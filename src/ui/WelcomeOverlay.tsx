import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { L } from '../i18n';
import { HELP_ICON } from './HelpScreen';
import { useColors } from './theme-context';
import { alpha, colors, pressed, radius, ripple, space, type Colors } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/** La pelota. Cuadrada, asi que el alto y el ancho son el mismo numero. */
const BALL = require('../../assets/ball.webp');

/**
 * EL SALUDO DE LA PRIMERA VEZ. Chico, encima del inicio, y se va.
 *
 * LA PRIMERA IMPRESION TIENE QUE SER LA APP. Antes esto era la pantalla de ayuda entera abriendose
 * sola: seis pasos, los ajustes y un boton de Empezar. Aunque estuviera bien escrita, le ponia un
 * manual adelante a alguien que todavia no vio la cancha ni el boton verde — y un manual que
 * aparece antes de que exista la pregunta se saltea sin leer.
 *
 * Asi que la primera vez solo se dice UNA cosa: donde esta la ayuda el dia que haga falta. El
 * boton lleva el MISMO icono que el del inicio, para que reconocerlo despues no dependa de haber
 * leido el nombre: se lo presenta, no se lo cuenta.
 *
 * Se muestra UNA sola vez (`seenWelcome` en las preferencias) y las dos salidas la dan por vista:
 * la que entra a la ayuda y la que se va directo a la app.
 */
export function WelcomeOverlay({
  visible,
  onHelp,
  onClose,
}: {
  visible: boolean;
  /** Cerrar y abrir la ayuda. */
  onHelp: () => void;
  /** Cerrar y quedarse donde estaba. */
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      /* El back de Android cierra, como cualquier dialogo. Sin esto, el unico camino seria tocar
         un boton, y un dialogo del que no se puede salir con el back se siente trabado. */
      onRequestClose={onClose}
    >
      {/* El velo NO cierra al tocarse. Son dos botones y ninguno es peligroso: si el toque de
          afuera cerrara, alguien que quiso apretar "Ayuda" y erro por dos milimetros perderia el
          unico aviso de donde esta la ayuda — y no vuelve a aparecer nunca. */}
      <View style={s.veil}>
        <View style={s.card}>
          {/* La pelota, sin circulo de fondo detras: ya ES un circulo, y meterla dentro de otro
              solo dibujaba un anillo alrededor. */}
          <Image source={BALL} style={s.ball} resizeMode="contain" />

          <Text style={s.title}>{L.welcome.title}</Text>
          <Text style={s.text}>{L.welcome.text}</Text>

          <View style={s.actions}>
            <Pressable
              style={({ pressed: pr }) => [s.ghost, pr && pressed]}
              android_ripple={ripple}
              onPress={() => {
                tick();
                onClose();
              }}
            >
              <Text style={s.ghostText}>{L.welcome.close}</Text>
            </Pressable>

            <Pressable
              style={({ pressed: pr }) => [s.primary, pr && pressed]}
              android_ripple={ripple}
              onPress={() => {
                tick();
                onHelp();
              }}
            >
              {/* Blanco fijo, no `c.text`: va sobre el verde del boton, que es el mismo en los
                  dos temas. Siguiendo al tema, en el claro seria texto oscuro sobre verde. */}
              <MaterialIcons name={HELP_ICON} size={20} color={colors.text} />
              <Text style={s.primaryText}>{L.welcome.help}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  veil: {
    flex: 1,
    backgroundColor: alpha('#000000', 0.72),
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },

  /**
   * CHICA. `maxWidth` para que en una tablet no se estire a lo ancho de la pantalla: un dialogo de
   * cuatro renglones ocupando 800 px de ancho deja de ser un dialogo y parece una pantalla.
   */
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
  },

  /** Esta pelota ya viene con su volumen y su luz: derecha, sin girar. */
  ball: { width: 38, height: 38, marginBottom: space.xs },

  title: { color: c.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  text: {
    color: c.textDim,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },

  /**
   * Los dos botones a lo ancho, con el de Ayuda a la derecha y con peso: es el que lleva a algun
   * lado. `flexWrap` para que con la letra del sistema en grande caigan uno debajo del otro en vez
   * de apretarse hasta cortar las palabras.
   */
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
    alignSelf: 'stretch',
  },

  ghost: {
    flex: 1,
    minWidth: 120,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  ghostText: { color: c.textDim, fontSize: 15, fontWeight: '800' },

  primary: {
    flex: 1,
    minWidth: 120,
    height: 48,
    flexDirection: 'row',
    gap: space.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.cta,
  },
  /** Blanco fijo por lo mismo que el icono de al lado: el fondo verde no cambia con el tema. */
  primaryText: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
