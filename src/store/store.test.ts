import { describe, expect, it } from 'vitest';

import { normalize } from './store';

/**
 * La normalizacion es la unica defensa real contra que el historial de un jugador se parta en
 * dos por un typo. Si "Ana Ruíz" y "Ana Ruiz" son dos personas distintas, las estadisticas de
 * Ana quedan divididas para siempre y no hay forma de volver a juntarlas.
 */
describe('identidad de un jugador', () => {
  it('ignora mayusculas', () => {
    expect(normalize('Ana Ruiz')).toBe(normalize('ana ruiz'));
    expect(normalize('ANA RUIZ')).toBe(normalize('Ana Ruiz'));
  });

  it('ignora acentos: el typo mas frecuente en castellano', () => {
    expect(normalize('Ana Ruíz')).toBe(normalize('Ana Ruiz'));
    expect(normalize('Sebastián')).toBe(normalize('Sebastian'));
    expect(normalize('María Fernanda')).toBe(normalize('Maria Fernanda'));
  });

  it('ignora los espacios de mas, adelante, atras y en el medio', () => {
    expect(normalize('  Ana   Ruiz  ')).toBe(normalize('Ana Ruiz'));
  });

  it('pero NO junta a dos personas distintas', () => {
    expect(normalize('Ana Ruiz')).not.toBe(normalize('Ana Ruz'));
    expect(normalize('Ana')).not.toBe(normalize('Ana Ruiz'));
  });
});
