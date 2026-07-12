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

  /** La pelotita del tanteador: amarillo limon, como una pelota de padel. */
  ball: '#D9F92F',

  // Semaforo, desde la perspectiva del jugador de la tarjeta.
  winner: '#22C55E',
  errorForced: '#FACC15',
  errorUnforced: '#F43F5E',

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
