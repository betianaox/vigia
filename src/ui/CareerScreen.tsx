import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CareerPoint, CareerStats } from '../engine/career';
import { pct, totalDuels } from '../engine/stats';
import { L } from '../i18n';
import { Brand } from './Brand';
import { useRoster } from './roster';
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
 * Los colores ALTERNAN entre el lima y el celeste, y eso si tiene una razon: si cambias de
 * pastilla y el color no cambia, no se nota que el grafico se actualizo. Alternando, el cambio
 * de color confirma que estas viendo otra cosa. No codifica nada mas — la metrica ya esta
 * escrita en la pastilla.
 *
 * Los dos van en su version de GRAFICO (`ballChart`, `aceChart`). El lima puro es una pastilla
 * de 8px al lado de un nombre; en una columna de barras llenas es neon y cansa la vista. Misma
 * identidad, medio tono de voz.
 *
 * Con UNA excepcion, que es la regla de siempre: los errores no forzados van en bordo, porque
 * ahi mas es PEOR. Una barra que sube se lee como que vas bien; si son errores, vas mal. El
 * cambio de color es el aviso de que cambio la regla.
 */
const metrics = () =>
  [
    {
      key: 'ratio',
      label: L.stats.winnersPerError,
      color: colors.ballChart,
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
      label: L.stats.firstServeIn,
      color: colors.aceChart,
      of: (p: CareerPoint) => pct(p.stats.firstServesIn, p.stats.servePointsPlayed),
      total: (c: CareerStats) => pct(c.totals.firstServesIn, c.totals.servePointsPlayed),
      format: (v: number) => `${Math.round(v)}%`,
    },
    {
      key: 'gana1',
      label: L.stats.wonWithFirstLong,
      color: colors.ballChart,
      of: (p: CareerPoint) => pct(p.stats.firstServePointsWon, p.stats.firstServesIn),
      total: (c: CareerStats) => pct(c.totals.firstServePointsWon, c.totals.firstServesIn),
      format: (v: number) => `${Math.round(v)}%`,
    },
    {
      key: 'enf',
      label: L.stats.unforcedErrors,
      color: colors.worse,
      of: (p: CareerPoint) => p.stats.unforcedErrors,
      total: (c: CareerStats) =>
        c.matches === 0 ? null : c.totals.unforcedErrors / c.matches,
      format: (v: number) => v.toFixed(1),
    },
  ] as const;

