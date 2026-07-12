import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { MatchConfig, MatchState, TeamId } from '../engine';
import { CHAR, fitWidth } from './layout';
import { useMetrics, type Metrics } from './metrics';
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
const nameFontSize = (m: Metrics, config: MatchConfig, state: MatchState): number => {
  const b = m.board;
  const pointsW = b.cellW + Math.round(b.cellW * 0.5);

  const col = columns(state);
  const cols = state.completedSets.length + (col.games ? 1 : 0) + (col.points ? 1 : 0);
  const colsW =
    state.completedSets.length * b.cellW +
    (col.games ? b.cellW : 0) +
    (col.points ? pointsW : 0);

  const nameW = m.availW - b.padH * 2 - b.ballSlot - colsW - b.gap * (cols + 1);
  const longest = Math.max(
    ...Object.values(config.players).map((p) => p.name.length),
    1,
  );

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

export function Scoreboard({ config, state }: { config: MatchConfig; state: MatchState }) {
  const m = useMetrics();
  const s = useMemo(() => makeStyles(m), [m]);
  const nameSize = useMemo(() => nameFontSize(m, config, state), [m, config, state]);
  const label = state.isSuperTiebreak ? 'SÚPER TIEBREAK' : state.inTiebreak ? 'TIEBREAK' : null;
  const col = columns(state);

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

      <TeamBlock team="A" config={config} state={state} s={s} m={m} nameSize={nameSize} />
      {/* Una linea fina entre las parejas: sin ella los cuatro nombres se leen como una sola
          lista y hay que pensar un segundo para ver donde termina un equipo. Ese segundo es
          justo el que no se tiene. */}
      <View style={s.divider} />
      <TeamBlock team="B" config={config} state={state} s={s} m={m} nameSize={nameSize} />
    </View>
  );
}

function TeamBlock({
  team,
  config,
  state,
  s,
  m,
  nameSize,
}: {
  team: TeamId;
  config: MatchConfig;
  state: MatchState;
  s: ReturnType<typeof makeStyles>;
  m: Metrics;
  /** Igual para los cuatro: se calcula contra el nombre mas largo. */
  nameSize: number;
}) {
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
              {/* Si ni al tamano minimo entra, ahi si se corta con puntos suspensivos. */}
              <Text
                style={[s.name, { fontSize: nameSize, color: teamColor(team) }, lost && s.lost]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {config.players[p]!.name}
              </Text>
            </View>
          );
        })}
      </View>

      {state.completedSets.map((set, i) => {
        const setLost = set.winner !== team;
        return (
          <View key={i} style={[s.cell, s.setCell]}>
            <Text style={[s.num, s.setText, !setLost && s.setWon]}>{set.games[team]}</Text>
            {/* Convencion de transmision: el tanteo del tiebreak va como superindice, y solo
                sobre el que PERDIO el set. Va como Text hermano y levantado media altura:
                anidado adentro del otro, RN lo pega a la linea de base y queda abajo. */}
            {set.tiebreak && setLost && <Text style={s.sup}>{set.tiebreak[team]}</Text>}
          </View>
        );
      })}

      {col.games && (
        <View style={[s.cell, s.cellGames]}>
          <Text style={[s.num, s.gamesText]}>{state.games[team]}</Text>
        </View>
      )}

      {col.points && (
        <View
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
        </View>
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
