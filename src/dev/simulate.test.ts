import { describe, expect, it } from 'vitest';

import { reduce } from '../engine';
import { computeStats } from '../engine/stats';
import type { MatchConfig } from '../engine';
// Del modulo PURO, no de `matches.ts`: ese importa expo-file-system y no se puede cargar fuera
// de un telefono. Justamente por estar mezclado con el disco, este bug no tenia como testearse.
import { summarize, type SavedMatch } from '../store/summary';
import { simulate } from './simulate';

const config = (over: Partial<MatchConfig> = {}): MatchConfig => ({
  players: {
    a1: { id: 'a1', name: 'Ana Ruiz' },
    a2: { id: 'a2', name: 'Aldo Vega' },
    b1: { id: 'b1', name: 'Bea Sosa' },
    b2: { id: 'b2', name: 'Beto Lino' },
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
  changeEnds: 'fin_de_set',
  ...over,
});

/**
 * El simulador existe para probar las pantallas contra datos de verdad. Si el que miente es el
 * simulador, no probamos nada — asi que lo probamos a el primero.
 */
describe('el partido simulado', () => {
  it('termina, y lo da por terminado el motor', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const c = config();
      const events = simulate(c, { seed });
      const st = reduce(c, events);

      expect(st.finished).toBe(true);
      expect(st.winner).not.toBeNull();
      // Un partido a tres sets no se gana en cuatro puntos.
      expect(events.length).toBeGreaterThan(100);
    }
  });

  it('el mismo semillero da siempre el mismo partido', () => {
    const c = config();
    // Con la hora fija: el azar es reproducible, pero el reloj no.
    const at = { seed: 7, startedAt: 1_700_000_000_000 };
    expect(simulate(c, at)).toEqual(simulate(c, at));
  });

  /**
   * SE MIRAN VARIOS SEMILLEROS, NO UNO. Lo que se prueba es que el simulador PUEDE producir
   * cada cosa, no que un stream de azar particular la produzca: con un solo seed, cualquier
   * cambio en el orden en que se piden los randoms rompe el test sin que nada este mal —paso
   * al agregarle "quien forzo" al error forzado, que consume un random mas.
   */
  it('trae de todo: aces, dobles faltas, lets y golpes cargados', () => {
    const c = config();
    const seeds = [1, 3, 7, 11, 23];

    let aces = 0;
    let dobles = 0;
    let lets = false;
    let shotData = false;

    for (const seed of seeds) {
      const events = simulate(c, { seed });
      const stats = computeStats(c, events);
      aces += Object.values(stats.players).reduce((n, p) => n + p.aces, 0);
      dobles += Object.values(stats.players).reduce((n, p) => n + p.doubleFaults, 0);
      lets ||= events.some((e) => e.type === 'LET');
      shotData ||= stats.hasShotData;
    }

    expect(lets).toBe(true);
    expect(shotData).toBe(true);
    expect(aces).toBeGreaterThan(0);
    expect(dobles).toBeGreaterThan(0);
  });

  /** Lo que vinimos a mirar: los duelos del saque tienen que quedar repartidos, no todos a uno. */
  it('los aces y las dobles faltas quedan repartidos entre los dos restadores', () => {
    const c = config();
    const stats = computeStats(c, simulate(c, { seed: 7 }));

    const rivals = new Set<string>();
    for (const p of Object.values(stats.players)) {
      for (const id of Object.keys(p.acesAgainst)) rivals.add(id);
      for (const id of Object.keys(p.doubleFaultsAgainst)) rivals.add(id);
    }
    expect(rivals.size).toBeGreaterThan(1);
  });

  /**
   * Lo encontro el primer partido sembrado: el historial decia 209 puntos y las estadisticas
   * 210. El resumen contaba "winner, error o ace" y se olvidaba de la doble falta.
   */
  it('el historial y las estadisticas cuentan los mismos puntos', () => {
    const c = config();
    const events = simulate(c, { seed: 7, startedAt: 1_700_000_000_000 });
    const m: SavedMatch = {
      id: 'x',
      config: c,
      events,
      startedAt: 1_700_000_000_000,
      updatedAt: events[events.length - 1]!.t!,
    };

    expect(summarize(m).points).toBe(computeStats(c, events).totalPoints);
  });

  it('sin golpes cargados, la seccion de golpes no tiene datos', () => {
    const c = config();
    const stats = computeStats(c, simulate(c, { seed: 7, shotRate: 0 }));
    expect(stats.hasShotData).toBe(false);
    expect(stats.totalPoints).toBeGreaterThan(50);
  });

  it('llega a tiebreak alguna vez: el reglamento lo produce, no el simulador', () => {
    const c = config();
    // Parejo, para que los sets se estiren.
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const conTiebreak = seeds.some((seed) => {
      const st = reduce(c, simulate(c, { seed, strengthA: 0.5 }));
      return st.completedSets.some((s) => s.tiebreak !== undefined);
    });
    expect(conTiebreak).toBe(true);
  });
});
