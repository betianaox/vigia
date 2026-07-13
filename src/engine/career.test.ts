import { describe, expect, it } from 'vitest';

import { career, playedBy, type PlayedMatch } from './career';
import { pct } from './stats';
import type { MatchConfig, MatchEvent, TeamId } from './types';

const config = (over: Partial<MatchConfig> = {}): MatchConfig => ({
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
  length: 'un_game',
  thirdSet: 'set_normal',
  changeEnds: 'nunca',
  ...over,
});

const point = (t: TeamId): MatchEvent => ({ type: 'WINNER', player: t === 'A' ? 'a1' : 'b1' });
const game = (t: TeamId): MatchEvent[] => Array.from({ length: 4 }, () => point(t));

const match = (id: string, at: number, events: MatchEvent[], c = config()): PlayedMatch => ({
  id,
  config: c,
  events,
  startedAt: at,
});

describe('el acumulado de una persona', () => {
  it('junta los partidos donde jugo, del mas viejo al mas nuevo', () => {
    const ms = [match('m2', 200, game('A')), match('m1', 100, game('B'))];
    expect(playedBy('a1', ms).map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('ignora los partidos donde no jugo', () => {
    const otro = config({
      players: {
        c1: { id: 'c1', name: 'Caro' },
        c2: { id: 'c2', name: 'Ciro' },
        d1: { id: 'd1', name: 'Dana' },
        d2: { id: 'd2', name: 'Dario' },
      },
      teams: {
        A: { id: 'A', drive: 'c1', reves: 'c2' },
        B: { id: 'B', drive: 'd1', reves: 'd2' },
      },
      serveOrder: { A: ['c1', 'c2'], B: ['d1', 'd2'] },
    });

    const c = career('a1', [match('m1', 100, game('A')), match('m2', 200, game('A'), otro)]);
    expect(c.matches).toBe(1);
  });

  it('cuenta ganados, perdidos, y los que nadie definio', () => {
    const c = career('a1', [
      match('m1', 100, game('A')), // gana su equipo
      match('m2', 200, game('B')), // pierde
      match('m3', 300, [point('A')]), // a medias: el reglamento no definio nada
    ]);

    expect(c.matches).toBe(3);
    expect(c.won).toBe(1);
    expect(c.lost).toBe(1);
    expect(c.undecided).toBe(1);
    // No se inventa un ganador porque alguien iba arriba.
    expect(c.timeline[2]!.won).toBeNull();
  });

  it('suma los contadores de todos los partidos', () => {
    const c = career('a1', [match('m1', 100, game('A')), match('m2', 200, game('A'))]);
    expect(c.totals.winners).toBe(8); // 4 + 4
    expect(c.matches).toBe(2);
  });

  /**
   * LA TRAMPA. El "1er saque adentro" de una temporada NO es el promedio de los porcentajes
   * por partido: es la suma de los que entraron sobre la suma de los que se sacaron.
   *
   * Aca: un partido de UN punto, con el primer saque adentro (100%). Y otro de cuatro, con el
   * primero adentro una sola vez (25%). El promedio de esos dos porcentajes da 63%. La verdad
   * es 2 de 5 = 40%. Veintitres puntos de diferencia, y el promedio favorece al partido
   * cortito — que es exactamente el que menos deberia pesar.
   */
  it('no promedia porcentajes: los suma y despues divide', () => {
    // Partido 1: a1 saca UN punto y su primer saque entra.
    const m1 = match('m1', 100, [point('A')]);

    // Partido 2: a1 saca cuatro; en tres tiene que ir al segundo saque.
    const m2 = match('m2', 200, [
      point('A'),
      { type: 'FALTA' },
      point('A'),
      { type: 'FALTA' },
      point('A'),
      { type: 'FALTA' },
      point('A'),
    ]);

    const c = career('a1', [m1, m2]);
    const real = pct(c.totals.firstServesIn, c.totals.servePointsPlayed);

    expect(c.totals.firstServesIn).toBe(2);
    expect(c.totals.servePointsPlayed).toBe(5);
    expect(Math.round(real!)).toBe(40);

    // El promedio de los porcentajes por partido daria 63%, y estaria mal.
    const porPartido = c.timeline.map(
      (t) => pct(t.stats.firstServesIn, t.stats.servePointsPlayed) ?? 0,
    );
    const promedio = porPartido.reduce((a, b) => a + b, 0) / porPartido.length;
    expect(Math.round(promedio)).toBe(63);
    expect(Math.round(promedio)).not.toBe(Math.round(real!));
  });

  it('la linea de tiempo trae el companero y los rivales de cada partido', () => {
    const c = career('a1', [match('m1', 100, game('A'))]);
    expect(c.timeline[0]!.partner).toBe('a2');
    expect(c.timeline[0]!.opponents).toEqual(['b1', 'b2']);
  });

  it('sin partidos, no explota', () => {
    const c = career('a1', []);
    expect(c.matches).toBe(0);
    expect(c.totals.winners).toBe(0);
    expect(c.timeline).toEqual([]);
  });
});

/**
 * UNIR DOS PERSONAS, SIN TOCAR UN SOLO PARTIDO.
 *
 * "Ana" se cargo un dia con un id, y "Ana Ruiz" otro dia con otro: son la misma persona, con el
 * historial partido en dos. Al unirlas, los partidos NO se reescriben — el de aquel dia sigue
 * guardando el id viejo. Lo que cambia es que ese id ahora apunta a Ana Ruiz, y el acumulado lo
 * resuelve AL LEER.
 *
 * Esto es lo que hace que la union sea reversible y que no haya forma de corromper un partido en
 * el intento.
 */
describe('el acumulado, despues de unir dos personas', () => {
  /** El partido viejo: la misma gente, pero Ana cargada con OTRO id. */
  const viejo = config({
    players: {
      'a1-viejo': { id: 'a1-viejo', name: 'Ana' },
      a2: { id: 'a2', name: 'Aldo' },
      b1: { id: 'b1', name: 'Bea' },
      b2: { id: 'b2', name: 'Beto' },
    },
    teams: {
      A: { id: 'A', drive: 'a1-viejo', reves: 'a2' },
      B: { id: 'B', drive: 'b1', reves: 'b2' },
    },
    serveOrder: { A: ['a1-viejo', 'a2'], B: ['b1', 'b2'] },
  });

  const puntoViejo = (): MatchEvent => ({ type: 'WINNER', player: 'a1-viejo' });
  const gameViejo = (): MatchEvent[] => Array.from({ length: 4 }, () => puntoViejo());

  const ms = [
    match('m1', 100, gameViejo(), viejo), // Ana, con el id viejo
    match('m2', 200, game('A')), // Ana Ruiz, con el id nuevo
  ];

  /** "a1-viejo" es en realidad "a1". */
  const canon = (id: string) => (id === 'a1-viejo' ? 'a1' : id);

  it('sin la union, el historial esta partido en dos', () => {
    expect(career('a1', ms).matches).toBe(1);
    expect(career('a1-viejo', ms).matches).toBe(1);
  });

  it('unidas, los dos partidos son de la misma persona', () => {
    const c = career('a1', ms, canon);
    expect(c.matches).toBe(2);
    expect(c.won).toBe(2);
  });

  it('y los contadores se suman: el partido viejo tambien cuenta', () => {
    const c = career('a1', ms, canon);
    // Cuatro winners con el id viejo, cuatro con el nuevo.
    expect(c.totals.winners).toBe(8);
  });

  it('la linea de tiempo trae los dos, en orden', () => {
    const c = career('a1', ms, canon);
    expect(c.timeline.map((t) => t.matchId)).toEqual(['m1', 'm2']);
  });

  /** El partido viejo sigue diciendo lo que decia: no se reescribio nada. */
  it('el partido viejo no se toco: sigue guardando el id de antes', () => {
    expect(Object.keys(ms[0]!.config.players)).toContain('a1-viejo');
    expect(ms[0]!.events[0]).toEqual({ type: 'WINNER', player: 'a1-viejo' });
  });
});
