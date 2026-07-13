import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CareerPoint, CareerStats } from '../engine/career';
import { pct } from '../engine/stats';
import { Brand } from './Brand';
import { ShotStack } from './charts/ShotStack';
import { Trend, type TrendPoint } from './charts/Trend';
import { alpha, colors, pressed, radius, ripple, space } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const num = (n: number | null, suffix = ''): string =>
  n === null ? '—' : `${Math.round(n)}${suffix}`;

/**
 * Las metricas que se pueden seguir en el tiempo.
 *
 * `of` saca el numero de UN partido (para las barras). `total` lo saca del acumulado, sumando
 * contadores — nunca promediando las barras. Son dos cuentas distintas a proposito: la linea
 * del promedio tiene que ser el acumulado de verdad, no el promedio de lo dibujado, que
 * mentiria a favor de los partidos cortos.
 *
 * EL COLOR NO CAMBIA CON LA METRICA. Antes cada una traia el suyo —verde el ratio, celeste el
 * saque— y eso era decoracion pura: la metrica ya esta escrita en el chip de arriba, el color
 * no estaba codificando nada. Y encima chocaba: el ratio en verde se leia como el grafico de
 * winners de mas abajo, y parecian el mismo.
 *
 * Va el lima del logo, que es el acento de Vigia y no significa ninguna otra cosa.
 *
 * Con UNA excepcion, que es la regla de siempre: los errores no forzados van en bordo, porque
 * ahi mas es PEOR. Una barra lima que sube se lee como que vas bien; si son errores, vas mal.
 * El cambio de color es el aviso de que cambio la regla.
 */
const METRICS = [
  {
    key: 'ratio',
    label: 'Winners por error',
    color: colors.ball,
    of: (p: CareerPoint) =>
      p.stats.unforcedErrors === 0
        ? p.stats.winners === 0
          ? null
          : p.stats.winners
        : p.stats.winners / p.stats.unforcedErrors,
    total: (c: CareerStats) =>
      c.totals.unforcedErrors === 0
        ? c.totals.winners === 0
          ? null
          : c.totals.winners
        : c.totals.winners / c.totals.unforcedErrors,
    format: (v: number) => v.toFixed(1),
  },
  {
    key: 'primero',
    label: '1er saque adentro',
    color: colors.ball,
    of: (p: CareerPoint) => pct(p.stats.firstServesIn, p.stats.servePointsPlayed),
    total: (c: CareerStats) => pct(c.totals.firstServesIn, c.totals.servePointsPlayed),
    format: (v: number) => `${Math.round(v)}%`,
  },
  {
    key: 'gana1',
    label: 'Gana con 1er saque',
    color: colors.ball,
    of: (p: CareerPoint) => pct(p.stats.firstServePointsWon, p.stats.firstServesIn),
    total: (c: CareerStats) => pct(c.totals.firstServePointsWon, c.totals.firstServesIn),
    format: (v: number) => `${Math.round(v)}%`,
  },
  {
    key: 'resto',
    label: 'Gana restando',
    color: colors.ball,
    of: (p: CareerPoint) => pct(p.stats.returnPointsWon, p.stats.returnPointsPlayed),
    total: (c: CareerStats) => pct(c.totals.returnPointsWon, c.totals.returnPointsPlayed),
    format: (v: number) => `${Math.round(v)}%`,
  },
  {
    key: 'enf',
    label: 'Errores no forzados',
    color: colors.worse,
    of: (p: CareerPoint) => p.stats.unforcedErrors,
    total: (c: CareerStats) =>
      c.matches === 0 ? null : c.totals.unforcedErrors / c.matches,
    format: (v: number) => v.toFixed(1),
  },
] as const;

