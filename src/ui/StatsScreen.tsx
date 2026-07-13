import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { computeStats, pct, teamShotLines, shotLines } from '../engine/stats';
import type { MatchStats, PlayerStats } from '../engine/stats';
import type { MatchConfig, MatchEvent, MatchState, PlayerId, TeamId } from '../engine';
import { Brand } from './Brand';
import { HeadToHead, type Cell, type Row } from './charts/HeadToHead';
import { ShotBars } from './charts/ShotBars';
import { TeamCompare, type CompareRow } from './charts/TeamCompare';
import { useRoster } from './roster';
import { Scoreboard } from './Scoreboard';
import { colors, pressed, radius, ripple, space, teamColor } from './theme';

const num = (n: number | null, suffix = ''): string =>
  n === null ? '—' : `${Math.round(n)}${suffix}`;

/**
 * Winners contra errores no forzados, LOS DOS CRUDOS: "22/14".
 *
 * Antes iba el ratio (1.6). El problema del ratio es que tiene un UMBRAL INVISIBLE: para saber
 * si un 1.6 es bueno hay que saber que el corte esta en 1.0, y nadie lo sabe la primera vez.
 *
 * El par no tiene umbral: tiene COLOR. Verde si pegaste mas de lo que regalaste, rojo si es al
 * reves — y son el verde y el rojo de los botones de la cancha, los mismos que ya significan
 * winner y error no forzado. Se ven los dos numeros y el veredicto de una, sin aprender nada.
 *
 * Y los dos van en POSITIVO. Se penso mostrarlo como una resta con signo (+8 / −8), pero en
 * padel amateur los errores casi siempre superan a los winners, asi que casi todo daria
 * negativo — y si en cambio se invertia a "errores menos winners" para que diera positivo, seria
 * el unico numero de la app donde el signo se lee al reves: un "+12" querria decir que estas
 * jugando mal. Es la misma trampa que sacamos de las barras, y en un numero es peor, porque de
 * un numero nadie sospecha.
 */
const wOverE = (p: Pick<PlayerStats, 'winners' | 'unforcedErrors'>): string =>
  `${p.winners}/${p.unforcedErrors}`;

const wOverEColor = (p: Pick<PlayerStats, 'winners' | 'unforcedErrors'>): string => {
  if (p.winners === p.unforcedErrors) return colors.text;
  // Los de grafico, no los de boton: en esta pantalla el verde y el rojo ya son los suaves, y
  // dos verdes distintos que significan lo mismo es peor que un color feo.
  return p.winners > p.unforcedErrors ? colors.winnerChart : colors.errorUnforcedChart;
};

/**
 * Cuanto duro, del log mismo: la hora del primer evento a la del ultimo.
 *
 * No hay ningun cronometro corriendo — la hora la estampa la UI en cada punto. Un partido que
 * quedo a medias hace tres semanas devuelve lo que efectivamente se jugo, no tres semanas.
 */
const duration = (events: MatchEvent[]): string => {
  const stamps = events.map((e) => e.t).filter((t): t is number => typeof t === 'number');
  if (stamps.length < 2) return '—';
  const min = Math.round((Math.max(...stamps) - Math.min(...stamps)) / 60000);
  if (min < 1) return '—';
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
};

/**
 * Las cinco filas de la vista global. Es lo que se lee en tres segundos —y lo que va a llevar
 * la tarjeta que se comparte—, asi que cada una tiene que ganarse el lugar.
 *
 * Winners y errores no forzados son las dos columnas que cuentan la historia: un partido se
 * gana pegandola o esperando a que el otro se equivoque, y el tanteo no distingue entre las
 * dos. El ratio entre ellas es EL numero del entrenador.
 */
