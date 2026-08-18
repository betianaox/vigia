/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LOS DOS TEMAS
 * ─────────────────────────────────────────────────────────────────────────────
 * El OSCURO es el original y no se toca: es el que se probó gris por gris contra una cancha de
 * noche, y el default de la app.
 *
 * El CLARO arranca como una COPIA del oscuro, con los fondos y los textos dados vuelta y nada
 * más. No es pereza: es el método. Cambiando solo eso, la app se vuelve clara de golpe y lo que
 * queda mal se ve solo — un violeta que sobre negro respiraba y sobre blanco grita, una barra que
 * desaparece. Se corrige lo que falla, mirándolo, en vez de adivinar treinta tonos de una.
 *
 * Los colores de DATOS (los equipos, el semáforo de gráficos, el lima) siguen siendo los del
 * oscuro a propósito, y casi seguro haya que rehacerlos: están validados contra `#141B24` con
 * cuatro criterios —banda de luminosidad, croma, separación para daltonismo y contraste— y esa
 * validación no se hereda al cambiar el fondo.
 */
const dark = {
  bg: '#0A0E13',
  surface: '#141B24',
  surfaceAlt: '#1B2531',
  border: '#28333F',

  text: '#F1F5F9',
  textDim: '#94A3B8',
  textFaint: '#5B6B7C',

  // Los equipos NO usan ningun color de los botones: asi un avatar nunca se confunde
  // con una accion. Verde/amarillo/rojo estan tomados por el semaforo.
  teamA: '#A78BFA',
  teamB: '#FB923C',

  /**
   * Los mismos violeta y naranja, un paso mas oscuro, para RELLENOS de barra sobre
   * fondo oscuro. Los de arriba sirven como texto/avatar pero quedan fuera de la banda
   * de luminosidad para marcas de grafico. Estos pasan las cuatro validaciones
   * (banda, croma, separacion CVD ΔE 118, contraste) contra la superficie #141B24.
   * La identidad del equipo se mantiene: es el mismo tono, otro paso del ramp.
   */
  teamAFill: '#8250DF',
  teamBFill: '#DB6D28',

  /** El sacador: blanco. No compite con ninguna accion. */
  serve: '#FFFFFF',
  golden: '#F59E0B',

  /**
   * La copita del ganador. NO usa `golden`: ese ambar esta a un paso del naranja del equipo
   * B (#FB923C) y en una pantalla chica se confunden — la copita parecia parte del color del
   * equipo. Este amarillo tiene carga verde, asi que no choca con ningun equipo ni con el
   * dorado del punto de oro.
   */
  trophy: '#EFDA3E',

  /** La pelotita del tanteador: amarillo limon, como una pelota de padel. */
  ball: '#D9F92F',
  /**
   * El lima PARA GRAFICOS. El de arriba es una pastilla de 8px al lado de un nombre; en una
   * barra grande y llena es neon, y una columna entera de eso cansa la vista. Misma identidad,
   * medio tono de voz — el mismo criterio que el semaforo (ver mas abajo).
   */
  ballChart: '#A8C43A',

  /**
   * El boton que arranca el partido. Verde sobrio, NO el lima de la pelotita: ese amarillo
   * es el vocabulario del saque y no puede significar dos cosas. Tampoco el verde del
   * semaforo (`winner`), que ya quiere decir otra cosa en la cancha.
   */
  cta: '#2F9E6B',

  /**
   * El semaforo de LOS BOTONES, desde la perspectiva del jugador de la tarjeta.
   *
   * Son botones: tienen que gritar desde el otro lado de la cancha, con el sol de frente. Por
   * eso van saturados. NO SE USAN EN LOS GRAFICOS — para eso estan los tres de abajo.
   */
  winner: '#22C55E',
  errorForced: '#FACC15',
  errorUnforced: '#F43F5E',

  /**
   * Los mismos tres, PARA GRAFICOS: mismo tono, menos saturacion.
   *
   * Una barra que grita como un boton convierte la pantalla en un arbolito de navidad, y con
   * treinta barras a la vez cansa la vista en diez segundos. Los botones gritan; los graficos
   * hablan. El significado es identico —verde winner, amarillo forzado, rojo no forzado—, lo
   * unico que baja es el tono de voz.
   *
   * No se resuelve con transparencia: el alfa sobre fondo oscuro los ensucia y les baja el
   * contraste. Quedan turbios, no calmos. Son colores propios.
   */
  winnerChart: '#3E9D68',
  errorForcedChart: '#C2A230',
  errorUnforcedChart: '#C05770',

  /** El celeste del ACE, tambien en su version de grafico. Mismo criterio que los tres de arriba. */
  aceChart: '#4E9AC0',

  /**
   * LOS PUNTOS GANADOS FORZANDO EL ERROR DEL OTRO. Azul, y NO amarillo.
   *
   * El amarillo seria lo intuitivo —es el color del error forzado en toda la app— pero diria
   * justo lo contrario de lo que este numero cuenta. En la cancha, amarillo es un ERROR: lo que
   * le pasa a quien lo comete. Aca el dato es del otro lado del duelo, es lo que alguien HIZO, y
   * pintarlo del color de un error lo convierte en una mancha mas en una fila que ya tiene rojo.
   * El rojo si es universal para "error" y no se puede reasignar; el amarillo, en cambio, es
   * vocabulario nuestro, y no aguanta significar las dos puntas de la misma jugada.
   *
   * El azul esta libre y ademas es el unico que sirve: es el tercer color que distingue todo el
   * mundo cuando los otros dos son verde y rojo, que es exactamente el par que no separa ~1 de
   * cada 12 varones. Contrasta 4.37 contra el fondo oscuro y 3.91 contra el claro —los dos por
   * encima del 3:1 que pide una cifra en negrita— asi que va un solo valor para los dos temas,
   * igual que el resto de los colores de grafico.
   *
   * Hue 223: a 25 grados del celeste del ace (198) y a 35 del violeta del equipo A (258). Cerca
   * del celeste, pero el ace no se dibuja nunca en la misma tabla que esto.
   */
  causedChart: '#4A73D9',

  /**
   * La fila del grafico donde tener MAS es ir PEOR (los errores). Es la unica que se sale del
   * violeta y el naranja, y ese cambio de color es justamente el aviso de que cambio la regla.
   *
   * Bordo, NO el rojo de `errorUnforced`. Ese rojo es un BOTON: si aparece en un grafico, el
   * ojo lo lee como "hay algo para tocar". El color tiene que decir categoria, no accion.
   *
   * Y NO hay verde del otro lado: rojo contra verde es el par que no distingue ~1 de cada 12
   * varones, y aca el verde no aportaba nada — en esa fila el segmento mas largo ES siempre el
   * del que erro mas, asi que el largo y el numero ya lo dicen dos veces. Va gris: se pierde
   * cero informacion y se gana que lo lea todo el mundo.
   */
  worse: '#8F3A4B',
  neutralFill: '#4E5C6B',

  // Saque: tres botones del mismo tamano, distinto color.
  falta: '#E2E8F0',
  ace: '#38BDF8',
  let: '#7C8AA0',

  onLight: '#0A0E13',
} as const;

