export const colors = {
  bg: '#0B0F14',
  surface: '#151C24',
  surfaceAlt: '#1E2833',
  border: '#2A3644',

  text: '#F1F5F9',
  textDim: '#94A3B8',
  textFaint: '#5B6B7C',

  teamA: '#34D399',
  teamB: '#60A5FA',

  /**
   * El sacador se marca en BLANCO, no en ambar: el amarillo esta reservado para el
   * semaforo de las acciones y no pueden competir.
   */
  serve: '#FFFFFF',
  golden: '#F59E0B',

  // Semaforo, desde la perspectiva del jugador de la tarjeta:
  // verde = hizo un winner, amarillo = error forzado, rojo = error no forzado.
  winner: '#22C55E',
  errorForced: '#FACC15',
  errorUnforced: '#EF4444',

  /** Texto sobre los botones claros del semaforo. */
  onLight: '#0B0F14',
} as const;

export const teamColor = (team: 'A' | 'B'): string =>
  team === 'A' ? colors.teamA : colors.teamB;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
