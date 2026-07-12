import type { Stroke, Variant } from '../engine';

/**
 * Los nombres de los golpes no se traducen en ningun idioma: van en castellano siempre.
 * En ingles tambien les dicen bandeja, vibora y chiquita.
 *
 * Y por eso mismo esta tabla existe: el LABEL esta separado de la CLAVE. Renombrar un golpe
 * es cambiar un texto de aca — no toca datos, ni eventos, ni estadisticas, ni partidos ya
 * cargados. Es lo que hace barato reevaluar la jerga con una entrenadora despues del primer
 * test de verdad.
 */
export const STROKE_LABELS: Record<Stroke, string> = {
  recuperacion: 'Recuperación',
  fondo: 'Fondo',
  salida_de_pared: 'Salida de pared',
  globo: 'Globo',
  chiquita: 'Chiquita',
  dejada: 'Dejada',
  volea: 'Volea',
  bandeja: 'Bandeja',
  remate: 'Remate',
};

export const VARIANT_LABELS: Record<Variant, string> = {
  vibora: 'Víbora',
  gancho: 'Gancho',
  x3: 'x3',
  x4: 'x4',
  traerla: 'Traerla',
};

/**
 * Los golpes que se juegan de drive o de reves. En la hoja se dibujan como una matriz de dos
 * columnas, asi un solo tap elige golpe y lado a la vez — el lado no es un paso, es una
 * columna.
 *
 * El orden no es decorativo: la lista va de ATRAS HACIA ADELANTE. Arriba lo que se juega
 * desde el fondo; abajo, lo que se juega en la red. Por eso la volea va ultima: queda pegada
 * a la bandeja y al remate, que tambien son golpes de red, y la transicion es continua.
 *
 * De ahi que no haga falta ningun encabezado que diga "de arriba" ni "en la red": el gradiente
 * ya lo dice, y un titulo que anuncia algo que se ve es ruido. La clasificacion aerea queda
 * igual disponible en el codigo (son los unicos golpes sin lado) por si las estadisticas la
 * necesitan.
 */
export const STROKES_CON_LADO: Stroke[] = [
  'fondo',
  'salida_de_pared',
  'globo',
  'chiquita',
  'dejada',
  'recuperacion',
  'volea',
];

/**
 * Los golpes sin lado (no existe una bandeja de reves), y cada uno con sus variantes.
 *
 * Van al final de la hoja, sin ningun titulo que los agrupe: son golpes de red, y la lista
 * ya viene bajando desde el fondo hacia la red. Se distinguen solos porque no tienen las dos
 * columnas de lado.
 *
 * Las variantes van DESPLEGADAS al lado de su golpe base, nunca en un submenu: si marcar una
 * vibora costara dos toques, el que sabe dejaria de usarlas. Y el boton base es el golpe
 * mismo — se toca "Remate" y es un remate. No hay ningun boton que se llame "normal", que no
 * significa nada.
 */
export const STROKES_POR_ALTO: Array<{ stroke: Stroke; variants: Variant[] }> = [
  { stroke: 'bandeja', variants: ['vibora', 'gancho'] },
  { stroke: 'remate', variants: ['x3', 'x4', 'traerla'] },
];
