import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ChangeEndsRule,
  GameFormat,
  MatchLength,
  Player,
  PlayerId,
  ThirdSetFormat,
} from '../engine';
import type { LangPref } from '../i18n';

/**
 * El guardado local. Es lo unico que persiste hoy, y es a proposito el pedazo mas aburrido
 * de la app: durante el partido la red no puede estar en el camino critico del tap, asi que
 * todo esto es local y sincrono desde el punto de vista del usuario.
 *
 * Guarda dos cosas, y las dos existen por razones distintas:
 *
 * 1. EL PLANTEL. Los jugadores tienen que tener identidad estable, no ser strings tipeados
 *    en cada partido. Si escribis "Ana Ruiz" a mano cada vez, con un typo ("Ana Ruíz") ya son
 *    dos personas distintas y las estadisticas de Ana quedan partidas para siempre. Lo que
 *    hace volver a alguien no es ver sus partidos viejos, es VERSE A SI MISMO: como le va de
 *    drive vs. de reves, su ratio contra ese rival que siempre le gana.
 *
 * 2. LAS PREFERENCIAS. No hay boton de "guardar preferencias" ni pantalla de ajustes: la app
 *    recuerda lo ultimo que usaste y listo. Un boton de guardar es MAS complejo — te obliga a
 *    entender que hay preferencias, a acordarte de guardarlas y a preguntarte si guardaste.
 *    Recordar en silencio no le pide nada a nadie.
 */

const KEY_PLAYERS = 'vigia.players.v1';
const KEY_PREFS = 'vigia.prefs.v1';
const KEY_MERGES = 'vigia.merges.v1';

/**
 * COMO SE REGISTRA EL GOLPE. Es la unica preferencia que no es una regla del partido: es de la
 * persona que anota.
 *
 * - `siempre`: cada punto abre la hoja de golpes.
 * - `opcional`: el toque corto registra el punto; el golpe se elige manteniendo apretado.
 */
export type ShotPrompt = 'siempre' | 'opcional';

/**
 * Lo que se acuerda del ultimo partido: el formato, no los jugadores.
 *
 * Y dos cosas que NO son del partido sino de la APP —como se cargan los golpes y en que idioma
 * esta— que viven en el mismo archivo porque el archivo es "lo que se acuerda de vos". La
 * diferencia se cuenta en la pantalla, no aca (ver las avanzadas).
 */
export interface Prefs {
  gameFormat: GameFormat;
  length: MatchLength;
  thirdSet: ThirdSetFormat;
  changeEnds: ChangeEndsRule;
  shotPrompt: ShotPrompt;
  language: LangPref;
  /**
   * Si ya se mostro la bienvenida. Se pone en true la primera vez que se cierra, y de ahi en
   * adelante la pantalla solo se abre a pedido, con el boton de ayuda del inicio.
   */
  seenWelcome: boolean;
}

/** La primera vez que se abre la app. De ahi en adelante manda lo ultimo que se uso. */
export const DEFAULT_PREFS: Prefs = {
  gameFormat: 'ventajas',
  length: 'tres_sets',
  thirdSet: 'set_normal',
  /** Como se juega de verdad en un club: se cambia de lado al terminar el set, no cada game impar. */
  changeEnds: 'fin_de_set',

  /**
   * EL DEFAULT ES EL QUE ENSEÑA.
   *
   * Los golpes son el diferencial entero de la app —es el dato que ningun reloj puede dar— y
   * hasta hoy vivian detras de un long press, que es invisible. La opcion sola no alcanzaba: si
   * el modo "preguntar siempre" fuera opt-in, lo encontraria unicamente el que ya sabe que
   * existe, y el que no sabe —justo el que hay que enseñarle— no lo descubriria nunca.
   *
   * Asi que la app pregunta desde el primer punto, y el que no lo quiere lo apaga UNA vez y no
   * lo ve nunca mas. El default enseña; la configuracion acelera. Al reves es como se pierde una
   * funcion.
   */
  shotPrompt: 'siempre',

  /**
   * El del telefono. Nadie entra a una app de padel a elegir idioma: la abre y espera entenderla.
   * El selector existe para el caso real —tener el telefono en un idioma y jugar al padel en
   * otro— no para hacerle tomar una decision a alguien que no la pidio.
   */
  language: 'auto',

  /**
   * Nadie la vio todavia. Como `loadPrefs` completa con los defaults, el que ya venia usando la
   * app tambien la va a ver una vez —y esta bien: la pantalla es nueva, y explica cosas que hasta
   * ahora no estaban escritas en ningun lado.
   */
  seenWelcome: false,
};

/**
 * Lee y no explota nunca. Si el JSON esta corrupto o la clave no existe, devuelve el
 * fallback: la app tiene que abrir siempre, aunque el guardado este roto.
 */
