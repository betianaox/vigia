import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, PlayerId, TeamId } from '../engine';
import { loadIndex, loadMatch, type MatchSummary, type SavedMatch } from '../store/matches';
import { loadPlayers } from '../store/store';
import { Brand } from './Brand';
import { alpha, colors, pressed, radius, ripple, space, teamColor } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/**
 * Rangos, no un calendario. Nadie se acuerda de la fecha exacta de un partido, pero todos
 * saben si fue "esta semana" o "este año".
 */
const PERIODS = [
  { value: 'all', label: 'Todos', days: 0 },
  { value: 'year', label: 'Este año', days: 365 },
  { value: '30d', label: '30 días', days: 30 },
  { value: '7d', label: '7 días', days: 7 },
] as const;

type Period = (typeof PERIODS)[number]['value'];

const DAY = 24 * 60 * 60 * 1000;

/** "Sáb 12 jul", y el año solo si no es este. */
const formatDate = (t: number): string => {
  const d = new Date(t);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('es', opts);
};

const formatDuration = (ms: number): string => {
  const min = Math.round(ms / 60000);
  if (min < 1) return '—';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
};

export function HistoryScreen({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (m: SavedMatch) => void;
}) {
  const [all, setAll] = useState<MatchSummary[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [player, setPlayer] = useState<PlayerId | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [pickingPlayer, setPickingPlayer] = useState(false);

  useEffect(() => {
    void loadIndex().then(setAll);
    void loadPlayers().then(setRoster);
  }, []);

  /**
   * El filtro por jugador va por ID, no por nombre: dos personas se pueden llamar igual, y
   * alguien se puede renombrar. El id es la identidad estable que se construyo para esto.
   */
  const matches = useMemo(() => {
    const days = PERIODS.find((p) => p.value === period)!.days;
    const since = days === 0 ? 0 : Date.now() - days * DAY;
    return all
      .filter((m) => m.startedAt >= since)
      .filter((m) => !player || m.playerIds.includes(player));
  }, [all, period, player]);

  /** Solo los que efectivamente jugaron algun partido: el plantel entero seria ruido. */
  const played = useMemo(() => {
    const ids = new Set(all.flatMap((m) => m.playerIds));
    return roster.filter((p) => ids.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [all, roster]);

  const open = async (m: MatchSummary) => {
    tick();
    const saved = await loadMatch(m.id);
    if (saved) onOpen(saved);
  };

  const chosen = played.find((p) => p.id === player);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.head}>
        <Pressable
          style={({ pressed: pr }) => [s.back, pr && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onBack}
          hitSlop={10}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Brand size={26} subtitle="Historial" tint={colors.ball} />
      </View>

      {/* Los filtros. Sin ellos, un historial deja de servir apenas tenes treinta partidos. */}
      <View style={s.filters}>
        <Pressable
          style={({ pressed: pr }) => [s.chip, chosen && s.chipOn, pr && pressed]}
          android_ripple={ripple}
          onPress={() => {
            tick();
            setPickingPlayer((v) => !v);
          }}
        >
          <MaterialIcons
            name="person"
            size={16}
            color={chosen ? colors.text : colors.textFaint}
          />
          <Text style={[s.chipText, chosen && s.chipTextOn]} numberOfLines={1}>
            {chosen?.name ?? 'Jugador'}
          </Text>
          {chosen ? (
            <Pressable
              onPress={() => {
                tick();
                setPlayer(null);
                setPickingPlayer(false);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={16} color={colors.text} />
            </Pressable>
          ) : (
            <MaterialIcons name="expand-more" size={16} color={colors.textFaint} />
          )}
        </Pressable>

        <View style={s.periods}>
          {PERIODS.map((p) => (
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

      {pickingPlayer && (
        <View style={s.playerList}>
          {played.length === 0 ? (
            <Text style={s.empty}>Todavía no hay partidos jugados.</Text>
          ) : (
            played.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed: pr }) => [s.playerRow, pr && pressed]}
                android_ripple={ripple}
                onPress={() => {
                  tick();
                  setPlayer(p.id);
                  setPickingPlayer(false);
                }}
              >
                <MaterialIcons name="person" size={18} color={colors.textDim} />
                <Text style={s.playerName}>{p.name}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

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
              ? 'Todavía no hay partidos guardados. Jugá uno y va a aparecer acá.'
              : 'Ningún partido con esos filtros.'}
          </Text>
        }
        renderItem={({ item }) => <Row m={item} onPress={() => void open(item)} />}
      />
    </SafeAreaView>
  );
}

/** El ganador en el color de su equipo, el perdedor atenuado: el mismo vocabulario del tanteador. */
function Row({ m, onPress }: { m: MatchSummary; onPress: () => void }) {
  const line = (t: TeamId) => {
    const lost = m.finished && m.winner !== t;
    return (
      <Text
        style={[s.team, { color: teamColor(t) }, lost && s.lost]}
        numberOfLines={1}
      >
        {m.teams[t]}
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
        <Text style={s.meta} numberOfLines={1}>
          {formatDate(m.startedAt)} · {formatDuration(m.updatedAt - m.startedAt)} ·{' '}
          {m.points} puntos
          {m.finished ? '' : ' · sin terminar'}
        </Text>
      </View>

      <View style={s.rowRight}>
        <Text style={s.score} numberOfLines={1}>
          {m.score || '—'}
        </Text>
        <MaterialIcons name="bar-chart" size={22} color={colors.textDim} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },

  filters: { paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm },
  periods: { flexDirection: 'row', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  chipText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: colors.text, fontWeight: '900' },

  playerList: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
  },
  playerName: { color: colors.text, fontSize: 15, fontWeight: '600' },

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
  team: { fontSize: 14, fontWeight: '800' },
  lost: { opacity: 0.45 },
  meta: { color: colors.textFaint, fontSize: 11, fontWeight: '600', marginTop: 2 },

  rowRight: { alignItems: 'flex-end', gap: 4 },
  score: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19, padding: space.md },
});
