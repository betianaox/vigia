import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Player } from '../engine';
import { alpha, colors, pressed, radius, ripple, space } from './theme';

/**
 * Un campo para nombrar a una persona: se escribe un pedazo del nombre y abajo aparecen los
 * que coinciden.
 *
 * Vive en dos lugares —el formulario de partido nuevo y el filtro del historial— y hasta hoy
 * estaba escrito dos veces, con dos aspectos distintos. Que la misma accion se vea distinta
 * segun la pantalla es lo que hace que una app se sienta hecha de retazos.
 *
 * Lo que NO comparten es si el texto libre vale: en el historial solo se puede elegir de la
 * lista (a un jugador que no existe no se le pueden buscar partidos), pero en el formulario
 * hay que poder escribir un nombre nuevo — es justo donde nacen los jugadores. Por eso el
 * componente presta la caja y el desplegable, y cada pantalla decide las reglas.
 */
export function PlayerField({
  value,
  onChangeText,
  placeholder,
  suggestions,
  onPick,
  chosen,
  onClear,
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  /** Los que coinciden con lo escrito. Las reglas las pone quien lo usa. */
  suggestions: Player[];
  onPick: (p: Player) => void;
  /**
   * Fijado a una persona concreta. Cuando lo esta, el campo deja de ser un campo: es su
   * nombre. Solo lo usa el historial — el formulario acepta cualquier nombre escrito.
   */
  chosen?: Player | null;
  onClear: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const locked = Boolean(chosen);

  return (
    <View style={s.root}>
      <View style={[s.box, locked && s.boxOn, !locked && !value && s.boxEmpty]}>
        <MaterialIcons
          name={locked ? 'person' : 'search'}
          size={20}
          color={locked ? colors.text : colors.textFaint}
        />

        {chosen ? (
          <Text style={s.chosen} numberOfLines={1}>
            {chosen.name}
          </Text>
        ) : (
          <TextInput
            style={s.input}
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
          />
        )}

        {(locked || value.length > 0) && (
          <Pressable onPress={onClear} hitSlop={10}>
            <MaterialIcons name="close" size={18} color={colors.textDim} />
          </Pressable>
        )}
      </View>

      {/* Debajo del campo, no encima: no tapa lo que estas mirando. */}
      {suggestions.length > 0 && (
        <View style={s.hits}>
          {suggestions.map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed: pr }) => [s.hit, pr && pressed]}
              android_ripple={ripple}
              onPress={() => onPick(p)}
            >
              <MaterialIcons name="person" size={18} color={colors.textDim} />
              <Text style={s.hitText} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  /**
   * SIN `flex`. El componente no sabe —ni tiene por que saber— si lo van a poner en una fila o
   * en una columna: `flex: 1` significa "ocupa el ancho que sobra" en una y "ocupa el alto que
   * sobra" en la otra, y de la segunda salio una caja aplastada con los filtros encima. Como
   * se acomoda lo decide quien lo usa.
   */
  root: { gap: space.xs },

  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  /** Vacio: mas apagado y con el borde apenas insinuado. Se ve que falta llenarlo. */
  boxEmpty: { backgroundColor: 'transparent', borderColor: alpha(colors.text, 0.12) },
  /** Fijado: se enciende. De un vistazo se ve que hay un filtro puesto. */
  boxOn: { borderColor: alpha(colors.text, 0.5), backgroundColor: alpha(colors.text, 0.1) },

  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    padding: 0,
    includeFontPadding: false,
  },
  chosen: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '900' },

  hits: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
  },
  hitText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
});
