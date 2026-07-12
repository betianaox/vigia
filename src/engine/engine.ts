import {
  boxForPoint,
  displayScore,
  gameWinner,
  isGoldenPoint,
  otherTeam,
  receiverForBox,
  serverForGame,
  serverForTiebreakPoint,
  servingTeamForGame,
  setWinner,
  shouldStartTiebreak,
  teamOfPlayer,
  tiebreakWinner,
} from './rules';
import type {
  Box,
  CompletedSet,
  MatchConfig,
  MatchEvent,
  MatchState,
  PlayerId,
  ServeState,
  TeamId,
} from './types';

interface Internal {
  completedSets: CompletedSet[];
  setsWon: Record<TeamId, number>;
  games: Record<TeamId, number>;
  points: Record<TeamId, number>;
  firstServingTeamOfSet: TeamId;
  serveOrder: Record<TeamId, [PlayerId, PlayerId]>;
  inTiebreak: boolean;
  isSuperTiebreak: boolean;
  serveState: ServeState;
  chosenBox: Box | null;
  endsSwapped: boolean;
  finished: boolean;
  winner: TeamId | null;
  manuallyCorrected: boolean;
}

const zero = (): Record<TeamId, number> => ({ A: 0, B: 0 });

/** El tercer set de un partido a 3 se juega integramente como super tiebreak a 10. */
const setIsSuperTiebreak = (config: MatchConfig, setsWon: Record<TeamId, number>): boolean =>
  config.length === 'tres_sets' &&
  config.thirdSet === 'super_tiebreak' &&
  setsWon.A === 1 &&
  setsWon.B === 1;

const init = (config: MatchConfig): Internal => {
  const completedSets: CompletedSet[] = (config.initialScore?.sets ?? []).map((games) => ({
    games: { ...games },
    winner: games.A > games.B ? 'A' : 'B',
  }));
  const setsWon = completedSets.reduce(
    (acc, s) => ({ ...acc, [s.winner]: acc[s.winner] + 1 }),
    zero(),
  );
  const games = { ...(config.initialScore?.games ?? zero()) };
  const isSuper = setIsSuperTiebreak(config, setsWon);

  return {
    completedSets,
    setsWon,
    games,
    points: zero(),
    firstServingTeamOfSet: config.firstServingTeam,
    serveOrder: { A: [...config.serveOrder.A], B: [...config.serveOrder.B] },
    inTiebreak: isSuper || shouldStartTiebreak(games),
    isSuperTiebreak: isSuper,
    serveState: 'PRIMERO',
    chosenBox: null,
    endsSwapped: false,
    finished: false,
    winner: null,
    manuallyCorrected: false,
  };
};

const swapEnds = (s: Internal, when: 'game' | 'set', config: MatchConfig): void => {
  if (config.changeEnds === 'nunca') return;
  if (config.changeEnds === 'fin_de_set' && when === 'set') s.endsSwapped = !s.endsSwapped;
  // Regla oficial: se cambia al terminar cada game impar del set. Cuando el set cierra
  // con un total impar de games, ese mismo cambio es el de fin de set.
  if (config.changeEnds === 'games_impares' && when === 'game') {
    if ((s.games.A + s.games.B) % 2 === 1) s.endsSwapped = !s.endsSwapped;
  }
};

const endSet = (s: Internal, config: MatchConfig, winner: TeamId, tiebreak?: Record<TeamId, number>): void => {
  const totalGames = s.games.A + s.games.B;
  const prevFirst = s.firstServingTeamOfSet;

  s.completedSets.push({
    games: { ...s.games },
    ...(tiebreak ? { tiebreak: { ...tiebreak } } : {}),
    winner,
  });
  s.setsWon[winner] += 1;
  swapEnds(s, 'set', config);

  const matchOver =
    config.length === 'un_set' ||
    (config.length === 'tres_sets' && s.setsWon[winner] === 2);

  if (matchOver) {
    s.finished = true;
    s.winner = winner;
    return;
  }

  // La rotacion de saque continua: saca primero el equipo que NO saco el ultimo game.
  const lastServingTeam = servingTeamForGame(totalGames - 1, prevFirst);
  s.firstServingTeamOfSet = otherTeam(lastServingTeam);

  s.games = zero();
  s.points = zero();
  s.isSuperTiebreak = setIsSuperTiebreak(config, s.setsWon);
  s.inTiebreak = s.isSuperTiebreak;
};

const awardPoint = (s: Internal, config: MatchConfig, team: TeamId): void => {
  s.points[team] += 1;
  s.serveState = 'PRIMERO';
  s.chosenBox = null;

  if (s.inTiebreak) {
    const total = s.points.A + s.points.B;
    if (config.changeEnds === 'games_impares' && total > 0 && total % 6 === 0) {
      s.endsSwapped = !s.endsSwapped;
    }

    const w = tiebreakWinner(s.points, s.isSuperTiebreak);
    if (!w) return;

    const tb = { ...s.points };
    if (s.isSuperTiebreak) {
      // El super tiebreak ES el set. Se anota 1-0 en games y el tanteo real va aparte.
      s.games = { A: w === 'A' ? 1 : 0, B: w === 'B' ? 1 : 0 };
    } else {
      s.games[w] += 1; // 7-6
    }
    endSet(s, config, w, tb);
    return;
  }

  const w = gameWinner(s.points, config.gameFormat);
  if (!w) return;

  s.games[w] += 1;
  s.points = zero();
  swapEnds(s, 'game', config);

  if (config.length === 'un_game') {
    s.finished = true;
    s.winner = w;
    return;
  }

  const sw = setWinner(s.games);
  if (sw) {
    endSet(s, config, sw);
    return;
  }
  if (shouldStartTiebreak(s.games)) s.inTiebreak = true;
};

