import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { computeStats, pct, winnerErrorRatio } from '../engine/stats';
import type { PlayerStats, ShotTally } from '../engine/stats';
import type { MatchConfig, MatchEvent, MatchState, Shot, TeamId } from '../engine';
import { Scoreboard } from './Scoreboard';
import { SHOT_LABELS } from './shots';
import { alpha, colors, radius, space, teamColor } from './theme';

const num = (n: number | null, suffix = ''): string =>
  n === null ? '—' : `${Math.round(n)}${suffix}`;

const ratio = (p: PlayerStats): string => {
  const r = winnerErrorRatio(p);
  if (r === null) return '—';
  if (r === Infinity) return `${p.winners}/0`;
  return r.toFixed(1);
};

const topShots = (t: ShotTally, n = 3): Array<[Shot, number]> =>
  (Object.entries(t) as Array<[Shot, number]>).sort((a, b) => b[1] - a[1]).slice(0, n);

export function StatsScreen({
  config,
  events,
  state,
  finishedEarly,
  onBack,
  onShare,
  onFinish,
}: {
  config: MatchConfig;
  events: MatchEvent[];
  state: MatchState;
  finishedEarly: boolean;
  onBack: () => void;
  onShare: () => void;
  onFinish: () => void;
}) {
  const stats = computeStats(config, events);
  const over = state.finished || finishedEarly;

  // En amateur las canchas se alquilan por tiempo: terminar antes NO es un caso de
  // borde, es como termina la mayoria de los partidos. Pero es destructivo, asi que
  // se confirma.
  const confirmFinish = () =>
    Alert.alert(
      '¿Terminar el partido?',
      'Se cierra acá y quedan las estadísticas de lo jugado hasta ahora.',
      [
        { text: 'Seguir jugando', style: 'cancel' },
        { text: 'Terminar', style: 'destructive', onPress: onFinish },
      ],
    );

  return (
    <SafeAreaView style={s.root}>
      <Scoreboard config={config} state={state} />

      <ScrollView contentContainerStyle={s.list}>
        {stats.totalPoints === 0 ? (
          <Text style={s.empty}>Todavía no se jugó ningún punto.</Text>
        ) : (
          <>
            {(['A', 'B'] as TeamId[]).map((t) => (
              <View key={t} style={s.block}>
                <TeamBar config={config} team={t} stats={stats} />
                {[config.teams[t].drive, config.teams[t].reves].map((id) => (
                  <PlayerCard key={id} p={stats.players[id]!} />
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={s.actions}>
        {over ? (
          <Text style={s.overNote}>
            {finishedEarly && !state.finished
              ? 'Partido terminado antes de tiempo.'
              : 'Partido terminado.'}
          </Text>
        ) : null}

        <Pressable style={[s.btn, s.btnPrimary]} onPress={onBack}>
          <Text style={s.btnPrimaryText}>{over ? 'Volver' : 'Volver al partido'}</Text>
        </Pressable>

        <View style={s.row}>
          <Pressable style={[s.btn, s.btnRow, s.btnGhost]} onPress={onShare}>
            <Text style={s.btnGhostText}>Compartir</Text>
          </Pressable>
          {!over && (
            <Pressable style={[s.btn, s.btnRow, s.btnGhost]} onPress={confirmFinish}>
              <Text style={s.btnDanger}>Terminar partido</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function TeamBar({
  config,
  team,
  stats,
}: {
  config: MatchConfig;
  team: TeamId;
  stats: ReturnType<typeof computeStats>;
}) {
  const t = stats.teams[team];
  const names = [config.teams[team].drive, config.teams[team].reves]
    .map((p) => config.players[p]!.name.split(' ')[0])
    .join(' / ');
  const share = pct(t.pointsWon, stats.totalPoints);

  return (
    <View style={[s.teamBar, { borderColor: alpha(teamColor(team), 0.4) }]}>
      <Text style={[s.teamName, { color: teamColor(team) }]} numberOfLines={1}>
        {names}
      </Text>
      <Stat label="Puntos" value={`${t.pointsWon}`} sub={num(share, '%')} />
      <Stat
        label="Breaks"
        value={`${t.breakPointsConverted}/${t.breakPointsPlayed}`}
        sub="convertidos"
      />
      <Stat
        label="Salvados"
        value={`${t.breakPointsSaved}/${t.breakPointsFaced}`}
        sub="break points"
      />
    </View>
  );
}

function PlayerCard({ p }: { p: PlayerStats }) {
  const c = teamColor(p.team);
  const first = pct(p.firstServesIn, p.servePointsPlayed);
  const won1 = pct(p.firstServePointsWon, p.firstServePointsPlayed);
  const won2 = pct(p.secondServePointsWon, p.secondServePointsPlayed);

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={[s.dot, { backgroundColor: c }]} />
        <Text style={s.cardName}>{p.name}</Text>
        <View style={s.ratioBox}>
          <Text style={[s.ratioValue, { color: c }]}>{ratio(p)}</Text>
          <Text style={s.ratioLabel}>W / ENF</Text>
        </View>
      </View>

      <View style={s.grid}>
        <Stat label="Winners" value={`${p.winners}`} color={colors.winner} />
        <Stat label="E. forzados" value={`${p.forcedErrors}`} color={colors.errorForced} />
        <Stat label="E. no forz." value={`${p.unforcedErrors}`} color={colors.errorUnforced} />
      </View>

      <View style={s.divider} />

      <View style={s.grid}>
        <Stat label="1er saque" value={num(first, '%')} sub={`${p.firstServesIn}/${p.servePointsPlayed}`} />
        <Stat label="Gana c/ 1ro" value={num(won1, '%')} sub={`${p.firstServePointsWon}/${p.firstServePointsPlayed}`} />
        <Stat label="Gana c/ 2do" value={num(won2, '%')} sub={`${p.secondServePointsWon}/${p.secondServePointsPlayed}`} />
      </View>

      <View style={s.grid}>
        <Stat label="Aces" value={`${p.aces}`} />
        <Stat label="Dobles faltas" value={`${p.doubleFaults}`} />
        <View style={s.statCell} />
      </View>

      <ShotBreakdown title="Winners con" tally={p.winnersByShot} color={colors.winner} />
      <ShotBreakdown title="Errores no forzados con" tally={p.unforcedByShot} color={colors.errorUnforced} />
    </View>
  );
}

/** El desglose por golpe es lo que ningun reloj puede darte. */
function ShotBreakdown({
  title,
  tally,
  color,
}: {
  title: string;
  tally: ShotTally;
  color: string;
}) {
  const top = topShots(tally);
  if (top.length === 0) return null;
  return (
    <View style={s.shots}>
      <Text style={s.shotsTitle}>{title}</Text>
      <View style={s.shotsRow}>
        {top.map(([shot, n]) => (
          <View key={shot} style={[s.chip, { borderColor: alpha(color, 0.45), backgroundColor: alpha(color, 0.12) }]}>
            <Text style={[s.chipN, { color }]}>{n}</Text>
            <Text style={s.chipLabel}>{SHOT_LABELS[shot]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: space.sm },
  list: { padding: space.md, gap: space.lg },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: space.xl },

  block: { gap: space.sm },

  teamBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  teamName: { flex: 1, fontSize: 14, fontWeight: '800' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  cardName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  ratioBox: { alignItems: 'flex-end' },
  ratioValue: { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ratioLabel: { color: colors.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  grid: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  statSub: { color: colors.textFaint, fontSize: 9, fontVariant: ['tabular-nums'] },

  divider: { height: 1, backgroundColor: colors.border },

  shots: { gap: space.xs },
  shotsTitle: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  shotsRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipN: { fontSize: 12, fontWeight: '900' },
  chipLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },

  overNote: { color: colors.textFaint, fontSize: 11, textAlign: 'center' },
  actions: { padding: space.md, gap: space.sm, backgroundColor: colors.surface },
  // Sin flex: dentro de un contenedor en columna, flex:1 colapsa el boton y le come el texto.
  btn: { paddingVertical: space.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flex: 1 },
  btnPrimary: { backgroundColor: colors.text },
  btnPrimaryText: { color: colors.onLight, fontWeight: '800', fontSize: 15 },
  btnGhost: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.text, fontWeight: '700' },
  btnDanger: { color: colors.errorUnforced, fontWeight: '700' },
});
