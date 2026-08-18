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

  /**
   * El desglose por golpe existe donde el golpe SE CARGA: el winner, el error no forzado, y el
   * error forzado del lado de quien lo sufre son actos propios y la hoja pregunta con que se
   * hicieron.
   *
   * EL ERROR FORZADO SE SUMA ACA MISMO, en `unforcedByShot`, no en un desglose propio: para
   * quien lo sufre, "con que erro" es el mismo dato haya sido forzado o no — lo unico que
   * cambia es de quien es la culpa del punto, y eso ya lo cuenta `forcedErrors` aparte. Lo que
   * hizo el que FUERZA, en cambio, esta en `forcedErrorsCausedByShot`, en SU ficha.
   */
  winnersByShot: ShotTally;
  unforcedByShot: ShotTally;

  aces: number;
  doubleFaults: number;

  /**
   * Los duelos del saque: contra QUIEN paso cada cosa.
   *
   * El ace es algo que le hacés a alguien — dice que el que restaba no llego. Y la doble
   * falta tambien tiene al restador adentro: uno arriesga mas de lo que puede sostener
   * justamente por miedo al resto del que tiene enfrente, y ahi nace la mayoria de las
   * dobles. Que el sacador falle no quiere decir que el otro no tenga nada que ver.
   *
   * Sin esto, "5 dobles faltas" es un numero muerto. Con esto, es "4 de las 5 sacandole a
   * Beto", que ya es una instruccion.
   */
  acesAgainst: Partial<Record<PlayerId, number>>;
  doubleFaultsAgainst: Partial<Record<PlayerId, number>>;
  /**
   * El mismo duelo, para el error forzado: a quien se lo forzaste. Vive del lado del que
   * FUERZA, igual que el ace vive del lado del que saca — es lo que HIZO, no lo que le
   * pasa al otro.
   */
  forcedErrorsCaused: Partial<Record<PlayerId, number>>;
  /** Con que golpe forzaste esos errores. Es el dato que se pidio marcar primero en la hoja. */
  forcedErrorsCausedByShot: ShotTally;
  /**
   * LOS DOS DUELOS CRUZADOS: a quien, y con que golpe se lo forzaste a ESA persona.
   *
   * Los dos de arriba son sumas por separado, y por separado no alcanzan: dicen "5 a Beto" y
   * "3 de remate", pero no si esos remates fueron a Beto o a Bea. Nada en ellos permite
   * reconstruirlo, aunque el log lo sepa — cada evento de error forzado trae junto quien
   * erro, quien forzo y con que.
   *
   * Con el cruce, la ficha puede mostrar una tabla en vez de dos listas sueltas: una fila por
   * rival, una columna por golpe. "Le ganaste tres veces con el remate a Beto" es una
   * instruccion; "3 remates" y "5 a Beto" en renglones distintos, no.
   *
   * Se guarda ademas de los otros dos y no en su lugar: `forcedErrorsCaused` es el total por
   * rival —incluidos los puntos donde no se cargo el golpe— y esa suma no se puede recuperar
   * desde aca.
   */
  forcedErrorsCausedDetail: Partial<Record<PlayerId, ShotTally>>;

  /** Restando: los aces que le hicieron, y las dobles faltas que provoco. */
  acesConceded: number;
  doubleFaultsForced: number;

  /** Puntos que saco (los let no cuentan: se repite el saque). */
  servePointsPlayed: number;
  /**
   * Primeros saques que entraron. Es tambien el denominador de "gana con 1er saque": no son
   * dos numeros, es uno — de los puntos en que el primero entro, cuantos gano.
   */
  firstServesIn: number;
  firstServePointsWon: number;
  secondServePointsPlayed: number;
  secondServePointsWon: number;

  /** Restando: cuantos puntos jugo de resto y cuantos gano. */
  returnPointsPlayed: number;
  returnPointsWon: number;

  /**
   * Fallas devolviendo el saque, forzada y no forzada. Suman aparte de `forcedErrors` y
   * `unforcedErrors` — no son un tercer contador, son EL MISMO, marcado con donde paso (ver
   * `onReturn` en `MatchEvent`). El porcentaje sobre `returnPointsPlayed` es "falla de
   * recepcion", y solo existe si alguien uso el boton dedicado: nadie lo infiere solo.
   */
  returnErrorsForced: number;
  returnErrorsUnforced: number;

  /**
   * EL BREAK NO TIENE DUEÑO, Y POR ESO NO ESTA ACA.
   *
   * Se penso contarlo por persona —quien saca esta identificado, asi que "a quien le quebraron"
   * parecia un dato mas. No lo es. El game se pierde de a cuatro: el punto que cierra el quiebre
   * lo puede haber regalado el companero con un error no forzado, y la app estaria diciendo "le
   * quebraron a Ana" sobre un game que Ana no perdio. Del otro lado es igual: el break point que
   * "gana" el que resta lo puede haber definido su companero.
   *
   * Al equipo se lo quiebran y el equipo quiebra. El break vive en `TeamStats` y ahi se queda.
   */
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
  acesConceded: number;
  doubleFaultsForced: number;
  servePointsPlayed: number;
  firstServesIn: number;
  firstServePointsWon: number;
  secondServePointsPlayed: number;
  secondServePointsWon: number;
  returnPointsPlayed: number;
  returnPointsWon: number;
  returnErrorsForced: number;
  returnErrorsUnforced: number;
}

