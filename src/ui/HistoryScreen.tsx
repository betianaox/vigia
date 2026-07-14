import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, PlayerId, TeamId } from '../engine';
import {
  deleteMatch,
  loadIndex,
  loadMatch,
  type MatchSummary,
  type SavedMatch,
} from '../store/matches';
import { L, LOCALE } from '../i18n';
import { normalize } from '../store/store';
import { Brand } from './Brand';
import { Confirm } from './Confirm';
import { PlayerField } from './PlayerField';
import { useRoster } from './roster';
import { alpha, colors, pressed, radius, ripple, space, teamColor } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/**
 * Rangos, no un calendario. Nadie se acuerda de la fecha exacta de un partido, pero todos
 * saben si fue "esta semana" o "este año".
 */
const periods = () =>
  [
    { value: 'all', label: L.history.periods.all, days: 0 },
    { value: 'year', label: L.history.periods.year, days: 365 },
    { value: '30d', label: L.history.periods['30d'], days: 30 },
    { value: '7d', label: L.history.periods['7d'], days: 7 },
  ] as const;

type Period = ReturnType<typeof periods>[number]['value'];

const DAY = 24 * 60 * 60 * 1000;

/** "Sáb 12 jul", y el año solo si no es este. */
const formatDate = (t: number): string => {
  const d = new Date(t);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(LOCALE, opts);
};

/** "20:30". La hora a la que se empezo, que es como la gente se acuerda de un partido. */
const formatTime = (t: number): string =>
  new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });

