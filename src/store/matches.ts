import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { reduce } from '../engine';
import type { MatchConfig, MatchEvent, PlayerId, TeamId } from '../engine';

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
 * NADA SE BORRA NUNCA. Lo que hace volver a alguien es verse a si mismo a lo largo del
 * tiempo: como evoluciono su primer saque, su ratio en los ultimos diez partidos, su
 * historial contra ese rival. La antiguedad ES el valor. Borrar lo viejo seria tirar
 * justamente la parte que crece.
 *
 * AsyncStorage queda solo para lo chico: el indice, el plantel, las preferencias.
 */

const DIR = 'matches';
const KEY_INDEX = 'vigia.matches.index.v1';
const KEY_CURRENT = 'vigia.matches.current.v1';

/** El partido entero, tal como se guarda. El log de eventos es la fuente de verdad. */
export interface SavedMatch {
  id: string;
  config: MatchConfig;
  events: MatchEvent[];
  startedAt: number;
  updatedAt: number;
}

/**
 * Lo justo para dibujar la lista del historial sin abrir un solo archivo. Se recalcula al
 * guardar, no al listar: la lista tiene que ser instantanea aunque haya 500 partidos.
 */
export interface MatchSummary {
  id: string;
  startedAt: number;
  updatedAt: number;
  finished: boolean;
  /** "Ana Ruiz / Aldo Vega", ya armado. */
  teams: Record<TeamId, string>;
  /** "6-4 7-5", o el parcial si quedo a medias. */
  score: string;
  winner: TeamId | null;
  points: number;
  /**
   * Los cuatro que jugaron, POR ID. El filtro por jugador del historial se hace con esto y no
   * con el nombre: dos personas se pueden llamar igual, y alguien se puede renombrar. El id es
   * la identidad estable que se construyo justamente para esto.
   */
  playerIds: PlayerId[];
}

export const newMatchId = (): string =>
  `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const dir = (): Directory => new Directory(Paths.document, DIR);
const fileFor = (id: string): File => new File(dir(), `${id}.json`);

/** El resultado en texto, del partido terminado o de lo que se lleve jugado. */
const scoreText = (config: MatchConfig, events: MatchEvent[]): string => {
  const s = reduce(config, events);
  const sets = s.completedSets.map((set) => `${set.games.A}-${set.games.B}`);
  if (!s.finished) {
    const current = `${s.games.A}-${s.games.B}`;
    // Un partido recien empezado no muestra "0-0": muestra nada.
    if (sets.length > 0 || s.games.A + s.games.B > 0) sets.push(current);
  }
  return sets.join(' ');
};

export const summarize = (m: SavedMatch): MatchSummary => {
  const s = reduce(m.config, m.events);
  const names = (t: TeamId): string =>
    [m.config.teams[t].drive, m.config.teams[t].reves]
      .map((p) => m.config.players[p]!.name)
      .join(' / ');

  return {
    id: m.id,
    startedAt: m.startedAt,
    updatedAt: m.updatedAt,
    finished: s.finished,
    teams: { A: names('A'), B: names('B') },
    score: scoreText(m.config, m.events),
    winner: s.winner,
    points: m.events.filter((e) => 'player' in e || e.type === 'ACE').length,
    playerIds: (['A', 'B'] as TeamId[]).flatMap((t) => [
      m.config.teams[t].drive,
      m.config.teams[t].reves,
    ]),
  };
};

/** Cuanto duro, en milisegundos. Sale de la hora del primer y del ultimo evento. */
export const matchDuration = (m: Pick<SavedMatch, 'startedAt' | 'updatedAt'>): number =>
  Math.max(0, m.updatedAt - m.startedAt);

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
