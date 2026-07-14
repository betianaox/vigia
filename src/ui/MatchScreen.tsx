import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  TeamId,
} from '../engine';
import { DEFAULT_PREFS, loadPrefs, type ShotPrompt } from '../store/store';
import { CHAR, fitWidth, TOUCH_MIN } from './layout';
import { useMetrics, type Metrics } from './metrics';
import { usePulse } from './pulse';
import { useRoster } from './roster';
import { Scoreboard } from './Scoreboard';
import {
  SIDE_LABELS,
  STROKE_LABELS,
  STROKES_CON_LADO,
  STROKES_POR_ALTO,
  STROKES_SIN_LADO,
  VARIANT_LABELS,
} from './shots';
import { alpha, colors, pressed, radius, ripple, space, teamColor } from './theme';

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
 * Semaforo, desde la perspectiva del jugador de la tarjeta.
 * La inicial manda (es lo que se busca de un vistazo) y la descripcion chica debajo
 * hace que se entienda solo, sin tener que explicarle nada a nadie.
 *
 * La descripcion NO repite la palabra "error": ya la dice la inicial de arriba, y con ella
 * "Error no forzado" no entraba en dos lineas — se cortaba en "no for...". Dice lo mismo
 * en la mitad de ancho.
 */
const RALLY: Array<{ type: RallyAction; label: string; desc: string; color: string }> = [
  { type: 'WINNER', label: 'W', desc: 'Winner', color: colors.winner },
  { type: 'ERROR_FORZADO', label: 'EF', desc: 'Forzado', color: colors.errorForced },
  { type: 'ERROR_NO_FORZADO', label: 'ENF', desc: 'No forzado', color: colors.errorUnforced },
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
  const s = useMemo(() => makeStyles(m), [m]);

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
        }
      : null;

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
          <Text style={s.goldenText}>
            {state.awaitingBoxChoice ? 'PUNTO DE ORO — ELIGE EL QUE RESTA' : 'PUNTO DE ORO'}
          </Text>
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
                  <Text style={s.goldenBtnText}>{b === 'derecha' ? 'Derecha' : 'Izquierda'}</Text>
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
                <MaterialIcons name="swap-horiz" size={m.sheet.closeIcon} color={colors.text} />
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
              color={colors.trophy}
            />

            <Text style={s.finishedTitle}>Partido terminado</Text>

            <Text
              style={[s.finishedWinners, { color: teamColor(state.winner!) }]}
              numberOfLines={1}
            >
              {[config.teams[state.winner!].drive, config.teams[state.winner!].reves]
                .map((p) => nameOf(p, config.players[p]?.name))
                .join(' / ')}
            </Text>

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
                <MaterialIcons name="home" size={m.card.avatarMax * 0.55} color={colors.text} />
                <Text style={s.finishedBtnText}>Inicio</Text>
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
                  color={colors.text}
                />
                <Text style={s.finishedBtnText}>Stats</Text>
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
          <MaterialIcons name="undo" size={m.bottom.icon} color={colors.text} />
          <Text style={s.utilText}>Deshacer</Text>
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
          <MaterialIcons name="swap-vert" size={m.bottom.icon} color={colors.text} />
        </Pressable>
        <Pressable
          style={({ pressed: p }) => [s.utilBtn, s.utilBtnIcon, p && s.pressed]}
          android_ripple={ripple}
          onPress={() => {
            tick();
            onStats?.();
          }}
        >
          <MaterialIcons name="bar-chart" size={m.bottom.icon} color={colors.text} />
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
          <MaterialIcons name="home" size={m.bottom.icon} color={colors.text} />
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
}) {
  const { s, m } = props;
  const c = teamColor(props.team);
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
      <Text style={[s.serveText, { color: solid ? colors.onLight : color }]} numberOfLines={1}>
        {label}
      </Text>
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
          {serveBtn(second ? 'DOBLE' : 'FALTA', colors.falta, props.onFalta, true)}
          {serveBtn('ACE', colors.ace, props.onAce)}
          {serveBtn('LET', colors.let, props.onLet)}
        </View>
      ) : (
        <View style={s.serveRowEmpty} />
      )}

      {/* Lo elastico de la tarjeta: se queda con el alto que sobre, sea el que sea. */}
      <View style={s.identity}>
        <View style={s.avatarRow}>
          {/* Un cuadrado que se resuelve solo: toma el alto disponible y saca el ancho de ahi.
              Nadie le dice cuanto mide — solo hasta donde puede crecer. */}
          <View style={[s.avatar, { backgroundColor: c }]}>
            <Text style={s.avatarText} numberOfLines={1} adjustsFontSizeToFit>
              {initials(props.name)}
            </Text>
          </View>

          {/* De que lado juega, como marca de agua. Va atada a la FILA DEL AVATAR, no a toda
              la banda de la identidad: asi queda siempre al costado del avatar y nunca a la
              altura del nombre, que con un nombre largo se le montaba encima. Es absoluta y
              no captura toques — informa sin mover ni tapar nada. */}
          <View style={s.sideMark} pointerEvents="none">
            <Text style={[s.sideMarkText, { color: alpha(c, 0.34) }]}>
              {props.position === 'drive' ? 'D' : 'R'}
            </Text>
          </View>
        </View>

        <Text style={s.cardName} numberOfLines={1}>
          {props.name}
        </Text>

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
              <Text style={[s.pillText, second && { color: colors.onLight }]}>
                {second ? '2DO SAQUE' : '1ER SAQUE'}
              </Text>
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
                  color={colors.textDim}
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
            <Text style={s.pillText}>RESTA</Text>
          </View>
        ) : (
          <View style={s.pillEmpty} />
        )}
      </View>

      <View style={s.row}>
        {RALLY.map((a) => (
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
            <Text style={[s.rallyText, { color: a.color }]} numberOfLines={1}>
              {a.label}
            </Text>
            {/* Una sola linea, siempre, y si no entra se corta con puntos suspensivos. El
                alto de la caja es fijo por eso mismo: las tres iniciales tienen que quedar
                a la misma altura, que es lo que permite encontrar el boton de un vistazo. */}
            <View style={s.descBox}>
              <Text
                style={[s.rallyDesc, { color: alpha(a.color, 0.8) }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {a.desc}
              </Text>
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
 * Y no scrollea — las filas se achican hasta que todo entre (ver `sheet` en layout.ts).
 */
function ShotSheet(props: {
  action: RallyAction;
  playerName: string;
  team: TeamId;
  s: ReturnType<typeof makeStyles>;
  m: Metrics;
  onPick: (shot: Shot) => void;
  onSkip: () => void;
}) {
  const { s, m } = props;
  /** La misma inicial y el mismo color del boton que se acaba de tocar. */
  const action = RALLY.find((a) => a.type === props.action)!;

  const pick = (shot: Shot) => {
    tick();
    props.onPick(shot);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onSkip}>
      {/* El fondo es un HERMANO de la hoja, no su padre. Cuando era el padre, cualquier
          toque que caia en un hueco de la hoja burbujeaba y la cerraba: errarle a un boton
          por dos milimetros te costaba el golpe. */}
      <View style={s.sheetBg}>
        <Pressable style={s.sheetBackdrop} onPress={props.onSkip} />

        <View style={s.sheet}>
          {/* La X va a la derecha, del lado del pulgar. Igual no es el unico modo de salir:
              tocar el fondo (un objetivo enorme) y el boton de atras tambien cierran. */}
          <View style={s.sheetTop}>
            {/* Solo la inicial y el nombre: "W Ana Ruiz". Nada de "Winner de ...", que hay que
                traducir y que con un nombre largo empuja al nombre fuera de la pantalla.

                Los dos colores hacen el trabajo de las palabras que sacamos: la inicial va
                del color de la accion (el mismo boton que se acaba de tocar) y el nombre del
                color del equipo, igual que en la cancha y en el tanteador. */}
            <Text style={s.sheetTitle} numberOfLines={1}>
              <Text style={{ color: action.color }}>{action.label}</Text>{' '}
              <Text style={{ color: teamColor(props.team) }}>{props.playerName}</Text>
            </Text>
            {/* Blanca, no roja: cerrar sin elegir golpe no es destructivo ni es un error — el
                punto ya quedo registrado. Un rojo diria "cuidado", y aca no hay cuidado. */}
            <Pressable
              style={({ pressed: p }) => [s.sheetClose, p && s.pressed]}
              android_ripple={{ ...ripple, borderless: true }}
              onPress={props.onSkip}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={m.sheet.closeIcon} color={colors.text} />
            </Pressable>
          </View>

          {/* LOS GOLPES QUE DEFINEN EL PUNTO, PRIMEROS Y JUNTOS: remate, bandeja y las dos
              variantes de la bandeja. Son los que mas se van a tocar, asi que van donde el ojo
              aterriza y donde el pulgar llega sin buscar.

              El boton base es el golpe mismo: se toca REMATE y es un remate. No hay ningun boton
              que se llame "normal", que no significa nada. Las variantes van al lado, en un solo
              tap: si marcar una vibora costara dos toques, el que sabe dejaria de usarlas. */}
          {/* Los cuatro en UNA fila plana, sin agrupar. Agrupados, "Bandeja + sus variantes"
              se repartia el 75% del ancho y adentro la bandeja se quedaba con la mitad: la
              vibora y el gancho terminaban en un quinto de fila cada uno, con la palabra
              apretada contra los bordes. Los cuatro son teclas, y las teclas se reparten el
              ancho casi parejo; los dos golpes base pesan un poco mas porque son los que se
              tocan sin pensar. */}
          <View style={s.sheetRow}>
            {STROKES_POR_ALTO.map(({ stroke, variants }) => (
              <Fragment key={stroke}>
                <Pressable
                  style={({ pressed: p }) => [s.sheetBase, p && s.pressed]}
                  android_ripple={ripple}
                  onPress={() => pick({ stroke })}
                >
                  {/* En minusculas, como todos los golpes. Iban en mayusculas cuando eran la
                      CABECERA de un grupo (el golpe base, con sus variantes colgando). Ya no
                      encabezan nada: son cuatro teclas de la misma fila. Lo unico que las
                      distingue —que son el golpe y no una variante— lo dice el relleno. */}
                  <Text style={s.sheetBaseText} numberOfLines={1} adjustsFontSizeToFit>
                    {STROKE_LABELS[stroke]}
                  </Text>
                </Pressable>

                {variants.map((variant) => (
                  <Pressable
                    key={variant}
                    style={({ pressed: p }) => [s.sheetVariant, p && s.pressed]}
                    android_ripple={ripple}
                    onPress={() => pick({ stroke, variant })}
                  >
                    <Text style={s.sheetVariantText} numberOfLines={1} adjustsFontSizeToFit>
                      {VARIANT_LABELS[variant]}
                    </Text>
                  </Pressable>
                ))}
              </Fragment>
            ))}
          </View>

          {/* EL TECLADO. El nombre del golpe se escribe UNA vez y a la derecha estan sus dos
              teclas — antes cada fila decia "Fondo" dos veces, una por boton: el doble de texto
              para un dato que es uno solo, en una hoja que ahora se abre en cada punto.

              Y el lado del golpe se llama DERECHA, no "drive": drive en esta app es de que lado
              de la cancha juega la PERSONA, y usar la misma palabra para las dos cosas las
              confunde. Ademas en España a la derecha le dicen derecha (ver `SIDE_LABELS`). */}
          <View style={s.keyHead}>
            <Text style={s.keyHeadText}>{SIDE_LABELS[LEFT].toUpperCase()}</Text>
            <View style={s.keyName} />
            <Text style={s.keyHeadText}>{SIDE_LABELS[RIGHT].toUpperCase()}</Text>
          </View>

          {STROKES_CON_LADO.map((stroke) => (
            <View key={stroke} style={s.keyRow}>
              <Pressable
                style={({ pressed: p }) => [s.key, p && s.pressed]}
                android_ripple={ripple}
                onPress={() => pick({ stroke, side: LEFT })}
              >
                <View style={s.keyDot} />
              </Pressable>

              <Text style={s.keyName} numberOfLines={1}>
                {STROKE_LABELS[stroke]}
              </Text>

              <Pressable
                style={({ pressed: p }) => [s.key, p && s.pressed]}
                android_ripple={ripple}
                onPress={() => pick({ stroke, side: RIGHT })}
              >
                <View style={s.keyDot} />
              </Pressable>
            </View>
          ))}

          {/* La dejada y la recuperacion, abajo de todo y sin lado: el lado en ellas no dice
              nada (una recuperacion es un manotazo) y no valen dos botones cada una.

              Con MAS aire arriba: no son la sexta fila del teclado, son otra cosa. El espacio es
              lo que dice que ahi termina un bloque y empieza otro — sin el, el ojo las lee como
              si fueran parte de la grilla. */}
          <View style={[s.sheetRow, s.sheetRowApart]}>
            {STROKES_SIN_LADO.map((stroke) => (
              <Pressable
                key={stroke}
                style={({ pressed: p }) => [s.sheetCell, p && s.pressed]}
                android_ripple={ripple}
                onPress={() => pick({ stroke })}
              >
                <Text style={s.sheetCellName} numberOfLines={1}>
                  {STROKE_LABELS[stroke]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** El golpe de nombre mas largo ("Salida de pared"): es el que fija el tamano de fuente. */
const LONGEST_STROKE = Math.max(...STROKES_CON_LADO.map((st) => STROKE_LABELS[st].length));

/**
 * El contorno de los botones de la hoja: mas marcado que un borde de superficie, para que
 * cada boton se recorte contra el fondo — pero por debajo del contorno del golpe base, que es
 * el unico que tiene que destacarse.
 */
const SHEET_BORDER = alpha(colors.text, 0.2);

const makeStyles = (m: Metrics) => {
  const k = m.card;
  const h = m.sheet;
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
   * El ancho de una tecla. Un cuarto del ancho util, con un piso: una tecla que no se acierta
   * con el pulgar —apurado, mirando la cancha— no es una tecla, es una trampa.
   */
  const keyW = Math.max(TOUCH_MIN, Math.round((m.availW - h.pad * 2) * 0.25));

  /**
   * El nombre del golpe queda en segundo plano: sirve para recorrer la lista con la vista de
   * arriba a abajo, no para elegir entre los dos botones de una fila.
   *
   * Se mide contra el mas largo de todos, y los nueve comparten tamano: si cada uno se
   * achicara por su cuenta, "Volea" quedaria enorme al lado de "Salida de pared".
   */
  const strokeFont = Math.max(
    11,
    Math.min(h.label, fitWidth(LONGEST_STROKE, cellW - cellPad * 2 - sideW - h.gap, CHAR.semiLower)),
  );
  /** La descripcion vive en una linea exacta, siempre. */
  const descLine = Math.round(k.rallyDesc * 1.35);

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    row: { flexDirection: 'row', gap: k.rowGap },

    /** El acuse de recibo del toque. Lo llevan TODOS los botones (ver theme.ts). */
    pressed,

    goldenBar: { backgroundColor: colors.golden, padding: k.gap, gap: k.gap, alignItems: 'center' },
    goldenText: { color: '#3B2708', fontWeight: '900', letterSpacing: 1, fontSize: k.pillFont + 2 },
    goldenBtn: {
      backgroundColor: '#3B2708',
      minHeight: k.serve,
      justifyContent: 'center',
      paddingHorizontal: space.xl,
      borderRadius: radius.sm,
    },
    goldenBtnText: { color: colors.golden, fontWeight: '800', fontSize: k.name },

    court: { flex: 1, gap: m.court.gap, padding: m.court.pad },
    teamRow: { flex: 1, flexDirection: 'row', gap: m.court.gap },

    card: {
      flex: 1,
      justifyContent: 'space-between',
      padding: k.pad,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      /** Red de seguridad: si algun dia el contenido no entra, que se recorte adentro de la
          tarjeta y no se le monte encima a la de abajo, como pasaba antes. */
      overflow: 'hidden',
    },
    cardServing: { borderColor: colors.serve, borderWidth: 2, backgroundColor: colors.surfaceAlt },

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
    avatarText: { color: colors.bg, fontWeight: '900', fontSize: Math.round(k.avatarMax * 0.42) },
    cardName: { color: colors.text, fontWeight: '700', fontSize: k.name },

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
      borderColor: colors.textFaint,
      backgroundColor: colors.surfaceAlt,
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
    pillCool: { borderColor: alpha(colors.serve, 0.5), backgroundColor: alpha(colors.serve, 0.1) },
    pillHot: { borderColor: colors.serve, backgroundColor: colors.serve },
    pillText: { color: colors.serve, fontSize: k.pillFont, fontWeight: '900', letterSpacing: 1 },

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

    bottom: { flexDirection: 'row', gap: m.bottom.gap, padding: m.bottom.pad, backgroundColor: colors.surface },
    utilBtn: {
      flex: 1,
      flexDirection: 'row',
      gap: m.bottom.gap,
      height: m.bottom.util,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    utilBtnWide: { flex: 1 },
    /** Solo icono: no necesita crecer, y el ancho que sobra se lo lleva Deshacer. */
    utilBtnIcon: { flex: 0, width: m.bottom.util + m.bottom.gap * 2 },
    utilBtnOff: { opacity: 0.35 },
    utilText: { color: colors.text, fontWeight: '800', fontSize: m.bottom.font },

    // ---- Hoja de golpes ----
    sheetBg: { flex: 1, justifyContent: 'flex-end' },
    /** Solo el fondo cierra. Va absoluto y aparte, para que la hoja no le pase los toques. */
    sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000B' },
    sheet: {
      backgroundColor: colors.surface,
      padding: h.pad,
      /**
       * El Modal se ancla al borde FISICO: sin esto, la ultima fila queda debajo de la barra de
       * navegacion del sistema. Pero el aire de la barra YA es aire — sumarle encima el padding
       * de la hoja dejaba un hueco muerto abajo de todo. Se toma el mayor de los dos, no la suma.
       */
      paddingBottom: Math.max(h.pad, m.insetBottom),
      gap: h.gap,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
    sheetTop: { flexDirection: 'row', alignItems: 'center', height: h.close },
    sheetClose: {
      width: h.close,
      height: h.close,
      alignItems: 'center',
      justifyContent: 'center',
      /** Que el icono quede alineado con el borde de la grilla, no el area tactil. */
      marginRight: -h.pad / 2,
    },
    sheetTitle: { flex: 1, color: colors.textDim, fontSize: h.title, fontWeight: '800' },

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
      backgroundColor: colors.surfaceAlt,
    },
    /** Centrado, como el nombre del teclado: toda la hoja lee por el eje del medio. */
    sheetCellName: {
      flex: 1,
      textAlign: 'center',
      color: colors.textDim,
      fontSize: strokeFont,
      fontWeight: '700',
    },

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
      color: colors.textFaint,
      fontSize: sideFont * 0.62,
      fontWeight: '900',
      letterSpacing: 1,
    },
    keyRow: { flexDirection: 'row', alignItems: 'center', gap: h.gap, height: h.row },
    /** Al medio y centrado: es el eje de la fila, y las dos teclas cuelgan de el. */
    keyName: {
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: strokeFont,
      fontWeight: '700',
    },
    key: {
      width: keyW,
      height: '100%',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: SHEET_BORDER,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyDot: {
      width: Math.round(sideFont * 0.5),
      height: Math.round(sideFont * 0.5),
      borderRadius: radius.pill,
      backgroundColor: colors.textDim,
    },

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
      backgroundColor: alpha(colors.text, 0.14),
      borderWidth: 1,
      borderColor: alpha(colors.text, 0.45),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    /** Sin el espaciado de las mayusculas, que ya no lleva: se escribe como cualquier golpe. */
    sheetBaseText: { color: colors.text, fontSize: h.btn, fontWeight: '900' },

    /**
     * Las variantes cuelgan del base: un solo tap, y con el MISMO peso visual que los golpes
     * de la grilla de arriba. Estuvieron un rato como fantasmas, sin relleno, y quedaban tan
     * apagadas que parecian deshabilitadas — el que sabe no las iba a tocar nunca.
     *
     * La jerarquia la sigue marcando el boton base, que es el unico solido y en blanco.
     */
    sheetVariant: {
      flex: 1,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: SHEET_BORDER,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    sheetVariantText: { color: colors.textDim, fontSize: strokeFont, fontWeight: '700' },

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
      backgroundColor: alpha(colors.bg, 0.93),
      alignItems: 'center',
      justifyContent: 'center',
      gap: m.court.gap,
      padding: m.court.pad,
    },
    finishedTitle: { color: colors.text, fontSize: h.title + 4, fontWeight: '900' },
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
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    finishedBtnText: { color: colors.text, fontSize: h.label, fontWeight: '800' },
  });
};