/** La forma que los dos temas tienen que cumplir. Falta un color: no compila. */
export type Colors = { [K in keyof typeof dark]: string };

/**
 * EL CLARO. Por ahora, el oscuro con los fondos y los textos dados vuelta.
 *
 * El fondo NO es blanco puro: un blanco a pantalla completa en una app que se mira muchas veces
 * seguidas durante un partido cansa la vista, que es exactamente la razón por la que el oscuro
 * tampoco es negro puro. Es un gris muy claro, y las superficies —las tarjetas— van en blanco,
 * así se despegan del fondo sin necesidad de un borde más fuerte.
 */
const light: Colors = {
  ...dark,

  bg: '#EEF1F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F7FA',
  border: '#D3DBE4',

  text: '#0F172A',
  textDim: '#4A5A6B',
  textFaint: '#7C8B9C',

  /** El texto que va ENCIMA de un color claro sigue siendo oscuro: no se da vuelta. */
  onLight: '#0A0E13',

  /**
   * EL LIMA, OSCURECIDO. El de la marca (#D9F92F) tiene 1.06 de contraste contra este fondo:
   * no es que se lea poco, es que no se ve. Sobre el negro de la cancha brilla; sobre casi
   * blanco desaparece.
   *
   * Se probaron dos pasos. El que pasa 4.5:1 —el umbral del TEXTO chico— se iba a verde militar
   * y perdia la identidad de la marca. Este cumple 3.50 contra el fondo, que es el umbral que
   * corresponde de verdad a lo que se pinta con el: el logo, los iconos, las pastillas. Ninguno
   * es texto de doce puntos.
   *
   * El tono se mantiene —hue 66 contra los 70 del original—, asi que sigue leyendose como el
   * mismo lima, un paso mas grave y apenas mas amarillo: al oscurecer un verde-amarillo, el ojo
   * lo empieza a leer como oliva, y correrlo unos grados hacia el amarillo lo devuelve a la
   * familia del original sin tocar el brillo.
   *
   * En el INICIO no hace falta: alli el lima va sobre la foto de la cancha, que es oscura en los
   * dos temas, y por eso ese logo no se tiñe con el color del tema.
   */
  ball: '#7D8A0A',
  /**
   * El lima de GRAFICOS. Sigue la misma regla que en el oscuro —grita menos que el otro— pero al
   * reves: aca gritar menos es acercarse al fondo, no alejarse. Queda en 3.03, que es lo que
   * necesita una barra grande, donde el area ya hace la mitad del trabajo.
   */
  ballChart: '#8A9C14',

  /**
   * LOS EQUIPOS, UN PASO MAS OSCUROS. Sobre el fondo claro, el violeta y el naranja originales
   * quedaban en 2.40 y 2.00 — por debajo del minimo de 3:1 incluso para un grafico. Y no son un
   * grafico: encabezan media pantalla del formulario, en texto.
   *
   * Quedan en 3.74 y 3.42: por encima del 3:1 de los elementos graficos, por debajo del 4.5 del
   * texto chico. Se probo el paso siguiente —5.03 y 4.06— y era mas legible pero apagaba la
   * marca: el naranja empezaba a irse a marron. Se eligio a ojo sobre el telefono, que es donde
   * se mira, y estos nombres van en mayusculas y en negrita, que es la parte del texto que menos
   * depende del contraste puro.
   *
   * El TONO se mantiene en los dos —violeta 262 contra 255, naranja 24 contra 27—, y eso es lo
   * que importa para que sigan siendo la misma pareja: lo que los separa entre si, tambien para
   * quien no distingue rojo de verde, es el tono, no el brillo.
   */
  teamA: '#8B5CF6',
  teamB: '#D2600A',

  /**
   * EL SACADOR: NEGRO, NO BLANCO. En la cancha, al que saca se lo marca con un borde de este
   * color. Sobre el fondo oscuro el blanco lo recortaba; sobre una tarjeta blanca, un borde
   * blanco es invisible — el que saca dejaba de distinguirse justo en la pantalla donde mas
   * importa.
   *
   * Sigue valiendo la regla original: no compite con ninguna accion, porque no es ninguno de los
   * colores del semaforo ni del boton verde. Solo cambia de extremo.
   */
  serve: '#0F172A',

  /**
   * EL SEMAFORO, UN PASO MAS OSCURO. Son los botones de la cancha, y en el tema claro van sobre
   * una tarjeta blanca en vez del fondo negro.
   *
   * El amarillo es el unico que no se puede arreglar del todo: sobre blanco arranca en 1.53 y
   * ni oscureciendolo bastante pasa de ~2.9, porque un amarillo luminoso contra blanco tiene ese
   * techo. Bajarlo hasta que cumpla lo convierte en mostaza y deja de leerse como el amarillo del
   * error forzado. Se baja lo que se puede sin perder el color, y el resto del trabajo lo hace la
   * pastilla de fondo, que le da un contorno propio.
   */
  winner: '#16A34A',
  errorForced: '#D4A106',
  errorUnforced: '#E62E52',

  /**
   * EL CELESTE DEL ACE. Sobre la tarjeta blanca de la cancha arrancaba en 2.14 — el mismo
   * problema que el resto de los colores pensados contra el negro. Llega a 3.19, que es el
   * umbral de lo que se dibuja con el: una pastilla con su etiqueta, no texto corrido.
   *
   * Sigue siendo el celeste del saque y no se acerca a ningun otro color de la cancha: el
   * semaforo es verde-amarillo-rojo y el sacador ahora es negro.
   */
  ace: '#0E9AD4',
};

