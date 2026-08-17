import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from './theme-context';
import { space, type Colors } from './theme';

/**
 * UNA METRICA QUE SE LLEVA EL ANCHO ENTERO, porque su desglose no cabe en un tercio.
 *
 * Nace de un defecto que estaba en DOS pantallas a la vez —la ficha del partido y el acumulado de
 * una persona—: "Errores provocados" vivia en una celda de un grid de tres, con las otras dos
 * VACIAS al lado, y su desglose por golpe apretado en ese tercio de ancho. Las dos listas que
 * cuelgan de ese numero no son igual de largas ni por casualidad: los rivales son a lo sumo DOS,
 * pero los golpes son CATORCE. En un tercio de ancho, la de golpes se partia en un chorizo de
 * siete renglones; en el acumulado de una temporada, donde aparecen todos los golpes con numeros
 * altos, era peor todavia.
 *
 * Vive en su propio archivo y no en una de las dos pantallas para que no nazca una tercera copia:
 * `Stat` y el armado de las listas ya estan duplicados entre ambas, y esa duplicacion es la razon
 * por la que el problema hubo que encontrarlo dos veces.
 */
export function WideStat({
  label,
  value,
  rows,
}: {
  label: string;
  value: string;
  /** Cada dimension del desglose. Una fila sin datos no se dibuja. */
  rows: { label: string; text: string | undefined }[];
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  /**
   * Una fila SIN datos no se dibuja: "Con qué —" no informa nada y le mete ruido al bloque. El
   * numero de arriba ya distingue el cero del "no se sabe", que es donde esa distincion importa.
   */
  const withData = rows.filter((r) => r.text);

  return (
    <View style={s.wideStat}>
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>

      {withData.map((r) => (
        <View key={r.label} style={s.row}>
          <Text style={s.rowLabel}>{r.label}</Text>
          <Text style={s.rowText}>{r.text}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Lo mismo que hacian `duels` y `shotDuels` en cada pantalla, pero SIN la preposicion:
 * "5 Beto · 2 Bea" en vez de "5 a Beto · 2 a Bea".
 *
 * En una fila ancha el rotulo de la izquierda ("A qué", "Con qué") ya dice de que habla la lista,
 * asi que repetir el "a" o el "de" en cada entrada solo gasta el ancho que justamente faltaba. Y
 * de paso saca del medio un "a" que estaba escrito en castellano dentro de una app que habla
 * cuatro idiomas.
 */
export function tally(
  counts: Partial<Record<string, number>>,
  labelOf: (key: string) => string,
): string | undefined {
  const lines = (Object.entries(counts) as Array<[string, number]>)
    .filter(([, n]) => n > 0)
    // De mayor a menor: cinco errores forzados al mismo rival dicen algo que cinco repartidos no.
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${n} ${labelOf(key)}`);
  return lines.length > 0 ? lines.join(' · ') : undefined;
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  /**
   * Alineada a la izquierda y no centrada a proposito: la celda que reemplaza era la PRIMERA de
   * un grid de tres, asi que su numero ya vivia a la izquierda de la tarjeta. Centrarlo lo
   * habria mandado al medio, moviendo de lugar un dato que la gente ya sabe donde encontrar.
   */
  wideStat: { gap: 2, alignItems: 'flex-start' },

  // Mismos valores que el `Stat` de las dos pantallas: es la misma clase de dato, con el mismo
  // peso visual. Lo unico que cambia es el ancho que se le da al desglose.
  value: { color: c.text, fontSize: 20, fontWeight: '800' },
  label: { color: c.textDim, fontSize: 12, fontWeight: '600' },

  row: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  /**
   * `minWidth` y NO `width`: con la letra del sistema en grande, un ancho fijo le corta la cola a
   * "Contra quem". Prefiero que empuje y que las dos filas queden un pelo desalineadas antes que
   * truncar un rotulo — desalineado se lee, truncado no.
   */
  rowLabel: { color: c.textFaint, fontSize: 11, fontWeight: '800', minWidth: 64 },
  /** Se lleva el resto del ancho: es el que tenia que envolver bien y no podia. */
  rowText: { color: c.textFaint, fontSize: 11, flex: 1 },
});
