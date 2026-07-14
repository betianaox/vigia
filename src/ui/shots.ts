import type { Side, Stroke, Variant } from '../engine';

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

/**
 * EL LADO DEL GOLPE NO ES EL LADO DEL JUGADOR, y hasta hoy los dos decian "D".
 *
 * "Drive" en esta app habla de la PERSONA: de que lado de la cancha juega (la marca de agua D/R
 * de cada tarjeta). El lado del GOLPE es otra cosa: con que mano-cara le pego a esta pelota. Con
 * la misma letra para las dos, un "D" queria decir dos cosas distintas en la misma pantalla.
 *
 * Y de paso: en España a la derecha le dicen DERECHA. "Drive" es jerga nuestra. Si la app va a
 * cruzar el charco, el golpe se llama como se llama alla — que ademas es como se llama en todos
 * lados menos aca.
 *
 * La CLAVE sigue siendo `drive`: no se migra ni un partido. Cambia el cartel, no el dato.
 */
export const SIDE_LABELS: Record<Side, string> = {
  drive: 'Derecha',
  reves: 'Revés',
};

export const VARIANT_LABELS: Record<Variant, string> = {
  vibora: 'Víbora',
  gancho: 'Gancho',
  x3: 'x3',
  x4: 'x4',
  traerla: 'Traerla',
};

/**
 * Los golpes que se juegan de derecha o de reves. En la hoja son un teclado: el nombre una vez,
 * y dos teclas al lado.
 *
 * EL ORDEN VA DE LA RED HACIA EL FONDO, y no es decorativo: arriba de la lista estan el remate y
 * la bandeja, que se juegan en la red. La volea sigue: queda pegada a ellos y la transicion es
 * continua. Despues la chiquita, la salida de pared, el fondo, y al final el globo — que es lo
 * que se juega desde mas atras.
 *
 * Iba al reves (fondo arriba, volea abajo) porque los golpes de red vivian ABAJO de la hoja. Al
 * subirlos, la progresion tenia que darse vuelta con ellos: el orden espeja la cancha, y la
 * cancha no cambio — cambio donde la miramos desde.
 *
 * De ahi que no haga falta ningun encabezado que diga "en la red" ni "de fondo": el gradiente ya
 * lo dice, y un titulo que anuncia algo que se ve es ruido.
 */
export const STROKES_CON_LADO: Stroke[] = [
  'volea',
  'chiquita',
  'salida_de_pared',
  'fondo',
  'globo',
];

/**
 * La dejada y la recuperacion: SIN lado, un boton cada una.
 *
 * No es que importen menos —la dejada define puntos, y la recuperacion, como error, es una
 * debilidad defensiva que se lee de una— es que EL LADO no aporta nada en ellas. Una recuperacion
 * es un manotazo: si salio de drive o de reves es casi azar, y no cambia ninguna conclusion.
 *
 * Y el lado es caro: cuesta dos botones por golpe, en una hoja que ahora se abre en CADA punto y
 * hay que poder escanear en un segundo y medio. Se paga donde sirve, no en todos lados.
 */
export const STROKES_SIN_LADO: Stroke[] = ['dejada', 'recuperacion'];

/**
 * Los golpes por alto (no existe una bandeja de reves), y las variantes que sobrevivieron.
 *
 * Van al final de la hoja, sin ningun titulo que los agrupe: son golpes de red, y la lista
 * ya viene bajando desde el fondo hacia la red. Se distinguen solos porque no tienen las dos
 * columnas de lado.
 *
 * Las variantes van DESPLEGADAS al lado de su golpe base, nunca en un submenu: si marcar una
 * vibora costara dos toques, el que sabe dejaria de usarlas. Y el boton base es el golpe
 * mismo — se toca "Remate" y es un remate. No hay ningun boton que se llame "normal", que no
 * significa nada.
 *
 * SE FUERON x3, x4 Y TRAERLA. Eran tres botones —de veinte, en una hoja que ahora se abre en
 * cada punto— para distinguir tres maneras de rematar que el motor suma igual como REMATE. No se
 * rompe ninguna estadistica: se recupera un tercio del renglon.
 *
 * `VARIANT_LABELS` las conserva igual: los partidos ya cargados con un x3 tienen que seguir
 * diciendo "x3" en las estadisticas. Sacar el boton no borra la historia.
 */
export const STROKES_POR_ALTO: Array<{ stroke: Stroke; variants: Variant[] }> = [
  { stroke: 'remate', variants: [] },
  { stroke: 'bandeja', variants: ['vibora', 'gancho'] },
];
