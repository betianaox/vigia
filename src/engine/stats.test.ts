import { describe, expect, it } from 'vitest';
import { computeStats, shotLines, winnerErrorRatio, pct } from './stats';
import type { MatchConfig, MatchEvent, TeamId } from './types';

const baseConfig = (over: Partial<MatchConfig> = {}): MatchConfig => ({
  players: {
    a1: { id: 'a1', name: 'Ana' },
    a2: { id: 'a2', name: 'Aldo' },
    b1: { id: 'b1', name: 'Bea' },
    b2: { id: 'b2', name: 'Beto' },
  },
  teams: {
    A: { id: 'A', drive: 'a1', reves: 'a2' },
    B: { id: 'B', drive: 'b1', reves: 'b2' },
  },
  serveOrder: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  firstServingTeam: 'A',
  gameFormat: 'ventajas',
  length: 'tres_sets',
  thirdSet: 'set_normal',
  changeEnds: 'nunca',
  ...over,
});

const point = (t: TeamId): MatchEvent => ({ type: 'WINNER', player: t === 'A' ? 'a1' : 'b1' });
const points = (t: TeamId, n: number) => Array.from({ length: n }, () => point(t));
const game = (t: TeamId) => points(t, 4);

describe('atribucion de acciones', () => {
  const c = baseConfig();

  it('cuenta winners, errores forzados y no forzados por jugador', () => {
    const s = computeStats(c, [
      { type: 'WINNER', player: 'a2' },
      { type: 'ERROR_NO_FORZADO', player: 'b1' },
      { type: 'ERROR_FORZADO', player: 'b2' },
      { type: 'WINNER', player: 'a2' },
    ]);
    expect(s.players.a2!.winners).toBe(2);
    expect(s.players.b1!.unforcedErrors).toBe(1);
    expect(s.players.b2!.forcedErrors).toBe(1);
    // Los 4 puntos fueron para A (2 winners suyos + 2 errores de B).
    expect(s.teams.A.pointsWon).toBe(4);
    expect(s.teams.B.pointsWon).toBe(0);
  });

  it('desglosa por tipo de golpe', () => {
    const s = computeStats(c, [
      { type: 'WINNER', player: 'a1', shot: { stroke: 'bandeja' } },
      { type: 'WINNER', player: 'a1', shot: { stroke: 'volea', side: 'drive' } },
      { type: 'ERROR_NO_FORZADO', player: 'a1', shot: { stroke: 'bandeja' } },
    ]);
    expect(s.players.a1!.winnersByShot).toEqual({ bandeja: 1, volea: 1 });
    expect(s.players.a1!.unforcedByShot).toEqual({ bandeja: 1 });
  });

  /**
   * La razon de ser del modelo: la variante REFINA el golpe, no lo parte en otra clave. Si
   * la vibora se contara aparte, "cuantas bandejas pego" no se podria contestar sin sumar
   * casilleros a mano — y el modo simple y el completo dejarian de ser comparables.
   */
  it('la vibora y el rulo cuentan aparte de la bandeja: son golpes, no variantes', () => {
    const s = computeStats(c, [
      { type: 'WINNER', player: 'a1', shot: { stroke: 'bandeja' } },
      { type: 'WINNER', player: 'a1', shot: { stroke: 'vibora' } },
      { type: 'WINNER', player: 'a1', shot: { stroke: 'rulo' } },
      { type: 'WINNER', player: 'a1', shot: { stroke: 'remate' } },
      { type: 'WINNER', player: 'a1', shot: { stroke: 'remate' } },
    ]);
    expect(s.players.a1!.winnersByShot).toEqual({ bandeja: 1, vibora: 1, rulo: 1, remate: 2 });
  });

  /** El mismo golpe de los dos lados sigue siendo el mismo golpe. */
  it('el lado no parte el golpe: una volea de drive y una de reves son dos voleas', () => {
    const s = computeStats(c, [
      { type: 'WINNER', player: 'a1', shot: { stroke: 'volea', side: 'drive' } },
      { type: 'WINNER', player: 'a1', shot: { stroke: 'volea', side: 'reves' } },
    ]);
    expect(s.players.a1!.winnersByShot).toEqual({ volea: 2 });
  });

  it('un punto sin tipo de golpe cuenta igual, solo que sin desglose', () => {
    const s = computeStats(c, [{ type: 'WINNER', player: 'a1' }]);
    expect(s.players.a1!.winners).toBe(1);
    expect(s.players.a1!.winnersByShot).toEqual({});
  });
});

