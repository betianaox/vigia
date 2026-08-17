import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { reduce, undo } from '../engine';
import type {
  Box,
  MatchConfig,
  MatchEvent,
  PlayerId,
  Position,
  Shot,
  Side,
  Stroke,
  TeamId,
} from '../engine';
import { L } from '../i18n';
import { DEFAULT_PREFS, loadPrefs, type ShotPrompt } from '../store/store';
/**
 * DOS TEXTOS EN EL MISMO ARCHIVO, Y LA DIFERENCIA ES DELIBERADA.
 *
 * La CANCHA usa `FixedText`: no obedece la letra del sistema (el porque, entero, en `FixedText`).
 * Es una pantalla sin scroll, de botones que se reconocen por color y posicion, donde agrandar la
 * letra no agranda nada — corta "FAULT" en "FAU…", que no se lee mejor: no se lee.
 *
 * La HOJA DE GOLPES usa el `Text` de siempre, y SI escala. Es la unica parte de esta pantalla con
 * palabras de verdad ("Salida de pared", "Chiquita"), es un modal que puede crecer, y se probo con
 * la letra del sistema al maximo sin un solo corte. Ahi la escala del sistema ayuda de verdad, asi
 * que ahi se respeta.
 */
import { FixedText } from './FixedText';
import { CHAR, fitWidth, TOUCH_MIN } from './layout';
import { useMetrics, type Metrics } from './metrics';
import { usePulse } from './pulse';
import { useRoster } from './roster';
import { Scoreboard } from './Scoreboard';
import {
  sideLabels,
  strokeLabels,
  STROKES_CON_LADO,
  STROKES_DEFENSIVOS_CON_LADO,
  STROKES_OFENSIVOS_CON_LADO,
  STROKES_POR_ALTO,
  STROKES_SIN_LADO,
} from './shots';
import { useColors } from './theme-context';
import { alpha, pressed, radius, ripple, space, teamColor, type Colors } from './theme';

type RallyAction = 'WINNER' | 'ERROR_FORZADO' | 'ERROR_NO_FORZADO';

/**
 * EL NOMBRE AL MEDIO Y LAS DOS TECLAS A LOS COSTADOS: el reves a la izquierda, la derecha a la
 * derecha. La fila espeja el cuerpo de una jugadora diestra, que es la mayoria.
 *
 * No es una lista, es un MAPA. El pulgar va al lado en que se pego, sin leer — y leer es
 * exactamente lo que no hay tiempo de hacer entre dos puntos. Es ademas el mismo idioma que ya
 * hablan las estadisticas: la etiqueta al medio, y lo de cada lado hacia su lado.
 *
 * Se elige una vez y vale para siempre: tocar la tecla equivocada no es un error de dibujo, es
 * cargar el golpe al lado que no fue.
 */
const LEFT: Side = 'reves';
const RIGHT: Side = 'drive';

/**
 * EL ANCLA. Las teclas de la salida de pared van solidas, como el remate y la bandeja.
 *
 * No es que el golpe importe mas: es que una lista de cinco filas identicas obliga a leerlas
 * todas. Con una fila distinta en el medio, el ojo aterriza ahi y cuenta desde ahi —una arriba,
 * dos abajo— y encuentra sin leer. Es el punto en relieve de la F y la J del teclado: no dice
 * nada, orienta.
 *
 * Sirve recien cuando la persona se acostumbro. Al principio no molesta; despues, ahorra el
 * unico recurso que no sobra entre dos puntos, que es la vista.
 */
const ANCHOR: Stroke = 'globo';

/**
 * La otra ancla, abajo. Con una sola, la hoja quedaba desbalanceada hacia el medio.
 *
 * Es LA DEJADA, no la recuperacion: la recuperacion casi no pasa en un partido amateur, y
 * encima la palabra es la mas larga de la hoja — encendida, se lleva la vista sin merecerla. La
 * dejada, ademas, cae a la izquierda, en la misma columna que el remate y la bandeja.
 */
const ANCHOR_BAJO: Stroke = 'dejada';

/**
 * Semaforo, desde la perspectiva del jugador de la tarjeta.
 * La inicial manda (es lo que se busca de un vistazo) y la descripcion chica debajo
 * hace que se entienda solo, sin tener que explicarle nada a nadie.
 *
 * La descripcion NO repite la palabra "error": ya la dice la inicial de arriba, y con ella
 * "Error no forzado" no entraba en dos lineas — se cortaba en "no for...". Dice lo mismo
 * en la mitad de ancho.
 */
const rally = (
  c: Colors,
): Array<{ type: RallyAction; label: string; desc: string; color: string }> => [
  { type: 'WINNER', label: L.court.winnerShort, desc: L.court.winner, color: c.winner },
  {
    type: 'ERROR_FORZADO',
    label: L.court.forcedShort,
    desc: L.court.forced,
    color: c.errorForced,
  },
  {
    type: 'ERROR_NO_FORZADO',
    label: L.court.unforcedShort,
    desc: L.court.unforced,
    color: c.errorUnforced,
  },
];

/** Nombre y apellido -> "AR". Un solo nombre -> las dos primeras letras, para no colisionar. */
const initials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : words[0]!.slice(0, 2);
  return raw.slice(0, 2).toUpperCase();
};

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const thud = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/**
 * La cancha ya NO es dueña del log de eventos: lo recibe y avisa cuando cambia.
 *
 * El dueño es App, que lo persiste en cada evento. Asi el partido no depende de que esta
 * pantalla siga viva: si Android mata la app en el entretiempo, el log ya esta en disco.
 */
