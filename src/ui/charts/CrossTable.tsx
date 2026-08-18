import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme-context';
import { alpha, radius, space, type Colors } from '../theme';

/**
 * UNA TABLITA: una fila por sujeto, una columna por golpe, el numero en la celda.
 *
 * Nace de "Errores provocados", que se contaba como dos listas sueltas — "5 a Beto · 2 a Bea" y
 * "3 de remate · 4 de bandeja"—. Las dos son ciertas y juntas no dicen nada: nadie puede saber
 * si esos remates fueron a Beto o a Bea. La tabla cruza las dos preguntas y ahi recien el dato
 * sirve: "le ganaste tres veces con el remate a Beto" es una instruccion.
 *
 * LAS COLUMNAS SON LAS QUE PASARON, no las catorce posibles. En un partido se fuerzan errores
 * con tres o cuatro golpes; con las catorce fijas, la tabla necesitaria scroll horizontal para
 * mostrar diez columnas vacias.
 *
 * Y EL GUION NO ES UN CERO. Una celda vacia dice "con ese golpe, a esa persona, no le forzaste
 * ninguno" — que es un dato— pero escribirlo como `0` llena la tabla de ceros y hace que los
 * numeros que importan se pierdan entre ellos. El guion se ve y no se lee.
 */
export interface CrossRow {
  /** Como se llama la fila. Un rival, un jugador. */
  label: string;
  /** Cuanto le corresponde a cada columna. Lo que falte se dibuja como guion. */
  cells: Partial<Record<string, number>>;
}

export function CrossTable({
  rows,
  columns,
  columnLabel,
}: {
  rows: CrossRow[];
  /** Las claves de las columnas, ya ordenadas por quien llama. */
  columns: string[];
  /** Como se escribe el encabezado de cada columna. */
  columnLabel: (key: string) => string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  if (rows.length === 0 || columns.length === 0) return null;

  /**
   * Scrollea a lo ancho SOLO si hace falta. Con tres o cuatro columnas entra sin mover nada;
   * con un partido raro de ocho golpes distintos, se corre en vez de apretar los nombres hasta
   * cortarlos.
   */
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.table}>
        <View style={s.head}>
          {/* La celda de la esquina va vacia: es el cruce de "quien" con "con que", y ponerle
              un titulo obliga a leer una palabra que no aporta. */}
          <View style={s.name} />
          {columns.map((col) => (
            <Text key={col} style={s.headCell} numberOfLines={1}>
              {columnLabel(col)}
            </Text>
          ))}
        </View>

        {rows.map((row) => (
          <View key={row.label} style={s.row}>
            <Text style={s.name} numberOfLines={1}>
              {row.label}
            </Text>
            {columns.map((col) => {
              const n = row.cells[col] ?? 0;
              return (
                <Text key={col} style={[s.cell, n === 0 && s.empty]}>
                  {n === 0 ? '—' : n}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    table: { gap: 2 },

    head: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 2 },

    /**
     * El nombre de la fila manda el ancho de la primera columna, y es fijo: si cada fila midiera
     * lo suyo, los numeros no alinearian entre filas — que es lo unico que una tabla tiene que
     * garantizar.
     */
    name: {
      width: 110,
      color: c.textDim,
      fontSize: 12.5,
      fontWeight: '700',
      paddingRight: space.xs,
    },

    /**
     * Las columnas son los rivales, y son DOS: pueden ser anchas y llevar el nombre entero.
     * Cuando eran los catorce golpes tenian que ser angostas y el nombre se cortaba.
     */
    headCell: {
      width: 78,
      textAlign: 'center',
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '800',
      paddingBottom: 3,
    },

    cell: {
      width: 78,
      textAlign: 'center',
      paddingVertical: 7,
      borderRadius: radius.sm,
      backgroundColor: alpha(c.text, 0.05),
      color: c.text,
      fontSize: 15,
      fontWeight: '800',
    },
    /** El guion, apagado: esta para marcar el hueco, no para leerse. */
    empty: { color: c.textFaint, backgroundColor: 'transparent', fontWeight: '600' },
  });