describe('si hay golpes cargados', () => {
  const c = baseConfig();

  it('sin ningun golpe anotado, no hay datos de golpes', () => {
    const s = computeStats(c, [point('A'), point('B'), { type: 'ACE' }]);
    expect(s.hasShotData).toBe(false);
  });

  it('alcanza con uno solo en todo el partido', () => {
    const s = computeStats(c, [
      point('A'),
      { type: 'WINNER', player: 'a2', shot: { stroke: 'volea', side: 'drive' } },
    ]);
    expect(s.hasShotData).toBe(true);
  });
});

describe('estadisticas de saque', () => {
  const c = baseConfig();

  it('si no se toca nada, el punto se jugo con primer saque', () => {
    const s = computeStats(c, [point('A')]);
    const a1 = s.players.a1!; // saca a1
    expect(a1.servePointsPlayed).toBe(1);
    expect(a1.firstServesIn).toBe(1);
    expect(a1.firstServePointsWon).toBe(1);
    expect(a1.secondServePointsPlayed).toBe(0);
  });

  it('una falta hace que el punto sea de segundo saque', () => {
    const s = computeStats(c, [{ type: 'FALTA' }, point('A')]);
    const a1 = s.players.a1!;
    expect(a1.firstServesIn).toBe(0);
    expect(a1.secondServePointsPlayed).toBe(1);
    expect(a1.secondServePointsWon).toBe(1);
  });

  it('el punto de segundo saque perdido no suma a los ganados', () => {
    const s = computeStats(c, [{ type: 'FALTA' }, point('B')]);
    const a1 = s.players.a1!;
    expect(a1.secondServePointsPlayed).toBe(1);
    expect(a1.secondServePointsWon).toBe(0);
  });

  it('la doble falta es un punto: cuenta en el total', () => {
    // Parece obvio y no lo era: el resumen del historial contaba "winner, error o ace" y se
    // olvidaba de la doble falta, asi que mostraba un punto de menos por cada una.
    const s = computeStats(c, [{ type: 'FALTA' }, { type: 'FALTA' }]);
    expect(s.totalPoints).toBe(1);
  });

  it('la doble falta se le cuenta al sacador y el punto va al rival', () => {
    const s = computeStats(c, [{ type: 'FALTA' }, { type: 'FALTA' }]);
    expect(s.players.a1!.doubleFaults).toBe(1);
    expect(s.players.a1!.secondServePointsPlayed).toBe(1);
    expect(s.players.a1!.secondServePointsWon).toBe(0);
    expect(s.teams.B.pointsWon).toBe(1);
  });

  it('el ace suma al sacador y se registra con que saque fue', () => {
    const primero = computeStats(c, [{ type: 'ACE' }]);
    expect(primero.players.a1!.aces).toBe(1);
    expect(primero.players.a1!.firstServePointsWon).toBe(1);

    const segundo = computeStats(c, [{ type: 'FALTA' }, { type: 'ACE' }]);
    expect(segundo.players.a1!.aces).toBe(1);
    expect(segundo.players.a1!.secondServePointsWon).toBe(1);
    expect(segundo.players.a1!.firstServePointsWon).toBe(0);
  });

  it('el ace se registra CONTRA quien restaba, de los dos lados', () => {
    // Saca a1. El cuadro alterna: el primer punto se saca al de la derecha, el segundo al
    // de la izquierda. Asi que los dos aces no le caen a la misma persona.
    const s = computeStats(c, [{ type: 'ACE' }, { type: 'ACE' }]);
    const a1 = s.players.a1!;

    expect(a1.aces).toBe(2);
    // La suma de los duelos tiene que dar el total: si no, alguien se pierde por el camino.
    const total = Object.values(a1.acesAgainst).reduce<number>((n, x) => n + (x ?? 0), 0);
    expect(total).toBe(2);

    // Uno a cada restador, y cada uno se lo anota como recibido.
    expect(a1.acesAgainst.b1).toBe(1);
    expect(a1.acesAgainst.b2).toBe(1);
    expect(s.players.b1!.acesConceded).toBe(1);
    expect(s.players.b2!.acesConceded).toBe(1);
  });

  /**
   * La doble falta la comete el que saca, pero el que resta esta adentro: se arriesga de mas
   * por miedo al resto del que tiene enfrente. Por eso se guarda contra quien fue.
   */
  it('la doble falta se registra contra quien esperaba el saque', () => {
    const s = computeStats(c, [{ type: 'FALTA' }, { type: 'FALTA' }]);
    const a1 = s.players.a1!;

    expect(a1.doubleFaults).toBe(1);
    expect(a1.doubleFaultsAgainst.b1).toBe(1);
    expect(s.players.b1!.doubleFaultsForced).toBe(1);
    // El companero del que restaba no tiene nada que ver con esta.
    expect(s.players.b2!.doubleFaultsForced).toBe(0);
  });

  it('los puntos de resto se le cuentan al que restaba', () => {
    // a1 saca a b1 y pierde el punto; despues saca a b2 y lo gana.
    const s = computeStats(c, [point('B'), point('A')]);
    expect(s.players.b1!.returnPointsPlayed).toBe(1);
    expect(s.players.b1!.returnPointsWon).toBe(1);
    expect(s.players.b2!.returnPointsPlayed).toBe(1);
    expect(s.players.b2!.returnPointsWon).toBe(0);
  });

  it('el let no ensucia nada: no avanza el saque ni cuenta como punto', () => {
    const s = computeStats(c, [{ type: 'LET' }, { type: 'LET' }, point('A')]);
    const a1 = s.players.a1!;
    expect(a1.servePointsPlayed).toBe(1);
    expect(a1.firstServesIn).toBe(1);
    expect(s.totalPoints).toBe(1);
  });

  it('el saque se atribuye al sacador de cada game, no siempre al mismo', () => {
    // Game 1 lo saca a1; game 2 lo saca b1.
    const s = computeStats(c, [...game('A'), { type: 'ACE' }]);
    expect(s.players.a1!.servePointsPlayed).toBe(4);
    expect(s.players.b1!.aces).toBe(1);
    expect(s.players.b1!.servePointsPlayed).toBe(1);
  });

  it('el porcentaje de primer saque sale de los puntos, no de los saques', () => {
    // 3 puntos: 2 con primero adentro, 1 con falta.
    const s = computeStats(c, [point('A'), { type: 'FALTA' }, point('A'), point('A')]);
    const a1 = s.players.a1!;
    expect(a1.servePointsPlayed).toBe(3);
    expect(a1.firstServesIn).toBe(2);
    expect(pct(a1.firstServesIn, a1.servePointsPlayed)).toBeCloseTo(66.67, 1);
  });
});

