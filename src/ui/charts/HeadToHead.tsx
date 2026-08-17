import { useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { useColors } from '../theme-context';
import { space, type Colors } from '../theme';

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
const CENTER = 100;

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
  /**
   * Cuanto pesan los nombres de la cabecera.
   *
   * En la app son una etiqueta: el tanteador esta justo arriba, grande, y ahi se lee quien jugo.
   * En la TARJETA no: el tanteador va chico y al que perdio lo dibuja en gris, asi que estos
   * nombres pasan a ser los que sostienen la lectura. Crecen y se encienden.
   */
  nameSize = 12.5,
  nameColor,
  /**
   * Y MENOS NEGRITA CUANTO MAS GRANDE. Un nombre chico necesita peso para no desaparecer; uno
   * grande no, y con 800 encima grita. Se lee mejor un cuerpo mas grande y un trazo mas liviano.
   */
  nameWeight = '700',
  /** Cuanto respira el nombre del punto de color. Cuanto mas grande la letra, mas aire pide. */
  nameGap = 6,
  /** Los numeros y las etiquetas del medio. En la tarjeta van mas grandes: ver `allowFontScaling`. */
  valueSize = 13,
  labelSize = 12,
  /**
   * EN LA TARJETA VA EN `false`, Y NO ES UN CAPRICHO.
   *
   * La tarjeta es una IMAGEN de ancho fijo: el mismo partido tiene que dar el mismo PNG en
   * cualquier telefono. Si su texto creciera con la fuente del sistema, la imagen que manda
   * alguien con la letra al 150% sale con la ultima columna afuera del lienzo — y el que la
   * recibe ve eso, sin saber por que. En la app, en cambio, esto SI tiene que escalar: es una
   * pantalla que se lee, no una foto que se manda.
   */
  allowFontScaling = true,
}: {
  rows: Row[];
  playersA: [string, string];
  playersB: [string, string];
  colorA: string;
  colorB: string;
  nameSize?: number;
  nameColor?: string;
  nameWeight?: TextStyle['fontWeight'];
  nameGap?: number;
  valueSize?: number;
  labelSize?: number;
  allowFontScaling?: boolean;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  /* El default no puede ir en la firma: alli todavia no existe el tema. */
  const nombreColor = nameColor ?? c.textDim;

  return (
    <View style={s.root}>
      {/* La cabecera declara el orden una sola vez: arriba el primero, abajo el segundo. */}
      <View style={s.header}>
        <View style={[s.headSide, { gap: nameGap }]}>
          <View style={[s.swatch, { backgroundColor: colorA }]} />
          <View>
            {playersA.map((n) => (
              <Text
                key={n}
                allowFontScaling={allowFontScaling}
                style={[s.headName, {
                    fontSize: nameSize,
                    lineHeight: nameSize + 4,
                    color: nombreColor,
                    fontWeight: nameWeight,
                  }]}
                numberOfLines={1}
              >
                {n}
              </Text>
            ))}
          </View>
        </View>
        <View style={[s.headSide, s.headSideRight, { gap: nameGap }]}>
          <View>
            {playersB.map((n) => (
              <Text
                key={n}
                allowFontScaling={allowFontScaling}
                style={[
                  s.headName,
                  s.headNameRight,
                  {
                    fontSize: nameSize,
                    lineHeight: nameSize + 4,
                    color: nombreColor,
                    fontWeight: nameWeight,
                  },
                ]}
                numberOfLines={1}
              >
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
                    <Text
                      allowFontScaling={allowFontScaling}
                      style={[s.value, { fontSize: valueSize }]}
                    >
                      {c.text}
                    </Text>
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

              <Text
                allowFontScaling={allowFontScaling}
                style={[s.label, { fontSize: labelSize }]}
                numberOfLines={2}
              >
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
                    <Text
                      allowFontScaling={allowFontScaling}
                      style={[s.value, { fontSize: valueSize }]}
                    >
                      {c.text}
                    </Text>
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

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  root: {},

  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: space.sm },
  headSide: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  headSideRight: { justifyContent: 'flex-end' },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  /** El texto va en tokens de texto, nunca en el color de la serie. */
  headName: { color: c.textDim, fontSize: 12.5, fontWeight: '700', lineHeight: 17 },
  headNameRight: { textAlign: 'right' },

  sep: { height: 1, backgroundColor: c.border },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  side: { flex: 1, gap: 4 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  track: { flex: 1, flexDirection: 'row', height: BAR, alignItems: 'center' },

  bar: { height: BAR },
  barLeft: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  barRight: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },

  value: {
    minWidth: 38,
    textAlign: 'center',
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  /**
   * Dos renglones de alto, para que todas las filas midan igual aunque la etiqueta entre en uno.
   *
   * `minHeight`, NO `height`: los dp no escalan con la fuente del sistema pero el texto si, asi
   * que una caja de 30 con la letra en grande le corta el segundo renglon a "Errores no forzados".
   * Es la misma trampa que nos comimos en la cancha. El piso mantiene la grilla pareja; el techo
   * lo pone el texto.
   */
  label: {
    width: CENTER,
    minHeight: 32,
    textAlignVertical: 'center',
    textAlign: 'center',
    color: c.textDim,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
});
