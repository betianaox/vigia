import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { MatchConfig, MatchState, TeamId } from '../engine';
/**
 * TODO EL TANTEADOR VA EN TEXTO QUE NO ESCALA (el porque, en `FixedText`).
 *
 * Es una TABLA: cuatro nombres, dos columnas de numeros y unos casilleros que tienen que alinear
 * entre si. Con la letra del sistema en grande los nombres se pisaban uno al otro, "GM" y "PTS"
 * se cortaban por arriba y las celdas dejaban de alinear con las lineas. Un tanteador roto no es
 * un tanteador mas grande.
 *
 * Se importa CON EL NOMBRE `Text` a proposito: asi no queda ni un `<Text>` comun al que se le
 * escape la regla, y el que agregue una linea manana la hereda sin enterarse.
 */
import { FixedText as Text } from './FixedText';
import { CHAR, fitWidth } from './layout';
import { useMetrics, type Metrics } from './metrics';
import { usePulse } from './pulse';
import { useRoster } from './roster';
import { alpha, colors, radius, teamColor } from './theme';

/**
 * Tanteador estilo transmision: cada numero en su casillero, los sets terminados en gris,
 * los games en un casillero neutro y los puntos en vivo en el casillero encendido.
 *
 * Cada equipo ocupa DOS lineas, un jugador arriba del otro, el de drive primero — el mismo
 * orden que las tarjetas de la cancha, para no tener que traducir nada mentalmente.
 *
 * Apilarlos no fue solo para que entren los nombres largos: al ocupar dos lineas, las celdas
 * de GM y PTS abarcan el bloque entero, y con el doble de alto el numero puede ser mucho mas
 * grande. El marcador se resalta como CONSECUENCIA de arreglar los nombres, no a costa de la
 * cancha.
 *
 * Y sale otra cosa gratis: la pelotita ya no marca que EQUIPO saca, marca que JUGADOR saca.
 */
/**
 * Cuanto puede medir un nombre, sabiendo cuantas columnas hay en juego.
 *
 * El tanteador CRECE durante el partido: arranca con GM y PTS, y a cada set terminado le
 * suma una columna. En el peor caso —dos sets terminados mas el tercero en curso— los
 * nombres se quedan con bastante menos ancho del que tenian al empezar.
 *
 * Asi que la fuente sale de ahi: se toma el nombre mas largo de los cuatro y se busca el
 * tamano mas grande con el que entra. Los cuatro comparten tamano —si cada uno se achicara
 * por su cuenta quedarian todos distintos, que es peor que que sean chicos— y si ni al
 * minimo entra, ahi si se corta con puntos suspensivos.
 */
const nameFontSize = (
  m: Metrics,
  state: MatchState,
  boxW: number,
  /** Los nombres YA RESUELTOS: si alguien se renombro, el largo cambia y la fuente tambien. */
  names: string[],
): number => {
  const b = m.board;
  const pointsW = b.cellW + Math.round(b.cellW * 0.5);

  const col = columns(state);
  const cols = state.completedSets.length + (col.games ? 1 : 0) + (col.points ? 1 : 0);
  const colsW =
    state.completedSets.length * b.cellW +
    (col.games ? b.cellW : 0) +
    (col.points ? pointsW : 0);

  const nameW = boxW - b.padH * 2 - b.ballSlot - colsW - b.gap * (cols + 1);
  const longest = Math.max(...names.map((n) => n.length), 1);

  return Math.max(10, Math.min(b.names, fitWidth(longest, nameW, CHAR.semiLower)));
};

/**
 * Que columnas se muestran.
 *
 * Terminado el partido desaparecen las columnas en vivo y queda el resultado en las de sets.
 * Pero un partido a UN GAME termina sin cerrar ningun set (ver engine.ts), asi que se
 * quedaba sin ninguna columna: el tanteador vacio, justo cuando mas se lo mira. En ese caso
 * la columna de games se queda, porque ahi esta el resultado.
 */
const columns = (state: MatchState) => ({
  games: !state.finished || state.completedSets.length === 0,
  points: !state.finished,
});

