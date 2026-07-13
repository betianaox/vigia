import { StyleSheet, Text, View } from 'react-native';

import { colors, space } from '../theme';

export interface Cell {
  text: string;
  value: number;
}

export interface Row {
  /** Siempre en dos renglones, para que todas las filas midan igual. */
  label: string;
  a: [Cell, Cell];
  b: [Cell, Cell];
  /**
   * El color de la barra, cuando la fila NO es una competencia.
   *
   * Aca cada fila es, literalmente, UN BOTON de la cancha: winner, error forzado, error no
   * forzado, ace. Si la barra toma el color de ese boton, deja de decir "quien va ganando" y
   * pasa a decir "de que accion estamos hablando" — y el problema de la fila que se lee al
   * reves desaparece solo, porque ninguna fila es ya una competencia. Nadie mira una barra
   * roja de errores y piensa que la mas larga va ganando.
   *
   * Es ademas el idioma que la app YA habla: el desglose de golpes usa esa misma leyenda.
   *
   * Sin `fill`, la barra va del color de su equipo — que es lo correcto en las filas que no
   * salen de ningun boton (los porcentajes de saque) y donde tener mas SI es ir mejor.
   */
  fill?: string;
}

const BAR = 8; // marca fina, muy por debajo del tope de 24px
const CENTER = 92;

/**
 * Comparativa cara a cara, como en las transmisiones, pero POR JUGADOR: un entrenador
 * no corrige a un equipo, corrige a una persona. La suma por equipo esconde justo lo
 * accionable ("¿cuál de los dos está tirando los errores?").
 *
 * El color codifica el EQUIPO (dos series, validadas). Al jugador lo identifica su
 * POSICION: la barra de arriba es siempre el primero de la cabecera, la de abajo el
 * segundo. Asi el orden se declara una sola vez y no hay que repetir las iniciales en
 * cada fila.
 *
 * Cada fila se escala contra su propio maximo, nunca entre filas: las metricas tienen
 * unidades distintas (puntos, porcentajes) y compararlas entre si seria mentir.
 */
export function HeadToHead({
  rows,
  playersA,
  playersB,
  colorA,
  colorB,
}: {
  rows: Row[];
  playersA: [string, string];
  playersB: [string, string];
  colorA: string;
  colorB: string;
}) {
  return (
    <View style={s.root}>
      {/* La cabecera declara el orden una sola vez: arriba el primero, abajo el segundo. */}
      <View style={s.header}>
        <View style={s.headSide}>
          <View style={[s.swatch, { backgroundColor: colorA }]} />
          <View>
            {playersA.map((n) => (
              <Text key={n} style={s.headName} numberOfLines={1}>
                {n}
              </Text>
            ))}
          </View>
        </View>
        <View style={[s.headSide, s.headSideRight]}>
          <View>
            {playersB.map((n) => (
              <Text key={n} style={[s.headName, s.headNameRight]} numberOfLines={1}>
                {n}
              </Text>
            ))}
          </View>
          <View style={[s.swatch, { backgroundColor: colorB }]} />
        </View>
      </View>

      {rows.map((r, i) => {
        const max = Math.max(...[...r.a, ...r.b].map((c) => c.value), 1);

        // Con color de accion, las cuatro barras van del mismo: la fila habla de la accion,
        // no de quien gana. Sin el, cada una del color de su equipo.
        const fillA = r.fill ?? colorA;
        const fillB = r.fill ?? colorB;

        return (
          <View key={r.label}>
            {i > 0 && <View style={s.sep} />}

            <View style={s.row}>
              <View style={s.side}>
                {r.a.map((c, k) => (
                  <View key={k} style={s.sub}>
                    <Text style={s.value}>{c.text}</Text>
                    {/* El espaciador va primero para que la barra nazca en el centro y
                        crezca hacia afuera. La punta exterior va redondeada. */}
                    <View style={s.track}>
                      <View style={{ flex: 1 - c.value / max }} />
                      <View
                        style={[s.bar, s.barLeft, { backgroundColor: fillA, flex: c.value / max }]}
                      />
                    </View>
                  </View>
                ))}
              </View>

              <Text style={s.label} numberOfLines={2}>
                {r.label}
              </Text>

              <View style={s.side}>
                {r.b.map((c, k) => (
                  <View key={k} style={s.sub}>
                    <View style={s.track}>
                      <View
                        style={[s.bar, s.barRight, { backgroundColor: fillB, flex: c.value / max }]}
                      />
                      <View style={{ flex: 1 - c.value / max }} />
                    </View>
                    <Text style={s.value}>{c.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  root: {},

  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: space.sm },
  headSide: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  headSideRight: { justifyContent: 'flex-end' },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  /** El texto va en tokens de texto, nunca en el color de la serie. */
  headName: { color: colors.textDim, fontSize: 11, fontWeight: '700', lineHeight: 15 },
  headNameRight: { textAlign: 'right' },

  sep: { height: 1, backgroundColor: colors.border },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  side: { flex: 1, gap: 4 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  track: { flex: 1, flexDirection: 'row', height: BAR, alignItems: 'center' },

  bar: { height: BAR },
  barLeft: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  barRight: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  value: {
    minWidth: 34,
    textAlign: 'center',
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  /** Alto fijo de dos renglones: asi todas las filas miden igual, aunque la etiqueta
      entre en uno solo. */
  label: {
    width: CENTER,
    height: 30,
    textAlignVertical: 'center',
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '600',
  },
});
