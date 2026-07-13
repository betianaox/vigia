import { reduce } from './engine';
import { computeStats, type PlayerStats, type ShotTally } from './stats';
import { teamOfPlayer } from './rules';
import type { MatchConfig, MatchEvent, PlayerId, Stroke, TeamId } from './types';

/**
 * El acumulado y la evolucion de UNA persona, a lo largo de todos sus partidos.
 *
 * Es lo unico que crece. Un partido suelto es una foto; esto es la unica razon por la que
 * alguien vuelve a abrir la app en tres meses (§7 bis del plan). Una app de scoring la
 * reemplaza cualquiera — dos años de tu propio juego, no.
 *
 * SE RECALCULA DEL LOG, SIEMPRE. No hay ningun total guardado en ningun lado: se abre cada
 * partido y se lo vuelve a correr. Es mas caro, y es a proposito — el dia que se guarde un
 * numero derivado aparece la clase de bug donde las estadisticas dicen una cosa y los partidos
 * dicen otra, y ese seguro no se entrega por una velocidad que todavia no hace falta.
 */

/** Lo minimo que hace falta de un partido guardado. `SavedMatch` lo cumple. */
export interface PlayedMatch {
  id: string;
  config: MatchConfig;
  events: MatchEvent[];
  startedAt: number;
}

/** Un partido, visto desde una persona. De aca sale la evolucion. */
export interface CareerPoint {
  matchId: string;
  at: number;
  /** null: el partido se termino a mano y el reglamento nunca declaro un ganador. */
  won: boolean | null;
  /** Los rivales, para poder decir "contra quien". */
  opponents: PlayerId[];
  partner: PlayerId;
  stats: PlayerStats;
  /** Del EQUIPO: un punto lo gana una pareja, no una persona. */
  teamPointsWon: number;
  totalPoints: number;
}

export interface CareerStats {
  player: PlayerId;
  matches: number;
  won: number;
  lost: number;
  /** Ni ganados ni perdidos: se cortaron sin que el reglamento definiera nada. */
  undecided: number;

  /**
   * La suma de los CONTADORES de todos los partidos.
   *
   * Nunca el promedio de los porcentajes. El "1er saque adentro" de una temporada no es el
   * promedio de los porcentajes por partido: es la suma de los saques que entraron sobre la
   * suma de los que se sacaron. Un dia con 2 saques al 100% y otro con 40 al 50% dan un
   * promedio de 75% y una verdad de 52%. Por eso el motor guarda contadores y no porcentajes:
   * para que esto se pueda sumar sin mentir.
   */
  totals: PlayerStats;

  teamPointsWon: number;
  totalPoints: number;

  /** En orden cronologico, del mas viejo al mas nuevo. La pelicula. */
  timeline: CareerPoint[];
}

const mergeTally = (a: ShotTally, b: ShotTally): ShotTally => {
  const out: ShotTally = { ...a };
  for (const [shot, n] of Object.entries(b) as Array<[Stroke, number]>) {
    out[shot] = (out[shot] ?? 0) + n;
  }
  return out;
};

/**
 * Los duelos, sumados a lo largo de los años. Las CLAVES pasan por `canon`: el rival de hace dos
 * años puede estar guardado con un id viejo, y si no se resuelve la union, "8 dobles faltas
 * sacandole a Beto" se parte en dos Betos que no existen.
 */
const mergeAgainst = (
  a: Partial<Record<PlayerId, number>>,
  b: Partial<Record<PlayerId, number>>,
  canon: Canon,
): Partial<Record<PlayerId, number>> => {
  const out = { ...a };
  for (const [id, n] of Object.entries(b) as Array<[PlayerId, number]>) {
    const who = canon(id);
    out[who] = (out[who] ?? 0) + n;
  }
  return out;
};

const empty = (id: PlayerId, name: string, team: TeamId): PlayerStats => ({
  id,
  name,
  team,
  winners: 0,
  forcedErrors: 0,
  unforcedErrors: 0,
  winnersByShot: {},
  forcedByShot: {},
  unforcedByShot: {},
  aces: 0,
  doubleFaults: 0,
  acesAgainst: {},
  doubleFaultsAgainst: {},
  acesConceded: 0,
  doubleFaultsForced: 0,
  servePointsPlayed: 0,
  firstServesIn: 0,
  firstServePointsWon: 0,
  secondServePointsPlayed: 0,
  secondServePointsWon: 0,
  returnPointsPlayed: 0,
  returnPointsWon: 0,
});