export function Scoreboard({
  config,
  state,
  width,
}: {
  config: MatchConfig;
  state: MatchState;
  /**
   * Contra que ancho se miden los nombres. Por defecto, la pantalla — que es lo que ocupa en
   * la cancha. Metido adentro de una tarjeta tiene bastante menos, y si no se entera, calcula
   * un tamano de fuente que no entra y los corta.
   */
  width?: number;
}) {
  const m = useMetrics();
  const { nameOf } = useRoster();
  const s = useMemo(() => makeStyles(m), [m]);
  const boxW = width ?? m.availW;

  const names = useMemo(
    () => Object.values(config.players).map((p) => nameOf(p.id, p.name)),
    [config.players, nameOf],
  );
  const nameSize = useMemo(
    () => nameFontSize(m, state, boxW, names),
    [m, state, boxW, names],
  );
  const label = state.isSuperTiebreak ? 'SÚPER TIEBREAK' : state.inTiebreak ? 'TIEBREAK' : null;
  const col = columns(state);

  /**
   * EL AVISO DE QUE EL PUNTO ENTRO.
   *
   * Quien opera la app esta mirando la cancha, no la pantalla: toca y vuelve al partido. Sin un
   * aviso, la unica forma de saber si el toque entro —y si entro PARA EL EQUIPO CORRECTO— es
   * quedarse mirando el tanteador, que es justo lo que no puede hacer.
   *
   * El aviso vive donde ocurrio el cambio, y dice las tres cosas juntas: que entro, para quien
   * (el color del equipo) y como quedo. Se descarto un beep: un club es ruidoso, la mitad de los
   * telefonos estan en silencio, sonaria doscientas veces por partido — y sobre todo no puede
   * decir DE QUIEN fue el punto, que es el unico error que hay que poder cazar.
   */
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const prev = useRef<MatchState>(state);

  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    const p = scored(before, state);
    if (p) setPulse(p);
  }, [state]);

  return (
    <View style={s.root}>
      {/* El header espeja la estructura de los bloques para que las columnas alineen. */}
      <View style={s.headRow}>
        <Text style={s.label} numberOfLines={1}>
          {label ?? ''}
        </Text>
        {state.completedSets.map((_, i) => (
          <Text key={i} style={[s.headCell, s.headText]}>
            S{i + 1}
          </Text>
        ))}
        {col.games && <Text style={[s.headCell, s.headText]}>GM</Text>}
        {col.points && <Text style={[s.headCell, s.headWide, s.headText]}>PTS</Text>}
      </View>

      <TeamBlock team="A" config={config} state={state} pulse={pulse} s={s} m={m} nameSize={nameSize} />
      {/* Una linea fina entre las parejas: sin ella los cuatro nombres se leen como una sola
          lista y hay que pensar un segundo para ver donde termina un equipo. Ese segundo es
          justo el que no se tiene. */}
      <View style={s.divider} />
      <TeamBlock team="B" config={config} state={state} pulse={pulse} s={s} m={m} nameSize={nameSize} />
    </View>
  );
}

/**
 * QUE CAMBIO EN EL TANTEADOR, y de quien.
 *
 * Sale de comparar dos estados, no de escuchar el tap. La diferencia no es un capricho: **no
 * todo toque suma un punto**. Una falta cambia el saque y no el marcador; un let no cambia nada.
 * Un aviso colgado del tap confirmaria puntos que no existieron — que es exactamente el error que
 * este aviso tiene que ayudar a cazar.
 *
 * Y por la misma razon, deshacer no dispara nada: el marcador baja, no sube.
 */
type Pulse = { team: TeamId; cell: 'points' | 'games' | 'set'; at: number };

/** Los sets viejos no destellan nunca: uno solo, quieto, para todos. */
const STILL = new Animated.Value(0);

const scored = (prev: MatchState, next: MatchState): Pulse | null => {
  const at = Date.now();

  // El orden importa: cerrar un set tambien mueve los games, y cerrar un game tambien
  // toca los puntos (los pone en cero). Se avisa donde quedo el resultado, no donde rebotó.
  if (next.completedSets.length > prev.completedSets.length) {
    const set = next.completedSets[next.completedSets.length - 1]!;
    return { team: set.winner, cell: 'set', at };
  }
  for (const t of ['A', 'B'] as TeamId[]) {
    if (next.games[t] > prev.games[t]) return { team: t, cell: 'games', at };
  }
  for (const t of ['A', 'B'] as TeamId[]) {
    if (next.points[t] > prev.points[t]) return { team: t, cell: 'points', at };
  }
  return null;
};

