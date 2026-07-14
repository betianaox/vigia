import { getLocales } from 'expo-localization';

import { en } from './en';
import { es } from './es';
import { it } from './it';
import { pt } from './pt';

/**
 * LA FORMA DEL DICCIONARIO LA DEFINE EL CASTELLANO.
 *
 * Los otros tres se declaran como `Dict`, asi que si a uno le falta una clave —o le sobra— el
 * proyecto NO COMPILA. No hace falta acordarse de nada ni mantener una lista: el compilador es
 * el que avisa que falta traducir, y avisa antes de que la app llegue a nadie.
 */
export type Dict = typeof es;

/** Los idiomas que la app habla. */
export type Lang = 'es' | 'en' | 'pt' | 'it';

/**
 * Lo que la persona ELIGIO, que no es lo mismo que el idioma que termina viendo.
 *
 * `auto` es el default y es un estado de verdad, no una ausencia: significa "segui al telefono".
 * Sin el, quien alguna vez toca el selector no puede volver nunca — y el que se muda, o le presta
 * el telefono a alguien, queda clavado en un idioma que eligio una vez.
 */
export type LangPref = 'auto' | Lang;

const LOCALES: Record<Lang, Dict> = { es, en, pt, it };

/**
 * El nombre de cada idioma, EN SU PROPIO IDIOMA. No se traducen.
 *
 * Es la unica lista de la app que es igual en los cuatro diccionarios, y por eso no vive en
 * ninguno: quien busca "Português" lo busca escrito asi, no como "Portugues" — justamente porque
 * todavia no entiende el idioma en el que esta la app. Es la razon por la que ninguna app seria
 * traduce los nombres de los idiomas.
 */
export const LANG_NAMES: Record<Lang, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
  it: 'Italiano',
};

const isLang = (x: string | undefined): x is Lang => !!x && x in LOCALES;

/** El idioma del telefono, si es uno de los cuatro. Si no, el castellano — que es el del padel. */
const deviceLang = (): Lang => {
  const tag = getLocales()[0]?.languageCode ?? undefined;
  return isLang(tag) ? tag : 'es';
};

/** A que idioma REAL corresponde una eleccion. */
export const resolveLang = (pref: LangPref): Lang => (pref === 'auto' ? deviceLang() : pref);

/**
 * EL DICCIONARIO ACTIVO, Y POR QUE ES `let` Y NO `const`.
 *
 * Arranca en el idioma del telefono y lo pisa `setLanguage` si la persona eligio otro. Un `import`
 * de ES modules es una referencia viva: quien escribe `L.court.undo` lee el diccionario EN ESE
 * MOMENTO, asi que al reasignar aca cambian todas las pantallas a la vez, sin reiniciar la app.
 *
 * Con una condicion, que es la unica regla de este modulo: NADIE PUEDE LEER `L` A NIVEL DE MODULO.
 * Una constante como `const TITULOS = [L.a, L.b]` copia los strings cuando carga el bundle y ya no
 * se entera de nada. Si un texto tiene que vivir afuera de un componente, va en una FUNCION que se
 * llama al dibujar (asi estan `rally()`, `PERIODS()`, `strokeLabels()`...).
 */
export let L: Dict = LOCALES[deviceLang()];

/**
 * El idioma en el que se escriben las FECHAS.
 *
 * "sáb 12 jul" estaba clavado en castellano en cuatro lugares. Una app en italiano con las fechas
 * en español no esta traducida a medias: esta rota — y es lo primero que se nota, porque la fecha
 * esta en cada renglon del historial.
 */
export let LOCALE: string = deviceLang();

/**
 * Cambia el idioma de la app entera. Lo llama App al arrancar (con lo que estaba guardado) y el
 * selector de las avanzadas.
 *
 * Devuelve el idioma real que quedo puesto, que es lo que hay que mostrarle a quien eligio `auto`.
 */
export const setLanguage = (pref: LangPref): Lang => {
  const lang = resolveLang(pref);
  L = LOCALES[lang];
  LOCALE = lang;
  return lang;
};