/**
 * Como le rindio un golpe: cuantos winners dio y cuantos errores costo.
 *
 * `unforced` MEZCLA LOS DOS TIPOS DE ERROR, a proposito: para quien pega el golpe, fallar una
 * bandeja es fallar una bandeja, la hayan forzado o no — lo que cambia es de quien es la culpa
 * del punto (`forcedErrors` vs `unforcedErrors`), no con que se erro. SIN COLUMNA APARTE DE
 * FORZADOS: esa pregunta ("con que golpe FORZASTE vos un error ajeno") es otro dato, y vive en
 * `forcedErrorsCausedByShot`, en la ficha del que fuerza.
 */
export interface ShotLine {
  shot: Stroke;
  winners: number;
  unforced: number;
  total: number;
}

/**
 * El rendimiento de cada golpe, ordenado por uso. Es el desglose que ningun reloj
 * puede dar: para saber que la bandeja generó 4 errores no forzados hace falta que
 * alguien, desde afuera, haya juzgado cada punto.
 */
export const shotLines = (
  p: Pick<PlayerStats, 'winnersByShot' | 'unforcedByShot'>,
): ShotLine[] => {
  const shots = new Set<Stroke>([
    ...(Object.keys(p.winnersByShot) as Stroke[]),
    ...(Object.keys(p.unforcedByShot) as Stroke[]),
  ]);
  return [...shots]
    .map((shot) => {
      const winners = p.winnersByShot[shot] ?? 0;
      const unforced = p.unforcedByShot[shot] ?? 0;
      return { shot, winners, unforced, total: winners + unforced };
    })
    .sort((a, b) => b.total - a.total);
};

export interface MatchStats {
  players: Record<PlayerId, PlayerStats>;
  teams: Record<TeamId, TeamStats>;
  totalPoints: number;
  goldenPointsPlayed: number;
  /**
   * Si alguien cargo el golpe de al menos un punto.
   *
   * El golpe es OPCIONAL: se anota con el toque largo, y en la mitad de los partidos nadie va
   * a tener tiempo. Sin esto, la pantalla dibujaria una seccion de golpes llena de ceros —y
   * una tabla de ceros no dice "no lo anotaste", dice "no pegaste ninguno". Si no hay datos,
   * la seccion no existe.
   */
  hasShotData: boolean;
}

/** Ratio winners / errores no forzados: la metrica estrella en padel. */
export const winnerErrorRatio = (p: PlayerStats): number | null =>
  p.unforcedErrors === 0 ? (p.winners === 0 ? null : Infinity) : p.winners / p.unforcedErrors;

export const pct = (won: number, played: number): number | null =>
  played === 0 ? null : (won / played) * 100;

/**
 * El total de un duelo: la suma de lo que se le hizo a cada rival.
 *
 * Vive en el motor y no en una pantalla porque lo usan las dos —la ficha del partido y el
 * acumulado— y tienen que dar el mismo numero. Dos copias de la misma cuenta es como empiezan
 * a diferir.
 */
