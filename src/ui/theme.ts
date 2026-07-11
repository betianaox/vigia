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

  /** El sacador. Ambar = "ojo aca", es lo que la app tiene que gritar siempre. */
  serve: '#FBBF24',
  golden: '#F59E0B',

  winner: '#34D399',
  errorForced: '#FB923C',
  errorUnforced: '#F87171',
} as const;

export const teamColor = (team: 'A' | 'B'): string =>
  team === 'A' ? colors.teamA : colors.teamB;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
