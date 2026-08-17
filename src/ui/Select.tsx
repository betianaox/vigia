import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from './theme-context';
import { alpha, pressed, radius, ripple, space, type Colors } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

export interface Option {
  value: string;
  label: string;
  /** Que hace, en una linea. Vive DENTRO de la opcion: ver abajo. */
  desc?: string;
}

/**
 * UN SELECTOR, Y NO BOTONES. LA FORMA DICE DE QUE CATEGORIA ES LA OPCION.
 *
 * En las avanzadas conviven dos cosas que no son lo mismo: el reglamento DEL PARTIDO de hoy (que
 * cambia de un partido a otro y se elige mirando las opciones juntas) y como te gusta a VOS usar
 * la app (que se pone una vez y no se toca mas). Escribir "CONFIGURACION DE LA APP" arriba de las
 * segundas seria explicar con palabras algo que el ojo entiende solo si se lo mostras: el
 * reglamento son botones, y lo de la app es un selector. Nadie lee la diferencia — la ve.
 *
 * Y hay una segunda razon, practica: estas opciones tienen que ENTRAR. Botones lado a lado obligan
 * a que las etiquetas sean cortas y a que quepan cuatro idiomas en una fila. En una lista vertical
 * cada opcion tiene el ancho de la pantalla, asi que puede traer su explicacion al lado — y la
 * explicacion deja de ser un renglon suelto abajo, hablando de un boton que esta arriba.
 */
export function Select({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: ReadonlyArray<Option>;
  value: string;
  onChange: (value: string) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  const pick = (o: Option) => {
    tick();
    setOpen(false);
    onChange(o.value);
  };

  return (
    <>
      {/**
       * EL TITULO ARRIBA, IGUAL QUE EN LOS BOTONES. La pantalla tiene un solo ritmo: cada bloque
       * dice de que se trata y debajo pone el control. Que el selector sea otro control no lo
       * autoriza a inventar otra anatomia — lo distinto tiene que ser lo que HACE, no como se
       * apila. Si cada bloque se ordena a su manera, no hay diseño: hay pantallas sueltas.
       */}
      <View style={s.block}>
        <Text style={s.title}>{title}</Text>

        {/* El control se toca ENTERO, de borde a borde: un objetivo del ancho de la pantalla no
            se erra nunca, y no hay ninguna razon para hacer apuntar a nadie a una flechita. */}
        <Pressable
          style={({ pressed: p }) => [s.field, p && pressed]}
          android_ripple={ripple}
          onPress={() => {
            tick();
            setOpen(true);
          }}
        >
          <View style={s.fieldText}>
            <Text style={s.value} numberOfLines={2}>
              {current?.label ?? '—'}
            </Text>

            {/**
             * LA EXPLICACION DE LA QUE ESTA PUESTA, TAMBIEN CON EL SELECTOR CERRADO.
             *
             * Y no es repetir lo que ya dice la hoja: la hoja hay que ABRIRLA. Si la explicacion
             * vive solo ahi adentro, quien pasa por las avanzadas lee "Registro opcional" y se
             * queda sin saber que significa — o peor, cree que sabe. Estas dos opciones cambian
             * lo que hace la app en cada punto del partido: no pueden estar escritas en clave.
             *
             * El idioma no la lleva, y es lo correcto: "Español" no necesita que le expliquen
             * que hace. La explicacion aparece SOLO donde el nombre no alcanza.
             */}
            {current?.desc && <Text style={s.fieldDesc}>{current.desc}</Text>}
          </View>

          <MaterialIcons name="expand-more" size={22} color={c.textDim} />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        {/* El fondo es HERMANO de la hoja, no su padre: si fuera el padre, cualquier toque que
            cayera en un hueco entre opciones burbujearia y cerraria sin querer. Es la misma
            leccion que la hoja de golpes. */}
        <View style={s.bg}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} />

          <View style={s.sheet}>
            <View style={s.head}>
              <Text style={s.headText} numberOfLines={1}>
                {title}
              </Text>
              <Pressable
                style={({ pressed: p }) => [s.close, p && pressed]}
                android_ripple={{ ...ripple, borderless: true }}
                onPress={() => setOpen(false)}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={22} color={c.text} />
              </Pressable>
            </View>

            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  style={({ pressed: p }) => [s.option, on && s.optionOn, p && pressed]}
                  android_ripple={ripple}
                  onPress={() => pick(o)}
                >
                  <View style={s.optionText}>
                    <Text style={[s.optionLabel, on && s.optionLabelOn]}>{o.label}</Text>
                    {/* LA EXPLICACION, ADENTRO DE LA OPCION. No abajo, en un renglon aparte:
                        asi se lee "que es esto" y "que hace" de una sola pasada, y se pueden
                        comparar las dos opciones sin cambiar de modo para averiguarlo. */}
                    {o.desc && <Text style={s.optionDesc}>{o.desc}</Text>}
                  </View>

                  {/* El tilde ocupa su lugar SIEMPRE, este o no: sin esto, la opcion elegida
                      tiene menos ancho de texto que las otras y el renglon salta al elegir. */}
                  <View style={s.checkSlot}>
                    {on && <MaterialIcons name="check" size={20} color={c.text} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  /** El mismo bloque que un grupo de botones: titulo arriba, control abajo, mismo aire. */
  block: { gap: space.sm },
  title: {
    color: c.textFaint,
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    /** Minimo, no fijo: con la letra del sistema en grande, el control crece en vez de cortarse. */
    minHeight: 44,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(c.text, 0.2),
    backgroundColor: c.surfaceAlt,
  },
  fieldText: { flex: 1, gap: 2 },
  /** Lo que esta puesto va encendido: es el dato, no el titulo. */
  value: { color: c.text, fontSize: 14, fontWeight: '700' },
  fieldDesc: { color: c.textFaint, fontSize: 12.5, lineHeight: 17 },

  bg: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000B' },
  sheet: {
    backgroundColor: c.surface,
    padding: space.md,
    paddingBottom: space.xl,
    gap: space.xs,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },

  head: { flexDirection: 'row', alignItems: 'center', height: 44 },
  headText: {
    flex: 1,
    color: c.textFaint,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  /** La elegida se enciende con el mismo relleno que un boton puesto: un solo vocabulario. */
  optionOn: {
    backgroundColor: alpha(c.text, 0.1),
    borderColor: alpha(c.text, 0.35),
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { color: c.textDim, fontSize: 15, fontWeight: '700' },
  optionLabelOn: { color: c.text, fontWeight: '900' },
  optionDesc: { color: c.textFaint, fontSize: 12.5, lineHeight: 17 },

  checkSlot: { width: 20, alignItems: 'center' },
});
