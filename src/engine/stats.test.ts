import { describe, expect, it } from 'vitest';
import { computeStats, winnerErrorRatio, pct } from './stats';
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
      { type: 'WINNER', player: 'a1', shot: 'bandeja' },
      { type: 'WINNER', player: 'a1', shot: 'bandeja' },
      { type: 'WINNER', player: 'a1', shot: 'vibora' },
      { type: 'ERROR_NO_FORZADO', player: 'a1', shot: 'bandeja' },
    ]);
    expect(s.players.a1!.winnersByShot).toEqual({ bandeja: 2, vibora: 1 });
    expect(s.players.a1!.unforcedByShot).toEqual({ bandeja: 1 });
  });

  it('un punto sin tipo de golpe cuenta igual, solo que sin desglose', () => {
    const s = computeStats(c, [{ type: 'WINNER', player: 'a1' }]);
    expect(s.players.a1!.winners).toBe(1);
    expect(s.players.a1!.winnersByShot).toEqual({});
  });
});

describe('estadisticas de saque', () => {
  const c = baseConfig();

  it('si no se toca nada, el punto se jugo con primer saque', () => {
    const s = computeStats(c, [point('A')]);
    const a1 = s.players.a1!; // saca a1
    expect(a1.servePointsPlayed).toBe(1);
    expect(a1.firstServesIn).toBe(1);
    expect(a1.firstServePointsPlayed).toBe(1);
    expect(a1.firstServePointsWon).toBe(1);
    expect(a1.secondServePointsPlayed).toBe(0);
  });

  it('una falta hace que el punto sea de segundo saque', () => {
    const s = computeStats(c, [{ type: 'FALTA' }, point('A')]);
    const a1 = s.players.a1!;
    expect(a1.firstServesIn).toBe(0);
    expect(a1.firstServePointsPlayed).toBe(0);
    expect(a1.secondServePointsPlayed).toBe(1);
    expect(a1.secondServePointsWon).toBe(1);
  });

  it('el punto de segundo saque perdido no suma a los ganados', () => {
    const s = computeStats(c, [{ type: 'FALTA' }, point('B')]);
    const a1 = s.players.a1!;
    expect(a1.secondServePointsPlayed).toBe(1);
    expect(a1.secondServePointsWon).toBe(0);
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

describe('las estadisticas son una funcion pura del log', () => {
  const c = baseConfig();

  it('deshacer un punto deshace su efecto en las estadisticas', () => {
    const evs: MatchEvent[] = [
      { type: 'WINNER', player: 'a1', shot: 'bandeja' },
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
