import { StyleSheet, Text, View } from 'react-native';

import type { ShotTally } from '../../engine/stats';
import type { Stroke } from '../../engine';
import { L } from '../../i18n';
import { STROKE_LABELS } from '../shots';
import { alpha, colors, radius, space } from '../theme';

/** Un partido: cuantos golpes de cada tipo, en esta categoria. */
export interface StackColumn {
  at: number;
  byShot: ShotTally;
}

/**
 * Los golpes CONTRA EL TIEMPO: una barra por partido, y adentro un pedazo por golpe.
 *
 * El desglose sumado de toda la carrera dice CUANTO, pero no dice si estas mejorando — y esta
 * pantalla existe justamente para lo segundo. Aca la altura de la barra es el total de esa
 * categoria ese dia: si la columna roja de errores no forzados va bajando, mejoraste, y se ve
 * sin leer un numero.
 *
 * Los pedazos NO van de colores distintos: van en intensidades del mismo color. Asi cada
 * grafico mantiene su identidad (verde los winners, amarillo los forzados, rojo los no
 * forzados) y los golpes se distinguen igual. Nueve colores sueltos serian nueve cosas nuevas
 * que aprender, y encima chocarian con los de los equipos.
 *
 * Y entran solo los golpes que la persona USA: los que casi no aparecen se juntan en "Otros".
 * Nueve pedacitos en una barra de telefono no son nueve datos, son ruido.
 */
const MAX_SHOTS = 5;

export function ShotStack({
  columns,
  color,
  /** El mismo para los tres graficos: asi la altura significa lo mismo en todos. */
  scale,
}: {
  columns: StackColumn[];
  color: string;
  scale: number;
}) {
  // Los golpes mas usados de esta categoria, de mayor a menor. El resto cae en "Otros".
  const totals: ShotTally = {};
  for (const c of columns) {
    for (const [shot, n] of Object.entries(c.byShot) as Array<[Stroke, number]>) {
      totals[shot] = (totals[shot] ?? 0) + n;
    }
  }

  const ranked = (Object.entries(totals) as Array<[Stroke, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0 || scale <= 0) {
    return <Text style={s.empty}>{L.stats.noShotsCategory}</Text>;
  }

  const top = ranked.slice(0, MAX_SHOTS).map(([shot]) => shot);
  const hasOthers = ranked.length > MAX_SHOTS;

  /**
   * La intensidad separa los golpes. El mas usado, el mas solido.
   *
   * El rango va hasta 0.22 y no hasta 0.4: con seis pedazos, un rango corto los deja a todos
   * pareciendose, y la leyenda promete una separacion que el grafico no entrega. Pero ni asi
   * alcanza — por eso cada pedazo lleva ademas una linea del color de la tarjeta que lo separa
   * del de al lado. El borde se ve aunque los tonos no.
   */
  const shade = (i: number, total: number): string =>
    alpha(color, total <= 1 ? 1 : 1 - (i / (total - 1)) * 0.78);

  const segments = hasOthers ? top.length + 1 : top.length;

  return (
    <View style={s.root}>
      <View style={s.plot}>
        {columns.map((c, i) => {
          const others = (Object.entries(c.byShot) as Array<[Stroke, number]>)
            .filter(([shot]) => !top.includes(shot))
            .reduce((n, [, v]) => n + v, 0);

          return (
            <View key={`${c.at}-${i}`} style={s.slot}>
              {/* El mas usado va ABAJO: es la base estable, y lo que se mueve arriba se lee
                  mejor contra un piso que no cambia. */}
              {hasOthers && others > 0 && (
                <View
                  style={[
                    s.seg,
                    { height: `${(others / scale) * 100}%`, backgroundColor: shade(segments - 1, segments) },
                  ]}
                />
              )}
              {[...top].reverse().map((shot) => {
                const n = c.byShot[shot] ?? 0;
                if (n === 0) return null;
                return (
                  <View
                    key={shot}
                    style={[
                      s.seg,
                      {
                        height: `${(n / scale) * 100}%`,
                        backgroundColor: shade(top.indexOf(shot), segments),
                      },
                    ]}
                  />
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={s.legend}>
        {top.map((shot, i) => (
          <View key={shot} style={s.key}>
            <View style={[s.swatch, { backgroundColor: shade(i, segments) }]} />
            <Text style={s.keyText}>{STROKE_LABELS[shot]}</Text>
          </View>
        ))}
        {hasOthers && (
          <View style={s.key}>
            <View style={[s.swatch, { backgroundColor: shade(segments - 1, segments) }]} />
            <Text style={s.keyText}>{L.stats.otherShots}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: space.sm },

  plot: { flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 3 },
  /** La columna crece desde abajo: los pedazos se apilan en orden inverso. */
  slot: { flex: 1, height: '100%', flexDirection: 'column-reverse' },
  /** La linea de arriba, del color de la tarjeta, es lo que separa un golpe del siguiente. */
  seg: {
    width: '100%',
    minHeight: 3,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  key: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 9, height: 9, borderRadius: radius.sm },
  keyText: { color: colors.textDim, fontSize: 10, fontWeight: '700' },

  empty: { color: colors.textFaint, fontSize: 12 },
});
