import { describe, expect, it } from 'vitest';

import { reduce } from '../engine';
import type { Player } from '../engine';
// Del modulo PURO, no de `matches.ts`: ese importa expo-file-system y no se puede cargar fuera
// de un telefono. Por eso el plan de la temporada vive en `season.ts` y no en `seed.ts`.
import { summarize, type SavedMatch } from '../store/summary';
import { COMPANEROS, PLANTEL, planSeason, RIVALES, seasonConfig } from './season';
import { simulate } from './simulate';

/**
 * La temporada sembrada existe para poder MIRAR las pantallas de estadisticas y decidir si el
 * diseño sirve, y para sacar las capturas de la ficha de Play. Si la temporada sale mal —el
 * protagonista no mejora, no aparece nunca un tie-break, las fechas quedan desordenadas— eso se
 * descubre enchufando el telefono, y eso cuesta un ciclo entero.
 *
 * Asi que se verifica aca, jugando los partidos de verdad con el motor.
 */

const TOTAL = 24;
const AHORA = 1_760_000_000_000; // fijo: la temporada tiene que ser reproducible

const jugador = (nombre: string, i: number): Player => ({ id: `p${i}`, name: nombre });

/** Juega la temporada completa y devuelve los partidos guardables. */
function jugarTemporada(total = TOTAL): SavedMatch[] {
  const roster = new Map(PLANTEL.map((n, i) => [n, jugador(n, i)]));
  const hero = roster.get(PLANTEL[0]!)!;

  return planSeason(total, 120, AHORA).map((slot, i) => {
    const config = seasonConfig(
      slot,
      hero,
      roster.get(slot.companero)!,
      roster.get(slot.rivales[0])!,
      roster.get(slot.rivales[1])!,
    );
    const events = simulate(config, {
      seed: slot.seed,
      strengthA: slot.strengthA,
      shotRate: 0.9,
      startedAt: slot.startedAt,
    });
    return {
      id: `m${i}`,
      config,
      events,
      startedAt: slot.startedAt,
      updatedAt: events[events.length - 1]?.t ?? slot.startedAt,
    };
  });
}

describe('la temporada sembrada', () => {
  const temporada = jugarTemporada();

  it('juega los 24 partidos y los termina todos', () => {
    expect(temporada).toHaveLength(TOTAL);
    for (const m of temporada) {
      expect(reduce(m.config, m.events).finished).toBe(true);
    }
  });

  it('deja al protagonista en todos los partidos', () => {
    const hero = PLANTEL[0]!;
    for (const m of temporada) {
      const nombres = Object.values(m.config.players).map((p) => p.name);
      expect(nombres).toContain(hero);
    }
  });

  it('usa el plantel entero, para que la pantalla de jugadores no quede con cuatro fichas', () => {
    const vistos = new Set<string>();
    for (const m of temporada) {
      for (const p of Object.values(m.config.players)) vistos.add(p.name);
    }
    expect(vistos.size).toBe(PLANTEL.length);
    expect(PLANTEL.length).toBe(1 + COMPANEROS.length + RIVALES.length * 2);
  });

  it('trae los tres reglamentos y los dos formatos de tercer set', () => {
    const formatos = new Set(temporada.map((m) => m.config.gameFormat));
    expect([...formatos].sort()).toEqual([
      'punto_de_oro',
      'punto_estrella',
      'ventajas',
    ]);

    const terceros = new Set(temporada.map((m) => m.config.thirdSet));
    expect([...terceros].sort()).toEqual(['set_normal', 'super_tiebreak']);
  });

  it('ordena las fechas de mas viejo a mas nuevo y no se va al futuro', () => {
    const fechas = temporada.map((m) => m.startedAt);
    for (let i = 1; i < fechas.length; i++) {
      expect(fechas[i]!).toBeGreaterThan(fechas[i - 1]!);
    }
    expect(fechas[fechas.length - 1]!).toBeLessThanOrEqual(AHORA);
  });

  /**
   * LA PRUEBA QUE IMPORTA PARA LAS CAPTURAS. El protagonista tiene que mejorar de verdad: si la
   * curva sale plana, la pantalla de evolucion no muestra nada y la captura no vende nada.
   * Se compara el primer tercio contra el ultimo en vez de partido a partido, porque el ruido
   * hace que dos partidos consecutivos puedan ir para cualquier lado — como en la realidad.
   */
  it('hace que el protagonista mejore a lo largo de la temporada', () => {
    const gano = (m: SavedMatch): boolean => summarize(m).winner === 'A';
    const tercio = Math.floor(TOTAL / 3);

    const primeros = temporada.slice(0, tercio).filter(gano).length;
    const ultimos = temporada.slice(-tercio).filter(gano).length;

    expect(ultimos).toBeGreaterThan(primeros);
  });

  it('produce partidos con volumen de puntos como los de verdad', () => {
    for (const m of temporada) {
      // Un partido a tres sets no se resuelve en veinte eventos ni necesita mil.
      expect(m.events.length).toBeGreaterThan(60);
      expect(m.events.length).toBeLessThan(700);
    }
  });

  it('carga el golpe en la mayoria de los puntos, que es lo que llena las pantallas de golpes', () => {
    const conGolpe = temporada
      .flatMap((m) => m.events)
      .filter((e) => 'shot' in e || 'forcedByShot' in e);
    const golpesCargados = conGolpe.filter(
      (e) =>
        ('shot' in e && e.shot !== undefined) ||
        ('forcedByShot' in e && e.forcedByShot !== undefined),
    );
    expect(golpesCargados.length / conGolpe.length).toBeGreaterThan(0.8);
  });
});
