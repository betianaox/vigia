import type { Side, Stroke } from '../engine';
import { L } from '../i18n';

/**
 * EL LABEL ESTA SEPARADO DE LA CLAVE, y eso es lo que hace barato equivocarse.
 *
 * Renombrar un golpe —o traducirlo mal— es cambiar un texto del diccionario: no toca datos, ni
 * eventos, ni estadisticas, ni partidos ya cargados. Un partido cargado con un `x3` sigue
 * diciendo x3 aunque el boton ya no exista.
 *
 * Que golpe se traduce y cual no, y por que, esta en `i18n/es.ts`.
 *
 * SON FUNCIONES, NO CONSTANTES, y esa es toda la diferencia entre poder cambiar el idioma en
 * caliente y no poder: una constante copia los strings cuando carga el bundle y se queda con el
 * idioma con el que arranco la app para siempre. Estas leen el diccionario CADA VEZ QUE SE
 * DIBUJA — asi que cambia el idioma y cambian ellas (ver la regla en `i18n/index.ts`).
 */
export const strokeLabels = (): Record<Stroke, string> => L.shots;

/**
 * EL LADO DEL GOLPE NO ES EL LADO DEL JUGADOR, y hasta hace poco los dos decian "D".
 *
 * "Drive" en esta app habla de la PERSONA: de que lado de la cancha juega (la marca de agua D/R
 * de cada tarjeta). El lado del GOLPE es otra cosa: con que mano-cara le pego a esta pelota. Con
 * la misma letra para las dos, un "D" queria decir dos cosas distintas en la misma pantalla.
 *
 * Y de paso: en España a la derecha le dicen DERECHA. "Drive" es jerga nuestra.
 *
 * La CLAVE sigue siendo `drive`: no se migra ni un partido. Cambia el cartel, no el dato.
 */
export const sideLabels = (): Record<Side, string> => L.sides;


/**
 * Los golpes que se juegan de derecha o de reves. En la hoja son un teclado: el nombre una vez,
 * y dos teclas al lado.
 *
 * EL ORDEN VA DE LA RED HACIA LA PARED, y no es decorativo: es un corte de la cancha.
 *
 * Arriba, el remate y la bandeja (la red). Sigue la volea, que queda pegada a ellos. Despues la
 * chiquita y el globo, que son con lo que se INTENTA SUBIR — no son golpes de fondo, son la
 * jugada para ganar la red. Y al final, el fondo y la salida de pared: la salida de pared es lo
 * ultimo de todo, porque cuando la pelota ya paso por el vidrio estas contra la pared, y no hay
 * nada mas atras que eso.
 *
 * Iba al reves (fondo arriba, volea abajo) porque los golpes de red vivian ABAJO de la hoja. Al
 * subirlos, la progresion tenia que darse vuelta con ellos: el orden espeja la cancha, y la
 * cancha no cambio — cambio desde donde la miramos.
 *
 * De ahi que no haga falta ningun encabezado que diga "en la red" ni "de fondo": el gradiente ya
 * lo dice, y un titulo que anuncia algo que se ve es ruido.
 */
export const STROKES_CON_LADO: Stroke[] = [
  'volea',
  'chiquita',
  'globo',
  'fondo',
  /**
   * Reemplaza a `salida_de_pared` (ver el comentario en `Stroke`): la ofensiva primero, la
   * defensiva al final de todo — es la mas defensiva de las dos, y ahi es donde ya estaba el
   * ancla de "no hay nada mas atras".
   */
  'salida_pared_ofensiva',
  'salida_pared_defensiva',
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
 * Los golpes por alto: no existe una bandeja de reves, asi que no llevan lado.
 *
 * Van al final de la hoja, sin ningun titulo que los agrupe: son golpes de red, y la lista
 * ya viene bajando desde el fondo hacia la red. Se distinguen solos porque no tienen las dos
 * columnas de lado.
 *
 * LOS CUATRO SON GOLPES, NO UN GOLPE CON VARIANTES. La vibora y el rulo colgaban de la bandeja
 * como refinamientos opcionales: en la hoja ya eran botones propios, pero el motor los sumaba
 * como bandeja, asi que en estadisticas no existian — no habia forma de preguntar cuantas
 * viboras pego alguien. El mecanismo protegia un historial que todavia no existe, asi que se
 * fue entero y cada uno cuenta por su cuenta.
 *
 * SE FUERON x3, x4 Y TRAERLA con el. Eran tres maneras de rematar que el motor sumaba igual
 * como remate, ya sin boton desde que la hoja se abre en cada punto.
 */
export const STROKES_POR_ALTO: Stroke[] = ['remate', 'bandeja', 'vibora', 'rulo'];

/**
 * LA MISMA LISTA DE `STROKES_CON_LADO`, PARTIDA EN DOS. La pantalla de "con que golpe forzo /
 * con que erro" del error forzado (ver `MatchScreen`) no pregunta por cualquier golpe: separa
 * los que se pegan yendo a la red de los que se pegan defendiendola, porque son exactamente las
 * dos preguntas de esa pantalla — el que fuerza ataca, el que sufre defiende. Dejada y
 * recuperacion quedan afuera de las dos: no son ni una cosa ni la otra.
 *
 * El orden y el conjunto vienen de `STROKES_CON_LADO`, no se repiten a mano: si el dia de
 * mañana ese orden cambia, estas dos lo siguen solas.
 */
export const STROKES_OFENSIVOS_CON_LADO: Stroke[] = STROKES_CON_LADO.filter(
  (s) => s === 'volea' || s === 'salida_pared_ofensiva',
);
export const STROKES_DEFENSIVOS_CON_LADO: Stroke[] = STROKES_CON_LADO.filter(
  (s) => s === 'chiquita' || s === 'globo' || s === 'fondo' || s === 'salida_pared_defensiva',
);