const formatDuration = (ms: number): string => {
  const min = Math.round(ms / 60000);
  if (min < 1) return '—';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

export function HistoryScreen({
  onBack,
  onOpen,
  onCareer,
}: {
  onBack: () => void;
  onOpen: (m: SavedMatch) => void;
  /** Ver el acumulado y la evolucion de una persona. */
  onCareer: (player: Player) => void;
}) {
  // El plantel sale del contexto: una sola fuente, y un renombre se ve en todas las pantallas.
  const { players: roster, all: everyone, canon } = useRoster();

  /**
   * El nombre de una persona, resuelto AL CANONICO.
   *
   * Un partido viejo guardo el id de antes de una union. Resolverlo contra ese id daria el nombre
   * viejo — y entonces la union no se veria en el historial. Se canonicaliza primero.
   */
  const resolve = useMemo(() => {
    const byId = new Map(everyone.map((p) => [p.id, p.name]));
    return (id: PlayerId): string | undefined => byId.get(canon(id));
  }, [everyone, canon]);

  const [all, setAll] = useState<MatchSummary[]>([]);
  const [query, setQuery] = useState('');
  /** El jugador ELEGIDO del desplegable. Es lo que fija el filtro de verdad. */
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  /** El partido que se esta por borrar. Borrar SI se pregunta: el archivo se va y no vuelve. */
  const [deleting, setDeleting] = useState<MatchSummary | null>(null);

  useEffect(() => {
    void loadIndex().then(setAll);
  }, []);

  /**
   * Escribir BUSCA; elegir FIJA.
   *
   * Escribiendo "bea" se van achicando los partidos, pero eso solo no alcanza: no sabes que
   * nombres existen ni podes fijar uno. Por eso, mientras escribis, abajo aparecen los
   * jugadores que coinciden — y al tocar uno, el filtro deja de ser texto y pasa a ser SU ID.
   *
   * Y esa es la diferencia que importa: dos personas se pueden llamar igual, y alguien se
   * puede renombrar. Buscando por texto, las dos "Ana" caen en la misma bolsa. Eligiendo del
   * desplegable, el historial es exactamente el de esa persona.
   */
  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (player || q.length === 0) return [];
    // Solo los que efectivamente jugaron: ofrecer a alguien sin un solo partido es ofrecer nada.
    const played = new Set(all.flatMap((m) => m.playerIds));
    return roster
      .filter((p) => played.has(p.id) && normalize(p.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, LOCALE))
      .slice(0, 6);
  }, [all, roster, query, player]);

  const matches = useMemo(() => {
    const days = periods().find((p) => p.value === period)!.days;
    const since = days === 0 ? 0 : Date.now() - days * DAY;
    const q = normalize(query);
    return all
      .filter((m) => m.startedAt >= since)
      .filter((m) => {
        // `canon` resuelve las uniones: un partido viejo puede tener guardado el id de antes.
        if (player) return m.playerIds.some((id) => canon(id) === player);
        // Contra los nombres RESUELTOS: si alguien se renombro, buscar por el nombre nuevo tiene
        // que encontrarlo. El texto horneado en el indice quedo viejo el dia que se renombro.
        return (
          !q || normalize(`${teamText(m, 'A', resolve)} ${teamText(m, 'B', resolve)}`).includes(q)
        );
      });
  }, [all, period, query, player, resolve, canon]);

  const chosen = roster.find((p) => p.id === player);

  const clearPlayer = () => {
    tick();
    setPlayer(null);
    setQuery('');
  };

  const open = async (m: MatchSummary) => {
    tick();
    const saved = await loadMatch(m.id);
    if (saved) onOpen(saved);
  };

  const remove = async (m: MatchSummary) => {
    await deleteMatch(m.id);
    setAll(await loadIndex());
  };

  return (
    <SafeAreaView style={s.root}>
      {/* La ✕ cierra, y es la misma de la hoja de golpes y de las estadisticas. A la derecha:
          ahi vive el cerrar, y el logo deja de estar aplastado contra una flecha. */}
      <View style={s.head}>
        <Brand size={26} subtitle={L.history.title} tint={colors.ball} />
        <Pressable
          style={({ pressed: pr }) => [s.close, pr && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onBack}
          hitSlop={10}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Los filtros. Sin ellos, un historial deja de servir apenas tenes treinta partidos. */}
      <View style={s.filters}>
        {/* El mismo campo que en el formulario de partido nuevo. Aca, ademas, se FIJA: al
            elegir del desplegable el filtro deja de ser texto y pasa a ser el id de esa
            persona, que es lo unico que distingue a dos que se llaman igual. */}
        <PlayerField
          value={query}
          onChangeText={setQuery}
          placeholder={L.history.search}
          suggestions={suggestions}
          chosen={chosen ?? null}
          onPick={(p) => {
            tick();
            setPlayer(p.id);
          }}
          onClear={clearPlayer}
        />

        {/* Elegida una persona, aparece la puerta a su acumulado. No antes: "el juego de
            quien" no tiene respuesta si no elegiste a nadie, y un boton que no se puede tocar
            es peor que uno que no esta. */}
        {chosen && (
          <Pressable
            style={({ pressed: pr }) => [s.career, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onCareer(chosen);
            }}
          >
            <MaterialIcons name="show-chart" size={20} color={colors.ball} />
            <Text style={s.careerText} numberOfLines={1}>
              {L.history.career(chosen.name.split(' ')[0]!)}
            </Text>
            <MaterialIcons name="chevron-right" size={22} color={colors.textDim} />
          </Pressable>
        )}

        <View style={s.periods}>
          {periods().map((p) => (
            <Pressable
              key={p.value}
              style={({ pressed: pr }) => [
                s.chip,
                period === p.value && s.chipOn,
                pr && pressed,
              ]}
              android_ripple={ripple}
              onPress={() => {
                tick();
                setPeriod(p.value);
              }}
            >
              <Text
                style={[s.chipText, period === p.value && s.chipTextOn]}
                numberOfLines={1}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* FlatList dibuja solo las filas que estan en pantalla: con 500 partidos guardados,
          renderiza ocho. Es la paginacion de verdad —no cargar todo— sin ningun boton de
          pagina, que es un patron de web que en un telefono nadie busca. */}
      <FlatList
        data={matches}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text style={s.empty}>
            {all.length === 0
              ? L.history.empty
              : L.history.emptyFiltered}
          </Text>
        }
        renderItem={({ item }) => (
          <Row
            m={item}
            resolve={resolve}
            onPress={() => void open(item)}
            onDelete={() => {
              tick();
              setDeleting(item);
            }}
          />
        )}
      />

      {/* Borrar SI se pregunta. Terminar un partido no destruia nada —quedaba en el historial—
          pero esto se lleva el archivo, y con el los puntos, los golpes y las estadisticas de
          ese dia. No hay deshacer del otro lado.

          Y el cartel dice CUAL. Con los nombres solos no alcanza: la misma gente juega todas
          las semanas, y dos filas seguidas pueden decir exactamente lo mismo. Un cartel que no
          distingue el partido que se va a borrar no es una confirmacion — es un tramite, y el
          error que tenia que evitar lo comete igual. La hora y el resultado son lo que lo
          vuelve UNO. */}
      <Confirm
        visible={deleting !== null}
        title={L.history.deleteTitle}
        message={
          deleting
            ? `${teamText(deleting, 'A', resolve)} vs ${teamText(deleting, 'B', resolve)}\n` +
              `${formatDate(deleting.startedAt)} · ${formatTime(deleting.startedAt)}` +
              `${deleting.score ? ` · ${deleting.score}` : ''}\n\n` +
              L.history.deleteNote
            : undefined
        }
        confirmLabel={L.history.delete}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const m = deleting;
          setDeleting(null);
          if (m) void remove(m);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * Los nombres de una pareja, resueltos contra el PLANTEL.
 *
 * El indice guarda el par ya armado como texto ("Ana Ruiz / Aldo Vega"), pero eso se horneo el
 * dia que se guardo el partido: si despues alguien se renombra, ese texto queda viejo para
 * siempre. Se reconstruye desde los ids —que si son estables— y el texto guardado queda de
 * respaldo por si alguno ya no esta en la tabla.
 *
 * `playerIds` viene en orden: [A drive, A reves, B drive, B reves].
 */
const teamText = (
  m: MatchSummary,
  t: TeamId,
  resolve: (id: PlayerId) => string | undefined,
): string => {
  const ids = t === 'A' ? m.playerIds.slice(0, 2) : m.playerIds.slice(2, 4);
  const names = ids.map(resolve);

  // Si alguno de los dos ya no esta en la tabla, se usa el texto guardado del par entero: mejor
  // "Ana Ruiz / Aldo Vega" con un nombre viejo que "Ana Ruiz / p_k3f9a2".
  if (names.length < 2 || names.some((n) => !n)) return m.teams[t];
  return names.join(' / ');
};

/** El ganador en el color de su equipo, el perdedor atenuado: el mismo vocabulario del tanteador. */
function Row({
  m,
  resolve,
  onPress,
  onDelete,
}: {
  m: MatchSummary;
  resolve: (id: PlayerId) => string | undefined;
  onPress: () => void;
  onDelete: () => void;
}) {
  const line = (t: TeamId) => {
    const lost = m.finished && m.winner !== t;
    return (
      /* DOS RENGLONES. Los cuatro nombres son EL dato de la fila —es como la gente reconoce un
         partido— y con la letra del sistema en grande una pareja de nombres largos no entra en
         uno: se leia "Carla Mendez / Diego Per…". La lista scrollea, asi que el alto no cuesta
         nada; el nombre de alguien cortado, si. */
      <Text
        style={[s.team, { color: teamColor(t) }, lost && s.lost]}
        numberOfLines={2}
      >
        {teamText(m, t, resolve)}
      </Text>
    );
  };

  return (
    <Pressable
      style={({ pressed: pr }) => [s.row, pr && pressed]}
      android_ripple={ripple}
      onPress={onPress}
    >
      <View style={s.rowMain}>
        {line('A')}
        {line('B')}

        {/* El resultado en un renglon propio, a lo ancho. Metido en la columna de los iconos
            entraba "1-0" y nada mas: un partido de tres sets con tiebreaks es tres veces mas
            largo que eso, y se cortaba justo el dia que mas ganas hay de mirarlo. */}
        <Text style={s.score} numberOfLines={1}>
          {m.score || '—'}
        </Text>

        {/* La hora, no solo el dia: en un club se juegan varios partidos la misma tarde, y
            "el de las 8" es como los distingue la gente que estuvo ahi.

            DOS RENGLONES, no uno. En un renglon solo, la linea entra en una pantalla ancha y en
            una angosta se corta — y lo que se pierde es SIEMPRE lo ultimo, que es justo "sin
            terminar": el unico dato de la fila que cambia lo que la persona va a hacer con ese
            partido. Un dato que solo se ve en los telefonos grandes no es un dato, es una
            loteria. */}
        <Text style={s.meta} numberOfLines={2}>
          {formatDate(m.startedAt)} · {formatTime(m.startedAt)} ·{' '}
          {formatDuration(m.updatedAt - m.startedAt)} · {L.history.points(m.points)}
          {m.finished ? '' : ` · ${L.history.unfinished}`}
        </Text>
      </View>

      <View style={s.actions}>
        <MaterialIcons name="bar-chart" size={22} color={colors.textDim} />

        {/* Su propio Pressable adentro de la fila: el toque no llega al de abajo. Va apagado —
            no compite con abrir el partido, que es lo que se hace el 99% de las veces. */}
        <Pressable
          style={({ pressed: pr }) => [s.trash, pr && s.trashOn]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onDelete}
          hitSlop={8}
        >
          {/* ROJO, Y NO GRIS. Es la unica accion de la app que destruye algo — un partido borrado
              no vuelve, con todas sus estadisticas adentro. Estaba pintado igual que un chevron.
              El color no esta para llamar la atencion: esta para que la mano dude medio segundo. */}
          <MaterialIcons name="delete-outline" size={22} color={colors.errorUnforcedChart} />
        </Pressable>
      </View>
    </Pressable>
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
    paddingBottom: space.lg,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  filters: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md },

  /** La puerta al acumulado. En el lima de la pelota: es lo que crece, y es lo que trae de vuelta. */
  career: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.ball, 0.4),
    backgroundColor: alpha(colors.ball, 0.08),
  },
  careerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },

  periods: { flexDirection: 'row', gap: space.sm },
  /** Alto MINIMO: con la letra del sistema en grande, la pastilla crece en vez de recortar. */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  chipText: { color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.text, fontWeight: '900' },

  list: { padding: space.lg, paddingTop: 0, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowMain: { flex: 1, gap: 2 },
  team: { fontSize: 15.5, fontWeight: '800' },
  lost: { opacity: 0.45 },
  /** El resultado: es lo primero que se busca de un partido viejo. Va mas grande que los nombres. */
  score: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  /**
   * Estaba en 11, y es lo que DISTINGUE UN PARTIDO DE OTRO: la misma gente juega todas las
   * semanas, asi que dos filas seguidas pueden tener los mismos cuatro nombres y el mismo
   * resultado. Lo unico que las separa es esta linea — la hora, la duracion, si quedo sin
   * terminar. Estaba escrita mas chica que todo lo demas.
   *
   * `lineHeight` explicito: con dos renglones, sin el, Android los pega uno contra el otro.
   */
  meta: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 2,
  },

  /** Los dos iconos juntos, en fila. */
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  /** Apagado: abrir el partido es lo que se hace siempre, borrarlo casi nunca. */
  trash: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  trashOn: { opacity: 0.6 },

  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19, padding: space.md },
});
