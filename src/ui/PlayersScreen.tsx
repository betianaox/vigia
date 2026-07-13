import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player } from '../engine';
import { loadIndex, type MatchSummary } from '../store/matches';
import { Brand } from './Brand';
import { useRoster } from './roster';
import { colors, pressed, radius, ripple, space } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const formatDate = (t: number): string => {
  const d = new Date(t);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('es', opts);
};

/**
 * La gente con la que jugas, y la puerta al juego de cada una.
 *
 * Antes esto se llegaba desde el historial: escribir un nombre, elegirlo del desplegable, y
 * recien ahi aparecia una tarjeta. Tres pasos — y si nunca usabas el buscador, no te enterabas
 * nunca de que existia. Justo la funcion que hace que alguien vuelva a abrir la app en tres
 * meses, escondida detras de un campo de busqueda.
 *
 * LA LISTA NO CALCULA NADA. Solo muestra lo que el indice ya sabe: cuantos partidos y cuando
 * fue el ultimo. El acumulado se recalcula del log —abriendo cada archivo— recien al tocar a
 * alguien. Si la lista lo hiciera para todos, abrirla significaria leer quinientos archivos
 * para dibujar cuatro renglones.
 */
export function PlayersScreen({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (p: Player) => void;
}) {
  // Del contexto: una sola fuente para el plantel, en toda la app.
  const { players: roster } = useRoster();
  const [index, setIndex] = useState<MatchSummary[]>([]);

  useEffect(() => {
    void loadIndex().then(setIndex);
  }, []);

  /** Los que efectivamente jugaron. Alguien del plantel sin un solo partido no tiene juego. */
  const rows = useMemo(() => {
    const stats = new Map<string, { matches: number; last: number }>();
    for (const m of index) {
      for (const id of m.playerIds) {
        const prev = stats.get(id) ?? { matches: 0, last: 0 };
        stats.set(id, {
          matches: prev.matches + 1,
          last: Math.max(prev.last, m.startedAt),
        });
      }
    }

    return roster
      .filter((p) => stats.has(p.id))
      .map((p) => ({ player: p, ...stats.get(p.id)! }))
      // El que mas jugo, primero: es de quien hay mas para decir.
      .sort((a, b) => b.matches - a.matches || b.last - a.last);
  }, [index, roster]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.head}>
        <Brand size={26} subtitle="Jugadores" tint={colors.ball} />
        <Pressable
          style={({ pressed: pr }) => [s.close, pr && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onBack}
          hitSlop={10}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <FlatList
        style={s.scroll}
        data={rows}
        keyExtractor={(r) => r.player.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text style={s.empty}>
            Todavía no jugó nadie. Cargá un partido y acá van a aparecer los jugadores.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed: pr }) => [s.row, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onOpen(item.player);
            }}
          >
            <MaterialIcons name="person" size={22} color={colors.textDim} />
            <View style={s.rowMain}>
              <Text style={s.name} numberOfLines={1}>
                {item.player.name}
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {item.matches} {item.matches === 1 ? 'partido' : 'partidos'} · último{' '}
                {formatDate(item.last)}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={colors.textFaint} />
          </Pressable>
        )}
      />
    </SafeAreaView>
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

  scroll: { flex: 1, borderTopWidth: 1, borderColor: colors.border },
  list: { padding: space.lg, gap: space.sm },

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
  /** Peso de lista, no de titulo: en una lista de nombres, un 800 hace que cada renglon grite. */
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },

  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19, padding: space.md },
});
