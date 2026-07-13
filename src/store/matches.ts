import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { PlayerId } from '../engine';
import { summarize, type MatchSummary, type SavedMatch } from './summary';

// Lo que se deriva del log es puro y vive en `summary.ts`, sin tocar el disco: asi se puede
// probar en un segundo. Se reexporta para que nadie tenga que saber que son dos archivos.
export { matchDuration, summarize } from './summary';
export type { MatchSummary, SavedMatch } from './summary';

/**
 * Los partidos. UN ARCHIVO POR PARTIDO, en el disco de la app.
 *
 * Por que archivos y no AsyncStorage: en Android, AsyncStorage guarda TODO adentro de una
 * sola base SQLite con un tope de 6 MB. A ~35 KB por partido son unos 170 partidos — poco
 * mas de un año jugando tres veces por semana — y despues las escrituras empiezan a fallar.
 * Ese es exactamente el peor bug posible en esta app (§ Local-first). Los archivos no tienen
 * ese tope: el limite es el disco del telefono, que tiene gigabytes.
 *
 * Y un archivo por partido, no uno con todos, por dos razones:
 *
 * 1. Guardar un punto escribe SOLO ese partido. Con la lista entera en un archivo estariamos
 *    reescribiendo megabytes en cada tap.
 * 2. Si un archivo se corrompe, se pierde UN partido, no todos. (De Betiana, y es el
 *    argumento mas fuerte de los dos.)
 *
 * LA APP NO BORRA NADA NUNCA. Lo que hace volver a alguien es verse a si mismo a lo largo del
 * tiempo: como evoluciono su primer saque, su ratio en los ultimos diez partidos, su
 * historial contra ese rival. La antiguedad ES el valor. Que la app tire lo viejo sola —para
 * ahorrar espacio, para "limpiar"— seria tirar justamente la parte que crece.
 *
 * El usuario SI puede borrar un partido, desde el historial (`deleteMatch`). Es distinto:
 * un partido que se empezo por error y quedo ahi ensucia las estadisticas para siempre, y
 * nadie mas que el dueño de los datos puede saber cual es cual.
 *
 * AsyncStorage queda solo para lo chico: el indice, el plantel, las preferencias.
 */

const DIR = 'matches';
const KEY_INDEX = 'vigia.matches.index.v1';
const KEY_CURRENT = 'vigia.matches.current.v1';

export const newMatchId = (): string =>
  `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const dir = (): Directory => new Directory(Paths.document, DIR);
const fileFor = (id: string): File => new File(dir(), `${id}.json`);

/**
 * Guarda el partido y actualiza el indice. Se llama en CADA evento.
 *
 * Nunca lanza: que falle una escritura no puede cortar un partido en la mitad. Si el disco
 * esta lleno o el archivo esta trabado, el partido sigue vivo en memoria y el proximo punto
 * lo vuelve a intentar.
 */
export const saveMatch = async (m: SavedMatch): Promise<void> => {
  try {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });

    const f = fileFor(m.id);
    if (!f.exists) f.create();
    f.write(JSON.stringify(m));

    await upsertSummary(summarize(m));
  } catch {
    // Ver arriba: el partido sigue en memoria y el proximo evento reintenta.
  }
};

export const loadMatch = async (id: string): Promise<SavedMatch | null> => {
  try {
    const f = fileFor(id);
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as SavedMatch;
  } catch {
    // Un archivo corrupto se lleva UN partido, no el historial entero. Por eso son archivos.
    return null;
  }
};

/**
 * Los partidos de UNA persona, enteros. Es lo que come el acumulado.
 *
 * Abre los archivos, uno por uno, y vuelve a correr cada log. Es caro y es a proposito: no hay
 * ningun total guardado que pueda separarse de la verdad (ver `career.ts`).
 *
 * Pero solo abre LOS SUYOS: el indice ya sabe quien jugo cada partido, asi que se filtra antes
 * de tocar el disco. Con quinientos partidos guardados y veinte de esta persona, se leen veinte
 * archivos, no quinientos.
 */
export const loadMatchesOf = async (player: PlayerId): Promise<SavedMatch[]> => {
  const index = await loadIndex();
  const mine = index.filter((s) => s.playerIds.includes(player));

  const out: SavedMatch[] = [];
  for (const s of mine) {
    const m = await loadMatch(s.id);
    if (m) out.push(m); // un archivo corrupto se pierde solo, no se lleva el acumulado
  }
  return out;
};

export const deleteMatch = async (id: string): Promise<void> => {
  try {
    const f = fileFor(id);
    if (f.exists) f.delete();
  } catch {
    /* si no se pudo borrar, queda: no es destructivo */
  }
  const index = await loadIndex();
  await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(index.filter((x) => x.id !== id)));
};

// ---- El indice: chico, en AsyncStorage, para que la lista abra al instante ----

export const loadIndex = async (): Promise<MatchSummary[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY_INDEX);
    const list = raw ? (JSON.parse(raw) as MatchSummary[]) : [];
    return list.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
};

const upsertSummary = async (s: MatchSummary): Promise<void> => {
  const list = await loadIndex();
  const next = [s, ...list.filter((x) => x.id !== s.id)];
  await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(next));
};

// ---- El partido en curso: para poder retomarlo si la app se cierra ----

export const getCurrentId = (): Promise<string | null> => AsyncStorage.getItem(KEY_CURRENT);

export const setCurrentId = async (id: string | null): Promise<void> => {
  if (id) await AsyncStorage.setItem(KEY_CURRENT, id);
  else await AsyncStorage.removeItem(KEY_CURRENT);
};