const globalRows = (stats: MatchStats): CompareRow[] => {
  const [a, b] = [stats.teams.A, stats.teams.B];

  const ratio = (t: typeof a): { text: string; value: number } => {
    if (t.unforcedErrors === 0) {
      return t.winners === 0
        ? { text: '—', value: 0 }
        : { text: `${t.winners}/0`, value: t.winners };
    }
    const r = t.winners / t.unforcedErrors;
    return { text: r.toFixed(1), value: r };
  };
  const [ra, rb] = [ratio(a), ratio(b)];

  return [
    {
      label: 'Puntos ganados',
      a: `${a.pointsWon}`,
      b: `${b.pointsWon}`,
      aValue: a.pointsWon,
      bValue: b.pointsWon,
    },
    {
      label: 'Winners',
      a: `${a.winners}`,
      b: `${b.winners}`,
      aValue: a.winners,
      bValue: b.winners,
    },
    {
      // Aca gana el que MENOS tiene. Sin esto, la barra premiaria al que mas se equivoco.
      label: 'Errores no forzados',
      a: `${a.unforcedErrors}`,
      b: `${b.unforcedErrors}`,
      aValue: a.unforcedErrors,
      bValue: b.unforcedErrors,
      lowerIsBetter: true,
    },
    {
      label: 'Winners por error',
      a: ra.text,
      b: rb.text,
      aValue: ra.value,
      bValue: rb.value,
    },
    {
      label: 'Breaks',
      a: `${a.breakPointsConverted}/${a.breakPointsPlayed}`,
      b: `${b.breakPointsConverted}/${b.breakPointsPlayed}`,
      aValue: a.breakPointsConverted,
      bValue: b.breakPointsConverted,
    },
  ];
};

/**
 * Los nombres salen del PLANTEL, por id — no de la copia que el partido guarda adentro. Asi,
 * renombrar a alguien cambia tambien sus partidos viejos. La copia es el paracaidas: si esa
 * persona ya no esta en la tabla, se usa (ver `roster.tsx`).
 */
type NameOf = (id: PlayerId, fallback?: string) => string;

const teamNames = (config: MatchConfig, t: TeamId, nameOf: NameOf): string =>
  [config.teams[t].drive, config.teams[t].reves]
    .map((p) => nameOf(p, config.players[p]?.name).split(' ')[0])
    .join(' / ');