export const themes = { oscuro: dark, claro: light } as const;

/** Cuál de los dos. Vive en las preferencias, y el default es el oscuro. */
export type ThemeName = keyof typeof themes;

/**
 * El tema por defecto, y el que usan los pocos lugares que NO pueden pedirlo por contexto —el
 * `ripple`, que es una constante de módulo, y la tarjeta compartible, que se dibuja siempre
 * oscura porque se manda a WhatsApp y ahí no hay tema.
 */
export const colors = dark;

/**
 * El color del equipo. El tema va SEGUNDO y con default a proposito: asi las pantallas todavia
 * sin migrar siguen compilando —con el oscuro, que es el default de la app— y la migracion puede
 * ir de a una. Cuando no quede ninguna sin migrar, el parametro deja de tener default.
 */
/**
 * EL QUE VA PERDIENDO SE APAGA — pero apagar no quiere decir lo mismo en los dos temas.
 *
 * Estaba escrito como `opacity: 0.45` en tres lugares: el tanteador, el historial y la barra de
 * comparacion. Sobre el fondo negro, bajar la opacidad OSCURECE, y el color se sigue recortando
 * contra el fondo. Sobre el fondo claro hace exactamente lo contrario: ACLARA, o sea empuja el
 * color hacia el mismo blanco de atras, y el numero del que va perdiendo casi desaparece.
 *
 * Es la misma regla dando resultados opuestos, asi que la regla no puede ser un numero fijo. En
 * claro se apaga menos, lo justo para que se lea que es secundario sin que se borre.
 */
