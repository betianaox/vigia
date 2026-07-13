export const colors = {
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

export const teamColor = (team: 'A' | 'B'): string =>
  team === 'A' ? colors.teamA : colors.teamB;

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
