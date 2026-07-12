import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { MatchConfig, MatchState, TeamId } from '../engine';
import { alpha, colors, radius, space, teamColor } from './theme';

/**
 * Tanteador estilo transmision: cada numero en su casillero, los sets terminados en
 * gris, los games en un casillero neutro y los puntos en vivo en el casillero encendido.
 */
export function Scoreboard({ config, state }: { config: MatchConfig; state: MatchState }) {
  const label = state.isSuperTiebreak ? 'SÚPER TIEBREAK' : state.inTiebreak ? 'TIEBREAK' : null;

  return (
    <View style={s.root}>
      {/* El header espeja exactamente la estructura de las filas para que las columnas alineen. */}
      <View style={s.row}>
        <View style={s.ballSpacer} />
        <Text style={s.label} numberOfLines={1}>
          {label ?? ''}
        </Text>
        {state.completedSets.map((_, i) => (
          <Text key={i} style={[s.cell, s.headerText]}>
            S{i + 1}
          </Text>
        ))}
        {!state.finished && <Text style={[s.cell, s.headerText]}>GM</Text>}
        {!state.finished && <Text style={[s.cell, s.cellPointsWidth, s.headerText]}>PTS</Text>}
      </View>

      {(['A', 'B'] as TeamId[]).map((t) => (
        <TeamRow key={t} team={t} config={config} state={state} />
      ))}
    </View>
  );
}

function TeamRow({
  team,
  config,
  state,
}: {
  team: TeamId;
  config: MatchConfig;
  state: MatchState;
}) {
  const names = [config.teams[team].drive, config.teams[team].reves]
    .map((p) => config.players[p]!.name)
    .join(' / ');

  const serving = !state.finished && state.servingTeam === team;
  const won = state.finished && state.winner === team;

  return (
    <View style={s.row}>
      {/* La pelotita: circulo dibujado, no emoji. El emoji de tenis en Android se
          renderiza como raqueta con pelota, que es otra cosa. */}
      <View style={s.ballSlot}>
        {serving ? (
          <View style={s.ball} />
        ) : won ? (
          <MaterialIcons name="emoji-events" size={15} color={colors.golden} />
        ) : null}
      </View>

      <Text
        style={[s.names, { color: teamColor(team) }, state.finished && !won && s.namesLost]}
        numberOfLines={1}
      >
        {names}
      </Text>

      {state.completedSets.map((set, i) => {
        const lost = set.winner !== team;
        return (
          <View key={i} style={[s.cell, s.setCell]}>
            <Text style={[s.cellText, s.setText, !lost && s.setWon]}>{set.games[team]}</Text>
            {/* Convencion de transmision: el tanteo del tiebreak va como superindice, y
                solo sobre el que PERDIO el set. Va como Text aparte y alineado arriba:
                anidado dentro del otro Text, RN lo pega a la linea de base y queda abajo. */}
            {set.tiebreak && lost && <Text style={s.sup}>{set.tiebreak[team]}</Text>}
          </View>
        );
      })}

      {!state.finished && (
        <View style={[s.cell, s.cellGames]}>
          <Text style={[s.cellText, s.gamesText]}>{state.games[team]}</Text>
        </View>
      )}

      {!state.finished && (
        <View
          style={[
            s.cell,
            s.cellPoints,
            state.isGoldenPoint && { backgroundColor: colors.golden, borderColor: colors.golden },
          ]}
        >
          <Text
            style={[s.cellText, s.pointsText, state.isGoldenPoint && { color: colors.onLight }]}
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

const CELL = 34;

const s = StyleSheet.create({
  root: { backgroundColor: colors.surface, paddingHorizontal: space.md, paddingVertical: space.sm },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  ballSlot: { width: 20, alignItems: 'center', justifyContent: 'center' },
  ball: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.ball,
    shadowColor: colors.ball,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  ballSpacer: { width: 20 },
  names: { flex: 1, fontSize: 15, fontWeight: '700' },
  /** Terminado el partido, el perdedor se apaga: el ganador se lee solo. */
  namesLost: { opacity: 0.45 },

  label: { flex: 1, fontSize: 9, fontWeight: '900', color: colors.golden, letterSpacing: 1.2 },
  headerText: {
    height: 14,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textFaint,
    letterSpacing: 1,
    textAlign: 'center',
  },

  cell: {
    width: CELL,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPointsWidth: { width: CELL + 14 },
  cellText: { fontVariant: ['tabular-nums'], textAlign: 'center' },

  setCell: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  setText: { fontSize: 18, fontWeight: '700', color: colors.textFaint, marginTop: 7 },
  setWon: { color: colors.text },
  sup: { fontSize: 10, fontWeight: '800', color: colors.textFaint, marginTop: 5, marginLeft: 1 },

  cellGames: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  gamesText: { fontSize: 19, fontWeight: '800', color: colors.text },

  // El casillero en vivo: el unico encendido de todo el tanteador.
  cellPoints: {
    width: CELL + 14,
    backgroundColor: alpha('#FFFFFF', 0.14),
    borderWidth: 1,
    borderColor: alpha('#FFFFFF', 0.35),
  },
  pointsText: { fontSize: 20, fontWeight: '900', color: colors.text },
});