const apply = (s: Internal, config: MatchConfig, e: MatchEvent): void => {
  if (s.finished) return;

  switch (e.type) {
    case 'ORDEN_SAQUE':
      s.serveOrder = { ...s.serveOrder, [e.team]: [...e.order] };
      return;

    case 'ELECCION_CUADRO':
      s.chosenBox = e.box;
      return;

    case 'CORRECCION_MANUAL':
      s.completedSets = e.sets.map((games) => ({
        games: { ...games },
        winner: games.A > games.B ? 'A' : 'B',
      }));
      s.setsWon = s.completedSets.reduce(
        (acc, cs) => ({ ...acc, [cs.winner]: acc[cs.winner] + 1 }),
        zero(),
      );
      s.games = { ...e.games };
      s.points = zero();
      s.serveState = 'PRIMERO';
      s.inTiebreak = shouldStartTiebreak(s.games);
      s.manuallyCorrected = true;
      return;

    case 'LET':
      // Se repite el saque: no avanza el contador ni pasa nada mas.
      return;

    case 'FALTA':
      if (s.serveState === 'PRIMERO') {
        s.serveState = 'SEGUNDO';
        return;
      }
      // Doble falta: no es un boton, es una consecuencia.
      awardPoint(s, config, otherTeam(currentServingTeam(s, config)));
      return;

    case 'ACE':
      awardPoint(s, config, currentServingTeam(s, config));
      return;

    case 'WINNER':
      awardPoint(s, config, teamOfPlayer(e.player, config.teams));
      return;

    case 'ERROR_NO_FORZADO':
    case 'ERROR_FORZADO':
      awardPoint(s, config, otherTeam(teamOfPlayer(e.player, config.teams)));
      return;
  }
};

const currentServer = (s: Internal): PlayerId => {
  const gameIndex = s.games.A + s.games.B;
  if (s.inTiebreak) {
    const pointIndex = s.points.A + s.points.B;
    // En el super tiebreak el "set" arranca en 0-0, asi que el game index es 0.
    const tbGameIndex = s.isSuperTiebreak ? 0 : gameIndex;
    return serverForTiebreakPoint(pointIndex, tbGameIndex, s.firstServingTeamOfSet, s.serveOrder);
  }
  return serverForGame(gameIndex, s.firstServingTeamOfSet, s.serveOrder);
};

const currentServingTeam = (s: Internal, config: MatchConfig): TeamId =>
  teamOfPlayer(currentServer(s), config.teams);

const present = (s: Internal, config: MatchConfig): MatchState => {
  const server = currentServer(s);
  const servingTeam = teamOfPlayer(server, config.teams);
  const golden = !s.inTiebreak && isGoldenPoint(s.points, config.gameFormat);
  const box: Box = golden && s.chosenBox ? s.chosenBox : boxForPoint(s.points.A + s.points.B);

  return {
    finished: s.finished,
    winner: s.winner,
    completedSets: s.completedSets.map((cs) => ({ ...cs })),
    setsWon: { ...s.setsWon },
    games: { ...s.games },
    points: { ...s.points },
    inTiebreak: s.inTiebreak,
    isSuperTiebreak: s.isSuperTiebreak,
    serveState: s.serveState,
    servingTeam,
    server,
    receiver: receiverForBox(box, otherTeam(servingTeam), config.teams),
    box,
    isGoldenPoint: golden,
    awaitingBoxChoice: golden && s.chosenBox === null,
    endsSwapped: s.endsSwapped,
    manuallyCorrected: s.manuallyCorrected,
    display: displayScore(s.points, s.inTiebreak),
  };
};

/**
 * El estado se deriva del log completo. Es el corazon del event sourcing:
 * el undo es `reduce(config, events.slice(0, -1))` y las estadisticas son otra
 * funcion pura sobre la misma lista.
 */
export const reduce = (config: MatchConfig, events: MatchEvent[]): MatchState => {
  const s = init(config);
  for (const e of events) apply(s, config, e);
  return present(s, config);
};

/**
 * El estado JUSTO ANTES de cada evento (mismo largo que `events`).
 *
 * Es lo que necesitan las estadisticas: para saber si un punto se jugo con primer o
 * segundo saque, quien sacaba, si era break point o punto de oro, hay que mirar como
 * estaba el partido antes de que el evento ocurriera.
 */
export const scan = (config: MatchConfig, events: MatchEvent[]): MatchState[] => {
  const s = init(config);
  const out: MatchState[] = [];
  for (const e of events) {
    out.push(present(s, config));
    apply(s, config, e);
  }
  return out;
};

export const undo = (events: MatchEvent[]): MatchEvent[] => events.slice(0, -1);
