import { describe, expect, it } from 'vitest';

import type { MatchConfig, MatchEvent, Player } from '../engine';
import { career } from '../engine/career';
import {
  backupFileName,
  isBackup,
  mergeRosters,
  newMatches,
  playersInMatches,
} from './backupRules';
import type { SavedMatch } from './summary';

const match = (id: string): SavedMatch =>
  ({ id, config: {}, events: [], startedAt: 0, updatedAt: 0 }) as unknown as SavedMatch;

const player = (id: string, name: string): Player => ({ id, name }) as Player;

/** Un partido de verdad, con sus cuatro personas adentro y un log que se puede recalcular. */
const config = (): MatchConfig => ({
  players: {
    a1: { id: 'a1', name: 'Ana Ruiz' },
    a2: { id: 'a2', name: 'Aldo Paz' },
    b1: { id: 'b1', name: 'Bea Sosa' },
    b2: { id: 'b2', name: 'Beto Lima' },
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
});

const played = (id: string, at: number, events: MatchEvent[]): SavedMatch => ({
  id,
  config: config(),
  events,
  startedAt: at,
  updatedAt: at,
});

const winner = (p: string, shot?: string): MatchEvent =>
  ({ type: 'WINNER', player: p, shot }) as unknown as MatchEvent;

describe('importar no duplica', () => {
  /**
   * EL CASO QUE MOTIVO TODO ESTO: alguien importa el mismo archivo cinco veces.
   *
   * La primera trae los partidos; de la segunda en adelante no entra ninguno, porque el id de un
   * partido nace con el y viaja adentro del archivo. Si esto se rompe, se rompe la unica promesa
   * que hace el boton de importar.
   */
  it('importar el mismo archivo dos veces no agrega nada la segunda vez', () => {
    const archivo = [match('m_1'), match('m_2'), match('m_3')];

    const primera = newMatches(archivo, new Set());
    expect(primera).toHaveLength(3);

    // Despues de la primera, esos ids ya estan guardados.
    const segunda = newMatches(archivo, new Set(['m_1', 'm_2', 'm_3']));
    expect(segunda).toHaveLength(0);
  });

  it('trae solo los que faltan y respeta los que ya estaban', () => {
    const nuevos = newMatches([match('m_1'), match('m_2')], new Set(['m_1']));
    expect(nuevos.map((m) => m.id)).toEqual(['m_2']);
  });

  it('ignora basura adentro del archivo sin voltear la importacion', () => {
    const sucio = [match('m_1'), null, undefined, {}, { id: 7 }] as unknown as SavedMatch[];
    expect(newMatches(sucio, new Set()).map((m) => m.id)).toEqual(['m_1']);
  });
});

describe('el plantel se une por id', () => {
  it('no repite a los que ya estan', () => {
    const local = [player('p_1', 'Ana')];
    const { roster, added } = mergeRosters([player('p_1', 'Ana'), player('p_2', 'Beto')], local);

    expect(added).toBe(1);
    expect(roster.map((p) => p.id)).toEqual(['p_1', 'p_2']);
  });

  /**
   * Dos telefonos donde se escribio "Ana" por separado son dos ids distintos, y quedan las dos.
   * No se puede saber desde aca si son la misma persona: para eso esta unir jugadores.
   */
  it('el mismo nombre con otro id entra igual: unirlos es otra operacion', () => {
    const { roster, added } = mergeRosters([player('p_9', 'Ana')], [player('p_1', 'Ana')]);

    expect(added).toBe(1);
    expect(roster).toHaveLength(2);
  });

  it('importar dos veces el mismo plantel no lo duplica', () => {
    const archivo = [player('p_1', 'Ana'), player('p_2', 'Beto')];
    const una = mergeRosters(archivo, []);
    const dos = mergeRosters(archivo, una.roster);

    expect(dos.added).toBe(0);
    expect(dos.roster).toHaveLength(2);
  });
});

/**
 * LO QUE SE IMPORTA NO SON PARTIDOS SUELTOS: SON PARTIDOS CON SU GENTE.
 *
 * Las estadisticas individuales NO se guardan en ningun lado — se calculan del log cada vez que
 * se abre la ficha de alguien (ver `career`). Asi que para que "importar" traiga de verdad el
 * juego de una persona hacen falta las dos cosas: el partido, para que haya de donde calcular, y
 * la persona en el plantel, que es la unica puerta desde la que se llega a su ficha.
 */
describe('importar trae los partidos Y a la gente que los jugo', () => {
  const events = [winner('a1', 'remate'), winner('a1', 'volea'), winner('b1'), winner('a1')];

  it('el que juega un partido importado queda en el plantel aunque el archivo no lo traiga', () => {
    /* Una copia a la que le falta el plantel: puede ser de una version vieja, o de un telefono
       donde esa lista quedo rota. Los partidos igual llegan enteros. */
    const sinPlantel: Player[] = [];
    const partidos = [played('m_1', 100, events)];

    const { roster } = mergeRosters(
      [...sinPlantel, ...playersInMatches(partidos)],
      [], // telefono nuevo, sin nada
    );

    expect(roster.map((p) => p.id).sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('y sus estadisticas individuales dan lo mismo que en el telefono de origen', () => {
    const partidos = [played('m_1', 100, events), played('m_2', 200, events)];

    /* El unico dato que viaja es el log. Si las dos cuentas dan igual, la ficha de Ana en el
       telefono que importo dice exactamente lo mismo que en el que exporto. */
    const origen = career('a1', partidos);
    const importado = career('a1', JSON.parse(JSON.stringify(partidos)) as SavedMatch[]);

    expect(importado).toEqual(origen);
    expect(importado.matches).toBe(2);
    expect(importado.totals.winners).toBe(6); // 3 winners de Ana, en dos partidos
  });

  it('el nombre bueno es el del plantel, no la copia congelada adentro del partido', () => {
    /* A Ana la renombraron despues de jugar: el partido guarda el nombre viejo. Gana el
       plantel, que es la lista que se mantiene. */
    const partidos = [played('m_1', 100, events)];
    const { roster } = mergeRosters(
      [player('a1', 'Ana Fernández'), ...playersInMatches(partidos)],
      [],
    );

    expect(roster.find((p) => p.id === 'a1')?.name).toBe('Ana Fernández');
  });

  it('la misma persona en veinte partidos entra UNA vez', () => {
    const partidos = Array.from({ length: 20 }, (_, i) => played(`m_${i}`, i, events));
    const { roster, added } = mergeRosters(playersInMatches(partidos), []);

    expect(added).toBe(4);
    expect(roster).toHaveLength(4);
  });

  it('no pisa a quien ya estaba en este telefono', () => {
    const partidos = [played('m_1', 100, events)];
    const local = [player('a1', 'Ana Ruiz')];
    const { roster, added } = mergeRosters(playersInMatches(partidos), local);

    expect(added).toBe(3);
    expect(roster.filter((p) => p.id === 'a1')).toHaveLength(1);
  });

  it('un partido roto no voltea la lectura del plantel', () => {
    const sucio = [
      played('m_1', 100, events),
      null,
      {},
      { config: {} },
      { config: { players: { x: { id: 'x' } } } }, // sin nombre: no es una persona
    ] as unknown as SavedMatch[];

    expect(playersInMatches(sucio).map((p) => p.id).sort()).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
});

describe('el archivo se reconoce', () => {
  it('acepta una copia de Vigia', () => {
    expect(isBackup({ app: 'vigia', version: 1, matches: [] })).toBe(true);
  });

  it('rechaza cualquier otro JSON del telefono', () => {
    expect(isBackup({ app: 'otra', version: 1, matches: [] })).toBe(false);
    expect(isBackup({ app: 'vigia', version: 1 })).toBe(false);
    expect(isBackup('{}')).toBe(false);
    expect(isBackup(null)).toBe(false);
  });

  it('el nombre del archivo dice que es y de cuando', () => {
    expect(backupFileName(Date.UTC(2026, 6, 15))).toBe('vigia-2026-07-15.json');
  });
});