export function CareerScreen({ stats, onClose }: { stats: CareerStats; onClose: () => void }) {
  const { nameOf } = useRoster();
  const [metric, setMetric] = useState<ReturnType<typeof metrics>[number]['key']>('ratio');
  const m = metrics().find((x) => x.key === metric)!;

  const points: TrendPoint[] = useMemo(
    () => stats.timeline.map((p) => ({ at: p.at, value: m.of(p) })),
    [stats.timeline, m],
  );

  const first = pct(stats.totals.firstServesIn, stats.totals.servePointsPlayed);
  /** Las dos fallas de devolucion suman una: lo que cambia es como se fallo, no que se fallo. */
  const careerReturnErrors =
    stats.totals.returnErrorsForced + stats.totals.returnErrorsUnforced;
  const careerForcedCaused = totalDuels(stats.totals.forcedErrorsCaused);
  const share = pct(stats.teamPointsWon, stats.totalPoints);

  /**
   * Nada propio que mostrar. Se mide por las ACCIONES, no por los puntos del partido: alguien
   * pudo estar en la cancha sin pegar un winner ni sacar una vez, y ahi la grilla es un muro de
   * ceros. El retrato sigue; el resto es "Datos insuficientes".
   */
  const noData =
    stats.totals.winners === 0 &&
    stats.totals.forcedErrors === 0 &&
    stats.totals.unforcedErrors === 0 &&
    stats.totals.servePointsPlayed === 0;

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

    /**
     * SIN LOS FORZADOS: no hay desglose por golpe de ese lado y no lo va a haber (ver
     * `PlayerStats`). El grafico existia porque el motor guardaba con que golpe habia fallado
     * el que sufrio el error; desde que la hoja pregunta por el golpe del que FORZA, ese dato
     * no se captura, y el grafico quedaria vacio para siempre.
     *
     * Y la escala la fijan los dos que quedan: si siguiera contando una categoria que ya no
     * tiene datos, las barras se dibujarian contra un techo inexistente.
     */
    let scale = 0;
    for (const p of stats.timeline) {
      scale = Math.max(scale, total(p.stats.winnersByShot), total(p.stats.unforcedByShot));
    }

    return {
      scale,
      winners: stats.timeline.map((p) => ({ at: p.at, byShot: p.stats.winnersByShot })),
      unforced: stats.timeline.map((p) => ({ at: p.at, byShot: p.stats.unforcedByShot })),
    };
  }, [stats.timeline]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.head}>
        {/* Aca el nombre no es una etiqueta de pantalla: es de quien habla todo lo que sigue.
            Sale del plantel, por id — no de la copia que guardo el primer partido que jugo. */}
        <Brand
          size={26}
          subtitle={nameOf(stats.player, stats.totals.name)}
          subject
          tint={colors.ball}
        />
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
          <Text style={s.empty}>{L.stats.noMatches}</Text>
        ) : (
          <>
            {/* EL RETRATO. Quien sos, de un vistazo.

                Ganados y perdidos son DOS numeros, no un "4-2": ese guion obliga a decodificar
                cual es cual, y no hay ninguna razon para hacerlo trabajar.

                Y los que se cortaron a mano se dicen "sin terminar", que es como los llama el
                historial. Antes decia "sin definir" — una palabra que no existia en ningun otro
                lado de la app, inventada para un solo cartel. */}
            <View style={s.portrait}>
              <View style={s.portraitRow}>
              <Big value={`${stats.matches}`} label={L.stats.matches} />
              <Big value={`${stats.won}`} label={L.stats.won} />
              <Big value={`${stats.lost}`} label={L.stats.lost} />
              <Big value={num(share, '%')} label={L.stats.pointsShare} />

              {/* Los dos crudos y el color, igual que en la tarjeta de cada jugador. El ratio
                  (1.3) tiene un umbral invisible —hay que saber que el corte esta en 1.0— y el
                  par no: verde si pegaste mas de lo que regalaste, rojo si es al reves.

                  Antes este numero iba en verde SIEMPRE, como acento. Ahora el verde significa
                  algo, y dos verdes con dos significados es peor que un color feo. */}
              {/* Sin un punto cargado, "0/0" no es un cero: es que no hay dato. Guion, como en
                  todo el resto de la app — y sin color, que ahi no hay nada mejor ni peor. */}
              <Big
                value={noData ? '—' : `${stats.totals.winners}/${stats.totals.unforcedErrors}`}
                label={L.stats.winnersOverErrors}
                accent={
                  noData || stats.totals.winners === stats.totals.unforcedErrors
                    ? colors.text
                    : stats.totals.winners > stats.totals.unforcedErrors
                      ? colors.winnerChart
                      : colors.errorUnforcedChart
                }
              />
              </View>

              {/* El estado del historial —cuantos quedaron a medias— en su propia linea, no
                  colgando de "Partidos": ahi "todos terminados" se partia en dos renglones bajo
                  una sola celda y quedaba escalonado. Aca es un pie del retrato, entero.

                  Pill GRIS, no celeste: "sin terminar" es un ESTADO, y en el historial ya es gris.
                  El celeste esta reservado para las cantidades; que "sin terminar" fuera azul aca
                  seria el unico lugar de la app donde ese mismo rotulo cambia de significado. */}
              <View style={s.portraitTag}>
                <Text style={s.portraitTagText}>
                  {stats.undecided > 0 ? L.stats.unfinished(stats.undecided) : L.stats.allFinished}
                </Text>
              </View>
            </View>

            {/* LA PELICULA. El acumulado deja de moverse a los treinta partidos; esto no. */}
            <Section title={L.stats.evolution} subtitle={L.stats.evolutionSub}>
              <View style={s.chips}>
                {metrics().map((x) => (
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
                    {/* Dos renglones, no puntos suspensivos: los nombres completos entran, y
                        cortar "Errores no forzados" en "Errores no fo…" no ahorra nada — hay
                        que leerlo igual, solo que peor. Es lo mismo que ya hace la grilla por
                        jugador con sus etiquetas. */}
                    <Text
                      style={[s.chipText, x.key === metric && s.chipTextOn]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
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

            <Section title={L.stats.myGame} subtitle={L.stats.pointsPlayed(stats.totalPoints)}>
              {noData ? (
                <Text style={s.noData}>{L.stats.noPoints}</Text>
              ) : (
              <>
              <View style={s.grid}>
                <Stat label={L.stats.winners} value={`${stats.totals.winners}`} />
                <Stat label={L.stats.forcedShort} value={`${stats.totals.forcedErrors}`} />
                <Stat label={L.stats.unforcedShort} value={`${stats.totals.unforcedErrors}`} />
              </View>

              {/* Los que provoco, en su propia celda: la misma que la ficha del partido, para
                  que las dos pantallas digan lo mismo con el mismo nombre. Sin "contra quien":
                  en un acumulado de dos temporadas esa lista no termina mas. */}
              <View style={s.grid}>
                <Stat
                  label={L.stats.forcedErrorsCaused}
                  value={careerForcedCaused > 0 ? `${careerForcedCaused}` : '—'}
                />
                <View style={s.statCell} />
                <View style={s.statCell} />
              </View>

              <View style={s.divider} />
              <Text style={s.blockLabel}>{L.stats.serving}</Text>

              <View style={s.grid}>
                <Stat
                  label={L.stats.firstServe}
                  value={num(first, '%')}
                  sub={`${stats.totals.firstServesIn}/${stats.totals.servePointsPlayed}`}
                />
                {/**
                 * LA FRACCION VA SIEMPRE, Y ACA MAS QUE EN UN PARTIDO.
                 *
                 * Un 62% de 12 saques y un 62% de 340 son la misma cifra y no dicen lo mismo:
                 * sin el denominador no se sabe si el numero es una tendencia o una casualidad
                 * de un dia. En un partido el volumen se intuye; en dos temporadas, no.
                 *
                 * Y hay una razon del propio motor: el acumulado NO promedia porcentajes, suma
                 * contadores y recien ahi divide (§7 bis). Mostrar los contadores es lo que
                 * hace visible ese trabajo — estaba bien calculado y no se veia.
                 */}
                <Stat
                  label={L.stats.wonWithFirst}
                  value={num(
                    pct(stats.totals.firstServePointsWon, stats.totals.firstServesIn),
                    '%',
                  )}
                  sub={`${stats.totals.firstServePointsWon}/${stats.totals.firstServesIn}`}
                />
                <Stat
                  label={L.stats.wonWithSecond}
                  value={num(
                    pct(stats.totals.secondServePointsWon, stats.totals.secondServePointsPlayed),
                    '%',
                  )}
                  sub={`${stats.totals.secondServePointsWon}/${stats.totals.secondServePointsPlayed}`}
                />
              </View>

              <View style={s.grid}>
                <Stat label={L.stats.aces} value={`${stats.totals.aces}`} />
                <Stat label={L.stats.doubleFaults} value={`${stats.totals.doubleFaults}`} />
                <View style={s.statCell} />
              </View>

              <View style={s.divider} />
              <Text style={s.blockLabel}>{L.stats.returning}</Text>

              {/* SIN "GANA RESTANDO": el punto que se gana restando lo definen cuatro, y el log
                  sabe quien resto, no quien lo termino. Es un dato del EQUIPO en la ficha de una
                  persona — la misma razon por la que el break no tiene dueno. Lo que se queria
                  saber de ahi ya lo dicen los breaks. El contador sigue en el motor por si
                  alguna vez hace falta a nivel equipo: lo que se fue es la vista. */}
              {/* LA FALLA EN RESTO VA PRIMERA: es el dato mas importante del bloque —lo pidio la
                  entrenadora— y es ademas el unico que mide algo que la persona HIZO. Los otros
                  dos cuentan lo que le hicieron o lo que fallo el rival. El orden de lectura es
                  jerarquia: lo primero de la fila es lo que hay que mirar. */}
              <View style={s.grid}>
                <Stat
                  label={L.stats.returnErrorPct}
                  /* Guion y no cero cuando nunca se uso el boton dedicado: un cero diria "no
                     fallo ninguna" y lo que pasa es que no se sabe. Igual que en el partido. */
                  value={
                    careerReturnErrors > 0
                      ? num(pct(careerReturnErrors, stats.totals.returnPointsPlayed), '%')
                      : '—'
                  }
                  sub={
                    careerReturnErrors > 0
                      ? `${careerReturnErrors}/${stats.totals.returnPointsPlayed}`
                      : undefined
                  }
                />
                <Stat label={L.stats.acesConceded} value={`${stats.totals.acesConceded}`} />
                <Stat label={L.stats.doubleFaultsForced} value={`${stats.totals.doubleFaultsForced}`} />
              </View>
              </>
              )}
            </Section>

            {/* LOS GOLPES, CONTRA EL TIEMPO. El desglose sumado dice cuanto, pero no dice si
                estas mejorando — y esta pantalla existe para lo segundo.

                Los tres comparten la escala a proposito: asi la altura significa lo mismo en
                los tres, y de un vistazo se ve si pegas mas winners de los que regalas
                errores. Con cada uno escalado a su propio maximo, los tres se verian igual de
                altos y no se podrian comparar — que es la unica pregunta que importa. */}
            {shots.scale > 0 && (
              <>
                <Section title={L.stats.winners} subtitle={L.stats.byShot}>
                  <ShotStack
                    columns={shots.winners}
                    color={colors.winnerChart}
                    scale={shots.scale}
                  />
                </Section>

                {/* NO HAY SECCION DE ERRORES FORZADOS POR GOLPE, y no es un recorte: no hay
                    con que dibujarla. La hoja pregunta con que golpe FORZO el que gano el
                    punto, no con cual fallo el que lo sufrio — asi que el desglose de este
                    lado no se captura. Un grafico vacio no es neutro: promete un dato que
                    la app no tiene.

                    El total de errores forzados sigue estando, en "Juego", y la evolucion
                    en el tantito de arriba. Lo que se fue es el por-golpe. */}
                <Section title={L.stats.unforcedErrors} subtitle={L.stats.byShot}>
                  <ShotStack
                    columns={shots.unforced}
                    color={colors.errorUnforcedChart}
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
  accent,
}: {
  value: string;
  label: string;
  accent?: string;
}) {
  return (
    <View style={s.bigCell}>
      {/* Se achica solo si no entra. El ancho de "87/69" no es fijo: crece con los partidos
          jugados, asi que un tamaño fijo funciona hoy y se corta el mes que viene. */}
      <Text
        style={[s.bigValue, accent ? { color: accent } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={s.bigLabel} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
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

  /** El retrato: quien sos, en cinco numeros. Es lo que se mira primero y no se lee, se ve. */
  portrait: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  portraitRow: { flexDirection: 'row' },
  /** El pie del retrato: cuantos partidos quedaron a medias. Pill gris —estado, no cantidad—,
      que se ajusta a su texto (por eso `alignSelf`, no ocupa el ancho). */
  portraitTag: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: alpha(colors.text, 0.08),
  },
  portraitTagText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  /**
   * Cinco celdas en el ancho de un telefono. El valor mas ancho, W/ENF ("100/71"), crece con los
   * partidos jugados, asi que se achica solo (`adjustsFontSizeToFit`) si algun dia no entra.
   */
  bigCell: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  bigValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  bigLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700' },

  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  sectionSub: { flex: 1, color: colors.textFaint, fontSize: 12.5, fontWeight: '600' },
  card: {
    padding: space.md,
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },

  /**
   * TRES por fila, con el ancho fijado.
   *
   * Dejadas a su tamaño natural entraban dos y sobraba media pantalla a un costado: los
   * nombres son largos y desparejos, asi que el acomodo automatico desperdiciaba el lugar.
   *
   * Y con alto fijo, para que todas midan igual aunque una use un renglon y otra dos — si no,
   * la fila queda escalonada y se lee como si algunas fueran mas importantes que otras.
   */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    width: '31%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  chipText: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  chipTextOn: { color: colors.text, fontWeight: '900' },

  /** El mismo cuerpo que la grilla de la pantalla del partido: las dos cuentan lo mismo. */
  grid: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  statSub: { color: colors.textFaint, fontSize: 11 },

  blockLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  divider: { height: 1, backgroundColor: colors.border },

  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19, padding: space.md },
  /** La frase que reemplaza la grilla de ceros: mismo tono que la de la evolucion. */
  noData: { color: colors.textFaint, fontSize: 13, lineHeight: 19 },
});
