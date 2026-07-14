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

const LOCALES: Record<string, Dict> = { es, en, pt, it };

/**
 * El idioma sale del TELEFONO, no de una pantalla de ajustes.
 *
 * Nadie entra a una app de padel a elegir idioma: la abre y espera entenderla. Si el telefono
 * esta en italiano, la app esta en italiano. Y si el idioma no es ninguno de los cuatro, cae al
 * castellano — que es el idioma del padel.
 */
const tag = getLocales()[0]?.languageCode ?? 'es';

/**
 * El idioma en el que se escriben las FECHAS.
 *
 * "sáb 12 jul" estaba clavado en castellano en cuatro lugares. Una app en italiano con las fechas
 * en español no esta traducida a medias: esta rota — y es lo primero que se nota, porque la fecha
 * esta en cada renglon del historial.
 *
 * Cae al castellano si el idioma no es ninguno de los cuatro, igual que el diccionario.
 */
export const LOCALE: string = LOCALES[tag] ? tag : 'es';

/**
 * El diccionario activo. Se resuelve UNA vez, al arrancar: el idioma del sistema no cambia en
 * medio de un partido, y un contexto de React para algo que no cambia es ceremonia sin motivo.
 */
export const L: Dict = LOCALES[tag] ?? es;