/** La celda que acaba de cambiar: crece un toque y se enciende en el color de su equipo. */
function Flash({
  v,
  team,
  style,
  children,
}: {
  v: Animated.Value;
  team: TeamId;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      style={[
        style,
        { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }] },
      ]}
    >
      {/* El color va ENCIMA y se apaga, en vez de reemplazar el fondo: asi el numero nunca
          desaparece debajo del destello, que es lo unico que no se puede perder. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius.sm,
            backgroundColor: teamColor(team),
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
          },
        ]}
      />
      {children}
    </Animated.View>
  );
}

function TeamBlock({
  team,
  config,
  state,
  pulse,
  s,
  m,
  nameSize,
}: {
  team: TeamId;
  config: MatchConfig;
  state: MatchState;
  /** Lo ultimo que cambio en el tanteador. Solo el equipo que sumo se enciende. */
  pulse: Pulse | null;
  s: ReturnType<typeof makeStyles>;
  m: Metrics;
  /** Igual para los cuatro: se calcula contra el nombre mas largo. */
  nameSize: number;
}) {
  const { nameOf } = useRoster();

  const mine = pulse?.team === team ? pulse : null;
  const pPoints = usePulse(mine?.cell === 'points' ? mine.at : 0);
  const pGames = usePulse(mine?.cell === 'games' ? mine.at : 0);
  const pSet = usePulse(mine?.cell === 'set' ? mine.at : 0);

  // El de drive arriba: el mismo orden que en la cancha.
  const ids = [config.teams[team].drive, config.teams[team].reves];
  /** Terminado el partido, el perdedor se apaga: el ganador se lee solo, sin ningun icono. */
  const lost = state.finished && state.winner !== team;
  const col = columns(state);

  return (
    <View style={s.teamRow}>
      <View style={s.names}>
        {ids.map((p) => {
          const serving = !state.finished && state.server === p;
          return (
            <View key={p} style={s.nameRow}>
              <View style={s.ballSlot}>
                {/* La pelotita: circulo dibujado, no emoji. El emoji de tenis en Android se
                    renderiza como raqueta con pelota, que es otra cosa.

                    Terminado el partido no hay nada: no hay sacador, y una pelotita ahi
                    sugeriria que el juego sigue. Tampoco va una copita — al lado de UNO de
                    los dos nombres se lee como "gano el", no "gano la pareja". El ganador ya
                    se lee igual: el perdedor queda atenuado y el resultado esta en las
                    columnas. La copita vive en el overlay de fin de partido, que es donde
                    habla de la pareja entera. */}
                {serving ? <View style={s.ball} /> : null}
              </View>
              {/* Si ni al tamano minimo entra, ahi si se corta con puntos suspensivos.

                  El nombre sale de la TABLA de jugadores, por id — no de la copia que el partido
                  guarda adentro. Asi, renombrar a alguien cambia tambien sus partidos viejos. La
                  copia queda de paracaidas por si esa persona ya no esta en la tabla. */}
              <Text
                style={[s.name, { fontSize: nameSize, color: teamColor(team) }, lost && s.lost]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {nameOf(p, config.players[p]?.name)}
              </Text>
            </View>
          );
        })}
      </View>

      {state.completedSets.map((set, i) => {
        const setLost = set.winner !== team;
        const last = i === state.completedSets.length - 1;
        return (
          <Flash key={i} v={last ? pSet : STILL} team={team} style={[s.cell, s.setCell]}>
            <Text style={[s.num, s.setText, !setLost && s.setWon]}>{set.games[team]}</Text>
            {/* Convencion de transmision: el tanteo del tiebreak va como superindice, y solo
                sobre el que PERDIO el set. Va como Text hermano y levantado media altura:
                anidado adentro del otro, RN lo pega a la linea de base y queda abajo. */}
            {set.tiebreak && setLost && <Text style={s.sup}>{set.tiebreak[team]}</Text>}
          </Flash>
        );
      })}

      {col.games && (
        <Flash v={pGames} team={team} style={[s.cell, s.cellGames]}>
          <Text style={[s.num, s.gamesText]}>{state.games[team]}</Text>
        </Flash>
      )}

      {col.points && (
        <Flash
          v={pPoints}
          team={team}
          style={[
            s.cell,
            s.cellPoints,
            state.isGoldenPoint && { backgroundColor: colors.golden, borderColor: colors.golden },
          ]}
        >
          <Text
            style={[s.num, s.pointsText, state.isGoldenPoint && { color: colors.onLight }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {state.display[team]}
          </Text>
        </Flash>
      )}
    </View>
  );
}

const makeStyles = (m: Metrics) => {
  const b = m.board;
  /** El casillero en vivo es mas ancho: ahi entran "40", "AD" y los dos digitos del tiebreak. */
  const pointsW = b.cellW + Math.round(b.cellW * 0.5);

  return StyleSheet.create({
    root: {
      backgroundColor: colors.surface,
      paddingHorizontal: b.padH,
      paddingVertical: b.padV,
      gap: b.rowGap,
    },

    headRow: { flexDirection: 'row', alignItems: 'center', gap: b.gap, height: b.header },
    label: { flex: 1, fontSize: b.small, fontWeight: '900', color: colors.golden, letterSpacing: 1.2 },
    headCell: { width: b.cellW },
    headWide: { width: pointsW },
    headText: {
      fontSize: b.small,
      fontWeight: '800',
      color: colors.textFaint,
      letterSpacing: 1,
      textAlign: 'center',
    },

    teamRow: { flexDirection: 'row', alignItems: 'center', gap: b.gap },
    /** Arranca donde arrancan los nombres, no en el borde: separa sin dibujar una caja. */
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: b.ballSlot,
      backgroundColor: colors.border,
    },

    // ---- Los dos jugadores, uno arriba del otro ----
    names: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', height: b.nameLine },
    ballSlot: { width: b.ballSlot, alignItems: 'center', justifyContent: 'center' },
    ball: {
      width: b.ball,
      height: b.ball,
      borderRadius: radius.pill,
      backgroundColor: colors.ball,
      shadowColor: colors.ball,
      shadowOpacity: 0.9,
      shadowRadius: 4,
      elevation: 4,
    },
    /**
     * El tamano no vive aca: sale de `nameFontSize`, contra el ancho que dejan las columnas.
     *
     * `includeFontPadding: false` es lo que alinea la pelotita con el nombre. Android le suma
     * al texto un padding invisible arriba y abajo (para acentos y descendentes) que forma
     * parte de la caja; al centrar la caja en la fila, los glifos quedan corridos y la
     * pelotita —que si esta centrada— parece alta. Apagandolo, la caja es el texto.
     */
    name: {
      flex: 1,
      fontWeight: '700',
      lineHeight: b.nameLine,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    /** Terminado el partido, el perdedor se apaga: el ganador se lee solo. */
    lost: { opacity: 0.45 },

    // ---- Los casilleros: abarcan las dos lineas del equipo ----
    cell: {
      width: b.cellW,
      height: b.cell,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    num: { fontVariant: ['tabular-nums'], textAlign: 'center' },

    setCell: { flexDirection: 'row', justifyContent: 'center' },
    setText: { fontSize: b.setNum, fontWeight: '700', color: colors.textFaint },
    setWon: { color: colors.text },
    sup: {
      fontSize: b.sup,
      fontWeight: '800',
      color: colors.textFaint,
      marginBottom: Math.round(b.setNum * 0.45),
      marginLeft: 1,
    },

    cellGames: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
    gamesText: { fontSize: b.setNum, fontWeight: '800', color: colors.text },

    // El casillero en vivo: el unico encendido de todo el tanteador.
    cellPoints: {
      width: pointsW,
      backgroundColor: alpha('#FFFFFF', 0.14),
      borderWidth: 1,
      borderColor: alpha('#FFFFFF', 0.35),
    },
    pointsText: { fontSize: b.liveNum, fontWeight: '900', color: colors.text },
  });
};