const read = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = async (key: string, value: unknown): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Que no se pueda guardar la preferencia no puede impedir jugar el partido.
  }
};

export const loadPlayers = (): Promise<Player[]> => read<Player[]>(KEY_PLAYERS, []);

/**
 * Escribir el plantel y las uniones ENTEROS. Los usa la copia de seguridad al importar, que es
 * el unico lugar que trae gente de afuera y necesita dejar la tabla como quedo despues de unir
 * lo que vino con lo que habia. El resto de la app no escribe listas completas: agrega de a uno.
 */
export const savePlayers = (roster: Player[]): Promise<void> => write(KEY_PLAYERS, roster);
export const saveMerges = (m: Merges): Promise<void> => write(KEY_MERGES, m);
/**
 * Las preferencias guardadas se COMPLETAN con los valores por default.
 *
 * Sin esto, el dia que se agrega una preferencia nueva, todo el que ya venia usando la app la
 * recibe vacia: ningun boton elegido, y la app tomando decisiones sobre un `undefined`. Le paso
 * exactamente a `shotPrompt`. El guardado viejo no se migra ni se reescribe — se le pone arriba
 * lo que falta, al leer.
 */
export const loadPrefs = async (): Promise<Prefs> => ({
  ...DEFAULT_PREFS,
  ...(await read<Partial<Prefs>>(KEY_PREFS, {})),
});
export const savePrefs = (p: Prefs): Promise<void> => write(KEY_PREFS, p);

/** Ids estables y unicos: de aca cuelga todo el historial de un jugador. */
const newId = (): string => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Agrega un jugador al plantel, o devuelve el que ya estaba.
 *
 * Compara sin acentos, sin mayusculas y sin espacios de mas: "ana ruiz", "Ana Ruiz" y
 * "  Ana  Ruíz " son la misma persona. Es la unica defensa real contra que el historial de
 * alguien se parta en dos por un typo.
 */
export const normalize = (name: string): string =>
  name
    .trim()
    .toLocaleLowerCase('es')
    // NFD separa la tilde de su letra base; el rango borra esos diacriticos combinantes.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');

export const addPlayer = async (name: string, roster: Player[]): Promise<Player[]> => {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return roster;

  const existing = roster.find((p) => normalize(p.name) === normalize(clean));
  if (existing) return roster;

  const next = [...roster, { id: newId(), name: clean }];
  await write(KEY_PLAYERS, next);
  return next;
};

export const findPlayer = (name: string, roster: Player[]): Player | undefined =>
  roster.find((p) => normalize(p.name) === normalize(name));

/**
 * Por que renombrar puede FALLAR.
 *
 * Un nombre vacio no es un nombre. Y si el nombre nuevo YA ES de otra persona del plantel, eso
 * no es renombrar: es UNIFICAR — una operacion distinta, que junta dos historiales.
 *
 * Y no es un problema: es JUSTO EL MOMENTO en que se descubre el duplicado. Alguien escribe
 * "Ana Ruiz" sobre "Ana", choca, y ahi es exactamente cuando hay que preguntarle si son la misma
 * persona. Por eso el choque devuelve CON QUIEN choco: la pantalla puede ofrecer unirlas.
 */
export type RenameError =
  | { kind: 'vacio' }
  | { kind: 'ya_existe'; other: Player };

/**
 * Renombrar a una persona. El ID NO CAMBIA — de el cuelga todo su historial.
 *
 * Los partidos ya guardados no se tocan: siguen con la copia del nombre viejo adentro, que es
 * su paracaidas. Lo que se ve en pantalla sale de esta tabla (ver `ui/roster.tsx`), asi que el
 * cambio aparece en todos lados, incluidos los partidos de hace dos años.
 */
/**
 * LA REGLA, separada de la escritura: es pura, y se puede probar en un segundo. Lo que toca el
 * disco no se puede — y lo unico que importa probar aca es la regla.
 */
export const validateRename = (
  id: PlayerId,
  name: string,
  roster: Player[],
): { ok: true; clean: string } | { ok: false; error: RenameError } => {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return { ok: false, error: { kind: 'vacio' } };

  // Cambiarse a uno mismo con otra ortografia SI vale ("ana ruiz" -> "Ana Ruiz"): es la misma
  // persona arreglando como se escribe. Lo que no vale es pisar a OTRA.
  const other = roster.find((p) => p.id !== id && normalize(p.name) === normalize(clean));
  if (other) return { ok: false, error: { kind: 'ya_existe', other } };

  return { ok: true, clean };
};

export const renamePlayer = async (
  id: PlayerId,
  name: string,
  roster: Player[],
): Promise<{ ok: true; roster: Player[] } | { ok: false; error: RenameError }> => {
  const check = validateRename(id, name, roster);
  if (!check.ok) return check;

  const next = roster.map((p) => (p.id === id ? { ...p, name: check.clean } : p));
  await write(KEY_PLAYERS, next);
  return { ok: true, roster: next };
};

