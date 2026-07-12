import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { computeStats, pct, teamShotLines, winnerErrorRatio, shotLines } from '../engine/stats';
import type { MatchStats, PlayerStats } from '../engine/stats';
import type { MatchConfig, MatchEvent, MatchState, TeamId } from '../engine';
import { HeadToHead, type Cell, type Row } from './charts/HeadToHead';
import { ShotBars } from './charts/ShotBars';
import { Scoreboard } from './Scoreboard';
import { colors, radius, space, teamColor } from './theme';

const num = (n: number | null, suffix = ''): string =>
  n === null ? '—' : `${Math.round(n)}${suffix}`;

const ratio = (p: PlayerStats): string => {
  const r = winnerErrorRatio(p);
  if (r === null) return '—';
  if (r === Infinity) return `${p.winners}/0`;
  return r.toFixed(1);
};

const teamNames = (config: MatchConfig, t: TeamId): string =>
  [config.teams[t].drive, config.teams[t].reves]
    .map((p) => config.players[p]!.name.split(' ')[0])
    .join(' / ');

/** En el mismo orden en que se dibujan las barras: primero drive, despues reves. */
const playerNames = (config: MatchConfig, t: TeamId): [string, string] =>
  [config.teams[t].drive, config.teams[t].reves].map((p) => config.players[p]!.name) as [
    string,
    string,
  ];

/**
 * Las filas de la comparativa, POR JUGADOR. Un entrenador no corrige a un equipo:
 * la suma por equipo esconde cual de los dos esta tirando los errores.
 *
 * Las etiquetas van partidas en dos renglones a proposito, para que todas las filas
 * midan lo mismo y la grilla se lea pareja.
 */
const buildRows = (stats: MatchStats, config: MatchConfig): Row[] => {
  const four = (['A', 'B'] as TeamId[]).map((t) =>
    [config.teams[t].drive, config.teams[t].reves].map((id) => stats.players[id]!),
  ) as [PlayerStats[], PlayerStats[]];

  const cells = (
    pick: (p: PlayerStats) => number,
    fmt: (p: PlayerStats) => string,
  ): Pick<Row, 'a' | 'b'> => ({
    a: four[0].map((p) => ({ text: fmt(p), value: pick(p) })) as [Cell, Cell],
    b: four[1].map((p) => ({ text: fmt(p), value: pick(p) })) as [Cell, Cell],
  });

  const count = (label: string, pick: (p: PlayerStats) => number): Row => ({
    label,
    ...cells(pick, (p) => `${pick(p)}`),
  });

  const percent = (
    label: string,
    won: (p: PlayerStats) => number,
    played: (p: PlayerStats) => number,
  ): Row => ({
    label,
    ...cells(
      (p) => pct(won(p), played(p)) ?? 0,
      (p) => num(pct(won(p), played(p)), '%'),
    ),
  });

  return [
    count('Winners', (p) => p.winners),
    count('Errores\nno forzados', (p) => p.unforcedErrors),
    count('Errores\nforzados', (p) => p.forcedErrors),
    count('Aces', (p) => p.aces),
    count('Dobles\nfaltas', (p) => p.doubleFaults),
    percent(
      '1er saque\nadentro',
      (p) => p.firstServesIn,
      (p) => p.servePointsPlayed,
    ),
    percent(
      'Gana con\n1er saque',
      (p) => p.firstServePointsWon,
      (p) => p.firstServePointsPlayed,
    ),
    percent(
      'Gana con\n2do saque',
      (p) => p.secondServePointsWon,
      (p) => p.secondServePointsPlayed,
    ),
  ];
};

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
  // borde, es como termina la mayoria de los partidos. Pero es destructivo: se confirma.
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
            {/* Lo primero que ves: quien va ganando cada cosa, sin leer un numero. */}
            <Section title="Cara a cara">
              {/* Puntos y breaks son del EQUIPO por naturaleza: van aparte, no en el
                  grafico por jugador. */}
              <View style={s.teamStrip}>
                <TeamKpi
                  value={`${stats.teams.A.pointsWon}`}
                  sub={num(pct(stats.teams.A.pointsWon, stats.totalPoints), '%')}
                  color={colors.teamA}
                  align="flex-start"
                />
                <View style={s.teamStripMid}>
                  <Text style={s.teamStripLabel}>Puntos ganados</Text>
                  <Text style={s.teamStripLabel}>
                    Breaks {stats.teams.A.breakPointsConverted}/{stats.teams.A.breakPointsPlayed}
                    {'  ·  '}
                    {stats.teams.B.breakPointsConverted}/{stats.teams.B.breakPointsPlayed}
                  </Text>
                </View>
                <TeamKpi
                  value={`${stats.teams.B.pointsWon}`}
                  sub={num(pct(stats.teams.B.pointsWon, stats.totalPoints), '%')}
                  color={colors.teamB}
                  align="flex-end"
                />
              </View>

              <View style={s.divider} />

              <HeadToHead
                rows={buildRows(stats, config)}
                playersA={playerNames(config, 'A')}
                playersB={playerNames(config, 'B')}
                colorA={colors.teamAFill}
                colorB={colors.teamBFill}
              />
            </Section>

            {(['A', 'B'] as TeamId[]).map((t) => (
              <Section key={t} title="Golpes" accent={teamColor(t)} subtitle={teamNames(config, t)}>
                <ShotBars lines={teamShotLines(stats, config, t)} />
              </Section>
            ))}

            <Section title="Jugador por jugador">
              {(['A', 'B'] as TeamId[]).flatMap((t) =>
                [config.teams[t].drive, config.teams[t].reves].map((id) => (
                  <PlayerCard key={id} p={stats.players[id]!} />
                )),
              )}
            </Section>
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

