import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { L } from '../i18n';
import { useColors } from './theme-context';
import { alpha, colors, pressed, radius, ripple, space, type Colors } from './theme';

/**
 * El dialogo de confirmacion de la app.
 *
 * Reemplaza al `Alert` nativo de Android, que es blanco y no se parece en nada a esto: en una
 * app oscura, un rectangulo blanco que aparece de golpe se siente como si lo hubiera abierto
 * OTRA aplicacion. La confianza en una herramienta se construye tambien con eso.
 *
 * Nunca cierra por accidente: el fondo NO cierra. Un dialogo de confirmacion pregunta algo, y
 * un toque perdido no es una respuesta.
 */
export function Confirm({
  visible,
  title,
  message,
  cancelLabel = L.players.cancel,
  confirmLabel,
  secondaryLabel,
  destructive,
  single,
  onCancel,
  onConfirm,
  onSecondary,
}: {
  visible: boolean;
  title: string;
  /**
   * Opcional, y casi siempre de mas. Si hay que explicar lo que hace un boton, el boton esta
   * mal escrito — nadie lee el parrafo. Los botones dicen lo que hacen.
   */
  message?: string;
  cancelLabel?: string;
  confirmLabel: string;
  /** Una segunda accion, cuando la pregunta tiene DOS respuestas validas (guardar o terminar). */
  secondaryLabel?: string;
  /** Pinta la accion en rojo. Solo para lo que no se puede deshacer. */
  destructive?: boolean;
  /**
   * UN AVISO NO ES UNA PREGUNTA. Cuando el dialogo solo informa algo que YA paso —"se agregaron
   * 52 partidos"— no hay nada que cancelar, y ofrecer "Cancelar" al lado invita a pensar que
   * todavia se puede deshacer. Queda un solo boton.
   */
  single?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onSecondary?: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const twoWays = Boolean(secondaryLabel && onSecondary);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.bg}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          {message ? <Text style={s.message}>{message}</Text> : null}

          <View style={s.actions}>
            {/* Con dos respuestas validas, las dos van arriba y con el mismo peso: no hay una
                "correcta". Cancelar baja a un renglon aparte — no es una respuesta, es un
                arrepentimiento. */}
            {single ? null : twoWays ? (
              <Pressable
                style={({ pressed: p }) => [s.btn, s.cancel, p && pressed]}
                android_ripple={ripple}
                onPress={onSecondary}
              >
                <Text style={s.cancelText}>{secondaryLabel}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed: p }) => [s.btn, s.cancel, p && pressed]}
                android_ripple={ripple}
                onPress={onCancel}
              >
                <Text style={s.cancelText}>{cancelLabel}</Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed: p }) => [s.btn, destructive ? s.danger : s.ok, p && pressed]}
              android_ripple={ripple}
              onPress={onConfirm}
            >
              <Text style={[s.okText, destructive && s.dangerText]}>{confirmLabel}</Text>
            </Pressable>
          </View>

          {twoWays && (
            <Pressable
              style={({ pressed: p }) => [s.link, p && pressed]}
              android_ripple={ripple}
              onPress={onCancel}
            >
              <Text style={s.linkText}>{cancelLabel}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#000C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(c.text, 0.14),
    backgroundColor: c.surface,
  },
  title: { color: c.text, fontSize: 18, fontWeight: '900' },
  message: { color: c.textDim, fontSize: 14, lineHeight: 20 },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  btn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  cancel: { borderWidth: 1, borderColor: alpha(c.text, 0.2), backgroundColor: c.surfaceAlt },
  cancelText: { color: c.textDim, fontSize: 15, fontWeight: '800' },

  ok: { backgroundColor: c.cta },
  /**
   * BLANCO FIJO, no `c.text`: va sobre el verde del boton, que es el mismo color en los dos
   * temas. Siguiendo al tema, en el claro se volvia azul oscuro sobre verde — la misma trampa
   * que ya estaba resuelta en el inicio, el saludo y el formulario, y que aca se habia colado.
   */
  okText: { color: colors.text, fontSize: 15, fontWeight: '900' },

  danger: { backgroundColor: alpha(c.errorUnforced, 0.2), borderWidth: 1, borderColor: c.errorUnforced },
  dangerText: { color: c.errorUnforced },

  /** Cancelar no es una respuesta: es un arrepentimiento. No compite con las dos que si lo son. */
  link: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  linkText: { color: c.textFaint, fontSize: 14, fontWeight: '700' },
});
