import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChangeEndsRule, GameFormat, MatchLength, Player, ThirdSetFormat } from '../engine';

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

/** Lo que se acuerda del ultimo partido: el formato, no los jugadores. */
export interface Prefs {
  gameFormat: GameFormat;
  length: MatchLength;
  thirdSet: ThirdSetFormat;
  changeEnds: ChangeEndsRule;
}

/** La primera vez que se abre la app. De ahi en adelante manda lo ultimo que se uso. */
export const DEFAULT_PREFS: Prefs = {
  gameFormat: 'ventajas',
  length: 'tres_sets',
  thirdSet: 'set_normal',
  /** Como se juega de verdad en un club: se cambia de lado al terminar el set, no cada game impar. */
  changeEnds: 'fin_de_set',
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
export const loadPrefs = (): Promise<Prefs> => read<Prefs>(KEY_PREFS, DEFAULT_PREFS);
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
