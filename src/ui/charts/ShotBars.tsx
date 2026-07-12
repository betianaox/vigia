import { StyleSheet, Text, View } from 'react-native';

import type { ShotLine } from '../../engine/stats';
import { STROKE_LABELS } from '../shots';
import { colors, radius, space } from '../theme';

const BAR = 12;
const GAP = 2; // el separador es un hueco del color de la superficie, no un borde

/**
 * Que rindio cada golpe: la barra se parte en winners / errores forzados / no forzados.
 * Un golpe que es casi todo rojo es plata para un entrenador — y es exactamente el
 * dato que ningun sensor puede producir, porque hace falta que alguien juzgue el punto.
 *
 * Cada barra se escala contra el golpe MAS usado, asi se ve de un vistazo cuales pesan.
 */
export function ShotBars({ lines }: { lines: ShotLine[] }) {
  if (lines.length === 0) {
    return (
      <Text style={s.empty}>
        Sin golpes cargados. Mantené apretada una acción para elegir el golpe.
      </Text>
    );
  }
  const max = Math.max(...lines.map((l) => l.total), 1);

  return (
    <View style={s.root}>
      <View style={s.legend}>
        {[
          ['Winners', colors.winner],
          ['E. forzados', colors.errorForced],
          ['E. no forzados', colors.errorUnforced],
        ].map(([label, color]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {lines.map((l) => (
        <View key={l.shot} style={s.row}>
          <Text style={s.name} numberOfLines={1}>
            {STROKE_LABELS[l.shot]}
          </Text>

          <View style={s.track}>
            <View style={[s.stack, { flex: l.total / max }]}>
              {(
                [
                  [l.winners, colors.winner],
                  [l.forced, colors.errorForced],
                  [l.unforced, colors.errorUnforced],
                ] as Array<[number, string]>
              )
                .filter(([n]) => n > 0)
                .map(([n, color], i, arr) => (
                  <View
                    key={color}
                    style={[
                      s.seg,
                      {
                        flex: n,
                        backgroundColor: color,
                        marginRight: i < arr.length - 1 ? GAP : 0,
                        borderTopLeftRadius: i === 0 ? 4 : 0,
                        borderBottomLeftRadius: i === 0 ? 4 : 0,
                        borderTopRightRadius: i === arr.length - 1 ? 4 : 0,
                        borderBottomRightRadius: i === arr.length - 1 ? 4 : 0,
                      },
                    ]}
                  />
                ))}
            </View>
            <View style={{ flex: 1 - l.total / max }} />
          </View>

          <Text style={s.total}>{l.total}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: space.sm },
  empty: { color: colors.textFaint, fontSize: 11, fontStyle: 'italic' },

  legend: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  legendText: { color: colors.textDim, fontSize: 10, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { width: 92, color: colors.textDim, fontSize: 11, fontWeight: '600' },
  track: { flex: 1, flexDirection: 'row', height: BAR, alignItems: 'center' },
  stack: { flexDirection: 'row', height: BAR },
  seg: { height: BAR },
  total: {
    minWidth: 18,
    textAlign: 'right',
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
