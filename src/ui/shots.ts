import type { Shot } from '../engine';

/** Los nombres de los golpes no se traducen en ningun idioma: van en castellano siempre. */
export const SHOT_LABELS: Record<Shot, string> = {
  remate: 'Remate',
  remate_por_3: 'Remate por 3',
  remate_por_4: 'Remate por 4',
  bandeja: 'Bandeja',
  vibora: 'Víbora',
  volea_drive: 'Volea de drive',
  volea_reves: 'Volea de revés',
  bajada_de_pared: 'Bajada de pared',
  globo: 'Globo',
  derecha: 'Derecha',
  reves: 'Revés',
  chiquita: 'Chiquita',
  resto: 'Resto',
};

export const SHOTS = Object.keys(SHOT_LABELS) as Shot[];
