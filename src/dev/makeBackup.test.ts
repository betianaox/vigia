import { writeFileSync } from 'node:fs';
import { it } from 'vitest';

import type { MatchConfig, Player } from '../engine';
import { simulate } from './simulate';

/**
 * ANDAMIO DE PRUEBA, NO ES UN TEST. Genera un archivo de copia de seguridad valido para poder
 * probar el importar en el emulador con datos reales. Se borra despues de usarlo.
 */
it('genera un backup de prueba', () => {
  const names = ['Zoe Prueba', 'Uli Prueba', 'Vera Prueba', 'Ivo Prueba'];
  const players: Player[] = names.map((name, i) => ({ id: `p_test_${i}`, name }) as Player);
  const [a1, a2, b1, b2] = players as [Player, Player, Player, Player];

  const config: MatchConfig = {
    players: Object.fromEntries(players.map((p) => [p.id, p])),
    teams: {
      A: { id: 'A', drive: a1.id, reves: a2.id, formation: 'australiana' },
      B: { id: 'B', drive: b1.id, reves: b2.id, formation: 'australiana' },
    },
    serveOrder: { A: [a1.id, a2.id], B: [b1.id, b2.id] },
    firstServingTeam: 'A',
    gameFormat: 'ventajas',
    length: 'un_set',
    thirdSet: 'set_normal',
    changeEnds: 'fin_de_set',
  } as MatchConfig;

  const matches = [1, 2].map((seed) => {
    const startedAt = Date.UTC(2026, 5, seed * 3, 20, 0);
    const events = simulate(config, { seed, startedAt, shotRate: 1 });
    return {
      id: `m_test_${seed}`,
      config,
      events,
      startedAt,
      updatedAt: events[events.length - 1]?.t ?? startedAt,
    };
  });

  writeFileSync(
    'C:/Users/betia/AppData/Local/Temp/claude/c--dev-Imago/59edc3ed-d20e-41ca-9c50-7ce092c4c774/scratchpad/vigia-prueba.json',
    JSON.stringify({
      app: 'vigia',
      version: 1,
      exportedAt: Date.UTC(2026, 6, 18),
      matches,
      players,
      merges: {},
    }),
  );
});
