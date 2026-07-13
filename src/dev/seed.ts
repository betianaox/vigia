import type { MatchConfig, Player } from '../engine';
import { newMatchId, saveMatch, type SavedMatch } from '../store/matches';
import { addPlayer, findPlayer, loadPlayers } from '../store/store';
import { simulate, type SimOptions } from './simulate';

/**
 * Mete en el historial un partido jugado de punta a punta, para tener con que probar las
 * pantallas de estadisticas sin cargar cien puntos a mano en el emulador.
 *
 * SOLO EN DESARROLLO. El boton que lo llama va detras de `__DEV__` y no existe en el build de
 * produccion.
 *
 * Los jugadores se crean con `addPlayer`, igual que los de un partido de verdad: asi entran al
 * plantel, aparecen en el buscador del historial, y el acumulado que venga despues los va a
 * encontrar por su id. Un partido sembrado tiene que ser indistinguible de uno jugado — si no,
 * lo que se prueba con el no vale.
 */
export async function seedMatch(opts: SimOptions = {}): Promise<SavedMatch> {
  const names = ['Ana Ruiz', 'Aldo Vega', 'Bea Sosa', 'Beto Lino'];

  let roster = await loadPlayers();
  for (const name of names) roster = await addPlayer(name, roster);
  const [a1, a2, b1, b2] = names.map((n) => findPlayer(n, roster)!) as [
    Player,
    Player,
    Player,
    Player,
  ];

  const config: MatchConfig = {
    players: Object.fromEntries([a1, a2, b1, b2].map((p) => [p.id, p])),
    teams: {
      A: { id: 'A', drive: a1.id, reves: a2.id, formation: 'australiana' },
      B: { id: 'B', drive: b1.id, reves: b2.id, formation: 'australiana' },
    },
    serveOrder: { A: [a1.id, a2.id], B: [b1.id, b2.id] },
    firstServingTeam: 'A',
    gameFormat: 'ventajas',
    length: 'tres_sets',
    thirdSet: 'set_normal',
    changeEnds: 'fin_de_set',
  };

  const startedAt = opts.startedAt ?? Date.now() - 3 * 24 * 60 * 60 * 1000;
  const events = simulate(config, { ...opts, startedAt });

  const last = events[events.length - 1]?.t ?? startedAt;
  const match: SavedMatch = {
    id: newMatchId(),
    config,
    events,
    startedAt,
    updatedAt: last,
  };

  await saveMatch(match);
  return match;
}