describe('break points', () => {
  const c = baseConfig();

  it('detecta el break point y lo cuenta como convertido', () => {
    // Saca A. B llega a 40-0: tres break points seguidos. Gana el primero.
    const s = computeStats(c, points('B', 4));
    // En 0-40 el primer break point aparece cuando B esta a un punto del game.
    expect(s.teams.B.breakPointsPlayed).toBe(1);
    expect(s.teams.B.breakPointsConverted).toBe(1);
    expect(s.teams.A.breakPointsFaced).toBe(1);
    expect(s.teams.A.breakPointsSaved).toBe(0);
  });

  it('estar 0-40 son TRES break points, y salvarlos son tres salvados', () => {
    // Se cuentan por punto, no por game: con B en 40 y A en 0/15/30, cada punto que
    // se juega es un break point.
    const s = computeStats(c, [...points('B', 3), ...points('A', 3)]);
    expect(s.teams.B.breakPointsPlayed).toBe(3);
    expect(s.teams.A.breakPointsSaved).toBe(3);
    expect(s.teams.B.breakPointsConverted).toBe(0);
  });

  it('no hay break points en el propio game de saque ganado en blanco', () => {
    const s = computeStats(c, game('A'));
    expect(s.teams.B.breakPointsPlayed).toBe(0);
    expect(s.teams.A.breakPointsFaced).toBe(0);
  });

  it('en deuce el punto NO es break point: recien lo es con la ventaja del que resta', () => {
    const deuce = [...points('A', 3), ...points('B', 3)];

    // Ganar en deuce solo da ventaja, no el game: todavia no hubo break point.
    expect(computeStats(c, [...deuce, point('B')]).teams.B.breakPointsPlayed).toBe(0);

    // Con la ventaja puesta, el punto siguiente si es break point (y lo convierte).
    const s = computeStats(c, [...deuce, point('B'), point('B')]);
    expect(s.teams.B.breakPointsPlayed).toBe(1);
    expect(s.teams.B.breakPointsConverted).toBe(1);
  });
});