// ---- Unificar dos personas ----

/**
 * "Este jugador es en realidad aquel". Del id que se absorbe, al que queda.
 *
 * NO SE REESCRIBE NI UN SOLO PARTIDO. La tentacion era abrir cada archivo y cambiar el id viejo
 * por el nuevo, y seria un error por dos razones concretas:
 *
 * 1. ES IRREVERSIBLE. Si se unen por error dos personas que no eran la misma, los logs quedan
 *    mezclados para siempre. Con un mapa, deshacerlo es borrar una linea.
 * 2. TOCA LOS EVENTOS. Cada WINNER lleva un id adentro. Reescribir eventos es exactamente lo que
 *    esta arquitectura no hace nunca — y si la escritura falla a la mitad, quedan partidos
 *    corruptos.
 *
 * Asi que la union se resuelve AL LEER. Los partidos siguen diciendo lo que dijeron siempre.
 */
export type Merges = Record<PlayerId, PlayerId>;

export const loadMerges = (): Promise<Merges> => read<Merges>(KEY_MERGES, {});

/**
 * El id que representa a esta persona HOY.
 *
 * Sigue la cadena, por si A se unio a B y despues B a C. El tope es una guarda contra un ciclo:
 * no deberia pasar nunca —`mergePlayers` lo evita— pero un dato corrupto no puede colgar la app.
 */
export const canonical = (id: PlayerId, merges: Merges): PlayerId => {
  let at = id;
  for (let i = 0; i < 16; i++) {
    const next = merges[at];
    if (!next || next === at) return at;
    at = next;
  }
  return at;
};

/**
 * Une a `from` dentro de `into`. Los dos ids siguen existiendo en los partidos viejos; lo que
 * cambia es que ahora los dos apuntan a la misma persona.
 *
 * El que ABSORBE (`into`) es el que sobrevive: su id es el canonico y su nombre es el que se ve.
 */
export const mergePlayers = async (
  from: PlayerId,
  into: PlayerId,
  roster: Player[],
  merges: Merges,
): Promise<{ roster: Player[]; merges: Merges }> => {
  const target = canonical(into, merges);
  if (from === target) return { roster, merges }; // ya son la misma: no hay nada que hacer

  const nextMerges: Merges = { ...merges, [from]: target };

  // Si alguien ya apuntaba a `from`, ahora apunta al destino final: la cadena queda de un salto y
  // no se puede armar un ciclo.
  for (const [old, to] of Object.entries(merges) as Array<[PlayerId, PlayerId]>) {
    if (to === from) nextMerges[old] = target;
  }

  await write(KEY_MERGES, nextMerges);
  return { roster, merges: nextMerges };
};

/**
 * BORRAR A UNA PERSONA SOLO ES SEGURO SI NO JUGO NUNCA. Y de ahi sale la unica regla de esta
 * funcion: NO se le pasa un jugador, se le pasa el jugador Y los ids que aparecen en algun
 * partido. Si aparece en alguno, no se borra — y no es una comprobacion defensiva de mas.
 *
 * UNA PERSONA VIVE ADENTRO DE PARTIDOS QUE SON DE OTRAS TRES. Borrar a Carla no puede borrar sus
 * partidos, porque en esos partidos tambien jugaron Ana, Beto y Diego, y las estadisticas de ellos
 * se calculan con esos puntos. Y dejarla borrada CON partidos vivos es peor todavia: el historial
 * seguiria mostrandola (cada partido guarda una copia del nombre) pero no se podria abrir su
 * juego, y si alguien vuelve a escribir el mismo nombre nace otra persona con otro id — su
 * historial quedaria partido en dos para siempre.
 *
 * Entonces, ¿a quien se borra? A los que quedaron SIN partidos, que son residuo puro: en esta app
 * nadie se carga a mano — un jugador nace al empezar un partido. Si hoy no tiene ninguno, es
 * porque ese partido se borro. No aparecen en ninguna estadistica, no se pueden abrir, y sin
 * embargo siguen saliendo en el autocompletado del formulario. Eso es lo que se limpia.
 *
 * Un duplicado ("Ana" y "Ana Ruiz") NO se arregla borrando: se arregla UNIENDO (ver `mergePlayers`),
 * que conserva los dos historiales.
 */
export const deletePlayer = async (
  id: PlayerId,
  roster: Player[],
  /** Los ids que aparecen en algun partido guardado, ya canonicalizados. */
  played: Set<PlayerId>,
): Promise<Player[]> => {
  if (played.has(id)) return roster;

  const next = roster.filter((p) => p.id !== id);
  await write(KEY_PLAYERS, next);
  return next;
};
