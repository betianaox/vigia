import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, space } from './theme';

/**
 * La marca. UN solo lugar en toda la app.
 *
 * El logo va a ir en el inicio, en las estadisticas y —sobre todo— en la tarjeta que se
 * comparte, que segun el plan es "la pantalla mas importante de la app": cada partido
 * compartido es la marca frente a ocho personas que juegan padel. Por eso no se dibuja el
 * texto "VIGIA" a mano en cada pantalla: se usa esto.
 *
 * TODO: cuando llegue el logo, ponerlo en assets/logo.png y descomentar el require de abajo.
 * No hay que tocar ninguna pantalla — todas usan este componente.
 */
const LOGO: number | null = null;
// const LOGO = require('../../assets/logo.png');

export function Brand({
  size = 26,
  subtitle,
}: {
  /** Alto del logo, o tamano de la fuente del wordmark. */
  size?: number;
  /** Que estas haciendo: "Partido nuevo", "Historial". Va al lado, no debajo. */
  subtitle?: string;
}) {
  return (
    <View style={s.row}>
      {LOGO ? (
        <Image source={LOGO} style={{ height: size, width: size * 4 }} resizeMode="contain" />
      ) : (
        <Text style={[s.wordmark, { fontSize: size }]}>VIGIA</Text>
      )}

      {subtitle ? (
        <Text style={[s.subtitle, { fontSize: Math.round(size * 0.46) }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  wordmark: { color: colors.text, fontWeight: '900', letterSpacing: 4 },
  subtitle: {
    color: colors.textFaint,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
