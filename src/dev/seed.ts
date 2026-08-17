import type { MatchConfig, Player } from '../engine';
import { newMatchId, saveMatch, type SavedMatch } from '../store/matches';
import { addPlayer, findPlayer, loadPlayers } from '../store/store';
import { PLANTEL, PROTAGONISTA, planSeason, seasonConfig } from './season';
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

/**
 * UNA TEMPORADA ENTERA, no un partido.
 *
 * `seedMatch` alcanza para ver si una pantalla dibuja, pero no para JUZGARLA: siembra siempre
 * los mismos cuatro nombres y un partido aislado, asi que el plantel queda con cuatro fichas y
 * la evolucion de un jugador, con un solo punto. Una curva de un punto no es una curva, y una
 * pantalla de evolucion vacia no dice si el diseño sirve.
 *
 * La FORMA de la temporada —quien juega con quien, con que reglamento y cuanto mejora— vive en
 * `season.ts`, que es puro y por eso esta testeado. Aca queda solo lo que toca el disco.
 *
 * Sigue valiendo la regla de `simulate`: el log lo juega el motor, nunca se escribe a mano.
 */
export interface SeasonOptions {
  /** Cuantos partidos. 24 llena las pantallas sin hacer esperar de mas. */
  matches?: number;
  /** Sobre cuantos dias hacia atras se reparten. */
  spanDays?: number;
  /** Se llama despues de cada partido, para poder mostrar el avance. */
  onProgress?: (done: number, total: number) => void;
}

export async function seedSeason(opts: SeasonOptions = {}): Promise<SavedMatch[]> {
  const total = opts.matches ?? 24;
  const spanDays = opts.spanDays ?? 120;

  // Todo el plantel se crea de una sola vez y ANTES del bucle. Si se creara adentro,
  // `addPlayer` volveria a leer y escribir el plantel en cada partido: mismo resultado,
  // pero 24 lecturas de AsyncStorage que no hacen falta.
  let roster = await loadPlayers();
  for (const nombre of PLANTEL) roster = await addPlayer(nombre, roster);

  const buscar = (nombre: string): Player => {
    const p = findPlayer(nombre, roster);
    if (!p) throw new Error(`Falta ${nombre} en el plantel sembrado`);
    return p;
  };

  const hero = buscar(PROTAGONISTA);
  const guardados: SavedMatch[] = [];
  const plan = planSeason(total, spanDays, Date.now());

  for (let i = 0; i < plan.length; i++) {
    const slot = plan[i]!;
    const companero = buscar(slot.companero);
    const rivalDrive = buscar(slot.rivales[0]);
    const rivalReves = buscar(slot.rivales[1]);

    const config = seasonConfig(slot, hero, companero, rivalDrive, rivalReves);

    const events = simulate(config, {
      seed: slot.seed,
      strengthA: slot.strengthA,
      // Alto a proposito: las pantallas de golpes son las que peor se ven con pocos datos.
      shotRate: 0.9,
      startedAt: slot.startedAt,
    });

    const match: SavedMatch = {
      id: newMatchId(),
      config,
      events,
      startedAt: slot.startedAt,
      updatedAt: events[events.length - 1]?.t ?? slot.startedAt,
    };

    await saveMatch(match);
    guardados.push(match);
    opts.onProgress?.(i + 1, total);
  }

  return guardados;
}
