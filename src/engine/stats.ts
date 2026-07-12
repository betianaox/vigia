import { reduce, scan } from './engine';
import { gameWinner, otherTeam, teamOfPlayer } from './rules';
import type {
  GameFormat,
  MatchConfig,
  MatchEvent,
  MatchState,
  PlayerId,
  Shot,
  Stroke,
  TeamId,
} from './types';

/**
 * Se cuenta por GOLPE, no por variante: un x3 suma como remate.
 *
 * Es lo que hace que el modo simple y el completo sean comparables — si el x3 fuera su
 * propia clave, "cuantos remates pego" no se podria contestar sin sumar casilleros a mano,
 * y ninguna pantalla lo haria. La variante refina el dato, no lo parte.
 */
export type ShotTally = Partial<Record<Stroke, number>>;

export interface PlayerStats {
  id: PlayerId;
  name: string;
  team: TeamId;

  winners: number;
  forcedErrors: number;
  unforcedErrors: number;

  winnersByShot: ShotTally;
  forcedByShot: ShotTally;
  unforcedByShot: ShotTally;

  aces: number;
  doubleFaults: number;

  /** Puntos que saco (los let no cuentan: se repite el saque). */
  servePointsPlayed: number;
  firstServesIn: number;
  firstServePointsPlayed: number;
  firstServePointsWon: number;
  secondServePointsPlayed: number;
  secondServePointsWon: number;
}

export interface TeamStats {
  team: TeamId;
  pointsWon: number;
  gamesWon: number;

  /** Restando: cuantos break points tuvo y cuantos convirtio. */
  breakPointsPlayed: number;
  breakPointsConverted: number;
  /** Sacando: cuantos break points enfrento y cuantos salvo. */
  breakPointsFaced: number;
  breakPointsSaved: number;

  goldenPointsWon: number;

  // Agregados de los dos jugadores. Los calcula el motor para que la pantalla no sume.
  winners: number;
  forcedErrors: number;
  unforcedErrors: number;
  aces: number;
  doubleFaults: number;
  servePointsPlayed: number;
  firstServesIn: number;
  firstServePointsPlayed: number;
  firstServePointsWon: number;
  secondServePointsPlayed: number;
  secondServePointsWon: number;
}

/** Como le rindio un golpe: cuantos winners dio y cuantos errores costo. */
export interface ShotLine {
  shot: Stroke;
  winners: number;
  forced: number;
  unforced: number;
  total: number;
}

/**
 * El rendimiento de cada golpe, ordenado por uso. Es el desglose que ningun reloj
 * puede dar: para saber que la bandeja generó 4 errores no forzados hace falta que
 * alguien, desde afuera, haya juzgado cada punto.
 */
export const shotLines = (
  p: Pick<PlayerStats, 'winnersByShot' | 'forcedByShot' | 'unforcedByShot'>,
): ShotLine[] => {
  const shots = new Set<Stroke>([
    ...(Object.keys(p.winnersByShot) as Stroke[]),
    ...(Object.keys(p.forcedByShot) as Stroke[]),
    ...(Object.keys(p.unforcedByShot) as Stroke[]),
  ]);
  return [...shots]
    .map((shot) => {
      const winners = p.winnersByShot[shot] ?? 0;
      const forced = p.forcedByShot[shot] ?? 0;
      const unforced = p.unforcedByShot[shot] ?? 0;
      return { shot, winners, forced, unforced, total: winners + forced + unforced };
    })
    .sort((a, b) => b.total - a.total);
};

export interface MatchStats {
  players: Record<PlayerId, PlayerStats>;
  teams: Record<TeamId, TeamStats>;
  totalPoints: number;
  goldenPointsPlayed: number;
}

/** Ratio winners / errores no forzados: la metrica estrella en padel. */
export const winnerErrorRatio = (p: PlayerStats): number | null =>
  p.unforcedErrors === 0 ? (p.winners === 0 ? null : Infinity) : p.winners / p.unforcedErrors;

export const pct = (won: number, played: number): number | null =>
  played === 0 ? null : (won / played) * 100;

/** El golpe suma por su nombre paraguas: la vibora suma como bandeja, el x3 como remate. */
const bump = (t: ShotTally, shot: Shot | undefined): void => {
  if (!shot) return;
  t[shot.stroke] = (t[shot.stroke] ?? 0) + 1;
};

/** Si el equipo gana ESTE punto, ¿se lleva el game? Sirve para detectar break points. */
const wouldWinGame = (st: MatchState, team: TeamId, format: GameFormat): boolean => {
  const points = { ...st.points, [team]: st.points[team] + 1 };
  return gameWinner(points, format) === team;
};

const emptyPlayer = (id: PlayerId, name: string, team: TeamId): PlayerStats => ({
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
  servePointsPlayed: 0,
  firstServesIn: 0,
  firstServePointsPlayed: 0,
  firstServePointsWon: 0,
  secondServePointsPlayed: 0,
  secondServePointsWon: 0,
});

const emptyTeam = (team: TeamId): TeamStats => ({
  team,
  pointsWon: 0,
  gamesWon: 0,
  breakPointsPlayed: 0,
  breakPointsConverted: 0,
  breakPointsFaced: 0,
  breakPointsSaved: 0,
  goldenPointsWon: 0,
  winners: 0,
  forcedErrors: 0,
  unforcedErrors: 0,
  aces: 0,
  doubleFaults: 0,
  servePointsPlayed: 0,
  firstServesIn: 0,
  firstServePointsPlayed: 0,
  firstServePointsWon: 0,
  secondServePointsPlayed: 0,
  secondServePointsWon: 0,
});

