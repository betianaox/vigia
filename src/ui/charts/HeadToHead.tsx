import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../theme';

export interface Cell {
  /** Iniciales del jugador. La identidad viene de esta etiqueta, no del color. */
  who: string;
  text: string;
  value: number;
}

export interface Row {
  label: string;
  a: [Cell, Cell];
  b: [Cell, Cell];
}

const BAR = 8; // marca fina, muy por debajo del tope de 24px
const CENTER = 96;

/**
 * Comparativa cara a cara, como en las transmisiones, pero POR JUGADOR: un entrenador
 * no corrige a un equipo, corrige a una persona. La suma por equipo esconde justo lo
 * accionable ("¿cuál de los dos está tirando los errores?").
 *
 * El color codifica el EQUIPO (dos series, validadas). Al jugador lo identifican sus
 * iniciales al lado de la barra: la identidad nunca depende solo del color.
 *
 * Cada fila se escala contra su propio maximo, nunca entre filas: las metricas tienen
 * unidades distintas (puntos, porcentajes) y compararlas entre si seria mentir.
 */
export function HeadToHead({
  rows,
  nameA,
  nameB,
  colorA,
  colorB,
}: {
  rows: Row[];
  nameA: string;
  nameB: string;
  colorA: string;
  colorB: string;
}) {
  return (
    <View style={s.root}>
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: colorA }]} />
          <Text style={s.legendText} numberOfLines={1}>
            {nameA}
          </Text>
        </View>
        <View style={[s.legendItem, s.legendRight]}>
          <Text style={s.legendText} numberOfLines={1}>
            {nameB}
          </Text>
          <View style={[s.swatch, { backgroundColor: colorB }]} />
        </View>
      </View>

      {rows.map((r) => {
        const max = Math.max(...[...r.a, ...r.b].map((c) => c.value), 1);

        return (
          <View key={r.label} style={s.row}>
            <View style={s.side}>
              {r.a.map((c) => (
                <View key={c.who} style={s.sub}>
                  <Text style={s.who}>{c.who}</Text>
                  <Text style={s.value}>{c.text}</Text>
                  {/* El espaciador va primero para que la barra nazca en el centro y
                      crezca hacia afuera. La punta exterior va redondeada. */}
                  <View style={s.track}>
                    <View style={{ flex: 1 - c.value / max }} />
                    <View
                      style={[
                        s.bar,
                        s.barLeft,
                        { backgroundColor: colorA, flex: c.value / max },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>

            <Text style={s.label} numberOfLines={2}>
              {r.label}
            </Text>

            <View style={s.side}>
              {r.b.map((c) => (
                <View key={c.who} style={s.sub}>
                  <View style={s.track}>
                    <View
                      style={[
                        s.bar,
                        s.barRight,
                        { backgroundColor: colorB, flex: c.value / max },
                      ]}
                    />
                    <View style={{ flex: 1 - c.value / max }} />
                  </View>
                  <Text style={s.value}>{c.text}</Text>
                  <Text style={s.who}>{c.who}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: space.md },

  legend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  legendRight: { justifyContent: 'flex-end' },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  /** El texto va en tokens de texto, nunca en el color de la serie. */
  legendText: { color: colors.textDim, fontSize: 12, fontWeight: '700', flexShrink: 1 },

  row: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, gap: 3 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { flex: 1, flexDirection: 'row', height: BAR, alignItems: 'center' },

  bar: { height: BAR },
  barLeft: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  barRight: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  who: { width: 22, color: colors.textFaint, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  value: {
    minWidth: 30,
    textAlign: 'center',
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  label: {
    width: CENTER,
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 10.5,
    fontWeight: '600',
    paddingHorizontal: space.xs,
  },
});
