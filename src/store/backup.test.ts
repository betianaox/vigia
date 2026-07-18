import { describe, expect, it } from 'vitest';

import type { Player } from '../engine';
import { backupFileName, isBackup, mergeRosters, newMatches } from './backupRules';
import type { SavedMatch } from './summary';

const match = (id: string): SavedMatch =>
  ({ id, config: {}, events: [], startedAt: 0, updatedAt: 0 }) as unknown as SavedMatch;

const player = (id: string, name: string): Player => ({ id, name }) as Player;

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
