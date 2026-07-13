import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, space } from './theme';

/**
 * La marca. UN solo lugar en toda la app.
 *
 * El logo va en el inicio, en las estadisticas y —sobre todo— en la tarjeta que se comparte,
 * que segun el plan es "la pantalla mas importante de la app": cada partido compartido es la
 * marca frente a ocho personas que juegan padel. Por eso no se dibuja a mano en cada pantalla.
 */
const LOGO = require('../../assets/logo.png');

/** 1596 x 293 px. De aca sale el ancho: nadie tiene que acordarse del numero. */
const RATIO = 1596 / 293;

export function Brand({
  size = 34,
  subtitle,
  subject,
  tint,
}: {
  /** Alto del logo. El ancho sale de la proporcion real del archivo. */
  size?: number;
  /** Que estas haciendo: "Partido nuevo", "Historial". Va al lado, no debajo. */
  subtitle?: string;
  /**
   * El subtitulo NO es una etiqueta: es EL SUJETO de la pantalla. Un nombre propio.
   *
   * "HISTORIAL" es una etiqueta y se escribe como tal: chiquita, en mayusculas, espaciada,
   * apagada. Pero "Ana Ruiz" no es una etiqueta — es de quien habla toda la pantalla. Y un
   * nombre en mayusculas espaciadas no se lee como un nombre, se lee como un rotulo.
   *
   * Asi que crece, se enciende, y se escribe como se escribe un nombre.
   */
  subject?: boolean;
  /**
   * El logo es de UN SOLO COLOR PLANO, asi que se puede tenir por codigo. Un unico PNG sirve
   * para cualquier fondo: blanco sobre la cancha oscura, el azul de marca sobre un fondo
   * claro, lo que haga falta en la tarjeta compartible. Sin `tint`, va con su color original.
   */
  tint?: string;
}) {
  return (
    <View style={s.row}>
      <Image
        source={LOGO}
        style={[{ height: size, width: Math.round(size * RATIO) }, tint ? { tintColor: tint } : null]}
        resizeMode="contain"
      />

      {/* El subtitulo cede si el logo crece: la marca manda, y el subtitulo se achica o se
          corta antes que empujar el logo fuera de la pantalla. */}
      {subtitle ? (
        <Text
          style={[
            s.subtitle,
            subject && s.subject,
            { fontSize: Math.round(size * (subject ? 0.72 : 0.3)) },
          ]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  /** El subtitulo apoya en la base del logo, no en su centro: los dos se leen sobre una linea. */
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  subtitle: {
    flexShrink: 1,
    color: colors.textFaint,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    /** El PNG deja aire abajo (la cola del halcon baja mas que la palabra): se compensa. */
    marginBottom: 2,
    includeFontPadding: false,
  },
  /** Un nombre propio se escribe como se escribe. Ni mayusculas, ni espaciado, ni apagado. */
  subject: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'none',
  },
});