export function CareerScreen({ stats, onClose }: { stats: CareerStats; onClose: () => void }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]['key']>('ratio');
  const m = METRICS.find((x) => x.key === metric)!;

  const points: TrendPoint[] = useMemo(
    () => stats.timeline.map((p) => ({ at: p.at, value: m.of(p) })),
    [stats.timeline, m],
  );

  const ratio = METRICS[0].total(stats);
  const first = pct(stats.totals.firstServesIn, stats.totals.servePointsPlayed);
  const share = pct(stats.teamPointsWon, stats.totalPoints);

  /**
   * Los golpes de cada categoria, partido a partido — y UNA escala para los tres.
   *
   * La escala sale del partido con mas golpes de CUALQUIER categoria. Si cada grafico se
   * escalara a su propio maximo, los tres se verian igual de altos: dos winners y veinte
   * errores ocuparian lo mismo, y la unica pregunta que importa —¿pego mas de lo que
   * regalo?— quedaria sin respuesta.
   */
  const shots = useMemo(() => {
    const total = (t: Record<string, number | undefined>) =>
      Object.values(t).reduce<number>((n, v) => n + (v ?? 0), 0);

    let scale = 0;
    for (const p of stats.timeline) {
      scale = Math.max(
        scale,
        total(p.stats.winnersByShot),
        total(p.stats.forcedByShot),
        total(p.stats.unforcedByShot),
      );
    }

    return {
      scale,
      winners: stats.timeline.map((p) => ({ at: p.at, byShot: p.stats.winnersByShot })),
      forced: stats.timeline.map((p) => ({ at: p.at, byShot: p.stats.forcedByShot })),
      unforced: stats.timeline.map((p) => ({ at: p.at, byShot: p.stats.unforcedByShot })),
    };
  }, [stats.timeline]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.head}>
        {/* Aca el nombre no es una etiqueta de pantalla: es de quien habla todo lo que sigue. */}
        <Brand size={26} subtitle={stats.totals.name} subject tint={colors.ball} />
        <Pressable
          style={({ pressed: p }) => [s.close, p && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onClose}
          hitSlop={10}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.list}>
        {stats.matches === 0 ? (
          <Text style={s.empty}>Todavía no jugó ningún partido.</Text>
        ) : (
          <>
            {/* EL RETRATO. Quien sos, de un vistazo.

                Ganados y perdidos son DOS numeros, no un "4-2": ese guion obliga a decodificar
                cual es cual, y no hay ninguna razon para hacerlo trabajar.

                Y los que se cortaron a mano se dicen "sin terminar", que es como los llama el
                historial. Antes decia "sin definir" — una palabra que no existia en ningun otro
                lado de la app, inventada para un solo cartel. */}
            <View style={s.portrait}>
              <Big
                value={`${stats.matches}`}
                label="Partidos"
                sub={
                  stats.undecided > 0 ? `${stats.undecided} sin terminar` : 'todos terminados'
                }
              />
              <Big value={`${stats.won}`} label="Ganados" />
              <Big value={`${stats.lost}`} label="Perdidos" />
              <Big value={num(share, '%')} label="Puntos" />
              <Big
                value={ratio === null ? '—' : ratio.toFixed(1)}
                label="W / ENF"
                accent={colors.winner}
              />
            </View>

            {/* LA PELICULA. El acumulado deja de moverse a los treinta partidos; esto no. */}
            <Section title="Evolución" subtitle="un partido, una barra">
              <View style={s.chips}>
                {METRICS.map((x) => (
                  <Pressable
                    key={x.key}
                    style={({ pressed: p }) => [
                      s.chip,
                      x.key === metric && s.chipOn,
                      p && pressed,
                    ]}
                    android_ripple={ripple}
                    onPress={() => {
                      tick();
                      setMetric(x.key);
                    }}
                  >
                    <Text
                      style={[s.chipText, x.key === metric && s.chipTextOn]}
                      numberOfLines={1}
                    >
                      {x.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Trend
                points={points}
                average={m.total(stats)}
                format={m.format}
                color={m.color}
              />
            </Section>

            <Section title="Su juego" subtitle={`${stats.totalPoints} puntos jugados`}>
              <View style={s.grid}>
                <Stat label="Winners" value={`${stats.totals.winners}`} />
                <Stat label="E. forzados" value={`${stats.totals.forcedErrors}`} />
                <Stat label="E. no forz." value={`${stats.totals.unforcedErrors}`} />
              </View>

              <View style={s.divider} />
              <Text style={s.blockLabel}>SACANDO</Text>

              <View style={s.grid}>
                <Stat
                  label="1er saque"
                  value={num(first, '%')}
                  sub={`${stats.totals.firstServesIn}/${stats.totals.servePointsPlayed}`}
                />
                <Stat
                  label="Gana c/ 1ro"
                  value={num(
                    pct(stats.totals.firstServePointsWon, stats.totals.firstServesIn),
                    '%',
                  )}
                />
                <Stat
                  label="Gana c/ 2do"
                  value={num(
                    pct(stats.totals.secondServePointsWon, stats.totals.secondServePointsPlayed),
                    '%',
                  )}
                />
              </View>

              <View style={s.grid}>
                <Stat label="Aces" value={`${stats.totals.aces}`} />
                <Stat label="Dobles faltas" value={`${stats.totals.doubleFaults}`} />
                <View style={s.statCell} />
              </View>

              <View style={s.divider} />
              <Text style={s.blockLabel}>RESTANDO</Text>

              <View style={s.grid}>
                <Stat
                  label="Gana restando"
                  value={num(
                    pct(stats.totals.returnPointsWon, stats.totals.returnPointsPlayed),
                    '%',
                  )}
                />
                <Stat label="Aces recibidos" value={`${stats.totals.acesConceded}`} />
                <Stat label="Dobles provocadas" value={`${stats.totals.doubleFaultsForced}`} />
              </View>
            </Section>

            {/* LOS GOLPES, CONTRA EL TIEMPO. El desglose sumado dice cuanto, pero no dice si
                estas mejorando — y esta pantalla existe para lo segundo.

                Los tres comparten la escala a proposito: asi la altura significa lo mismo en
                los tres, y de un vistazo se ve si pegas mas winners de los que regalas
                errores. Con cada uno escalado a su propio maximo, los tres se verian igual de
                altos y no se podrian comparar — que es la unica pregunta que importa. */}
            {shots.scale > 0 && (
              <>
                <Section title="Winners" subtitle="por golpe, partido a partido">
                  <ShotStack columns={shots.winners} color={colors.winner} scale={shots.scale} />
                </Section>

                <Section title="Errores forzados" subtitle="por golpe, partido a partido">
                  <ShotStack
                    columns={shots.forced}
                    color={colors.errorForced}
                    scale={shots.scale}
                  />
                </Section>

                <Section title="Errores no forzados" subtitle="por golpe, partido a partido">
                  <ShotStack
                    columns={shots.unforced}
                    color={colors.errorUnforced}
                    scale={shots.scale}
                  />
                </Section>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Big({
  value,
  label,
  sub,
  accent,
}: {
  value: string;
  label: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <View style={s.bigCell}>
      <Text style={[s.bigValue, accent ? { color: accent } : null]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={s.bigLabel} numberOfLines={1}>
        {label}
      </Text>
      {sub ? <Text style={s.bigSub}>{sub}</Text> : null}
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      <View style={s.card}>{children}</View>
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

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  scroll: { flex: 1, borderTopWidth: 1, borderColor: colors.border },
  list: { padding: space.md, gap: space.lg, paddingTop: space.lg, paddingBottom: space.xl },

  /** El retrato: cuatro numeros, sin adornos. Es lo que se mira primero y no se lee, se ve. */
  portrait: {
    flexDirection: 'row',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  /** Cinco celdas: los valores son cortos ("8", "4", "52%"), pero las etiquetas no. */
  bigCell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 2 },
  bigValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  bigLabel: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  bigSub: { color: colors.textFaint, fontSize: 9, textAlign: 'center' },

  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  sectionSub: { flex: 1, color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  card: {
    padding: space.md,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  chipText: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  chipTextOn: { color: colors.text, fontWeight: '900' },

  grid: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  statSub: { color: colors.textFaint, fontSize: 9 },

  blockLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  divider: { height: 1, backgroundColor: colors.border },

  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19, padding: space.md },
});
