import { reduce } from '../engine';
import { computeStats } from '../engine/stats';
import type { MatchConfig, MatchEvent, PlayerId, TeamId } from '../engine';

/**
 * El partido guardado, y lo que se deriva de el para el historial.
 *
 * Vive APARTE de `matches.ts` a proposito: todo esto es funcion pura del log —config y eventos
 * adentro, resumen afuera— y no tiene nada que ver con el disco. Mezclado con `expo-file-system`
 * no se podia testear fuera de un telefono, y justamente aca se coló un bug que ningun test
 * podia atrapar (el conteo de puntos que se olvidaba de las dobles faltas).
 *
 * Lo puro se prueba en un segundo; lo que toca el disco, no. Conviene no confundirlos.
 */

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
  const stats = computeStats(m.config, m.events);
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
    /**
     * Los puntos los cuenta el MOTOR, no una lista de tipos escrita a mano aca.
     *
     * Esa lista decia "winner, error, o ace" — y se olvidaba de la DOBLE FALTA, que tambien
     * cierra un punto (lo gana el que resta). El historial mostraba un punto menos por cada
     * doble falta, y nadie se iba a dar cuenta nunca leyendo la lista.
     *
     * Duplicar la definicion de "que cierra un punto" es garantizar que las dos copias se
     * separen. Hay una sola, y vive en el motor.
     */
    points: stats.totalPoints,
    playerIds: (['A', 'B'] as TeamId[]).flatMap((t) => [
      m.config.teams[t].drive,
      m.config.teams[t].reves,
    ]),
  };
};

/** Cuanto duro, en milisegundos. Sale de la hora del primer y del ultimo evento. */
export const matchDuration = (m: Pick<SavedMatch, 'startedAt' | 'updatedAt'>): number =>
  Math.max(0, m.updatedAt - m.startedAt);
