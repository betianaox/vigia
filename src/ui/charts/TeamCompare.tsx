import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme-context';
import { alpha, dimmed, radius, space, type Colors } from '../theme';

export interface CompareRow {
  label: string;
  /** Lo que se lee. Puede no ser un numero: "3/5", "1.5", "—". */
  a: string;
  b: string;
  /** Lo que se dibuja. La barra reparte el ancho entre los dos. */
  aValue: number;
  bValue: number;
  /** El que tiene el numero mas alto NO siempre es el que va mejor (los errores). */
  lowerIsBetter?: boolean;
}

/**
 * La vista global: equipo contra equipo, una fila por cosa.
 *
 * Es lo primero que se mira y lo unico que se entiende de un vistazo, sin leer un numero: la
 * barra ya dice quien gano cada cosa. Los nombres no estan a proposito — aca se compara a las
 * PAREJAS. Quien de los dos tiro los errores es la pregunta siguiente, y baja al detalle.
 *
 * De aca sale despues la tarjeta que se comparte, asi que se dibuja sola: no depende de nada
 * de la pantalla que la contiene.
 */
export function TeamCompare({ rows }: { rows: CompareRow[] }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={s.root}>
      {rows.map((r) => {
        const total = r.aValue + r.bValue;
        // Sin datos (0 a 0), la barra se reparte al medio: no inventa un ganador.
        const aShare = total === 0 ? 0.5 : r.aValue / total;

        const aWins = r.lowerIsBetter ? r.aValue < r.bValue : r.aValue > r.bValue;
        const bWins = r.lowerIsBetter ? r.bValue < r.aValue : r.bValue > r.aValue;

        /**
         * La barra mide CUANTO hay — eso no cambia nunca. Lo que cambia es de que color.
         *
         * En casi todas las filas, tener mas es ir mejor, y cada mitad va del color de su
         * equipo: violeta contra naranja, como en toda la app.
         *
         * Pero en la fila de errores el criterio se da vuelta: la barra larga es la del que va
         * PEOR. Cuatro filas que se leen de una forma y una que dice lo contrario es un grafico
         * que dice la verdad y comunica una mentira — porque nadie lee la etiqueta con cuidado,
         * se mira la barra.
         *
         * Asi que esa fila —y solo esa— cambia de color. EL CAMBIO DE COLOR ES EL AVISO DE QUE
         * CAMBIO LA REGLA, y llega por el canal que el ojo esta mirando, no por una etiqueta
         * que nadie lee. Se pierde la identidad de equipo en una fila; la posicion (izquierda
         * es el equipo 1) y los numeros de arriba la siguen diciendo.
         *
         * Bordo el que erro mas, gris el otro. Sin verde: ver `worse` en theme.ts.
         *
         * Y EL EMPATE ES GRIS DE LOS DOS LADOS. Sin esto, 5 errores contra 5 no daba ningun
         * ganador —ni `aWins` ni `bWins`— y las dos mitades se pintaban de bordo: una barra
         * entera roja, que se lee como un desastre y no como un empate. En un empate no hay peor.
         */
        const flipped = r.lowerIsBetter === true;
        const tied = r.aValue === r.bValue;
        const errColor = (wins: boolean): string =>
          tied || wins ? c.neutralFill : c.worse;

        const aColor = flipped ? errColor(aWins) : c.teamAFill;
        const bColor = flipped ? errColor(bWins) : c.teamBFill;

        return (
          <View key={r.label} style={s.row}>
            <View style={s.head}>
              <Text style={[s.value, s.valueA, { color: c.teamA }, !aWins && s.dim]}>
                {r.a}
              </Text>
              <Text style={s.label} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={[s.value, s.valueB, { color: c.teamB }, !bWins && s.dim]}>
                {r.b}
              </Text>
            </View>

            {/* Una sola barra partida, no dos: lo que se compara es el REPARTO. Dos barras
                sueltas obligan a medirlas con el ojo; una partida ya viene medida. */}
            <View style={s.bar}>
              <View style={[s.fill, { flex: aShare, backgroundColor: aColor }]} />
              <View style={[s.fill, { flex: 1 - aShare, backgroundColor: bColor }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  root: { gap: space.md },
  row: { gap: 6 },

  head: { flexDirection: 'row', alignItems: 'center' },
  value: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 68 },
  valueA: { textAlign: 'left' },
  valueB: { textAlign: 'right' },
  /** El que no gana esa fila se apaga. El ganador se lee sin comparar. */
  dim: dimmed(c),
  label: {
    flex: 1,
    textAlign: 'center',
    color: c.textDim,
    fontSize: 13,
    fontWeight: '700',
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: alpha(c.text, 0.08),
  },
  fill: { height: '100%' },
});