/** En el mismo orden en que se dibujan las barras: primero drive, despues reves. */
const playerNames = (config: MatchConfig, t: TeamId, nameOf: NameOf): [string, string] =>
  [config.teams[t].drive, config.teams[t].reves].map((p) =>
    nameOf(p, config.players[p]?.name),
  ) as [string, string];

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

  const count = (label: string, pick: (p: PlayerStats) => number, fill?: string): Row => ({
    label,
    fill,
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

  /**
   * Cada fila con el color del BOTON que la genero. La barra deja de decir "quien va ganando"
   * y pasa a decir "de que accion hablamos" — y asi ninguna fila se lee al reves de las otras.
   *
   * La doble falta no tiene boton propio (existe FALTA, que es blanco, y una barra blanca
   * seria lo mas brillante de la pantalla para la peor estadistica). Va en bordo, que es el
   * color con el que la app ya dice "mas es peor".
   *
   * Los porcentajes de saque no salen de ningun boton y ahi mas SI es mejor: color de equipo.
   */
  return [
    count('Winners', (p) => p.winners, colors.winnerChart),
    count('Errores\nno forzados', (p) => p.unforcedErrors, colors.errorUnforcedChart),
    count('Errores\nforzados', (p) => p.forcedErrors, colors.errorForcedChart),
    count('Aces', (p) => p.aces, colors.ace),
    count('Dobles\nfaltas', (p) => p.doubleFaults, colors.worse),
    percent(
      '1er saque\nadentro',
      (p) => p.firstServesIn,
      (p) => p.servePointsPlayed,
    ),
    percent(
      'Gana con\n1er saque',
      (p) => p.firstServePointsWon,
      (p) => p.firstServesIn,
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
  onClose,
  onShare,
}: {
  config: MatchConfig;
  events: MatchEvent[];
  state: MatchState;
  /** El partido quedo a medias: se muestran las estadisticas de lo que se jugo. */
  finishedEarly: boolean;
  /** Cerrar y volver a lo que estabas: la cancha, o el historial. */
  onClose: () => void;
  onShare: () => void;
}) {
  const { nameOf } = useRoster();
  const stats = computeStats(config, events);
  const over = state.finished || finishedEarly;

  /** Solo el nombre de pila: los duelos van como subtitulo y "3 a Beto Lino" no entra. */
  const firstNames: Record<PlayerId, string> = Object.fromEntries(
    Object.values(config.players).map((p) => [p.id, nameOf(p.id, p.name).split(' ')[0]!]),
  );

  return (
    <SafeAreaView style={s.root}>
      {/* La ✕ cierra, y es la MISMA ✕ de la hoja de golpes: un solo simbolo, un solo
          significado —cerra esto y volve a lo que estabas—. Va a la derecha, que es donde
          vive el cerrar, y de paso el logo respira a la izquierda. */}
      <View style={s.head}>
        <Brand size={26} subtitle="Estadísticas" tint={colors.ball} />
        <Pressable
          style={({ pressed: p }) => [s.close, p && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onClose}
          hitSlop={10}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <Scoreboard config={config} state={state} />

      {/* Una linea fina arriba y otra abajo: el tanteador y el boton son BORDES, no contenido —
          se quedan quietos mientras el resto se desliza. Sin ellas, el primer numero de la lista
          nace pegado al tanteador y el ultimo muere debajo del boton, y no se sabe donde termina
          una cosa y empieza la otra. */}
      <ScrollView style={s.scroll} contentContainerStyle={s.list}>
        {stats.totalPoints === 0 ? (
          <Text style={s.empty}>Todavía no se jugó ningún punto.</Text>
        ) : (
          <>
            {/* LA VISTA GLOBAL. Lo que se lee en tres segundos, sin leer un solo numero: la
                barra ya dice quien gano cada cosa. Va primero porque es la unica que le sirve
                a alguien que no estuvo en la cancha — y es la que va a llevar la tarjeta.

                Sin nombres a proposito: aca se comparan las PAREJAS. Cual de los dos tiro los
                errores es la pregunta siguiente, y baja al detalle. */}
            <Section title="Partido" subtitle={`${duration(events)} · ${stats.totalPoints} puntos`}>
              <TeamCompare rows={globalRows(stats)} />
            </Section>

            <Section title="Jugador por jugador">
              <HeadToHead
                rows={buildRows(stats, config)}
                playersA={playerNames(config, 'A', nameOf)}
                playersB={playerNames(config, 'B', nameOf)}
                colorA={colors.teamAFill}
                colorB={colors.teamBFill}
              />
            </Section>

            {stats.hasShotData &&
              (['A', 'B'] as TeamId[]).map((t) => (
                <Section
                  key={t}
                  title="Golpes"
                  accent={teamColor(t)}
                  subtitle={teamNames(config, t, nameOf)}
                >
                  <ShotBars lines={teamShotLines(stats, config, t)} />
                </Section>
              ))}

            {/* Una tarjeta POR PERSONA. Los cuatro estaban adentro de una sola caja, y eso era
                un muro de numeros donde no se veia donde terminaba uno y empezaba el otro. */}
            <Section title="Detalle" bare>
              {(['A', 'B'] as TeamId[]).flatMap((t) =>
                ([config.teams[t].drive, config.teams[t].reves] as const).map((id, i) => (
                  <PlayerCard
                    key={id}
                    p={stats.players[id]!}
                    names={firstNames}
                    side={i === 0 ? 'Drive' : 'Revés'}
                  />
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

        {/* Se fue el boton blanco "Volver": salir es la ✕ de arriba, y el back de Android.
            Y NO hay "Terminar partido": terminar se hace en UN solo lugar, la tarjeta del
            inicio. Tener el mismo camino en tres pantallas es como no tenerlo en ninguna.

            Queda una sola cosa abajo, que es la que importa. */}
        <Pressable
          style={({ pressed: p }) => [s.btn, s.btnGhost, p && pressed]}
          android_ripple={ripple}
          onPress={onShare}
        >
          <MaterialIcons name="ios-share" size={20} color={colors.text} />
          <Text style={s.btnGhostText}>Compartir</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  accent,
  bare,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  /**
   * Sin la caja de la seccion: los hijos traen la suya.
   *
   * Los cuatro jugadores estaban METIDOS ADENTRO DE UNA sola tarjeta, y eso era un muro de
   * numeros de mil pixeles de alto donde no se sabia donde terminaba uno y empezaba el otro.
   * Cada persona es una cosa aparte: cada una su tarjeta.
   */
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        {accent ? <View style={[s.sectionDot, { backgroundColor: accent }]} /> : null}
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
      </View>
      {bare ? children : <View style={s.card}>{children}</View>}
    </View>
  );
}

/**
 * Contra quien fue cada ace y cada doble falta: "3 a Beto · 1 a Bea".
 *
 * Va como subtitulo del numero, no en una seccion aparte. La pregunta "¿a quien?" nace mirando
 * el 4 de aces — si la respuesta esta tres pantallazos mas abajo, nadie la va a buscar.
 *
 * Ordenado de mayor a menor, que es justo el caso que importa: cinco dobles faltas repartidas
 * son mala suerte; cinco sacandole siempre al mismo son un problema con esa persona.
 */
const duels = (
  against: Partial<Record<PlayerId, number>>,
  names: Record<PlayerId, string>,
): string | undefined => {
  const lines = (Object.entries(against) as Array<[PlayerId, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${n} a ${names[id]}`);
  return lines.length > 0 ? lines.join(' · ') : undefined;
};

function PlayerCard({
  p,
  names,
  side,
}: {
  p: PlayerStats;
  names: Record<PlayerId, string>;
  /** De que lado juega: "Drive" o "Revés". */
  side: string;
}) {
  const { nameOf } = useRoster();
  const c = teamColor(p.team);
  const first = pct(p.firstServesIn, p.servePointsPlayed);
  const won1 = pct(p.firstServePointsWon, p.firstServesIn);
  const won2 = pct(p.secondServePointsWon, p.secondServePointsPlayed);
  const returning = pct(p.returnPointsWon, p.returnPointsPlayed);

  return (
    <View style={s.player}>
      <View style={s.cardHead}>
        <View style={[s.dot, { backgroundColor: c }]} />
        <Text style={s.cardName} numberOfLines={1}>
          {nameOf(p.id, p.name)}
        </Text>

        {/* De que lado juega. Y NADA MAS que eso.
            El drive sostiene y el reves arriesga, asi que diez errores de uno no significan lo
            mismo que diez del otro. Pero CUANTO no significan depende del nivel, del estilo, del
            rival y del dia — y de eso la app no sabe nada. Si insinuara la conclusion estaria
            opinando disfrazada de dato. Se le da el hecho al entrenador; la lectura es suya. */}
        <Text style={[s.cardSide, { color: c }]}>{side}</Text>

        <View style={s.ratioBox}>
          <Text style={[s.ratioValue, { color: wOverEColor(p) }]}>{wOverE(p)}</Text>
          <Text style={s.ratioLabel}>W / ENF</Text>
        </View>
      </View>

      <View style={s.grid}>
        <Stat label="Winners" value={`${p.winners}`} />
        <Stat label="E. forzados" value={`${p.forcedErrors}`} />
        <Stat label="E. no forz." value={`${p.unforcedErrors}`} />
      </View>

      <View style={s.divider} />
      <Text style={s.blockLabel}>SACANDO</Text>

      <View style={s.grid}>
        <Stat label="1er saque" value={num(first, '%')} sub={`${p.firstServesIn}/${p.servePointsPlayed}`} />
        <Stat label="Gana c/ 1ro" value={num(won1, '%')} sub={`${p.firstServePointsWon}/${p.firstServesIn}`} />
        <Stat label="Gana c/ 2do" value={num(won2, '%')} sub={`${p.secondServePointsWon}/${p.secondServePointsPlayed}`} />
      </View>

      <View style={s.grid}>
        <Stat label="Aces" value={`${p.aces}`} sub={duels(p.acesAgainst, names)} />
        <Stat
          label="Dobles faltas"
          value={`${p.doubleFaults}`}
          sub={duels(p.doubleFaultsAgainst, names)}
        />
        <View style={s.statCell} />
      </View>

      {/* El otro lado del duelo. Hasta ahora la tarjeta solo contaba lo que haces SACANDO, y
          media cancha se jugaba del otro lado. "Provoco 4 dobles faltas" no es una curiosidad:
          es lo que hace el resto de alguien al que le tenes miedo. */}
      <View style={s.divider} />
      <Text style={s.blockLabel}>RESTANDO</Text>

      <View style={s.grid}>
        <Stat
          label="Gana restando"
          value={num(returning, '%')}
          sub={`${p.returnPointsWon}/${p.returnPointsPlayed}`}
        />
        <Stat label="Aces recibidos" value={`${p.acesConceded}`} />
        <Stat label="Dobles provocadas" value={`${p.doubleFaultsForced}`} />
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
  /**
   * Las dos lineas que despegan el contenido de los bordes fijos.
   *
   * Van en el ScrollView, NO en su contenido: una linea puesta adentro se desliza con la lista
   * y deja de marcar el borde justo cuando hace falta. Estas se quedan quietas, que es todo el
   * punto — dicen "de aca para arriba no se mueve nada".
   *
   * Un pixel entero, no `hairlineWidth`: en una pantalla de esta densidad eso es un tercio de
   * pixel y sobre fondo oscuro se pierde. Una linea que no se ve no separa nada.
   */
  scroll: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  list: { padding: space.md, gap: space.lg, paddingTop: space.lg, paddingBottom: space.xl },
  empty: { color: colors.textFaint, textAlign: 'center', marginTop: space.xl },

  /** El `gap` tambien separa las tarjetas cuando la seccion es `bare` (una por jugador). */
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

  /**
   * Cada persona, su propia caja. Antes eran cuatro apiladas adentro de una sola.
   *
   * SIN RELLENO: solo el borde. Cuatro tarjetas grises seguidas vuelven a ser una masa —lo que
   * se gana separandolas se pierde en peso—. El borde alcanza para decir donde empieza y donde
   * termina cada una, y el fondo sigue siendo el de la pagina.
   */
  player: {
    gap: space.sm,
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  cardName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  /** Del color de su equipo, y apagado: es un dato de contexto, no un numero mas. */
  cardSide: { flex: 1, fontSize: 11, fontWeight: '700', opacity: 0.75 },
  ratioBox: { alignItems: 'flex-end' },
  /** El COLOR ya lo destaca. Con el tamaño y el peso encima, gritaba. */
  ratioValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  ratioLabel: { color: colors.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  grid: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  /** Sin `tabular-nums`: aca ya no van solo cifras, van los duelos ("3 a Beto · 1 a Bea"). */
  statSub: { color: colors.textFaint, fontSize: 9, textAlign: 'center' },

  /**
   * Parte la tarjeta en las dos mitades del partido: la que sacas y la que restas.
   *
   * En `textDim`, NO en `textFaint`: encabeza a las etiquetas de abajo ("Winners", "1er saque"),
   * que van en textDim — y un encabezado que se lee peor que lo que encabeza esta mal por
   * definicion. Sobre fondo oscuro, textFaint se leia como negro.
   */
  blockLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 2,
    marginBottom: 2,
  },

  divider: { height: 1, backgroundColor: colors.border },

  /** Cifra grande: figuras proporcionales, no tabulares. */
  kpi: { color: colors.text, fontSize: 26, fontWeight: '900' },
  kpiSub: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  overNote: { color: colors.textFaint, fontSize: 11, textAlign: 'center' },
  actions: { padding: space.md, gap: space.sm, backgroundColor: colors.surface },
  // Sin flex: dentro de un contenedor en columna, flex:1 colapsa el boton y le come el texto.
  btn: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
