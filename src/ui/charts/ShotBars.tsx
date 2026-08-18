import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ShotLine } from '../../engine/stats';
import { L } from '../../i18n';
import { strokeLabels } from '../shots';
import { useColors } from '../theme-context';
import { radius, space, type Colors } from '../theme';

const BAR = 12;
const GAP = 2; // el separador es un hueco del color de la superficie, no un borde

/**
 * La columna del nombre del golpe, a la fuente normal del sistema.
 *
 * Tiene que ser FIJA —si cada fila se anchara con su palabra, las barras arrancarian en una x
 * distinta en cada una y no habria nada que comparar—, pero fija en dp significa que no crece con
 * la letra: con la fuente al 150%, "Recuperación" no entra y React Native, que no sabe cortar
 * palabras con guion, la parte al medio ("Recuperaci / ón").
 *
 * Asi que la columna escala con la MISMA fuente que va adentro. Sigue siendo una sola medida para
 * todas las filas —las barras siguen alineadas— y el nombre entra entero en cualquier tamaño. El
 * tope existe porque de la pantalla no salen mas puntos: pasado 1.6 la barra se quedaria sin
 * espacio, y ahi es preferible que la palabra envuelva.
 */
const NAME_W = 110;
const NAME_MAX_SCALE = 1.6;

/**
 * Que rindio cada golpe: la barra se parte en winners / errores forzados / no forzados.
 * Un golpe que es casi todo rojo es plata para un entrenador — y es exactamente el
 * dato que ningun sensor puede producir, porque hace falta que alguien juzgue el punto.
 *
 * Cada barra se escala contra el golpe MAS usado, asi se ve de un vistazo cuales pesan.
 */
export function ShotBars({ lines }: { lines: ShotLine[] }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const { fontScale } = useWindowDimensions();
  const nameWidth = Math.round(NAME_W * Math.min(fontScale, NAME_MAX_SCALE));

  if (lines.length === 0) {
    return (
      <Text style={s.empty}>{L.stats.noShots}</Text>
    );
  }
  const max = Math.max(...lines.map((l) => l.total), 1);

  return (
    <View style={s.root}>
      <View style={s.legend}>
        {/* Los colores de GRAFICO, no los de los botones: mismo significado, medio tono de voz.
            Con treinta barras a la vez, el semaforo saturado cansa la vista en diez segundos.

            SON DOS, NO TRES. Habia un tercer casillero amarillo, "E. forzados", para un segmento
            que la barra no dibuja nunca: el motor suma el error forzado adentro de
            `unforcedByShot`, asi que la barra siempre tuvo dos tramos. Una leyenda que nombra un
            color que no aparece hace dudar de todo el resto del grafico.

            Y por eso el rojo dice TOTALES: contiene los forzados y los no forzados. Decia "no
            forzados", que era el mismo error contado al reves. */}
        {[
          [L.stats.winners, c.winnerChart],
          [L.stats.errorsLegend, c.errorUnforcedChart],
        ].map(([label, color]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      {lines.map((l) => (
        <View key={l.shot} style={s.row}>
          {/* Dos renglones como techo: los nombres largos de dos palabras ("Salida de pared",
              "Uscita di parete") envuelven en vez de cortarse. */}
          <Text style={[s.name, { width: nameWidth }]} numberOfLines={2}>
            {strokeLabels()[l.shot]}
          </Text>

          <View style={s.track}>
            <View style={[s.stack, { flex: l.total / max }]}>
              {(
                [
                  [l.winners, c.winnerChart],
                  [l.unforced, c.errorUnforcedChart],
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  root: { gap: space.sm },
  empty: { color: c.textFaint, fontSize: 12, fontStyle: 'italic' },

  legend: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  legendText: { color: c.textDim, fontSize: 11.5, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  /** El mismo cuerpo que en la hoja de golpes: un golpe se llama igual en toda la app.
      El ancho lo pone el componente, que es el unico que sabe cuanto crecio la letra. */
  name: { color: c.textDim, fontSize: 13, lineHeight: 16, fontWeight: '600' },
  track: { flex: 1, flexDirection: 'row', height: BAR, alignItems: 'center' },
  stack: { flexDirection: 'row', height: BAR },
  seg: { height: BAR },
  total: {
    minWidth: 22,
    textAlign: 'right',
    color: c.text,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
