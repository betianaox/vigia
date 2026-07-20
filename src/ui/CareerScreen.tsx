import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CareerPoint, CareerStats } from '../engine/career';
import { pct, totalDuels } from '../engine/stats';
import type { PlayerStats } from '../engine/stats';
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
/**
 * UNA SOLA CUENTA POR METRICA, QUE SIRVE PARA CUALQUIER CONJUNTO DE PARTIDOS.
 *
 * Antes habia dos: `of` para un partido y `total` para la carrera. Con eso alcanzaba mientras
 * lo unico que se miraba era "un partido" o "todos", pero ahora hay bloques de diez, primeros
 * N y ultimos N — y cada corte nuevo hubiera pedido su propia funcion, con su propia
 * oportunidad de calcularse distinto.
 *
 * `from` toma los partidos que sean y SUMA LOS CONTADORES antes de dividir. Eso no es un
 * detalle de implementacion: es la unica forma correcta. Un bloque con 2 saques al 100% y otro
 * con 40 al 50% promedian 75% y la verdad es 52% — los porcentajes no se promedian nunca
 * (§7 bis). Con una sola funcion, esa regla se cumple en todos los cortes o en ninguno.
 */
const sum = (ps: CareerPoint[], f: (s: PlayerStats) => number): number =>
  ps.reduce((n, p) => n + f(p.stats), 0);

export interface Metric {
  key: string;
  label: string;
  color: string;
  from: (ps: CareerPoint[]) => number | null;
  format: (v: number) => string;
  /** En estas, bajar es mejorar: el color del delta se da vuelta. */
  lowerIsBetter?: boolean;
}

const metrics = (): Metric[] => [
  {
    key: 'ratio',
    label: L.stats.winnersPerError,
    color: colors.ballChart,
    from: (ps) => {
      const w = sum(ps, (s) => s.winners);
      const e = sum(ps, (s) => s.unforcedErrors);
      return e === 0 ? (w === 0 ? null : w) : w / e;
    },
    format: (v) => v.toFixed(1),
  },
  {
    key: 'primero',
    label: L.stats.firstServeIn,
    color: colors.aceChart,
    from: (ps) => pct(sum(ps, (s) => s.firstServesIn), sum(ps, (s) => s.servePointsPlayed)),
    format: (v) => `${Math.round(v)}%`,
  },
  {
    key: 'gana1',
    label: L.stats.wonWithFirstLong,
    color: colors.ballChart,
    from: (ps) =>
      pct(sum(ps, (s) => s.firstServePointsWon), sum(ps, (s) => s.firstServesIn)),
    format: (v) => `${Math.round(v)}%`,
  },
  {
    /** Por partido, no en bruto: un bloque de diez y uno de tres no se comparan en total. */
    key: 'enf',
    label: L.stats.unforcedErrors,
    color: colors.worse,
    from: (ps) => (ps.length === 0 ? null : sum(ps, (s) => s.unforcedErrors) / ps.length),
    format: (v) => v.toFixed(1),
    lowerIsBetter: true,
  },
  {
    key: 'resto',
    label: L.stats.returnErrorPct,
    color: colors.worse,
    from: (ps) => {
      const fallas = sum(ps, (s) => s.returnErrorsForced + s.returnErrorsUnforced);
      // Guion, no cero: si nunca se uso el boton dedicado, no se sabe (ver StatsScreen).
      return fallas === 0 ? null : pct(fallas, sum(ps, (s) => s.returnPointsPlayed));
    },
    format: (v) => `${Math.round(v)}%`,
    lowerIsBetter: true,
  },
];