export const dimmed = (c: Colors) => ({ opacity: c === light ? 0.68 : 0.45 });

export const teamColor = (team: 'A' | 'B', c: Colors = dark): string =>
  team === 'A' ? c.teamA : c.teamB;

/** Relleno translucido sobre fondo oscuro: el color se lee sin gritar. */
export const alpha = (hex: string, a: number): string =>
  hex + Math.round(a * 255).toString(16).padStart(2, '0');

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/**
 * El acuse de recibo del toque. Va en TODOS los botones de la app, sin excepcion.
 *
 * El caso que lo hace obvio es el LET: registra el evento y en pantalla no cambia nada —el
 * tanteo no se mueve, porque un let es "no paso nada, saca de nuevo"—. Sin feedback no hay
 * forma de saber si el toque entro, y en una cancha eso termina en tocarlo dos veces.
 *
 * Son DOS cosas, y las dos hacen falta:
 *
 * - El hundimiento (`pressed`) se ve siempre, incluso con el dedo encima tapando el boton.
 *   Pero solo, es sutil.
 * - El ripple se dibuja ENCIMA del boton (`foreground: true`), asi que se ve sobre
 *   cualquier color. Es lo que resuelve el caso del LET: bajarle la opacidad a un boton que
 *   ya es el mas apagado de la pantalla no se nota — pintarle algo encima, si.
 *
 * El color del ripple es un gris medio a proposito: sobre el blanco solido de FALTA oscurece,
 * sobre el gris de LET aclara. Se ve en los dos.
 */
export const pressed = { transform: [{ scale: 0.95 }] } as const;

export const ripple = { color: alpha(colors.textDim, 0.4), foreground: true } as const;
