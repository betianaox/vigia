import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useColors } from './theme-context';
import { space, type Colors } from './theme';

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
  /**
   * 26, que es el tamaño con el que la marca aparece en casi toda la app: ayuda, historial,
   * jugadores, estadisticas y trayectoria lo piden explicito.
   *
   * Era 34, y ese numero no lo usaba nadie mas que el formulario —la unica pantalla que no pasa
   * un tamaño— asi que ahi la marca salia un tercio mas grande que en cualquier otro lado, sin
   * que nadie lo hubiera decidido: lo heredaba del default. Es el mismo bug que ya habia pasado
   * con el subtitulo, que sacaba su tamaño de una proporcion del logo (ver mas abajo). Un valor
   * por defecto que no coincide con lo que la app realmente usa siempre termina saliendo por
   * algun lado.
   */
  size = 26,
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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={s.row}>
      <Image
        source={LOGO}
        style={[{ height: size, width: Math.round(size * RATIO) }, tint ? { tintColor: tint } : null]}
        resizeMode="contain"
      />

      {/**
       * EL SUBTITULO YA NO SE MIDE CONTRA EL LOGO, Y ESE ERA EL BUG.
       *
       * Salia de una proporcion del alto del logo (30%), asi que en las pantallas que lo piden
       * chico —jugadores, historial, estadisticas, todas con un logo de 26— el subtitulo terminaba
       * en 7,8 px. No es que estuviera chico: es que nunca nadie eligio ese tamaño, lo heredaba.
       *
       * Ahora tiene el suyo, y es el mismo en todas: es el nombre de la pantalla en la que estas,
       * y no hay razon para que diga lo mismo mas fuerte en una que en otra. Sigue cediendo antes
       * que el logo (`flexShrink`), que es lo correcto: la marca manda.
       *
       * EL SUJETO ES OTRA COSA. Cuando el subtitulo es el nombre de una persona ("Ana Ruiz") no es
       * una etiqueta sino de quien habla la pantalla entera, y ahi si crece con el logo.
       */}
      {subtitle ? (
        <Text
          style={[
            s.subtitle,
            subject && s.subject,
            subject && { fontSize: Math.round(size * 0.55) },
          ]}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  /** El subtitulo apoya en la base del logo, no en su centro: los dos se leen sobre una linea. */
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  subtitle: {
    flexShrink: 1,
    color: c.textFaint,
    fontSize: 11,
    fontWeight: '800',
    /**
     * El espaciado bajo de 1.5 a 1.2 para pagar la letra mas grande: en mayusculas y con el logo al
     * lado, cada punto de espaciado cuesta casi tanto ancho como un punto de fuente, y el subtitulo
     * mas largo ("PARTIDO EN CURSO") comparte renglon con la marca.
     */
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    /** El PNG deja aire abajo (la cola del halcon baja mas que la palabra): se compensa. */
    marginBottom: 2,
    includeFontPadding: false,
  },
  /** Un nombre propio se escribe como se escribe. Ni mayusculas, ni espaciado, ni apagado. */
  subject: {
    color: c.text,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'none',
  },
});