describe('punto de oro', () => {
  it('cuenta los puntos de oro jugados y quien los gano', () => {
    const c = baseConfig({ gameFormat: 'punto_de_oro' });
    const s = computeStats(c, [...points('A', 3), ...points('B', 3), point('B')]);
    expect(s.goldenPointsPlayed).toBe(1);
    expect(s.teams.B.goldenPointsWon).toBe(1);
    expect(s.teams.A.goldenPointsWon).toBe(0);
  });

  it('en punto estrella, solo el tercer 40-40 es punto de oro', () => {
    const c = baseConfig({ gameFormat: 'punto_estrella' });
    const deuce = [...points('A', 3), ...points('B', 3)];
    const tercero = [...deuce, point('A'), point('B'), point('B'), point('A')];

    expect(computeStats(c, deuce).goldenPointsPlayed).toBe(0);
    expect(computeStats(c, [...tercero, point('A')]).goldenPointsPlayed).toBe(1);
    expect(computeStats(c, [...tercero, point('A')]).teams.A.goldenPointsWon).toBe(1);
  });
});

describe('ratio winners / errores no forzados', () => {
  const c = baseConfig();

  it('es la metrica estrella del padel', () => {
    const s = computeStats(c, [
      { type: 'WINNER', player: 'a1' },
      { type: 'WINNER', player: 'a1' },
      { type: 'WINNER', player: 'a1' },
      { type: 'ERROR_NO_FORZADO', player: 'a1' },
    ]);
    expect(winnerErrorRatio(s.players.a1!)).toBe(3);
  });

  it('sin errores no forzados no hay ratio que calcular', () => {
    const s = computeStats(c, []);
    expect(winnerErrorRatio(s.players.a1!)).toBeNull();
  });
});

describe('agregados por equipo', () => {
  const c = baseConfig();

  it('el equipo es la suma de sus dos jugadores', () => {
    const s = computeStats(c, [
      { type: 'WINNER', player: 'a1' },
      { type: 'WINNER', player: 'a2' },
      { type: 'WINNER', player: 'a2' },
      { type: 'ERROR_NO_FORZADO', player: 'a1' },
      { type: 'ERROR_FORZADO', player: 'b2' },
    ]);
    expect(s.teams.A.winners).toBe(3);
    expect(s.teams.A.unforcedErrors).toBe(1);
    expect(s.teams.B.forcedErrors).toBe(1);
    expect(s.teams.B.winners).toBe(0);
  });

  it('tambien suma el saque, aunque saque uno solo de los dos', () => {
    // Los 4 puntos del primer game los saca a1.
    const s = computeStats(c, [{ type: 'FALTA' }, ...points('A', 4)]);
    expect(s.players.a1!.servePointsPlayed).toBe(4);
    expect(s.players.a2!.servePointsPlayed).toBe(0);
    expect(s.teams.A.servePointsPlayed).toBe(4);
    expect(s.teams.A.firstServesIn).toBe(3); // el primero fue con falta
  });
});

describe('desglose por golpe', () => {
  const c = baseConfig();

  /**
   * SOLO WINNERS Y NO FORZADOS: el error forzado no tiene desglose por golpe de este lado —la
   * hoja pregunta con que golpe FORZO el rival, no con cual fallo quien lo sufrio— asi que el
   * evento ya no lleva `shot` y no hay nada que cruzar.
   */
  it('cruza cada golpe con como termino el punto, ordenado por uso', () => {
    const s = computeStats(c, [
      { type: 'WINNER', player: 'a1', shot: { stroke: 'bandeja' } },
      { type: 'ERROR_NO_FORZADO', player: 'a1', shot: { stroke: 'bandeja' } },
      { type: 'ERROR_NO_FORZADO', player: 'a1', shot: { stroke: 'bandeja' } },
      { type: 'WINNER', player: 'a1', shot: { stroke: 'remate' } },
    ]);
    const lines = shotLines(s.players.a1!);

    // La bandeja se uso 3 veces, el remate 1: va primero.
    expect(lines[0]).toEqual({ shot: 'bandeja', winners: 1, unforced: 2, total: 3 });
    expect(lines[1]).toEqual({ shot: 'remate', winners: 1, unforced: 0, total: 1 });
  });

  it('los golpes sin tipo cargado no aparecen', () => {
    const s = computeStats(c, [{ type: 'WINNER', player: 'a1' }]);
    expect(shotLines(s.players.a1!)).toEqual([]);
  });

});

