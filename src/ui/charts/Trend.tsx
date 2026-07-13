import { StyleSheet, Text, View } from 'react-native';

import { alpha, colors, radius, space } from '../theme';

export interface TrendPoint {
  at: number;
  /** null: ese partido no tiene el dato (nunca saco, nunca erro). No se dibuja un cero. */
  value: number | null;
}

/**
 * La evolucion: una barra por partido, del mas viejo al mas nuevo.
 *
 * Es la vista que engancha. El acumulado es un retrato —quien sos— y despues de treinta
 * partidos deja de moverse y se vuelve empapelado. La evolucion es una pelicula: es lo que un
 * entrenador usa de verdad ("desde que cambiamos el saque, tu ratio subio de 0.8 a 1.4").
 *
 * Un partido sin dato NO dibuja una barra de cero. Cero primeros saques adentro y "nunca
 * sacaste" son cosas distintas, y una barra al ras las confunde: parece un desastre cuando en
 * realidad no hay informacion. El hueco dice la verdad.
 *
 * La linea del promedio no es decorativa: sin ella, ocho barras parecidas no dicen nada. Con
 * ella, se ve de un vistazo cuales estan arriba y cuales abajo de lo que uno suele hacer.
 */
export function Trend({
  points,
  average,
  format,
  color,
}: {
  points: TrendPoint[];
  /** El acumulado de verdad (contadores sumados), NO el promedio de estas barras. */
  average: number | null;
  format: (v: number) => string;
  color: string;
}) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);

  if (values.length < 2) {
    return (
      <Text style={s.empty}>
        Con un solo partido no hay evolución que mostrar. Juega otro y esto se llena.
      </Text>
    );
  }

  // La escala arranca en cero: una barra que empieza en el minimo exagera cualquier diferencia
  // y hace parecer un derrumbe a lo que fue medio punto.
  const max = Math.max(...values, average ?? 0);
  const top = max <= 0 ? 1 : max * 1.1;
  const avgAt = average === null ? null : average / top;

  return (
    <View style={s.root}>
      <View style={s.plot}>
        <View style={s.bars}>
          {points.map((p, i) => (
            <View key={`${p.at}-${i}`} style={s.slot}>
              {p.value !== null && (
                <View
                  style={[
                    s.bar,
                    { height: `${Math.max(2, (p.value / top) * 100)}%`, backgroundColor: color },
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        {/* La linea del promedio va DESPUES de las barras: es la referencia contra la que se
            miden, asi que tiene que verse por encima de ellas. Dibujada debajo, la tapan justo
            las barras altas — que son las unicas que uno quiere comparar contra el promedio. */}
        {avgAt !== null && (
          <View style={[s.avgLine, { bottom: `${avgAt * 100}%` }]} pointerEvents="none">
            <View style={s.avgDash} />
            <Text style={s.avgText}>{format(average!)}</Text>
          </View>
        )}
      </View>

      {/* Solo las dos puntas. Una fecha debajo de cada barra seria ilegible con veinte partidos,
          y lo que se pregunta no es "¿que dia fue?": es "¿voy para arriba?". */}
      <View style={s.axis}>
        <Text style={s.axisText}>{when(points[0]!.at)}</Text>
        <Text style={s.axisText}>{when(points[points.length - 1]!.at)}</Text>
      </View>
    </View>
  );
}

const when = (t: number): string =>
  new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' });

const s = StyleSheet.create({
  root: { gap: space.sm },

  plot: { height: 120, justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 3 },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3, minHeight: 3 },

  /** El promedio: es la referencia contra la que se miden las barras, no un dato mas. */
  avgLine: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  avgDash: { flex: 1, height: 1, backgroundColor: alpha(colors.text, 0.5) },
  /** La etiqueta se recorta su propio fondo del color de la TARJETA, para leerse sobre la barra. */
  avgText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },

  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },

  empty: { color: colors.textFaint, fontSize: 12, lineHeight: 18 },
});
