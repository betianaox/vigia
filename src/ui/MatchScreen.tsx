import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { CHAR, fitWidth } from './layout';
import { useMetrics, type Metrics } from './metrics';
import { Scoreboard } from './Scoreboard';
import { STROKE_LABELS, STROKES_CON_LADO, STROKES_POR_ALTO, VARIANT_LABELS } from './shots';
import { StatsScreen } from './StatsScreen';
import { alpha, colors, radius, space, teamColor } from './theme';

type RallyAction = 'WINNER' | 'ERROR_FORZADO' | 'ERROR_NO_FORZADO';

/** El golpe con mas variantes (el remate). Fija el ancho de las dos filas de abajo. */
const MAX_VARIANTS = Math.max(...STROKES_POR_ALTO.map((g) => g.variants.length));

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

export function MatchScreen({ config }: { config: MatchConfig }) {
  useKeepAwake();

  const m = useMetrics();
  const s = useMemo(() => makeStyles(m), [m]);

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [shotFor, setShotFor] = useState<number | null>(null);
  const [rotated, setRotated] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [abandoned, setAbandoned] = useState(false);

  const state = useMemo(() => reduce(config, events), [config, events]);
  const push = (e: MatchEvent) => setEvents((prev) => [...prev, e]);

  if (showStats) {
    return (
      <StatsScreen
        config={config}
        events={events}
        state={state}
        finishedEarly={abandoned}
        onBack={() => setShowStats(false)}
        onShare={() => {}}
        onFinish={() => setAbandoned(true)}
      />
    );
  }

  /** Tap corto: registra el punto y listo. Un solo tap, sin seleccionar nada antes. */
  const registerPoint = (type: RallyAction, player: PlayerId) => {
    thud();
    push({ type, player });
  };

  /**
   * Long press: registra el punto IGUAL, y ademas abre el menu de golpe.
   * Nunca se pierde un punto por intentar el gesto largo y que salga mal.
   */
  const registerPointWithShot = (type: RallyAction, player: PlayerId) => {
    thud();
    setEvents((prev) => {
      setShotFor(prev.length);
      return [...prev, { type, player }];
    });
  };

  const setShot = (shot: Shot) => {
    if (shotFor === null) return;
    tick();
    setEvents((prev) => prev.map((e, i) => (i === shotFor && 'player' in e ? { ...e, shot } : e)));
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
          name: config.players[pendingEvent.player]!.name,
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
   */
  const playersOf = (t: TeamId, row: number): PlayerId[] => {
    const { drive, reves } = config.teams[t];
    return row === 0 ? [drive, reves] : [reves, drive];
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
                  style={s.goldenBtn}
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
                name={config.players[p]!.name}
                team={t}
                position={config.teams[t].drive === p ? 'drive' : 'reves'}
                serving={state.server === p}
                receiving={state.receiver === p}
                serveState={state.serveState}
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
          </View>
        ))}
      </View>

      {/* Deshacer se lleva el doble de espacio: se usa todo el tiempo y bajo presion.
          Rotar y las estadisticas se tocan poco y con calma. */}
      <View style={s.bottom}>
        <Pressable
          style={[s.utilBtn, s.utilBtnWide, events.length === 0 && s.utilBtnOff]}
          onPress={() => {
            tick();
            setEvents(undo);
          }}
          disabled={events.length === 0}
        >
          <MaterialIcons name="undo" size={m.bottom.icon} color={colors.text} />
          <Text style={s.utilText}>Deshacer</Text>
        </Pressable>
        {/* Solo icono: la etiqueta no explicaba nada (¿"dar vuelta" que?) y ocupaba lugar.
            Da vuelta la vista 180 grados para que coincida con lo que ve el que mira. */}
        <Pressable
          style={[s.utilBtn, s.utilBtnIcon]}
          onPress={() => {
            tick();
            setRotated((r) => !r);
          }}
        >
          <MaterialIcons name="swap-vert" size={m.bottom.icon} color={colors.text} />
        </Pressable>
        <Pressable
          style={[s.utilBtn, s.utilBtnIcon]}
          onPress={() => {
            tick();
            setShowStats(true);
          }}
        >
          <MaterialIcons name="bar-chart" size={m.bottom.icon} color={colors.text} />
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

      {state.finished && (
        <View style={s.finished}>
          <Text style={s.finishedText}>
            Ganó{' '}
            {[config.teams[state.winner!].drive, config.teams[state.winner!].reves]
              .map((p) => config.players[p]!.name)
              .join(' / ')}
          </Text>
        </View>
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

  // Mismo tamano los tres, los distingue el color. Pero la falta va SOLIDA: es la mas
  // frecuente y la que menos tiempo tiene (cae entre los dos saques). El ace, en cambio,
  // en padel es raro: no merece resaltar.
  const serveBtn = (label: string, color: string, onPress: () => void, solid = false) => (
    <Pressable
      style={[
        s.serveBtn,
        solid
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.55) },
      ]}
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
            <Text style={[s.sideMarkText, { color: alpha(c, 0.16) }]}>
              {props.position === 'drive' ? 'D' : 'R'}
            </Text>
          </View>
        </View>

        <Text style={s.cardName} numberOfLines={1}>
          {props.name}
        </Text>

        {props.serving ? (
          // El segundo saque se muestra invertido: es el estado peligroso, tiene que saltar.
          <View style={[s.pill, second ? s.pillHot : s.pillCool]}>
            <Text style={[s.pillText, second && { color: colors.onLight }]}>
              {second ? '2DO SAQUE' : '1ER SAQUE'}
            </Text>
          </View>
        ) : props.receiving ? (
          <View style={[s.pill, s.pillGhost]}>
            <Text style={[s.pillText, { color: colors.textFaint }]}>RESTA</Text>
          </View>
        ) : (
          <View style={s.pillEmpty} />
        )}
      </View>

      <View style={s.row}>
        {RALLY.map((a) => (
          <Pressable
            key={a.type}
            style={[
              s.rallyBtn,
              { backgroundColor: alpha(a.color, 0.15), borderColor: alpha(a.color, 0.5) },
            ]}
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
            <Pressable style={s.sheetClose} onPress={props.onSkip} hitSlop={8}>
              <MaterialIcons name="close" size={m.sheet.closeIcon} color={colors.text} />
            </Pressable>
          </View>

          {/* Cada boton dice QUE golpe y de QUE lado: el objetivo tactil y su etiqueta son el
              mismo objeto. Antes el nombre vivia afuera, en una columna aparte — el ojo leia
              a la izquierda y el pulgar tocaba a la derecha, y encima la columna era tan
              angosta que "Salida de pared" se cortaba mientras al lado habia dos cajas de 118
              dp con una sola letra adentro.

              Tampoco hay encabezado de columna: cada boton ya dice su lado. Un titulo que
              rotula lo que el boton ya rotula es una fila entera gastada al pedo. */}
          {STROKES_CON_LADO.map((stroke) => (
            <View key={stroke} style={s.sheetRow}>
              {/* El REVES va a la izquierda y el DRIVE a la derecha: la grilla espeja el
                  cuerpo de una jugadora diestra, que es la mayoria. No es una lista, es un
                  mapa — se toca del lado en que se pego. */}
              {(['reves', 'drive'] as Side[]).map((side) => (
                <Pressable key={side} style={s.sheetCell} onPress={() => pick({ stroke, side })}>
                  <Text style={s.sheetCellName} numberOfLines={1}>
                    {STROKE_LABELS[stroke]}
                  </Text>
                  {/* La misma letra que la marca de agua de la tarjeta: un solo vocabulario. */}
                  <Text style={s.sheetCellSide}>{side === 'drive' ? 'D' : 'R'}</Text>
                </Pressable>
              ))}
            </View>
          ))}

          {/* Los golpes sin lado van a continuacion, sin titulo: la lista viene bajando desde
              el fondo hacia la red, y estos son de red. Se distinguen solos porque no tienen
              las dos columnas. Un encabezado que anuncia algo que ya se ve es ruido. */}
          {STROKES_POR_ALTO.map(({ stroke, variants }) => (
            <View key={stroke} style={s.sheetRow}>
              {/* El boton base es el golpe mismo: se toca REMATE y es un remate. No hay
                  ningun boton que se llame "normal", que no significa nada. Va SOLIDO: es
                  el que se toca sin pensar, y el ojo tiene que aterrizar ahi primero. */}
              <Pressable style={s.sheetBase} onPress={() => pick({ stroke })}>
                <Text style={s.sheetBaseText}>{STROKE_LABELS[stroke].toUpperCase()}</Text>
              </Pressable>

              {/* Las variantes son un lujo, no un requisito: mismo alto y un solo tap, pero
                  fantasmas. Estan disponibles para el que sabe y no le gritan al que no. */}
              {variants.map((variant) => (
                <Pressable
                  key={variant}
                  style={s.sheetVariant}
                  onPress={() => pick({ stroke, variant })}
                >
                  <Text style={s.sheetVariantText}>{VARIANT_LABELS[variant]}</Text>
                </Pressable>
              ))}

              {/* Iguala el ancho de las dos filas, para que BANDEJA y REMATE midan lo mismo
                  aunque uno tenga dos variantes y el otro tres. */}
              {MAX_VARIANTS - variants.length > 0 && (
                <View style={{ flex: MAX_VARIANTS - variants.length }} />
              )}
            </View>
          ))}
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
    pillGhost: { borderColor: colors.border },
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
      /** El Modal se ancla al borde FISICO: sin esto, la ultima fila queda debajo de la barra
          de navegacion del sistema. */
      paddingBottom: h.pad + m.insetBottom,
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
    /** El golpe, en segundo plano: sirve para recorrer la lista, no para elegir entre los dos. */
    sheetCellName: { flex: 1, color: colors.textDim, fontSize: strokeFont, fontWeight: '700' },
    /** El lado, en primer plano: es lo unico que distingue este boton del de al lado. */
    sheetCellSide: {
      width: sideW,
      textAlign: 'right',
      color: colors.text,
      fontSize: sideFont,
      fontWeight: '900',
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
      flex: 2,
      borderRadius: radius.sm,
      backgroundColor: alpha(colors.text, 0.14),
      borderWidth: 1,
      borderColor: alpha(colors.text, 0.45),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    sheetBaseText: { color: colors.text, fontSize: h.btn, fontWeight: '900', letterSpacing: 0.5 },

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

    finished: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000C',
      alignItems: 'center',
      justifyContent: 'center',
    },
    finishedText: { color: colors.text, fontSize: 24, fontWeight: '900' },
  });
};
