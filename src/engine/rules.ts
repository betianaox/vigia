import type { Box, GameFormat, PlayerId, Team, TeamId } from './types';

export const otherTeam = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A');

/**
 * Los equipos alternan game, y dentro de cada equipo los dos jugadores alternan.
 * Con i = indice del game dentro del set (0-based), la rotacion es:
 *   i=0 -> A[0]   i=1 -> B[0]   i=2 -> A[1]   i=3 -> B[1]   i=4 -> A[0] ...
 * donde A es el equipo que saco primero en ese set.
 */
export const servingTeamForGame = (i: number, firstOfSet: TeamId): TeamId =>
  i % 2 === 0 ? firstOfSet : otherTeam(firstOfSet);

const playerIndexForGame = (i: number): 0 | 1 => (Math.floor(i / 2) % 2) as 0 | 1;

export const serverForGame = (
  i: number,
  firstOfSet: TeamId,
  serveOrder: Record<TeamId, [PlayerId, PlayerId]>,
): PlayerId => serveOrder[servingTeamForGame(i, firstOfSet)][playerIndexForGame(i)];

/**
 * Los 4 sacadores del set en orden de rotacion, empezando por el equipo que saco primero.
 */
export const serveCycle = (
  firstOfSet: TeamId,
  serveOrder: Record<TeamId, [PlayerId, PlayerId]>,
): [PlayerId, PlayerId, PlayerId, PlayerId] => {
  const second = otherTeam(firstOfSet);
  return [
    serveOrder[firstOfSet][0],
    serveOrder[second][0],
    serveOrder[firstOfSet][1],
    serveOrder[second][1],
  ];
};

/** Posicion del sacador del game `i` dentro del ciclo de 4. */
export const cycleIndexForGame = (i: number): number =>
  (i % 2) + 2 * (Math.floor(i / 2) % 2);

/**
 * En el tiebreak el primer sacador saca 1 punto y despues cada uno saca 2 consecutivos,
 * respetando la rotacion del set.
 */
const serveTurnInTiebreak = (pointIndex: number): number =>
  pointIndex === 0 ? 0 : Math.floor((pointIndex - 1) / 2) + 1;

export const serverForTiebreakPoint = (
  pointIndex: number,
  tiebreakGameIndex: number,
  firstOfSet: TeamId,
  serveOrder: Record<TeamId, [PlayerId, PlayerId]>,
): PlayerId => {
  const cycle = serveCycle(firstOfSet, serveOrder);
  const start = cycleIndexForGame(tiebreakGameIndex);
  return cycle[(start + serveTurnInTiebreak(pointIndex)) % 4];
};

export const teamOfPlayer = (p: PlayerId, teams: Record<TeamId, Team>): TeamId =>
  teams.A.drive === p || teams.A.reves === p ? 'A' : 'B';

/** El sacador arranca desde la derecha y alterna cuadro en cada punto. */
export const boxForPoint = (pointsPlayed: number): Box =>
  pointsPlayed % 2 === 0 ? 'derecha' : 'izquierda';

/**
 * Los dos restadores mantienen su cuadro todo el set: el de drive recibe siempre a la
 * derecha y el de reves a la izquierda. Por eso el receptor se deriva del cuadro.
 */
export const receiverForBox = (
  box: Box,
  receivingTeam: TeamId,
  teams: Record<TeamId, Team>,
): PlayerId => (box === 'derecha' ? teams[receivingTeam].drive : teams[receivingTeam].reves);

/** El punto en juego define el game de una sola vez, y el que resta elige cuadro. */
export const isGoldenPoint = (
  points: Record<TeamId, number>,
  format: GameFormat,
): boolean => {
  if (points.A !== points.B) return false;
  if (format === 'punto_de_oro') return points.A === 3;
  if (format === 'punto_estrella') return points.A === 5; // el tercer 40-40 consecutivo
  return false;
};

export const gameWinner = (
  points: Record<TeamId, number>,
  format: GameFormat,
): TeamId | null => {
  const check = (p: number, q: number): boolean => {
    if (p < 4) return false;
    if (p - q >= 2) return true;
    if (format === 'punto_de_oro') return q === 3; // gano el punto de oro
    if (format === 'punto_estrella') return p === 6 && q === 5; // gano el punto de oro
    return false;
  };
  if (check(points.A, points.B)) return 'A';
  if (check(points.B, points.A)) return 'B';
  return null;
};

export const tiebreakTarget = (isSuper: boolean): number => (isSuper ? 10 : 7);

export const tiebreakWinner = (
  points: Record<TeamId, number>,
  isSuper: boolean,
): TeamId | null => {
  const target = tiebreakTarget(isSuper);
  const check = (p: number, q: number): boolean => p >= target && p - q >= 2;
  if (check(points.A, points.B)) return 'A';
  if (check(points.B, points.A)) return 'B';
  return null;
};

export const setWinner = (games: Record<TeamId, number>): TeamId | null => {
  const check = (g: number, h: number): boolean => g >= 6 && g - h >= 2;
  if (check(games.A, games.B)) return 'A';
  if (check(games.B, games.A)) return 'B';
  return null;
};

export const shouldStartTiebreak = (games: Record<TeamId, number>): boolean =>
  games.A === 6 && games.B === 6;

const POINT_LABELS = ['0', '15', '30', '40'] as const;

export const displayScore = (
  points: Record<TeamId, number>,
  inTiebreak: boolean,
): Record<TeamId, string> => {
  if (inTiebreak) return { A: String(points.A), B: String(points.B) };

  // Con ventajas o punto estrella se puede pasar de 3 sin ganar el game.
  if (points.A >= 3 && points.B >= 3) {
    if (points.A === points.B) return { A: '40', B: '40' };
    return points.A > points.B ? { A: 'AD', B: '40' } : { A: '40', B: 'AD' };
  }
  return { A: POINT_LABELS[points.A]!, B: POINT_LABELS[points.B]! };
};
