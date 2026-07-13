import { describe, expect, it } from 'vitest';

import type { Player } from '../engine';
import { canonical, normalize, validateRename } from './store';

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

describe('renombrar a una persona', () => {
  const roster: Player[] = [
    { id: 'p1', name: 'Ana Ruiz' },
    { id: 'p2', name: 'Bea Sosa' },
  ];

  it('renombra', () => {
    const r = validateRename('p1', 'Ana Fernández', roster);
    expect(r).toEqual({ ok: true, clean: 'Ana Fernández' });
  });

  it('limpia los espacios de mas', () => {
    const r = validateRename('p1', '  Ana   Fernandez  ', roster);
    expect(r).toEqual({ ok: true, clean: 'Ana Fernandez' });
  });

  it('un nombre vacio no es un nombre', () => {
    expect(validateRename('p1', '   ', roster)).toEqual({
      ok: false,
      error: { kind: 'vacio' },
    });
  });

  /**
   * ARREGLAR COMO SE ESCRIBE SU PROPIO NOMBRE SI VALE. "ana ruiz" -> "Ana Ruiz" es la misma
   * persona corrigiendo la ortografia, y bloquearlo seria absurdo: chocaria consigo misma.
   */
  it('deja arreglar la ortografia de su propio nombre', () => {
    const r = validateRename('p1', 'ana ruíz', roster);
    expect(r).toEqual({ ok: true, clean: 'ana ruíz' });
  });

  /**
   * Pisar a OTRA persona no es renombrar: es UNIFICAR dos historiales.
   *
   * Y el choque DEVUELVE CON QUIEN CHOCO. Eso no es un detalle tecnico: es lo que permite que la
   * pantalla ofrezca unirlas ahi mismo. Que el nombre ya exista suele significar que son la misma
   * persona, y ese es justo el momento de resolverlo.
   */
  it('choca con otra persona, y dice CON QUIEN', () => {
    expect(validateRename('p1', 'Bea Sosa', roster)).toEqual({
      ok: false,
      error: { kind: 'ya_existe', other: { id: 'p2', name: 'Bea Sosa' } },
    });
  });

  it('y el choque se detecta normalizado: "bea sosá" es Bea Sosa', () => {
    const r = validateRename('p1', '  bea   sosá ', roster);
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'ya_existe') expect(r.error.other.id).toBe('p2');
  });
});

/**
 * Unir dos personas NO REESCRIBE NI UN SOLO PARTIDO.
 *
 * Los archivos siguen guardando el id viejo; lo que cambia es que ahora ese id apunta a otra
 * persona. La union se resuelve AL LEER. Por eso se puede deshacer, y por eso no hay forma de
 * corromper un partido en el intento.
 */
describe('unir dos personas', () => {
  it('sin uniones, cada uno es el mismo', () => {
    expect(canonical('p1', {})).toBe('p1');
  });

  it('el absorbido pasa a ser el que lo absorbio', () => {
    expect(canonical('p1', { p1: 'p2' })).toBe('p2');
  });

  it('sigue la cadena: si A se unio a B y B a C, A es C', () => {
    expect(canonical('a', { a: 'b', b: 'c' })).toBe('c');
  });

  /** Un dato corrupto no puede colgar la app: el ciclo se corta, no se cuelga. */
  it('un ciclo no cuelga la app', () => {
    expect(() => canonical('a', { a: 'b', b: 'a' })).not.toThrow();
  });
});