/** Los contadores que se suman sin mas. Los mapas y los strings van aparte. */
const SUMMED = [
  'winners',
  'forcedErrors',
  'unforcedErrors',
  'aces',
  'doubleFaults',
  'acesConceded',
  'doubleFaultsForced',
  'servePointsPlayed',
  'firstServesIn',
  'firstServePointsWon',
  'secondServePointsPlayed',
  'secondServePointsWon',
  'returnPointsPlayed',
  'returnPointsWon',
] as const;

/**
 * Con quien id aparece esta persona en ESTE partido.
 *
 * Casi siempre es el suyo. Pero si se unieron dos personas, un partido viejo tiene guardado el id
 * VIEJO — y ese partido tambien es suyo. `canon` resuelve la union: nada se reescribio, se
 * resuelve al leer.
 */
const idIn = (m: PlayedMatch, player: PlayerId, canon: Canon): PlayerId | null => {
  for (const id of Object.keys(m.config.players) as PlayerId[]) {
    if (canon(id) === player) return id;
  }
  return null;
};

/** Por defecto, cada uno es el mismo: sin uniones, esto no cambia nada. */
export type Canon = (id: PlayerId) => PlayerId;
const SELF: Canon = (id) => id;

/** Los partidos donde jugo esa persona, del mas viejo al mas nuevo. */
export const playedBy = (
  player: PlayerId,
  matches: PlayedMatch[],
  canon: Canon = SELF,
): PlayedMatch[] =>
  matches
    .filter((m) => idIn(m, player, canon) !== null)
    .sort((a, b) => a.startedAt - b.startedAt);

export const career = (
  player: PlayerId,
  matches: PlayedMatch[],
  canon: Canon = SELF,
): CareerStats => {
  const mine = playedBy(player, matches, canon);

  const first = mine[0];
  const firstId = first ? idIn(first, player, canon) : null;
  const totals = empty(
    player,
    first && firstId ? first.config.players[firstId]!.name : '',
    first && firstId ? teamOfPlayer(firstId, first.config.teams) : 'A',
  );

  let won = 0;
  let lost = 0;
  let undecided = 0;
  let teamPointsWon = 0;
  let totalPoints = 0;
  const timeline: CareerPoint[] = [];

  for (const m of mine) {
    // El id con el que aparece en ESTE partido: el suyo, o uno viejo si hubo una union.
    const here = idIn(m, player, canon)!;

    const st = reduce(m.config, m.events);
    const stats = computeStats(m.config, m.events);
    const mineStats = stats.players[here]!;
    const team = teamOfPlayer(here, m.config.teams);
    const rival: TeamId = team === 'A' ? 'B' : 'A';

    for (const k of SUMMED) totals[k] += mineStats[k];
    totals.winnersByShot = mergeTally(totals.winnersByShot, mineStats.winnersByShot);
    totals.forcedByShot = mergeTally(totals.forcedByShot, mineStats.forcedByShot);
    totals.unforcedByShot = mergeTally(totals.unforcedByShot, mineStats.unforcedByShot);
    totals.acesAgainst = mergeAgainst(totals.acesAgainst, mineStats.acesAgainst, canon);
    totals.doubleFaultsAgainst = mergeAgainst(
      totals.doubleFaultsAgainst,
      mineStats.doubleFaultsAgainst,
      canon,
    );

    const mineTeamPoints = stats.teams[team].pointsWon;
    teamPointsWon += mineTeamPoints;
    totalPoints += stats.totalPoints;

    // Sin ganador, el partido se corto y el reglamento nunca definio nada. No se inventa.
    const result = st.winner === null ? null : st.winner === team;
    if (result === true) won += 1;
    else if (result === false) lost += 1;
    else undecided += 1;

    const t = m.config.teams[team];
    const r = m.config.teams[rival];

    timeline.push({
      matchId: m.id,
      at: m.startedAt,
      won: result,
      partner: t.drive === here ? t.reves : t.drive,
      opponents: [r.drive, r.reves],
      stats: mineStats,
      teamPointsWon: mineTeamPoints,
      totalPoints: stats.totalPoints,
    });
  }

  return {
    player,
    matches: mine.length,
    won,
    lost,
    undecided,
    totals,
    teamPointsWon,
    totalPoints,
    timeline,
  };
};