/** Los agregados del equipo son la suma de sus dos jugadores. */
const AGGREGATED = [
  'winners',
  'forcedErrors',
  'unforcedErrors',
  'aces',
  'doubleFaults',
  'servePointsPlayed',
  'firstServesIn',
  'firstServePointsPlayed',
  'firstServePointsWon',
  'secondServePointsPlayed',
  'secondServePointsWon',
] as const;

/**
 * Funcion pura sobre el mismo log de eventos que alimenta al motor. Por eso deshacer
 * un punto tambien deshace su efecto en las estadisticas, sin ningun trabajo extra.
 */
export const computeStats = (config: MatchConfig, events: MatchEvent[]): MatchStats => {
  const states = scan(config, events);

  const players: Record<PlayerId, PlayerStats> = {};
  for (const t of ['A', 'B'] as TeamId[]) {
    for (const id of [config.teams[t].drive, config.teams[t].reves]) {
      players[id] = emptyPlayer(id, config.players[id]!.name, t);
    }
  }
  const teams: Record<TeamId, TeamStats> = { A: emptyTeam('A'), B: emptyTeam('B') };

  let totalPoints = 0;
  let goldenPointsPlayed = 0;
  /** Se arrastra dentro del punto en curso: el unico evento que no lo cierra. */
  let firstServeFailed = false;

  events.forEach((e, i) => {
    const st = states[i]!;
    if (st.finished) return;

    const server = st.server;
    const servingTeam = st.servingTeam;
    const receivingTeam = otherTeam(servingTeam);

    // El let repite el saque: no avanza nada, ni siquiera el contador de saques.
    if (e.type === 'LET') return;

    if (e.type === 'FALTA' && st.serveState === 'PRIMERO') {
      firstServeFailed = true;
      return;
    }

    let pointTo: TeamId;

    switch (e.type) {
      case 'FALTA': // en segundo saque: doble falta
        players[server]!.doubleFaults += 1;
        pointTo = receivingTeam;
        break;
      case 'ACE':
        players[server]!.aces += 1;
        pointTo = servingTeam;
        break;
      case 'WINNER': {
        const p = players[e.player]!;
        p.winners += 1;
        bump(p.winnersByShot, e.shot);
        pointTo = teamOfPlayer(e.player, config.teams);
        break;
      }
      case 'ERROR_FORZADO': {
        const p = players[e.player]!;
        p.forcedErrors += 1;
        bump(p.forcedByShot, e.shot);
        pointTo = otherTeam(teamOfPlayer(e.player, config.teams));
        break;
      }
      case 'ERROR_NO_FORZADO': {
        const p = players[e.player]!;
        p.unforcedErrors += 1;
        bump(p.unforcedByShot, e.shot);
        pointTo = otherTeam(teamOfPlayer(e.player, config.teams));
        break;
      }
      default:
        return; // ELECCION_CUADRO, ORDEN_SAQUE, CORRECCION_MANUAL: no son puntos
    }

    // A partir de aca el punto esta cerrado.
    totalPoints += 1;
    teams[pointTo].pointsWon += 1;

    const sp = players[server]!;
    sp.servePointsPlayed += 1;
    if (firstServeFailed) {
      sp.secondServePointsPlayed += 1;
      if (pointTo === servingTeam) sp.secondServePointsWon += 1;
    } else {
      sp.firstServesIn += 1;
      sp.firstServePointsPlayed += 1;
      if (pointTo === servingTeam) sp.firstServePointsWon += 1;
    }

    // Break point: el que resta esta a un punto de llevarse el game.
    // En el tiebreak no hay breaks (a lo sumo mini-breaks, que no contamos).
    if (!st.inTiebreak && wouldWinGame(st, receivingTeam, config.gameFormat)) {
      teams[receivingTeam].breakPointsPlayed += 1;
      teams[servingTeam].breakPointsFaced += 1;
      if (pointTo === receivingTeam) teams[receivingTeam].breakPointsConverted += 1;
      else teams[servingTeam].breakPointsSaved += 1;
    }

    if (st.isGoldenPoint) {
      goldenPointsPlayed += 1;
      teams[pointTo].goldenPointsWon += 1;
    }

    firstServeFailed = false;
  });

  const final = reduce(config, events);
  for (const t of ['A', 'B'] as TeamId[]) {
    teams[t].gamesWon =
      final.completedSets.reduce((n, s) => n + s.games[t], 0) + final.games[t];

    for (const id of [config.teams[t].drive, config.teams[t].reves]) {
      for (const k of AGGREGATED) teams[t][k] += players[id]![k];
    }
  }

  return { players, teams, totalPoints, goldenPointsPlayed };
};

/** Suma los golpes de los dos jugadores de un equipo. */
export const teamShotLines = (
  stats: MatchStats,
  config: MatchConfig,
  team: TeamId,
): ShotLine[] => {
  const merge = (key: 'winnersByShot' | 'forcedByShot' | 'unforcedByShot'): ShotTally => {
    const out: ShotTally = {};
    for (const id of [config.teams[team].drive, config.teams[team].reves]) {
      for (const [shot, n] of Object.entries(stats.players[id]![key]) as Array<[Stroke, number]>) {
        out[shot] = (out[shot] ?? 0) + n;
      }
    }
    return out;
  };
  return shotLines({
    winnersByShot: merge('winnersByShot'),
    forcedByShot: merge('forcedByShot'),
    unforcedByShot: merge('unforcedByShot'),
  });
};