describe('falla de recepcion', () => {
  const c = baseConfig();

  it('un error comun del que resta NO cuenta como falla de recepcion', () => {
    // Saca a1, resta b1 (ver "estadisticas de saque" arriba). Sin `onReturn`, es un error
    // no forzado de siempre — puede haber pasado en cualquier momento del peloteo.
    const s = computeStats(c, [{ type: 'ERROR_NO_FORZADO', player: 'b1' }]);
    expect(s.players.b1!.unforcedErrors).toBe(1);
    expect(s.players.b1!.returnErrorsUnforced).toBe(0);
    expect(s.players.b1!.returnErrorsForced).toBe(0);
  });

  it('el boton dedicado marca la falla de recepcion, ADEMAS de sumar como error de siempre', () => {
    const s = computeStats(c, [{ type: 'ERROR_NO_FORZADO', player: 'b1', onReturn: true }]);
    expect(s.players.b1!.unforcedErrors).toBe(1); // sigue siendo un ENF de toda la vida
    expect(s.players.b1!.returnErrorsUnforced).toBe(1);
  });

  it('la falla de recepcion tambien puede ser forzada', () => {
    const s = computeStats(c, [{ type: 'ERROR_FORZADO', player: 'b1', onReturn: true }]);
    expect(s.players.b1!.forcedErrors).toBe(1);
    expect(s.players.b1!.returnErrorsForced).toBe(1);
  });

  it('cuenta en tipo de golpe exactamente igual que cualquier otro error', () => {
    const s = computeStats(c, [
      { type: 'ERROR_NO_FORZADO', player: 'b1', onReturn: true, shot: { stroke: 'volea' } },
    ]);
    expect(s.players.b1!.unforcedByShot).toEqual({ volea: 1 });
  });
});

describe('quien forzo el error', () => {
  const c = baseConfig();

  it('sin forcedBy, el error forzado es igual que siempre', () => {
    const s = computeStats(c, [{ type: 'ERROR_FORZADO', player: 'b1' }]);
    expect(s.players.b1!.forcedErrors).toBe(1);
    expect(s.players.a1!.forcedErrorsCaused).toEqual({});
  });

  it('se anota en la ficha del que fuerza, no del que se equivoca', () => {
    const s = computeStats(c, [
      { type: 'ERROR_FORZADO', player: 'b1', forcedBy: 'a1', forcedByShot: { stroke: 'remate' } },
    ]);
    expect(s.players.a1!.forcedErrorsCaused).toEqual({ b1: 1 });
    expect(s.players.a1!.forcedErrorsCausedByShot).toEqual({ remate: 1 });
    // La ficha de b1 sigue contando SU golpe (si lo hubiera) por su lado: son datos distintos.
    expect(s.players.b1!.forcedErrorsCaused).toEqual({});
  });

  it('dos jugadores distintos forzando errores no se mezclan', () => {
    const s = computeStats(c, [
      { type: 'ERROR_FORZADO', player: 'b1', forcedBy: 'a1', forcedByShot: { stroke: 'remate' } },
      { type: 'ERROR_FORZADO', player: 'b2', forcedBy: 'a2', forcedByShot: { stroke: 'bandeja' } },
    ]);
    expect(s.players.a1!.forcedErrorsCaused).toEqual({ b1: 1 });
    expect(s.players.a2!.forcedErrorsCaused).toEqual({ b2: 1 });
  });

  it('el mismo forzador contra la misma persona dos veces, suma', () => {
    const s = computeStats(c, [
      { type: 'ERROR_FORZADO', player: 'b1', forcedBy: 'a1' },
      { type: 'ERROR_FORZADO', player: 'b1', forcedBy: 'a1' },
    ]);
    expect(s.players.a1!.forcedErrorsCaused).toEqual({ b1: 2 });
  });
});

describe('las estadisticas son una funcion pura del log', () => {
  const c = baseConfig();

  it('deshacer un punto deshace su efecto en las estadisticas', () => {
    const evs: MatchEvent[] = [
      { type: 'WINNER', player: 'a1', shot: { stroke: 'bandeja' } },
      { type: 'ERROR_NO_FORZADO', player: 'b1' },
    ];
    expect(computeStats(c, evs).players.b1!.unforcedErrors).toBe(1);
    expect(computeStats(c, evs.slice(0, -1)).players.b1!.unforcedErrors).toBe(0);
    expect(computeStats(c, evs.slice(0, -1)).players.a1!.winners).toBe(1);
  });

  it('los games ganados salen del estado final', () => {
    const s = computeStats(c, [...game('A'), ...game('B'), ...game('A')]);
    expect(s.teams.A.gamesWon).toBe(2);
    expect(s.teams.B.gamesWon).toBe(1);
    expect(s.totalPoints).toBe(12);
  });

  it('ignora los eventos que no son puntos', () => {
    const c2 = baseConfig({ gameFormat: 'punto_de_oro' });
    const s = computeStats(c2, [
      { type: 'ORDEN_SAQUE', team: 'A', order: ['a2', 'a1'] },
      ...points('A', 3),
      ...points('B', 3),
      { type: 'ELECCION_CUADRO', box: 'izquierda' },
      point('A'),
    ]);
    expect(s.totalPoints).toBe(7);
  });
});