function Section({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        {accent ? <View style={[s.sectionDot, { backgroundColor: accent }]} /> : null}
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function PlayerCard({ p }: { p: PlayerStats }) {
  const c = teamColor(p.team);
  const first = pct(p.firstServesIn, p.servePointsPlayed);
  const won1 = pct(p.firstServePointsWon, p.firstServePointsPlayed);
  const won2 = pct(p.secondServePointsWon, p.secondServePointsPlayed);

  return (
    <View style={s.player}>
      <View style={s.cardHead}>
        <View style={[s.dot, { backgroundColor: c }]} />
        <Text style={s.cardName}>{p.name}</Text>
        <View style={s.ratioBox}>
          <Text style={s.ratioValue}>{ratio(p)}</Text>
          <Text style={s.ratioLabel}>W / ENF</Text>
        </View>
      </View>

      <View style={s.grid}>
        <Stat label="Winners" value={`${p.winners}`} />
        <Stat label="E. forzados" value={`${p.forcedErrors}`} />
        <Stat label="E. no forz." value={`${p.unforcedErrors}`} />
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

      {shotLines(p).length > 0 && (
        <>
          <View style={s.divider} />
          <ShotBars lines={shotLines(p)} />
        </>
      )}
    </View>
  );
}

function TeamKpi({
  value,
  sub,
  color,
  align,
}: {
  value: string;
  sub: string;
  color: string;
  align: 'flex-start' | 'flex-end';
}) {
  return (
    <View style={{ alignItems: align, gap: 2 }}>
      {/* La cifra grande va en tinta; el color de equipo lo carga la pastilla de al lado. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {align === 'flex-start' && <View style={[s.dot, { backgroundColor: color }]} />}
        <Text style={s.kpi}>{value}</Text>
        {align === 'flex-end' && <View style={[s.dot, { backgroundColor: color }]} />}
      </View>
      <Text style={s.kpiSub}>{sub}</Text>
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.statCell}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: space.sm },
  list: { padding: space.md, gap: space.lg, paddingBottom: space.xl },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: space.xl },

  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionDot: { width: 8, height: 8, borderRadius: radius.pill },
  sectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionSub: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  player: { gap: space.sm, paddingBottom: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  cardName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  ratioBox: { alignItems: 'flex-end' },
  ratioValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  ratioLabel: { color: colors.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  grid: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  statSub: { color: colors.textFaint, fontSize: 9, fontVariant: ['tabular-nums'] },

  divider: { height: 1, backgroundColor: colors.border },

  teamStrip: { flexDirection: 'row', alignItems: 'center' },
  teamStripMid: { flex: 1, alignItems: 'center', gap: 2 },
  teamStripLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  /** Cifra grande: figuras proporcionales, no tabulares. */
  kpi: { color: colors.text, fontSize: 26, fontWeight: '900' },
  kpiSub: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },

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
