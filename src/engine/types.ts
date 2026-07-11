export type PlayerId = string;
export type TeamId = 'A' | 'B';

/** El cuadro desde el que se saca / al que se recibe. */
export type Box = 'derecha' | 'izquierda';

/**
 * La posicion fija de cada jugador dentro de su equipo durante todo el set.
 * El de drive recibe siempre en el cuadro derecho; el de reves, en el izquierdo.
 * De aca se deriva quien resta en cada punto, sin preguntarle nada al usuario.
 */
export type Position = 'drive' | 'reves';

export type GameFormat =
  /** Clasico: hay que sacar 2 puntos de diferencia, sin limite. */
  | 'ventajas'
  /** El primer 40-40 define el game en un solo punto. */
  | 'punto_de_oro'
  /** Maximo 2 ventajas; el tercer 40-40 consecutivo es punto de oro. Lo que usa Premier. */
  | 'punto_estrella';

export type MatchLength = 'un_game' | 'un_set' | 'tres_sets';
export type ThirdSetFormat = 'set_normal' | 'super_tiebreak';
export type ChangeEndsRule = 'games_impares' | 'fin_de_set' | 'nunca';

export type Shot =
  | 'remate'
  | 'remate_por_3'
  | 'remate_por_4'
  | 'bandeja'
  | 'vibora'
  | 'volea_drive'
  | 'volea_reves'
  | 'bajada_de_pared'
  | 'globo'
  | 'derecha'
  | 'reves'
  | 'chiquita'
  | 'resto';

export interface Player {
  id: PlayerId;
  name: string;
}

export interface Team {
  id: TeamId;
  drive: PlayerId;
  reves: PlayerId;
}

/** Para cuando el partido ya empezo y se empieza a cargar tarde. */
export interface InitialScore {
  /** Sets ya terminados, en games. */
  sets: Array<Record<TeamId, number>>;
  /** Games del set en curso. */
  games: Record<TeamId, number>;
}

export interface MatchConfig {
  players: Record<PlayerId, Player>;
  teams: Record<TeamId, Team>;
  /** Orden de saque dentro de cada equipo para el primer set. Se puede cambiar por set. */
  serveOrder: Record<TeamId, [PlayerId, PlayerId]>;
  /** Quien saca el primer game (el que gana el sorteo puede optar por restar). */
  firstServingTeam: TeamId;
  gameFormat: GameFormat;
  length: MatchLength;
  thirdSet: ThirdSetFormat;
  changeEnds: ChangeEndsRule;
  initialScore?: InitialScore;
}

/**
 * Todo lo que puede pasar en un partido. El log es append-only y el estado se deriva
 * de el: por eso el undo es "sacar el ultimo evento y recalcular".
 *
 * Ni LET, ni FALTA, ni ACE llevan jugador: el sacador se deriva. Un evento menos que
 * puede quedar mal cargado.
 */
export type MatchEvent =
  /** Saque a la red. Se repite; no avanza el contador de saques. */
  | { type: 'LET' }
  /** Falta de saque. Primer saque -> segundo. Segundo saque -> doble falta. */
  | { type: 'FALTA' }
  | { type: 'ACE' }
  | { type: 'WINNER'; player: PlayerId; shot?: Shot }
  | { type: 'ERROR_NO_FORZADO'; player: PlayerId; shot?: Shot }
  | { type: 'ERROR_FORZADO'; player: PlayerId; shot?: Shot }
  /** En punto de oro, el equipo que resta elige el cuadro. */
  | { type: 'ELECCION_CUADRO'; box: Box }
  /** Al empezar un set, cada equipo puede reordenar sus sacadores. */
  | { type: 'ORDEN_SAQUE'; team: TeamId; order: [PlayerId, PlayerId] }
  /** Escape hatch. Deja el partido marcado: las estadisticas ya no reconcilian. */
  | { type: 'CORRECCION_MANUAL'; sets: Array<Record<TeamId, number>>; games: Record<TeamId, number> };

/** Con que saque se jugo el punto. Necesario para las estadisticas de saque. */
export type ServeState = 'PRIMERO' | 'SEGUNDO';

export interface CompletedSet {
  games: Record<TeamId, number>;
  tiebreak?: Record<TeamId, number>;
  winner: TeamId;
}

export interface MatchState {
  finished: boolean;
  winner: TeamId | null;

  completedSets: CompletedSet[];
  setsWon: Record<TeamId, number>;

  /** Games del set en curso. */
  games: Record<TeamId, number>;
  /** Puntos crudos (0,1,2,3,4...) del game o tiebreak en curso. El display se deriva. */
  points: Record<TeamId, number>;

  inTiebreak: boolean;
  /** El tercer set jugado integramente como super tiebreak a 10. */
  isSuperTiebreak: boolean;

  serveState: ServeState;
  servingTeam: TeamId;
  server: PlayerId;
  receiver: PlayerId;
  box: Box;

  /** El punto en juego define el game de una sola vez. */
  isGoldenPoint: boolean;
  /** Punto de oro y el equipo que resta todavia no eligio cuadro. */
  awaitingBoxChoice: boolean;

  /** Los equipos intercambiaron lados de la cancha. Solo afecta al display. */
  endsSwapped: boolean;
  manuallyCorrected: boolean;

  /** "0" | "15" | "30" | "40" | "AD", o el numero crudo si es tiebreak. */
  display: Record<TeamId, string>;
}