export function MatchScreen({
  config,
  events,
  onEvents,
  onHome,
  onStats,
}: {
  config: MatchConfig;
  events: MatchEvent[];
  onEvents: (next: MatchEvent[]) => void;
  /** Salir. Siempre queda guardado y se puede retomar desde el inicio. */
  onHome?: () => void;
  /**
   * Ver las estadisticas. La cancha NO las abre: avisa que las quieren ver, y App decide.
   * Cuando una pantalla se dibuja a si misma adentro de otra, nadie sabe donde esta parado —
   * ni siquiera el boton "atras" de Android.
   */
  onStats?: () => void;
}) {
  useKeepAwake();

  const m = useMetrics();
  const { nameOf } = useRoster();
  const c = useColors();
  const s = useMemo(() => makeStyles(m, c), [m, c]);

  const [shotFor, setShotFor] = useState<number | null>(null);
  const [rotated, setRotated] = useState(false);

  /**
   * Como quiere cargar los golpes esta persona. Se lee del disco al entrar a la cancha, no se
   * pasa por props: es una preferencia de quien anota, no una regla del partido — un mismo
   * partido lo puede seguir anotando otro, con otra mano y otra costumbre.
   */
  const [shotPrompt, setShotPrompt] = useState<ShotPrompt>(DEFAULT_PREFS.shotPrompt);
  useEffect(() => {
    void loadPrefs().then((p) => setShotPrompt(p.shotPrompt));
  }, []);

  const state = useMemo(() => reduce(config, events), [config, events]);

  /**
   * La hora la pone la UI, NUNCA el motor: `reduce` tiene que seguir siendo una funcion pura
   * del log. De este campo salen la fecha del partido, su duracion, la de cada set, la de
   * cada game y el ritmo de juego. Cero taps de mas.
   */
  const push = (e: MatchEvent) => onEvents([...events, { ...e, t: Date.now() }]);

  /**
   * Toque corto. QUE PASA DESPUES LO DECIDE LA PERSONA, no la app (§ Registro de golpe).
   *
   * - `siempre` (el default): el punto se registra Y se abre la hoja. El golpe deja de estar
   *   detras de un gesto invisible: aparece solo, en el primer punto, sin que nadie lo explique.
   * - `opcional`: el punto se registra y listo. Es el camino rapido, para el que ya sabe que el
   *   golpe se carga sosteniendo — o para el que no lo quiere cargar.
   *
   * En los dos casos el PUNTO YA QUEDO REGISTRADO antes de que la hoja aparezca: no se pierde un
   * punto por venir aca, y salir sin elegir nada no cuesta nada.
   */
  const registerPoint = (type: RallyAction, player: PlayerId) => {
    thud();
    if (shotPrompt === 'siempre') setShotFor(events.length);
    push({ type, player });
  };

  /**
   * Sostener: registra el punto IGUAL, y ademas abre la hoja. Funciona en los dos modos —
   * nunca se pierde un punto por intentar el gesto largo y que salga mal.
   */
  const registerPointWithShot = (type: RallyAction, player: PlayerId) => {
    thud();
    setShotFor(events.length);
    push({ type, player });
  };

  const setShot = (shot: Shot) => {
    if (shotFor === null) return;
    tick();
    onEvents(events.map((e, i) => (i === shotFor && 'player' in e ? { ...e, shot } : e)));
    setShotFor(null);
  };

  /**
   * El boton dedicado del que resta: "fallo la devolucion". YA NO PREGUNTA NADA — antes se
   * elegia forzado o no forzado y, si era forzado, con que golpe y quien lo forzo. Pero una
   * falla de recepcion SIEMPRE es forzada (nadie devuelve mal un saque por decision propia) y
   * el que la fuerza SIEMPRE es el que esta sacando, con el golpe que es siempre el mismo: el
   * saque. No hay nada que preguntar porque no hay nada que decidir; por eso este boton no abre
   * la hoja, a diferencia de cualquier otro error de la cancha.
   *
   * `onReturn` es lo que separa este error de cualquier otro en las estadisticas (ver
   * `computeStats`): sin la marca, es indistinguible de un error a mitad de un peloteo largo.
   */
  const registerReturnFail = (player: PlayerId) => {
    thud();
    push({
      type: 'ERROR_FORZADO',
      player,
      onReturn: true,
      forcedBy: state.server,
      forcedByShot: { stroke: 'saque' },
    });
  };

  /**
   * LOS TRES DATOS DEL ERROR FORZADO, DE UNA SOLA VEZ: quien lo forzo, con que, y con que
   * respondio el que lo sufrio. Se escriben juntos y no en pasos que se van guardando —el
   * bloque de tres pantallas de `ShotSheet` los junta antes de llamar aca— porque un estado a
   * medias (se sabe quien forzo pero no el resto) es un caso que despues hay que resolver
   * igual, y closing en cualquiera de los tres pasos cancela los tres (ver el bloque de la
   * hoja): no tiene sentido guardar dos de tres.
   */
  const completeForcedError = (forcedBy: PlayerId, forcedByShot: Shot, shot: Shot) => {
    tick();
    onEvents(
      events.map((e, i) =>
        i === shotFor && e.type === 'ERROR_FORZADO' ? { ...e, forcedBy, forcedByShot, shot } : e,
      ),
    );
    setShotFor(null);
  };

  /**
   * De que punto habla la hoja. El punto YA se registro con el long press: sin esto, la
   * hoja pregunta "¿con que golpe?" sin decir de quien ni de que, y con un segundo de
   * distraccion no sabes a que le estas poniendo el golpe.
   */
  const pendingEvent = shotFor === null ? undefined : events[shotFor];
  const pending =
    pendingEvent && 'player' in pendingEvent
      ? {
          action: pendingEvent.type as RallyAction,
          name: nameOf(pendingEvent.player, config.players[pendingEvent.player]?.name),
          team: (config.teams.A.drive === pendingEvent.player ||
          config.teams.A.reves === pendingEvent.player
            ? 'A'
            : 'B') as TeamId,
          /** Solo tiene sentido en ERROR_FORZADO: si ya se sabe quien lo forzo. */
          forcedBy: pendingEvent.type === 'ERROR_FORZADO' ? pendingEvent.forcedBy : undefined,
        }
      : null;

  /** Los dos del equipo QUE NO COMETIO el error: candidatos a haberlo forzado. */
  const opponentsOf = (team: TeamId): Array<{ id: PlayerId; position: Position; name: string }> => {
    const rival = team === 'A' ? 'B' : 'A';
    const t = config.teams[rival];
    /**
     * EL REVES A LA IZQUIERDA Y EL DRIVE A LA DERECHA. Es el mismo orden que la hoja de golpes
     * (REVES | DERECHA), que a su vez espeja el cuerpo de una jugadora diestra. No es una
     * preferencia de esta pantalla: es UNA CONVENCION DE LA APP, y una convencion solo rinde
     * si no tiene excepciones — la primera vez que se invierte, deja de poder incorporarse y
     * hay que volver a leer cada vez.
     */
    return [
      { id: t.reves, position: 'reves', name: nameOf(t.reves, config.players[t.reves]?.name) },
      { id: t.drive, position: 'drive', name: nameOf(t.drive, config.players[t.drive]?.name) },
    ];
  };

  // Giro de 180 grados de la cancha: los equipos cambian de fila.
  const mirrored = state.endsSwapped !== rotated;
  const teamsInOrder: TeamId[] = mirrored ? ['B', 'A'] : ['A', 'B'];

  /**
   * Los dos equipos se miran de frente, asi que el drive de cada uno cae de un lado
   * distinto de la PANTALLA: el de arriba nos mira, y su derecha nos queda a la izquierda.
   * De ahi que el reves quede cruzado en diagonal con el reves, y el drive con el drive.
   *
   * Por eso el orden no es una propiedad del equipo sino de la FILA — y con eso el giro de
   * 180 grados sale solo: al cambiar de fila, el equipo se da vuelta tambien en horizontal,
   * que es exactamente lo que hace una rotacion de verdad.
   *
   * Se dibuja con `layout` —donde esta parado cada uno EN ESTE PUNTO— y no con `positions`,
   * que es el rol. Casi siempre son lo mismo. Se separan en un caso: el equipo que saca con
   * formacion "cambiando de lado", donde el sacador se queda del lado desde el que saco y la
   * pareja intercambia lugar EN CADA PUNTO, porque el cuadro alterna.
   *
   * Que las tarjetas se muevan no es un capricho: es lo que esta pasando en la cancha, y el
   * layout tiene que espejar lo que el observador esta mirando o le va a errar al jugador.
   */
  const playersOf = (t: TeamId, row: number): PlayerId[] => {
    const { drive, reves } = state.layout[t];
    return row === 0 ? [drive, reves] : [reves, drive];
  };

  /**
   * Salir NO PREGUNTA NADA. El partido se guarda en cada evento, asi que dejarlo a medias y
   * volver despues es un caso normal — no hay ninguna decision que tomar, y un dialogo que
   * pregunta sobre algo que ya esta resuelto solo miente sobre que hay algo en juego.
   *
   * Terminar un partido se hace en UN solo lugar: la tarjeta del inicio. Dos caminos para lo
   * mismo es como no tener ninguno.
   */
  const goHome = () => {
    tick();
    onHome?.();
  };

  /** El reglamento permite las dos cosas al empezar un set. El motor decide cuando es legal. */
  const swapPositions = (team: TeamId) => {
    thud();
    push({ type: 'CAMBIO_POSICION', team });
  };
  const swapServer = (team: TeamId) => {
    thud();
    const [first, second] = state.serveOrder[team];
    push({ type: 'ORDEN_SAQUE', team, order: [second, first] });
  };

  return (
    <SafeAreaView style={s.root}>
      <Scoreboard config={config} state={state} />

      {state.isGoldenPoint && (
        <View style={s.goldenBar}>
          <FixedText style={s.goldenText}>
            {state.awaitingBoxChoice ? L.court.goldenPointChoose : L.court.goldenPoint}
          </FixedText>
          {state.awaitingBoxChoice && (
            <View style={s.row}>
              {(['derecha', 'izquierda'] as Box[]).map((b) => (
                <Pressable
                  key={b}
                  style={({ pressed: p }) => [s.goldenBtn, p && s.pressed]}
                  android_ripple={ripple}
                  onPress={() => {
                    tick();
                    push({ type: 'ELECCION_CUADRO', box: b });
                  }}
                >
                  <FixedText style={s.goldenBtnText}>
                    {b === 'derecha' ? L.court.boxRight : L.court.boxLeft}
                  </FixedText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={s.court}>
        {teamsInOrder.map((t, row) => (
          <View key={t} style={s.teamRow}>
            {playersOf(t, row).map((p) => (
              <PlayerCard
                key={p}
                name={nameOf(p, config.players[p]?.name)}
                team={t}
                position={state.positions[t].drive === p ? 'drive' : 'reves'}
                serving={state.server === p}
                receiving={state.receiver === p}
                serveState={state.serveState}
                canSwapServer={state.canSwapServer && state.server === p}
                onSwapServer={() => swapServer(t)}
                s={s}
                m={m}
                onRally={(type) => registerPoint(type, p)}
                onRallyLong={(type) => registerPointWithShot(type, p)}
                onFalta={() => {
                  thud();
                  push({ type: 'FALTA' });
                }}
                onAce={() => {
                  thud();
                  push({ type: 'ACE' });
                }}
                onLet={() => {
                  tick();
                  push({ type: 'LET' });
                }}
                onReturnFail={() => registerReturnFail(p)}
              />
            ))}

            {/* Dar vuelta la pareja: el ⇄ vive EN EL HUECO entre las dos tarjetas, porque es
                lo que hace — las intercambia. Al tocarlo, las tarjetas se dan vuelta ante tus
                ojos. No hay nada que explicar: ves lo que hiciste.

                Solo aparece cuando el reglamento lo permite (antes del primer punto del set)
                y se va apenas empieza el juego. El resto del partido la cancha se ve limpia. */}
            {state.canSwapPositions && (
              <Pressable
                style={({ pressed: p }) => [s.swapPos, p && s.pressed]}
                android_ripple={{ ...ripple, borderless: true }}
                onPress={() => swapPositions(t)}
                hitSlop={10}
              >
                <MaterialIcons name="swap-horiz" size={m.sheet.closeIcon} color={c.text} />
              </Pressable>
            )}
          </View>
        ))}

        {/* Se termino el partido.

            Cubre SOLO la cancha, a proposito: el tanteador de arriba queda a la vista (ahi
            esta el resultado, no hace falta repetirlo) y la barra de abajo tambien — o sea
            que DESHACER sigue al alcance. Si el ultimo punto se cargo mal y el partido
            "termino" por error, se arregla. Con una capa a pantalla completa quedabas
            encerrado. */}
        {state.finished && (
          <View style={s.finished}>
            {/* La copita en vez de la palabra "ganaron": una palabra menos para traducir, y
                nada nuevo que entender. Va grande y sola: es el momento del partido, no una
                viñeta al costado de un nombre. */}
            <MaterialIcons
              name="emoji-events"
              size={Math.round(m.card.avatarMax * 0.65)}
              color={c.trophy}
            />

            <FixedText style={s.finishedTitle}>{L.court.finished}</FixedText>

            <FixedText
              style={[s.finishedWinners, { color: teamColor(state.winner!, c) }]}
              numberOfLines={1}
            >
              {[config.teams[state.winner!].drive, config.teams[state.winner!].reves]
                .map((p) => nameOf(p, config.players[p]?.name))
                .join(' / ')}
            </FixedText>

            <View style={s.finishedRow}>
              {/* Deshabilitado hasta que exista la pantalla de inicio: un boton que parece
                  andar y no hace nada te hace pensar que la app esta rota. Se enciende solo
                  cuando llegue el inicio. */}
              <Pressable
                style={({ pressed: p }) => [
                  s.finishedBtn,
                  !onHome && s.utilBtnOff,
                  p && s.pressed,
                ]}
                android_ripple={ripple}
                onPress={goHome}
                disabled={!onHome}
              >
                <MaterialIcons name="home" size={m.card.avatarMax * 0.55} color={c.text} />
                <FixedText style={s.finishedBtnText}>{L.court.home}</FixedText>
              </Pressable>

              <Pressable
                style={({ pressed: p }) => [s.finishedBtn, p && s.pressed]}
                android_ripple={ripple}
                onPress={() => {
                  tick();
                  onStats?.();
                }}
              >
                <MaterialIcons
                  name="bar-chart"
                  size={m.card.avatarMax * 0.55}
                  color={c.text}
                />
                <FixedText style={s.finishedBtnText}>{L.court.stats}</FixedText>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Deshacer se lleva el doble de espacio: se usa todo el tiempo y bajo presion.
          Rotar y las estadisticas se tocan poco y con calma. */}
      <View style={s.bottom}>
        <Pressable
          style={({ pressed: p }) => [
            s.utilBtn,
            s.utilBtnWide,
            events.length === 0 && s.utilBtnOff,
            p && s.pressed,
          ]}
          android_ripple={ripple}
          onPress={() => {
            tick();
            onEvents(undo(events));
          }}
          disabled={events.length === 0}
        >
          <MaterialIcons name="undo" size={m.bottom.icon} color={c.text} />
          <FixedText style={s.utilText}>{L.court.undo}</FixedText>
        </Pressable>
        {/* Solo icono: la etiqueta no explicaba nada (¿"dar vuelta" que?) y ocupaba lugar.
            Da vuelta la vista 180 grados para que coincida con lo que ve el que mira. */}
        <Pressable
          style={({ pressed: p }) => [s.utilBtn, s.utilBtnIcon, p && s.pressed]}
          android_ripple={ripple}
          onPress={() => {
            tick();
            setRotated((r) => !r);
          }}
        >
          <MaterialIcons name="swap-vert" size={m.bottom.icon} color={c.text} />
        </Pressable>
        <Pressable
          style={({ pressed: p }) => [s.utilBtn, s.utilBtnIcon, p && s.pressed]}
          android_ripple={ripple}
          onPress={() => {
            tick();
            onStats?.();
          }}
        >
          <MaterialIcons name="bar-chart" size={m.bottom.icon} color={c.text} />
        </Pressable>

        {/* Volver al inicio. Va ULTIMO, lo mas lejos posible de Deshacer: es la unica accion
            destructiva de la pantalla y no puede estar al lado de la que mas se toca.
            Deshabilitado hasta que exista la pantalla de inicio. */}
        <Pressable
          style={({ pressed: p }) => [
            s.utilBtn,
            s.utilBtnIcon,
            !onHome && s.utilBtnOff,
            p && s.pressed,
          ]}
          android_ripple={ripple}
          onPress={goHome}
          disabled={!onHome}
        >
          <MaterialIcons name="home" size={m.bottom.icon} color={c.text} />
        </Pressable>
      </View>

      {pending && (
        <ShotSheet
          action={pending.action}
          playerName={pending.name}
          team={pending.team}
          s={s}
          m={m}
          onPick={setShot}
          onSkip={() => setShotFor(null)}
          forcing={
            pending.action === 'ERROR_FORZADO' && pending.forcedBy === undefined
              ? {
                  opponents: opponentsOf(pending.team),
                  onComplete: completeForcedError,
                }
              : undefined
          }
        />
      )}

    </SafeAreaView>
  );
}

function PlayerCard(props: {
  name: string;
  team: TeamId;
  position: Position;
  serving: boolean;
  receiving: boolean;
  serveState: 'PRIMERO' | 'SEGUNDO';
  /** El reglamento permite cambiar el orden de saque al empezar el set. El motor dice cuando. */
  canSwapServer: boolean;
  onSwapServer: () => void;
  s: ReturnType<typeof makeStyles>;
  m: Metrics;
  onRally: (t: RallyAction) => void;
  onRallyLong: (t: RallyAction) => void;
  onFalta: () => void;
  onAce: () => void;
  onLet: () => void;
  onReturnFail: () => void;
}) {
  const { s, m } = props;
  const c = useColors();
  /** El color del EQUIPO de esta tarjeta. No confundir con `c`, que es el tema. */
  const teamC = teamColor(props.team, c);
  const second = props.serveState === 'SEGUNDO';

  /** Al pasar a 2do saque —o sea, cuando la falta entro— la pildora destella. */
  const [faltaAt, setFaltaAt] = useState(0);
  useEffect(() => {
    if (second) setFaltaAt(Date.now());
  }, [second]);
  const faltaPulse = usePulse(faltaAt);

  // Mismo tamano los tres, los distingue el color. Pero la falta va SOLIDA: es la mas
  // frecuente y la que menos tiempo tiene (cae entre los dos saques). El ace, en cambio,
  // en padel es raro: no merece resaltar.
  const serveBtn = (label: string, color: string, onPress: () => void, solid = false) => (
    <Pressable
      style={({ pressed: p }) => [
        s.serveBtn,
        solid
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.55) },
        p && s.pressed,
      ]}
      android_ripple={ripple}
      onPress={onPress}
    >
      <FixedText style={[s.serveText, { color: solid ? c.onLight : color }]} numberOfLines={1}>
        {label}
      </FixedText>
    </Pressable>
  );

  /**
   * El fallo de devolucion. Mismo alto y misma caja que un boton de saque, pero con las DOS
   * lineas del semaforo: el titulo dice que fue una falla y la descripcion si fue forzada o
   * no. Lo que cambia entre los dos botones es solo la segunda linea — y el color, y la
   * columna en la que caen.
   */
  const returnBtn = (color: string, desc: string, onPress: () => void) => (
    <Pressable
      style={({ pressed: p }) => [
        s.serveBtn,
        { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.55) },
        p && s.pressed,
      ]}
      android_ripple={ripple}
      onPress={onPress}
    >
      <FixedText style={[s.returnTitle, { color }]} numberOfLines={1}>
        {L.court.returnFail}
      </FixedText>
      {/* Una linea y si no entra se corta, igual que la del semaforo: se elige por el titulo
          y por la columna, la descripcion solo confirma. */}
      <FixedText style={[s.rallyDesc, { color: alpha(color, 0.8) }]} numberOfLines={1}>
        {desc}
      </FixedText>
    </Pressable>
  );

  return (
    <View style={[s.card, props.serving && s.cardServing]}>
      {/* Las acciones de saque solo existen para el que saca. Que la tarjeta sea
          distinta hace imposible no ver quien esta sacando. El que no saca reserva el
          mismo alto igual: las cuatro tarjetas tienen que alinear entre si. */}
      {props.serving ? (
        <View style={s.row}>
          {/* En 2do saque dice DOBLE, no "doble falta": una sola palabra, una sola linea,
              y la pildora de abajo ya dice 2DO SAQUE. */}
          {serveBtn(second ? L.court.double : L.court.fault, c.falta, props.onFalta, true)}
          {serveBtn(L.court.ace, c.ace, props.onAce)}
          {serveBtn(L.court.let, c.let, props.onLet)}
        </View>
      ) : props.receiving ? (
        /* EL FALLO DE DEVOLUCION: un solo boton, alineado a la izquierda (dos slots vacios lo
           siguen para que ocupe un tercio, no la fila entera, e igual de alto que sus pares).
           Antes eran dos botones —EF y ENF— y antes de eso todavia el que forzo y el golpe se
           preguntaban en una hoja aparte. Los tres pasos se fueron: una falla de recepcion es
           siempre forzada (nadie devuelve mal un saque por gusto) y siempre la fuerza el que
           saca, con el saque. No hay eleccion que hacer, asi que no hay nada que ofrecer para
           elegir.

           LLEVA LA MISMA FORMA QUE EL SEMAFORO: titulo arriba, descripcion abajo. El titulo
           dice QUE paso (una falla) y la descripcion dice DE QUE FILA es ("Resto"), que es la
           unica informacion que la fila de abajo no repite. Se dice FALLA y no "resto" porque
           "resto forzado" se puede leer como un buen resto: hay que decir que es un ERROR. Y
           falla es la palabra que la app ya usa para esto en estadisticas ("Falla de
           recepcion"), asi que el boton y el numero se enseñan entre si.

           Va en el mismo amarillo que el EF de abajo, no en una variante apagada: es, ni mas
           ni menos, un error forzado — el mismo dato, solo que este ya viene con el forzador y
           el golpe resueltos de antemano. */
        <View style={s.row}>
          {returnBtn(c.errorForced, L.court.returnRow, props.onReturnFail)}
          <View style={s.returnSpacer} />
          <View style={s.returnSpacer} />
        </View>
      ) : (
        <View style={s.serveRowEmpty} />
      )}

      {/* Lo elastico de la tarjeta: se queda con el alto que sobre, sea el que sea. */}
      <View style={s.identity}>
        <View style={s.avatarRow}>
          {/* Un cuadrado que se resuelve solo: toma el alto disponible y saca el ancho de ahi.
              Nadie le dice cuanto mide — solo hasta donde puede crecer. */}
          <View style={[s.avatar, { backgroundColor: teamC }]}>
            <FixedText style={s.avatarText} numberOfLines={1} adjustsFontSizeToFit>
              {initials(props.name)}
            </FixedText>
          </View>

          {/* De que lado juega, como marca de agua. Va atada a la FILA DEL AVATAR, no a toda
              la banda de la identidad: asi queda siempre al costado del avatar y nunca a la
              altura del nombre, que con un nombre largo se le montaba encima. Es absoluta y
              no captura toques — informa sin mover ni tapar nada. */}
          <View style={s.sideMark} pointerEvents="none">
            <FixedText style={[s.sideMarkText, { color: alpha(teamC, 0.34) }]}>
              {props.position === 'drive' ? 'D' : 'R'}
            </FixedText>
          </View>
        </View>

        <FixedText style={s.cardName} numberOfLines={1}>
          {props.name}
        </FixedText>

        {props.serving ? (
          <View style={s.pillRow}>
            {/* El segundo saque se muestra invertido: es el estado peligroso, tiene que saltar.

                Y DESTELLA al pasar a segundo, con el mismo gesto con que el tanteador avisa un
                punto. La falta es el unico toque que NO mueve el marcador: sin esto, quien la
                carga mirando la cancha se queda sin saber si entro. El aviso va donde ocurrio el
                cambio — igual que el punto va al tanteador, la falta va al saque. */}
            <Animated.View
              style={[
                s.pill,
                second ? s.pillHot : s.pillCool,
                {
                  transform: [
                    { scale: faltaPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                  ],
                },
              ]}
            >
              <FixedText style={[s.pillText, second && { color: c.onLight }]}>
                {second ? L.court.secondServe : L.court.firstServe}
              </FixedText>
            </Animated.View>

            {/* "Saca el otro". Pegado a la pildora porque habla de eso: de quien saca. Solo
                aparece en el primer game de saque del equipo en el set, y se va apenas hay un
                evento — despues, dar vuelta el orden no arregla lo ya atribuido. */}
            {props.canSwapServer && (
              <Pressable
                style={({ pressed: p }) => [s.swapServe, p && s.pressed]}
                android_ripple={{ ...ripple, borderless: true }}
                onPress={props.onSwapServer}
                hitSlop={12}
              >
                <MaterialIcons
                  name="swap-horiz"
                  size={Math.round(m.card.pill * 1.3)}
                  color={c.textDim}
                />
              </Pressable>
            )}
          </View>
        ) : props.receiving ? (
          /**
           * LA MISMA PILDORA QUE "1ER SAQUE", con la misma voz. El que resta estaba dicho en gris
           * fantasma y no se veia — y el punto lo juegan dos, no uno: el resto es media cancha.
           *
           * Se probo marcarle el borde a la tarjeta y era demasiado: dos tarjetas con borde
           * compiten, y la del que saca es la que tiene que ganar. La pildora alcanza.
           */
          <View style={[s.pill, s.pillCool]}>
            <FixedText style={s.pillText}>{L.court.returning}</FixedText>
          </View>
        ) : (
          <View style={s.pillEmpty} />
        )}
      </View>

      <View style={s.row}>
        {rally(c).map((a) => (
          <Pressable
            key={a.type}
            style={({ pressed: p }) => [
              s.rallyBtn,
              { backgroundColor: alpha(a.color, 0.15), borderColor: alpha(a.color, 0.5) },
              p && s.pressed,
            ]}
            android_ripple={ripple}
            onPress={() => props.onRally(a.type)}
            onLongPress={() => props.onRallyLong(a.type)}
          >
            <FixedText style={[s.rallyText, { color: a.color }]} numberOfLines={1}>
              {a.label}
            </FixedText>
            {/* UNA SOLA LINEA, SIEMPRE, Y SI NO ENTRA SE CORTA. Esta decidido, no es un descuido.
                En un telefono de 360 dp aca entran unos seis caracteres, y las descripciones miden
                entre 8 y 11 ("Unforced", "No forzado"): entrarlas enteras costaba dos renglones o
                palabras inventadas mas cortas. No lo valen — el boton se elige por la INICIAL y
                por el color, que son enormes; la descripcion solo esta para entender que es un ENF
                la primera vez, y para eso "No forz…" alcanza.

                El alto de la caja es fijo por lo mismo: las tres iniciales tienen que quedar a la
                misma altura, que es lo que permite encontrar el boton sin mirar. */}
            <View style={s.descBox}>
              <FixedText
                style={[s.rallyDesc, { color: alpha(a.color, 0.8) }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {a.desc}
              </FixedText>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * La hoja de golpes. Se abre con el long press, cuando el punto YA quedo registrado: nunca
 * se pierde un punto por venir aca, y salir sin elegir nada no cuesta nada.
 *
 * Un solo tap elige golpe Y lado: el lado es una columna de la matriz, no un paso mas.
 * NO SCROLLEA PARA UN GOLPE SUELTO — las filas se achican hasta que todo entre (ver `sheet`
 * en layout.ts). El bloque de tres pasos del error forzado (`ForcingBlock`) es mas alto que
 * eso, y ESE SI scrollea (`sheetScroll`, mas abajo): es una red de seguridad para telefonos
 * chicos, no el camino esperado — se apunta a que entre entero sin tocarla.
 */
function ShotSheet(props: {
  action: RallyAction;
  playerName: string;
  team: TeamId;
  s: ReturnType<typeof makeStyles>;
  m: Metrics;
  onPick: (shot: Shot) => void;
  onSkip: () => void;
  /**
   * SOLO EN ERROR_FORZADO, Y SOLO HASTA QUE SE SEPA QUIEN LO FORZO.
   *
   * Mientras esto exista, la hoja no es la de siempre —un golpe, un toque— sino el bloque de
   * tres pasos de `ForcingBlock`: quien forzo, con que forzo, y con que respondio el que lo
   * sufrio. Una vez resuelto (`pending.forcedBy` deja de ser `undefined`, ver mas arriba), esta
   * prop deja de llegar y la hoja vuelve a ser la de siempre — la del golpe propio, sin ningun
   * cambio.
   */
  forcing?: {
    opponents: Array<{ id: PlayerId; position: Position; name: string }>;
    onComplete: (forcedBy: PlayerId, forcedByShot: Shot, shot: Shot) => void;
  };
}) {
  const { s, m } = props;
  const c = useColors();
  /** La misma inicial y el mismo color del boton que se acaba de tocar. */
  const action = rally(c).find((a) => a.type === props.action)!;

  /** Los nombres, leidos al dibujar: si cambia el idioma, cambia la hoja. */
  const strokes = strokeLabels();
  const sides = sideLabels();

  const pick = (shot: Shot) => {
    tick();
    props.onPick(shot);
  };

  /**
   * LA GRILLA DE GOLPES COMPLETA: winner y error no forzado, sin cambios. El error forzado ya
   * no la usa —tiene su propio bloque de tres pasos, `ForcingBlock`, con dos subconjuntos de
   * esta misma grilla (ofensivos y defensivos)— pero winner y ENF siguen preguntando por
   * cualquier golpe, dejada y recuperacion incluidas.
   */
  const grid = (onPickShot: (shot: Shot) => void) => (
    <>
      <View style={s.sheetRow}>
        {/* CUATRO BOTONES IGUALES. Antes dos eran "el golpe" y dos eran "variantes de la
            bandeja", y se dibujaban distinto —el base solido, la variante fantasma— para
            decir esa jerarquia. La jerarquia ya no existe: son cuatro golpes, se cuentan por
            separado, y por eso se ven iguales. */}
        {STROKES_POR_ALTO.map((stroke) => (
          <Pressable
            key={stroke}
            style={({ pressed: p }) => [s.sheetBase, p && s.pressed]}
            android_ripple={ripple}
            onPress={() => onPickShot({ stroke })}
          >
            <Text style={s.sheetBaseText} numberOfLines={1} adjustsFontSizeToFit>
              {strokes[stroke]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={s.keyHead}>
        <Text style={s.keyHeadText} numberOfLines={1} adjustsFontSizeToFit>
          {sides[LEFT].toUpperCase()}
        </Text>
        <View style={s.keyName} />
        <Text style={s.keyHeadText} numberOfLines={1} adjustsFontSizeToFit>
          {sides[RIGHT].toUpperCase()}
        </Text>
      </View>

      {STROKES_CON_LADO.map((stroke) => {
        const anchor = stroke === ANCHOR;
        return (
          <View key={stroke} style={s.keyRow}>
            <Pressable
              style={({ pressed: p }) => [s.key, anchor && s.keyAnchor, p && s.pressed]}
              android_ripple={ripple}
              onPress={() => onPickShot({ stroke, side: LEFT })}
            >
              <View style={[s.keyDot, anchor && s.keyDotAnchor]} />
            </Pressable>

            <Text style={s.keyName} numberOfLines={1}>
              {strokes[stroke]}
            </Text>

            <Pressable
              style={({ pressed: p }) => [s.key, anchor && s.keyAnchor, p && s.pressed]}
              android_ripple={ripple}
              onPress={() => onPickShot({ stroke, side: RIGHT })}
            >
              <View style={[s.keyDot, anchor && s.keyDotAnchor]} />
            </Pressable>
          </View>
        );
      })}

      <View style={[s.sheetRow, s.sheetRowApart]}>
        {STROKES_SIN_LADO.map((stroke) => {
          const anchor = stroke === ANCHOR_BAJO;
          return (
            <Pressable
              key={stroke}
              style={({ pressed: p }) => [s.sheetCell, anchor && s.keyAnchor, p && s.pressed]}
              android_ripple={ripple}
              onPress={() => onPickShot({ stroke })}
            >
              <Text style={[s.sheetCellName, anchor && s.sheetCellNameOn]} numberOfLines={1}>
                {strokes[stroke]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onSkip}>
      {/* El fondo es un HERMANO de la hoja, no su padre. Cuando era el padre, cualquier
          toque que caia en un hueco de la hoja burbujeaba y la cerraba: errarle a un boton
          por dos milimetros te costaba el golpe. */}
      <View style={s.sheetBg}>
        <Pressable style={s.sheetBackdrop} onPress={props.onSkip} />

        <View style={s.sheet}>
          {/* La X va a la derecha, del lado del pulgar. Igual no es el unico modo de salir:
              tocar el fondo (un objetivo enorme) y el boton de atras tambien cierran. En el
              bloque de tres pasos del error forzado, cierra los TRES —no hay paso a medias que
              guardar (ver `completeForcedError` en MatchScreen). */}
          <View style={s.sheetTop}>
            <Text style={s.sheetTitle} numberOfLines={1}>
              {/* Solo la inicial y el nombre: "W Ana Ruiz". Nada de "Winner de ...", que hay
                  que traducir y que con un nombre largo empuja al nombre fuera de la pantalla.
                  Los dos colores hacen el trabajo de las palabras que sacamos. En el error
                  forzado esta cabecera queda IGUAL —dice quien lo sufrio—: los tres pasos que
                  siguen abajo son los que van cambiando, no este titulo. */}
              <Text style={{ color: action.color }}>{action.label}</Text>{' '}
              <Text style={{ color: teamColor(props.team, c) }}>{props.playerName}</Text>
            </Text>
            {/* Blanca, no roja: cerrar sin elegir golpe no es destructivo ni es un error — el
                punto ya quedo registrado. Un rojo diria "cuidado", y aca no hay cuidado. */}
            <Pressable
              style={({ pressed: p }) => [s.sheetClose, p && s.pressed]}
              android_ripple={{ ...ripple, borderless: true }}
              onPress={props.onSkip}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={m.sheet.closeIcon} color={c.text} />
            </Pressable>
          </View>

          {/* `sheetScroll` tiene un techo (ver `makeStyles`): mientras el contenido entre —el
              caso de siempre, incluida esta misma hoja para winner/ENF— no se nota que es un
              ScrollView, se ve identica a una hoja fija. Solo cuando el bloque de tres pasos
              no entra (telefonos chicos) aparece el deslizamiento, como red de seguridad. */}
          <ScrollView
            style={s.sheetScroll}
            contentContainerStyle={s.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {props.forcing ? (
              <ForcingBlock
                s={s}
                m={m}
                erringTeam={props.team}
                erringName={props.playerName}
                opponents={props.forcing.opponents}
                onComplete={props.forcing.onComplete}
              />
            ) : (
              grid(pick)
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * LOS TRES PASOS DEL ERROR FORZADO, EN UNA SOLA VISTA. Antes eran dos pantallas que se
 * reemplazaban (quien forzo -> con que forzo); ahora son tres bloques apilados en la misma
 * hoja, LOS TRES COMPLETOS DESDE QUE SE ABRE — mismo look que la hoja de golpes de siempre,
 * nada aparece ni desaparece. Lo que cambia es cual RESPONDE al toque: el que todavia no
 * corresponde esta apagado y no reacciona (`pointerEvents="none"`), y eso solo, sin acomodar
 * ni ocultar nada, ya da la sensacion de wizard. Cerrar en cualquier punto (la X, o "No lo se"
 * del primer bloque) cancela los tres — no hay guardado parcial.
 *
 * LOS GOLPES DE CADA PASO SON DISTINTOS A PROPOSITO. El que fuerza estaba atacando: sus
 * opciones son los golpes de ataque (`STROKES_POR_ALTO` + los ofensivos con lado). El que
 * sufrio estaba defendiendo: las suyas son los golpes de defensa. Ninguno de los dos pasos
 * ofrece dejada ni recuperacion — no son ni ataque ni defensa clara, y esta pantalla solo
 * pregunta por las dos mitades que sí lo son.
 */
function ForcingBlock(props: {
  s: ReturnType<typeof makeStyles>;
  m: Metrics;
  /** El equipo de quien SUFRIO el forzado. Los candidatos a haberlo forzado son del rival. */
  erringTeam: TeamId;
  erringName: string;
  opponents: Array<{ id: PlayerId; position: Position; name: string }>;
  onComplete: (forcedBy: PlayerId, forcedByShot: Shot, shot: Shot) => void;
}) {
  const { s } = props;
  const c = useColors();
  const strokes = strokeLabels();
  const sides = sideLabels();
  const forcerTeam: TeamId = props.erringTeam === 'A' ? 'B' : 'A';

  const [who, setWho] = useState<{ id: PlayerId; name: string } | null>(null);
  const [forcedShot, setForcedShot] = useState<Shot | null>(null);

  const pickWho = (o: { id: PlayerId; name: string }) => {
    tick();
    setWho(o);
  };
  const pickForcedShot = (shot: Shot) => {
    tick();
    setForcedShot(shot);
  };
  const pickErredShot = (shot: Shot) => {
    if (!who || !forcedShot) return;
    tick();
    props.onComplete(who.id, forcedShot, shot);
  };

  /**
   * Cuatro botones iguales, sin lado: remate, bandeja, vibora, rulo. `selected` resalta el que
   * ya se eligio en ESTE bloque — se sigue mostrando entero, resaltado, aunque el bloque ya
   * este resuelto y desactivado (ver `pointerEvents` en cada bloque, mas abajo).
   */
  const porAltoRow = (onPickShot: (shot: Shot) => void, selected: Shot | null) => (
    <View style={s.sheetRow}>
      {STROKES_POR_ALTO.map((stroke) => (
        <Pressable
          key={stroke}
          style={({ pressed: p }) => [
            s.sheetBase,
            selected?.stroke === stroke && s.sheetBaseSelected,
            p && s.pressed,
          ]}
          android_ripple={ripple}
          onPress={() => onPickShot({ stroke })}
        >
          <Text style={s.sheetBaseText} numberOfLines={1} adjustsFontSizeToFit>
            {strokes[stroke]}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  /** El teclado D/R para un subconjunto de golpes con lado — la misma pieza que usa `grid`. */
  const sideKeys = (strokesArr: Stroke[], onPickShot: (shot: Shot) => void, selected: Shot | null) => (
    <>
      <View style={s.keyHead}>
        <Text style={s.keyHeadText} numberOfLines={1} adjustsFontSizeToFit>
          {sides[LEFT].toUpperCase()}
        </Text>
        <View style={s.keyName} />
        <Text style={s.keyHeadText} numberOfLines={1} adjustsFontSizeToFit>
          {sides[RIGHT].toUpperCase()}
        </Text>
      </View>
      {strokesArr.map((stroke) => {
        const anchor = stroke === ANCHOR;
        const selLeft = selected?.stroke === stroke && selected.side === LEFT;
        const selRight = selected?.stroke === stroke && selected.side === RIGHT;
        return (
          <View key={stroke} style={s.keyRow}>
            <Pressable
              style={({ pressed: p }) => [
                s.key,
                anchor && s.keyAnchor,
                selLeft && s.keySelected,
                p && s.pressed,
              ]}
              android_ripple={ripple}
              onPress={() => onPickShot({ stroke, side: LEFT })}
            >
              <View style={[s.keyDot, anchor && s.keyDotAnchor, selLeft && s.keyDotSelected]} />
            </Pressable>
            <Text style={s.keyName} numberOfLines={1}>
              {strokes[stroke]}
            </Text>
            <Pressable
              style={({ pressed: p }) => [
                s.key,
                anchor && s.keyAnchor,
                selRight && s.keySelected,
                p && s.pressed,
              ]}
              android_ripple={ripple}
              onPress={() => onPickShot({ stroke, side: RIGHT })}
            >
              <View style={[s.keyDot, anchor && s.keyDotAnchor, selRight && s.keyDotSelected]} />
            </Pressable>
          </View>
        );
      })}
    </>
  );

  return (
    <>
      {/* PASO 1: quien lo forzo. Los dos candidatos son la pareja QUE GANO el punto — la unica
          que pudo haberlo forzado. LOS TRES BLOQUES VAN COMPLETOS DESDE EL PRINCIPIO, con el
          mismo look de la hoja de golpes de siempre: lo que los distingue no es que aparezcan
          o desaparezcan, es que los que todavia no corresponden se ven apagados y no responden
          al toque (`pointerEvents="none"`, ver los bloques 2 y 3) — la sensacion de wizard sin
          dejar de parecerse a la hoja que ya se conoce. */}
      <View style={s.stepBlock}>
        <Text style={[s.stepTitle, !who && s.stepTitleActive]} numberOfLines={1}>
          {L.court.forcedByTitle}
        </Text>
        {/* Una vez elegido, el bloque se apaga solo (no hace falta `stepBlockOff`: ya eligio,
            no hace falta seguir invitando al toque) pero se sigue viendo entero, con el elegido
            resaltado — asi la respuesta queda a la vista mientras se contesta lo que sigue. */}
        <View style={s.forcingRow} pointerEvents={who ? 'none' : 'auto'}>
          {props.opponents.map((o) => (
            <Pressable
              key={o.id}
              style={({ pressed: p }) => [
                s.forcingPick,
                { borderColor: alpha(teamColor(forcerTeam, c), 0.5) },
                who?.id === o.id && s.forcingPickSelected,
                p && s.pressed,
              ]}
              android_ripple={ripple}
              onPress={() => pickWho(o)}
            >
              <Text style={[s.forcingPickText, { color: teamColor(forcerTeam, c) }]}>
                {o.position === 'drive' ? 'D' : 'R'}
              </Text>
              <Text style={s.forcingPickName} numberOfLines={1}>
                {o.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* La linea entre bloques: el unico separador de toda la hoja, porque es la unica hoja
          con mas de una pregunta. Marca donde termina un paso y empieza el siguiente sin
          agregar una palabra mas. */}
      <View style={[s.stepDivider, s.stepGap]} />

      {/* PASO 2: con que forzo. Apagado (opacidad) hasta que el paso 1 tenga respuesta; sin
          respuesta propia todavia, tampoco responde al toque. */}
      <View style={[s.stepBlock, !who && s.stepBlockOff]}>
        <Text style={[s.stepTitle, who && !forcedShot && s.stepTitleActive]} numberOfLines={1}>
          {L.court.forcedByShotTitle(who?.name ?? '…')}
        </Text>
        <View pointerEvents={who && !forcedShot ? 'auto' : 'none'}>
          {porAltoRow(pickForcedShot, forcedShot)}
          {sideKeys(STROKES_OFENSIVOS_CON_LADO, pickForcedShot, forcedShot)}
        </View>
      </View>

      <View style={[s.stepDivider, s.stepGap]} />

      {/* PASO 3: con que respondio el que lo sufrio. Apagado hasta que el paso 2 tenga
          respuesta. Elegir aca cierra los tres pasos de una: ver `pickErredShot`. */}
      <View style={[s.stepBlock, !forcedShot && s.stepBlockOff]}>
        <Text style={[s.stepTitle, forcedShot && s.stepTitleActive]} numberOfLines={1}>
          {L.court.erredByShotTitle(props.erringName)}
        </Text>
        <View pointerEvents={forcedShot ? 'auto' : 'none'}>
          {sideKeys(STROKES_DEFENSIVOS_CON_LADO, pickErredShot, null)}
        </View>
      </View>
    </>
  );
}

/**
 * El golpe de nombre mas largo ("Salida de pared"): es el que fija el tamano de fuente de toda la
 * hoja. Se mide en el IDIOMA QUE ESTA PUESTO —de ahi que sea una funcion— porque el mas largo no
 * es el mismo en los cuatro: en italiano la "uscita dalla parete" es bastante mas larga.
 */
const longestStroke = (): number =>
  Math.max(...STROKES_CON_LADO.map((st) => strokeLabels()[st].length));

/**
 * El mas largo de los que van en celda (dejada, recuperacion). Se mide APARTE del de arriba
 * porque vive en otro ancho: estos ocupan media hoja cada uno, los de arriba la columna del
 * medio del teclado. Medir los dos con la misma vara era el bug — ver `strokeFont`.
 */
const longestCellStroke = (): number =>
  Math.max(...STROKES_SIN_LADO.map((st) => strokeLabels()[st].length));

const makeStyles = (m: Metrics, c: Colors) => {
  const k = m.card;
  const h = m.sheet;

  /**
   * El contorno de los botones de la hoja: mas marcado que un borde de superficie, para que
   * cada boton se recorte contra el fondo — pero por debajo del contorno del golpe base, que es
   * el unico que tiene que destacarse.
   *
   * Vive ADENTRO de la fabrica: como constante de modulo leia el color una sola vez, al cargar
   * el archivo, y se quedaba con el del tema que estuviera puesto en ese momento.
   */
  const SHEET_BORDER = alpha(c.text, 0.2);
  /** El ⇄ que da vuelta la pareja: flota sobre el hueco entre las dos tarjetas. */
  const swapSize = Math.round(k.avatarMax * 0.62);

  // Dos botones por fila, a todo el ancho de la hoja.
  const cellW = (m.availW - h.pad * 2 - h.gap) / 2;
  const cellPad = Math.round(h.pad * 0.8);

  /**
   * La D y la R son lo que MANDA, y por eso van grandes y encendidas.
   *
   * Parece al reves —el golpe deberia ser lo importante— pero no lo es: dentro de una fila,
   * los dos botones dicen el mismo golpe. Lo unico que los distingue es el lado. Si esa letra
   * es lo mas chico y apagado de la pantalla, es exactamente el error que la pantalla te va a
   * hacer cometer: tocar "Volea D" creyendo que tocas "Volea R".
   */
  const sideFont = Math.round(h.label * 1.3);
  const sideW = sideFont;

  /**
   * El ancho de una tecla, con un piso: una tecla que no se acierta con el pulgar —apurado,
   * mirando la cancha— no es una tecla, es una trampa.
   *
   * Era un cuarto del ancho util, o sea que las dos teclas se llevaban LA MITAD DE LA HOJA
   * para dibujar dos puntos. Ese aire no era gratis: el nombre del golpe se quedaba con lo
   * que sobraba, y como los nueve comparten tamano y se miden contra el mas largo (ver
   * `strokeFont`), la etiqueta mas larga le bajaba la letra a TODAS las demas.
   *
   * Al quinto, la tecla sigue midiendo bastante mas que el piso tactil —lo que se achica es
   * el aire, no el objetivo— y lo que se recupera va a la unica parte de la fila que hay que
   * leer. Lo que hace facil apuntar aca es el ALTO de la fila, y ese no se toca.
   */
  const keyW = Math.max(TOUCH_MIN, Math.round((m.availW - h.pad * 2) * 0.2));

  /** La columna del medio del teclado: lo que sobra despues de las dos teclas y sus gaps. */
  const nameW = m.availW - h.pad * 2 - keyW * 2 - h.gap * 2;

  /**
   * El nombre del golpe queda en segundo plano: sirve para recorrer la lista con la vista de
   * arriba a abajo, no para elegir entre los dos botones de una fila.
   *
   * TODA LA HOJA COMPARTE UN TAMANO —si cada nombre se achicara por su cuenta, "Volea"
   * quedaria enorme al lado de "S. Pared defensiva"— pero cada uno se mide contra el ancho
   * DONDE VIVE, y esa es la parte que estaba mal.
   *
   * Antes se median todos contra `cellW`, que es media hoja: el ancho de las celdas de dejada
   * y recuperacion. O sea que se le exigia a "S. Pared defensiva" entrar en una celda donde
   * ese texto NO SE MUESTRA NUNCA — vive en la columna del medio del teclado, que es mas
   * ancha. La hoja entera quedaba chica por una restriccion inventada, y por eso ensanchar
   * esa columna (ver `keyW`) no movia la letra: nadie la estaba midiendo.
   *
   * Ahora son dos medidas y manda la menor. La fila de arriba (remate, bandeja, vibora,
   * gancho) no entra en la cuenta a proposito: se achica sola con `adjustsFontSizeToFit`.
   */
  const strokeFont = Math.max(
    12,
    Math.min(
      h.label,
      fitWidth(longestStroke(), nameW, CHAR.semiLower),
      fitWidth(longestCellStroke(), cellW - cellPad * 2 - sideW - h.gap, CHAR.semiLower),
    ),
  );
  /** La descripcion vive en una linea exacta, siempre. */
  const descLine = Math.round(k.rallyDesc * 1.35);

  /**
   * EL TECHO DEL SCROLL DE LA HOJA (`sheetScroll`): el alto util menos la barra del titulo y
   * el inset de abajo. Descontaba ademas el gap y el padding entero de la hoja, y quedaba
   * corto — sobraba fondo visible arriba de la hoja mientras las dos (la grilla de siempre y
   * el bloque de tres pasos) ya scrolleaban por un margen que no hacia falta. Un solo `h.pad`
   * (no dos) sigue reservando el aire de arriba de la hoja; el resto se lo queda el contenido.
   */
  const sheetScrollMax = Math.max(TOUCH_MIN * 3, m.avail - h.close - h.pad - m.insetBottom);

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    row: { flexDirection: 'row', gap: k.rowGap },

    /** El acuse de recibo del toque. Lo llevan TODOS los botones (ver theme.ts). */
    pressed,

    goldenBar: { backgroundColor: c.golden, padding: k.gap, gap: k.gap, alignItems: 'center' },
    goldenText: { color: '#3B2708', fontWeight: '900', letterSpacing: 1, fontSize: k.pillFont + 2 },
    goldenBtn: {
      backgroundColor: '#3B2708',
      minHeight: k.serve,
      justifyContent: 'center',
      paddingHorizontal: space.xl,
      borderRadius: radius.sm,
    },
    goldenBtnText: { color: c.golden, fontWeight: '800', fontSize: k.name },

    court: { flex: 1, gap: m.court.gap, padding: m.court.pad },
    teamRow: { flex: 1, flexDirection: 'row', gap: m.court.gap },

    card: {
      flex: 1,
      justifyContent: 'space-between',
      padding: k.pad,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      /** Red de seguridad: si algun dia el contenido no entra, que se recorte adentro de la
          tarjeta y no se le monte encima a la de abajo, como pasaba antes. */
      overflow: 'hidden',
    },
    cardServing: { borderColor: c.serve, borderWidth: 2, backgroundColor: c.surfaceAlt },

    // Los tres del saque son del mismo tamano; los distingue el color, no la jerarquia.
    serveRowEmpty: { height: k.serve },
    serveBtn: {
      flex: 1,
      height: k.serve,
      borderRadius: radius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: k.btnPadH,
    },
    serveText: { fontWeight: '900', fontSize: k.serveFont, letterSpacing: 0.5 },

    /** El titulo del fallo de devolucion: la voz del semaforo, en la caja del saque. */
    returnTitle: { fontWeight: '900', fontSize: k.serveFont, letterSpacing: 0.5, textAlign: 'center' },
    /** Los slots vacios a los lados del boton de falla de recepcion, para que ocupe un
        tercio y quede en la misma columna que el EF de la fila de abajo. */
    returnSpacer: { flex: 1 },

    identity: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: k.gap },

    /**
     * Le presta el marco a la marca de agua, y NO crece mas que el avatar: si creciera, el
     * aire que sobra en la tarjeta se metería entre el avatar y el nombre en vez de quedar
     * afuera del grupo, y la identidad se partiria al medio.
     */
    avatarRow: {
      flex: 1,
      maxHeight: k.avatarMax,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
    /**
     * Ocupa el alto del avatar y nada mas. Al ser absoluta no participa del layout: no puede
     * correr nada de lugar por mas grande que sea la letra.
     */
    sideMark: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    sideMarkText: { fontWeight: '900', fontSize: Math.round(k.avatarMax * 0.75) },

    avatar: {
      flex: 1,
      /** El circulo sale de aca: el alto lo pone flex (con el techo de avatarRow), el ancho
          lo copia del alto. Nadie le dice cuanto mide. */
      aspectRatio: 1,
      minHeight: 0,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** La inicial se encoge sola contra el circulo que le toco: no hay ningun numero que atar. */
    avatarText: { color: c.bg, fontWeight: '900', fontSize: Math.round(k.avatarMax * 0.42) },
    cardName: { color: c.text, fontWeight: '700', fontSize: k.name },

    /** La pildora y, si el reglamento lo permite, el ⇄ que dice "saca el otro". */
    pillRow: { flexDirection: 'row', alignItems: 'center', gap: k.rowGap },
    swapServe: {
      height: Math.round(k.pill * 1.5),
      width: Math.round(k.pill * 1.5),
      alignItems: 'center',
      justifyContent: 'center',
    },

    /**
     * El ⇄ que da vuelta la pareja. Va centrado en el HUECO entre las dos tarjetas: es
     * literalmente lo que hace. Absoluto, asi que no corre nada de lugar, y por encima de las
     * tarjetas para que no lo tapen.
     */
    swapPos: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: swapSize,
      height: swapSize,
      marginLeft: -swapSize / 2,
      marginTop: -swapSize / 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.textFaint,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
      elevation: 4,
    },

    pill: {
      height: k.pill,
      paddingHorizontal: k.gap,
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    pillEmpty: { height: k.pill },
    pillCool: { borderColor: alpha(c.serve, 0.5), backgroundColor: alpha(c.serve, 0.1) },
    pillHot: { borderColor: c.serve, backgroundColor: c.serve },
    pillText: { color: c.serve, fontSize: k.pillFont, fontWeight: '900', letterSpacing: 1 },

    rallyBtn: {
      flex: 1,
      height: k.rally,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: k.btnPadH,
    },
    rallyText: { fontWeight: '900', fontSize: k.rallyFont, textAlign: 'center' },
    descBox: { height: descLine, justifyContent: 'center', alignSelf: 'stretch' },
    rallyDesc: { fontWeight: '700', fontSize: k.rallyDesc, lineHeight: descLine, textAlign: 'center' },

    bottom: { flexDirection: 'row', gap: m.bottom.gap, padding: m.bottom.pad, backgroundColor: c.surface },
    utilBtn: {
      flex: 1,
      flexDirection: 'row',
      gap: m.bottom.gap,
      height: m.bottom.util,
      borderRadius: radius.md,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    utilBtnWide: { flex: 1 },
    /** Solo icono: no necesita crecer, y el ancho que sobra se lo lleva Deshacer. */
    utilBtnIcon: { flex: 0, width: m.bottom.util + m.bottom.gap * 2 },
    utilBtnOff: { opacity: 0.35 },
    utilText: { color: c.text, fontWeight: '800', fontSize: m.bottom.font },

    // ---- Hoja de golpes ----
    sheetBg: { flex: 1, justifyContent: 'flex-end' },
    /** Solo el fondo cierra. Va absoluto y aparte, para que la hoja no le pase los toques. */
    sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000B' },
    sheet: {
      backgroundColor: c.surface,
      padding: h.pad,
      /**
       * El Modal se ancla al borde FISICO: sin el inset, la ultima fila queda debajo de la barra
       * de navegacion del sistema.
       *
       * ERA `max(pad, insetBottom)` Y ESTABA MAL. La idea era que el aire de la barra ya contaba
       * como aire, pero con la barra de tres botones el inset le gana siempre al padding (46 dp
       * contra 12): la hoja se quedaba sin NADA propio y la ultima fila terminaba justo donde
       * arranca la barra, pegada. Una barra opaca no es aire — es una barra.
       *
       * Son dos cosas distintas y por eso se SUMAN: el inset es lo que hay que RESERVAR para no
       * quedar tapado, y el padding es el aire que la hoja quiere tener. Con gestos (inset chico)
       * la suma tampoco molesta, porque ahi el que manda es el padding.
       */
      paddingBottom: m.insetBottom + h.pad,
      gap: h.gap,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
    /** Ver `sheetScrollMax`: invisible mientras el contenido entre, red de seguridad si no. */
    sheetScroll: { maxHeight: sheetScrollMax },
    sheetScrollContent: { gap: h.gap },

    sheetTop: { flexDirection: 'row', alignItems: 'center', height: h.close },
    sheetClose: {
      width: h.close,
      height: h.close,
      alignItems: 'center',
      justifyContent: 'center',
      /** Que el icono quede alineado con el borde de la grilla, no el area tactil. */
      marginRight: -h.pad / 2,
    },
    sheetTitle: { flex: 1, color: c.textDim, fontSize: h.title, fontWeight: '800' },

    sheetRow: { flexDirection: 'row', gap: h.gap, height: h.row },
    /** Separa un bloque del anterior: el aire es lo unico que dice "esto es otra cosa". */
    sheetRowApart: { marginTop: h.gap },

    sheetCell: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: h.gap,
      paddingHorizontal: cellPad,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: SHEET_BORDER,
      backgroundColor: c.surfaceAlt,
    },
    /** Centrado, como el nombre del teclado: toda la hoja lee por el eje del medio. */
    sheetCellName: {
      flex: 1,
      textAlign: 'center',
      color: c.textDim,
      fontSize: strokeFont,
      fontWeight: '600',
    },
    sheetCellNameOn: { color: c.text },

    /**
     * EL TECLADO: el nombre a la izquierda, dos teclas a la derecha.
     *
     * La tecla es un objetivo entero (respeta el piso tactil de 44 dp), no un puntito: lo que se
     * achica es el RUIDO, no el boton. El punto que se dibuja adentro es solo la mira.
     */
    keyHead: { flexDirection: 'row', alignItems: 'center', gap: h.gap, height: h.row * 0.55 },
    keyHeadText: {
      width: keyW,
      textAlign: 'center',
      color: c.textFaint,
      fontSize: sideFont * 0.62,
      fontWeight: '900',
      letterSpacing: 1,
    },
    keyRow: { flexDirection: 'row', alignItems: 'center', gap: h.gap, height: h.row },
    /** Al medio y centrado: es el eje de la fila, y las dos teclas cuelgan de el. */
    keyName: {
      flex: 1,
      textAlign: 'center',
      color: c.text,
      fontSize: strokeFont,
      fontWeight: '700',
    },
    key: {
      width: keyW,
      height: '100%',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: SHEET_BORDER,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyDot: {
      width: Math.round(sideFont * 0.5),
      height: Math.round(sideFont * 0.5),
      borderRadius: radius.pill,
      backgroundColor: c.textDim,
    },
    /** El ancla: las mismas teclas, con el relleno del remate y la bandeja (ver `ANCHOR`). */
    keyAnchor: {
      backgroundColor: alpha(c.text, 0.14),
      borderColor: alpha(c.text, 0.45),
    },
    keyDotAnchor: { backgroundColor: c.text },
    /** El elegido en el bloque del error forzado (`ForcingBlock`): mismo trato que el ancla,
        pero en el color del error para que se distinga de "este golpe es facil de tocar" (el
        ancla) de "esto es lo que se toco" (esto). */
    keySelected: {
      backgroundColor: alpha(c.errorForced, 0.2),
      borderColor: c.errorForced,
    },
    keyDotSelected: { backgroundColor: c.errorForced },

    /**
     * El golpe base: solido y con contorno claro. Es el que se toca sin pensar, y el ojo
     * tiene que aterrizar ahi antes que en las variantes.
     *
     * Se probo darle el ancho exacto de una celda de la grilla, para que las dos filas de
     * abajo alinearan con las siete de arriba. No funciono: las variantes quedaban apretadas
     * en la mitad que sobraba y la fila se veia peor que con el escalon. El escalon se banca.
     */
    sheetBase: {
      /** Un poco mas que una variante, no el doble: los cuatro son teclas de la misma fila. */
      flex: 1.25,
      borderRadius: radius.sm,
      backgroundColor: alpha(c.text, 0.14),
      borderWidth: 1,
      borderColor: alpha(c.text, 0.45),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    /** Sin el espaciado de las mayusculas, que ya no lleva: se escribe como cualquier golpe. */
    /**
     * EL MISMO TAMAÑO QUE TODA LA HOJA. Lo que distingue al golpe base de una variante ya lo dice
     * el RELLENO —es el unico solido y en blanco— y con eso alcanza. Agrandarle ademas la letra es
     * decir dos veces lo mismo, y de paso rompe la fila: nueve nombres iguales y dos mas grandes se
     * leen como si fueran de otra cosa.
     */
    sheetBaseText: { color: c.text, fontSize: strokeFont, fontWeight: '700' },
    /** El elegido en el paso "con que forzo" de `ForcingBlock`. Mismo trato que `keySelected`. */
    sheetBaseSelected: {
      backgroundColor: alpha(c.errorForced, 0.2),
      borderColor: c.errorForced,
    },


    /**
     * Los dos candidatos a haber forzado el error. Antes eran EL UNICO CONTENIDO del primer
     * paso —una pantalla propia— y podian ser tan grandes como un boton de saque (`h.row`).
     * Ahora son el primero de TRES bloques que tienen que entrar juntos, asi que bajan a un
     * piso mas chico: siguen siendo mucho mas altos que `TOUCH_MIN` (se aciertan igual, sin
     * mirar) pero ya no le sacan a los otros dos bloques el aire que necesitan.
     */
    forcingRow: {
      height: Math.max(TOUCH_MIN, Math.round(h.row * 0.68)),
      flexDirection: 'row',
      gap: h.gap,
    },
    forcingPick: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: h.gap,
      paddingHorizontal: cellPad,
      borderRadius: radius.sm,
      borderWidth: 1,
      backgroundColor: c.surfaceAlt,
    },
    /** La letra manda —es como se los busca— pero en el cuerpo de la hoja, no en titular. */
    forcingPickText: { fontSize: strokeFont, fontWeight: '700' },
    forcingPickName: { color: c.text, fontSize: strokeFont, fontWeight: '600' },
    /** El candidato elegido en el paso "quien lo forzo". Mismo trato que `keySelected`. */
    forcingPickSelected: {
      backgroundColor: alpha(c.errorForced, 0.2),
      borderColor: c.errorForced,
    },

    /**
     * LOS TRES BLOQUES DEL ERROR FORZADO (`ForcingBlock`). `stepBlockOff` es el que todavia no
     * se puede contestar —el paso anterior sigue sin resolver—: se apaga con opacidad, no
     * desaparece, para que las tres preguntas se vean desde el principio y quede claro que
     * faltan dos mas. `stepTitleActive` marca CUAL de los tres es el que hay que contestar
     * ahora — es todo el "destacado" que pidio la consigna: un color mas fuerte, nada de
     * animaciones que compitan con la cancha de abajo.
     */
    /** Mas apretado que `h.gap`: son TRES bloques, no uno, y el titulo de cada uno ya separa
        visualmente sin necesitar tanto aire como el que la hoja de un solo paso se podia dar. */
    stepBlock: { gap: Math.round(h.gap * 0.5) },
    /** El aire arriba y abajo de `stepDivider` — reemplaza al `sheetRowApart` de siempre (que
        sigue usando el aire completo en la grilla de un solo paso) solo para este bloque. */
    stepGap: { marginVertical: Math.round(h.gap * 0.7) },
    /** La linea entre bloques. Es la UNICA hoja con mas de una pregunta, asi que es la unica
        que necesita decir "esto termino, esto otro empieza" sin palabras. */
    stepDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
    stepBlockOff: { opacity: 0.35 },
    /** Menos peso que `sheetTitle` (800) a proposito: son preguntas de un mismo bloque, no el
        titulo de la hoja, y con el mismo peso costaba distinguir uno de otro de un vistazo. */
    stepTitle: { color: c.textFaint, fontSize: h.title, fontWeight: '600' },
    stepTitleActive: { color: c.textDim },

    /**
     * Cubre la cancha y NADA MAS: el tanteador queda arriba (con el resultado) y la barra
     * de abajo queda accesible (con el Deshacer). Va adentro del View de la cancha, no de
     * la pantalla — de ahi que las cuatro coordenadas en cero alcancen.
     */
    finished: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: alpha(c.bg, 0.93),
      alignItems: 'center',
      justifyContent: 'center',
      gap: m.court.gap,
      padding: m.court.pad,
    },
    finishedTitle: { color: c.text, fontSize: h.title + 4, fontWeight: '900' },
    /** Quien gano NO es el resultado (ese esta arriba, en el tanteador): es el momento. */
    finishedWinners: { fontSize: h.label + 1, fontWeight: '800', textAlign: 'center' },

    finishedRow: {
      flexDirection: 'row',
      gap: m.court.gap,
      alignSelf: 'stretch',
      marginTop: m.court.gap,
    },
    finishedBtn: {
      flex: 1,
      paddingVertical: k.gap * 2,
      gap: k.gap,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    finishedBtnText: { color: c.text, fontSize: h.label, fontWeight: '800' },
  });
};