export const totalDuels = (against: Partial<Record<PlayerId, number>>): number =>
  Object.values(against).reduce<number>((acc, n) => acc + (n ?? 0), 0);

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

  unforcedByShot: {},
  aces: 0,
  doubleFaults: 0,
  acesAgainst: {},
  doubleFaultsAgainst: {},
  forcedErrorsCaused: {},
  forcedErrorsCausedByShot: {},
  forcedErrorsCausedDetail: {},
  acesConceded: 0,
  doubleFaultsForced: 0,
  servePointsPlayed: 0,
  firstServesIn: 0,
  firstServePointsWon: 0,
  secondServePointsPlayed: 0,
  secondServePointsWon: 0,
  returnPointsPlayed: 0,
  returnPointsWon: 0,
  returnErrorsForced: 0,
  returnErrorsUnforced: 0,
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
  acesConceded: 0,
  doubleFaultsForced: 0,
  servePointsPlayed: 0,
  firstServesIn: 0,
  firstServePointsWon: 0,
  secondServePointsPlayed: 0,
  secondServePointsWon: 0,
  returnPointsPlayed: 0,
  returnPointsWon: 0,
  returnErrorsForced: 0,
  returnErrorsUnforced: 0,
});

/** Los agregados del equipo son la suma de sus dos jugadores. */
const AGGREGATED = [
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
  'returnErrorsForced',
  'returnErrorsUnforced',
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
    /** Quien esperaba el saque. Sale del cuadro y de como esta parada la pareja que resta. */
    const receiver = st.receiver;

    // El let repite el saque: no avanza nada, ni siquiera el contador de saques.
    if (e.type === 'LET') return;

    if (e.type === 'FALTA' && st.serveState === 'PRIMERO') {
      firstServeFailed = true;
      return;
    }

    let pointTo: TeamId;

    switch (e.type) {
      case 'FALTA': {
        // En segundo saque: doble falta. El restador no la pego, pero estaba adentro — se
        // arriesga de mas por miedo al resto del que esta enfrente. Se anota de los dos lados.
        const sv = players[server]!;
        sv.doubleFaults += 1;
        sv.doubleFaultsAgainst[receiver] = (sv.doubleFaultsAgainst[receiver] ?? 0) + 1;
        players[receiver]!.doubleFaultsForced += 1;
        pointTo = receivingTeam;
        break;
      }
      case 'ACE': {
        const sv = players[server]!;
        sv.aces += 1;
        sv.acesAgainst[receiver] = (sv.acesAgainst[receiver] ?? 0) + 1;
        players[receiver]!.acesConceded += 1;
        pointTo = servingTeam;
        break;
      }
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
        // Con que erro, en el mismo desglose que un error no forzado (ver el comentario en
        // `PlayerStats`): para quien lo sufre es el mismo dato de siempre.
        bump(p.unforcedByShot, e.shot);
        if (e.onReturn) p.returnErrorsForced += 1;
        // El otro lado del duelo: quien lo forzo, y con que. Vive en SU ficha, no en la de
        // quien erro — es lo que el hizo, igual que un ace vive en la ficha de quien saco.
        if (e.forcedBy) {
          const forcer = players[e.forcedBy]!;
          forcer.forcedErrorsCaused[e.player] = (forcer.forcedErrorsCaused[e.player] ?? 0) + 1;
          bump(forcer.forcedErrorsCausedByShot, e.forcedByShot);

          /* Y EL CRUCE: a esta persona, con este golpe. Solo cuando el golpe esta cargado —
             sin el no hay celda que llenar, y un total sin golpe ya lo cuenta la linea de
             arriba. */
          if (e.forcedByShot) {
            const suyo = (forcer.forcedErrorsCausedDetail[e.player] ??= {});
            bump(suyo, e.forcedByShot);
          }
        }
        pointTo = otherTeam(teamOfPlayer(e.player, config.teams));
        break;
      }
      case 'ERROR_NO_FORZADO': {
        const p = players[e.player]!;
        p.unforcedErrors += 1;
        bump(p.unforcedByShot, e.shot);
        if (e.onReturn) p.returnErrorsUnforced += 1;
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
      // `firstServesIn` es tambien el denominador de "gana con 1er saque": de los puntos en
      // que el primero entro, cuantos gano. Un solo numero, no dos.
      sp.firstServesIn += 1;
      if (pointTo === servingTeam) sp.firstServePointsWon += 1;
    }

    const rp = players[receiver]!;
    rp.returnPointsPlayed += 1;
    if (pointTo === receivingTeam) rp.returnPointsWon += 1;

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

  // Alcanza con UN golpe cargado en todo el partido para que la seccion tenga algo que decir.
  const hasShotData = events.some((e) => 'shot' in e && e.shot !== undefined);

  return { players, teams, totalPoints, goldenPointsPlayed, hasShotData };
};