export function CareerScreen({ stats, onClose }: { stats: CareerStats; onClose: () => void }) {
  const { nameOf } = useRoster();
  const [metric, setMetric] = useState<ReturnType<typeof metrics>[number]['key']>('ratio');
  const m = metrics().find((x) => x.key === metric)!;

  /**
   * LOS BLOQUES SE CUENTAN DESDE EL ULTIMO PARTIDO HACIA ATRAS.
   *
   * `block` 0 son los ultimos diez, 1 los diez anteriores, y asi. Va en ese sentido y no al
   * reves por una razon: el bloque que se mira siempre —el actual— tiene que estar COMPLETO,
   * porque es contra el que se compara todo. Contando desde el principio, el incompleto seria
   * el ultimo, justo el que mas se usa.
   *
   * Se agrupa por cantidad de partidos y no por mes a proposito: el mes asume una regularidad
   * que la app no conoce. Alguien que juega tres veces en marzo y quince en abril tendria dos
   * filas que no se pueden comparar, y el numero mas grande seria el del mes con mas partidos,
   * no el de la mejor racha.
   */
  const BLOCK = 10;
  const [block, setBlock] = useState(0);

  const blocks = useMemo(() => {
    const t = stats.timeline;
    const out: CareerPoint[][] = [];
    for (let end = t.length; end > 0; end -= BLOCK) out.push(t.slice(Math.max(0, end - BLOCK), end));
    return out;
  }, [stats.timeline]);

  /** Si se borra un partido y quedan menos bloques, no puede quedar mirando uno que ya no existe. */
  const blockIndex = Math.min(block, Math.max(0, blocks.length - 1));
  const current = blocks[blockIndex] ?? [];

  const points: TrendPoint[] = useMemo(
    () => current.map((p) => ({ at: p.at, value: m.from([p]) })),
    [current, m],
  );

  /**
   * ANTES Y AHORA: los primeros N partidos contra los ultimos N, sin solaparse nunca.
   *
   * N es el bloque entero cuando hay historial de sobra, y se achica solo cuando no lo hay
   * —con siete partidos son tres contra tres— porque una comparacion chica es peor que
   * ninguna solo si finge no serlo. Por eso la tabla muestra CUANTOS partidos hay de cada
   * lado: un salto entre dos muestras de tres es ruido, y tiene que poder verse que lo es.
   *
   * Con menos de cuatro partidos no aparece: ahi no hay dos grupos, hay uno partido al medio.
   */
  const compare = useMemo(() => {
    const t = stats.timeline;
    const n = Math.min(BLOCK, Math.floor(t.length / 2));
    return n < 2 ? null : { n, before: t.slice(0, n), after: t.slice(t.length - n) };
  }, [stats.timeline]);

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

              {/**
               * La linea de promedio es la del BLOQUE que se esta mirando, no la de toda la
               * carrera: si fuera la global, al ir hacia atras las barras se moverian y la
               * referencia no, y se leeria como que ese bloque fue peor cuando lo que cambio
               * es contra que se lo mide. Cada bloque se juzga contra si mismo.
               */}
              <Trend points={points} average={m.from(current)} format={m.format} color={m.color} />

              {/* La navegacion entre bloques. Va DEBAJO del grafico: primero se ve, despues se
                  decide moverse. Y dice el rango en partidos, que es la unidad de los bloques. */}
              <View style={s.blockNav}>
                <Pressable
                  style={({ pressed: p }) => [s.blockArrow, p && pressed]}
                  android_ripple={{ ...ripple, borderless: true }}
                  disabled={blockIndex >= blocks.length - 1}
                  onPress={() => {
                    tick();
                    setBlock(blockIndex + 1);
                  }}
                  hitSlop={10}
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={26}
                    color={blockIndex >= blocks.length - 1 ? colors.textFaint : colors.text}
                  />
                </Pressable>

                <Text style={s.blockLabelText}>
                  {L.stats.blockRange(
                    stats.timeline.length - blockIndex * BLOCK - current.length + 1,
                    stats.timeline.length - blockIndex * BLOCK,
                    stats.timeline.length,
                  )}
                </Text>

                <Pressable
                  style={({ pressed: p }) => [s.blockArrow, p && pressed]}
                  android_ripple={{ ...ripple, borderless: true }}
                  disabled={blockIndex === 0}
                  onPress={() => {
                    tick();
                    setBlock(blockIndex - 1);
                  }}
                  hitSlop={10}
                >
                  <MaterialIcons
                    name="chevron-right"
                    size={26}
                    color={blockIndex === 0 ? colors.textFaint : colors.text}
                  />
                </Pressable>
              </View>

              {/* LOS NUMEROS DEL BLOQUE, no solo su forma. El grafico contesta "¿voy mejorando?"
                  y no contesta "¿cuanto?" — y las dos preguntas se hacen. Cada fila es una
                  metrica sobre ESTE bloque, sumando contadores (ver `from`). */}
              <View style={s.blockTable}>
                {metrics().map((x) => (
                  <View key={x.key} style={s.blockRow}>
                    <Text style={s.blockRowLabel} numberOfLines={1}>
                      {x.label}
                    </Text>
                    <Text style={s.blockRowValue}>
                      {(() => {
                        const v = x.from(current);
                        return v === null ? '—' : x.format(v);
                      })()}
                    </Text>
                  </View>
                ))}
              </View>
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

            {/**
             * ANTES Y AHORA, AL FINAL DE TODO. Es la pieza que contesta la pregunta que trae al
             * entrenador: sin conocer al jugador, que hay que trabajar.
             *
             * Y la contesta SIN OPINAR, que es la condicion. La app no ordena las metricas por
             * urgencia ni escribe "mejorar el segundo saque": dibuja cada una contra si misma,
             * antes y ahora, y la fila cuya linea no se movio salta a la vista sola. El hecho lo
             * pone la app; la conclusion la saca quien mira. Es la misma regla que impide
             * interpretar drive contra reves.
             *
             * Cada fila tiene SU PROPIA ESCALA. Nunca se normalizan entre si: un porcentaje de
             * saque y un ratio de winners no comparten unidad, y ponerlos en un eje comun
             * —un radar, por ejemplo— dibuja una forma cuya area no significa nada.
             */}
            {compare && (
              <Section title={L.stats.beforeAfter} subtitle={L.stats.beforeAfterSub(compare.n)}>
                {metrics().map((x) => (
                  <Delta
                    key={x.key}
                    metric={x}
                    before={x.from(compare.before)}
                    after={x.from(compare.after)}
                  />
                ))}
              </Section>
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

/**
 * UNA METRICA, ANTES Y AHORA, EN UNA LINEA.
 *
 * Dos puntos unidos por una barra: donde estaba y donde esta. Lo que se lee no es cada numero
 * sino EL LARGO DE LA BARRA — y por eso la fila que no se movio, que es la que hay que
 * trabajar, se encuentra sin leer nada.
 *
 * La escala es de la fila, no de la tabla: el minimo y el maximo son los dos valores de ESTA
 * metrica. Compartir escala entre un porcentaje y un ratio no significaria nada.
 *
 * Y el color del delta respeta la regla de siempre: en las metricas donde mas es peor
 * (`lowerIsBetter`) bajar es mejorar, asi que el verde va para el signo negativo. Sin eso, la
 * unica fila que se lee al reves que las demas seria justo la de los errores.
 */
function Delta({
  metric,
  before,
  after,
}: {
  metric: Metric;
  before: number | null;
  after: number | null;
}) {
  const known = before !== null && after !== null;
  const diff = known ? after - before : 0;
  /** Sin cambio real no hay color: un delta de cero no es ni bueno ni malo. */
  const better = metric.lowerIsBetter ? diff < 0 : diff > 0;
  const flat = !known || Math.abs(diff) < 1e-9;
  const tone = flat ? colors.textDim : better ? colors.winnerChart : colors.errorUnforcedChart;

  /** La barra ocupa lo que cambio, sobre el mayor de los dos: la fila quieta queda corta. */
  const span = known ? Math.max(Math.abs(before), Math.abs(after), 1e-9) : 1;
  const width = known ? Math.min(1, Math.abs(diff) / span) : 0;

  return (
    <View style={s.deltaRow}>
      <Text style={s.deltaLabel} numberOfLines={1}>
        {metric.label}
      </Text>

      <Text style={s.deltaBefore}>{before === null ? '—' : metric.format(before)}</Text>

      <View style={s.deltaTrack}>
        <View style={[s.deltaFill, { width: `${Math.round(width * 100)}%`, backgroundColor: tone }]} />
      </View>

      <Text style={[s.deltaAfter, { color: tone }]}>
        {after === null ? '—' : metric.format(after)}
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

  /** La navegacion de bloques: dos flechas y el rango, centrado entre ellas. */
  blockNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  blockArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  blockLabelText: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  /** Los numeros del bloque: una fila por metrica, el nombre a la izquierda y el valor a la derecha. */
  blockTable: { marginTop: space.sm, gap: 2 },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: alpha(colors.text, 0.06),
  },
  blockRowLabel: { flex: 1, color: colors.textDim, fontSize: 13, fontWeight: '600' },
  blockRowValue: { color: colors.text, fontSize: 15, fontWeight: '900' },

  /** Antes y ahora. El ancho de la barra ES el dato: la fila quieta queda visiblemente corta. */
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 7 },
  deltaLabel: { width: '32%', color: colors.textDim, fontSize: 12, fontWeight: '600' },
  deltaBefore: { width: 42, textAlign: 'right', color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  deltaTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: alpha(colors.text, 0.08) },
  deltaFill: { height: '100%', borderRadius: 3, minWidth: 3 },
  deltaAfter: { width: 46, textAlign: 'right', fontSize: 14, fontWeight: '900' },
});
