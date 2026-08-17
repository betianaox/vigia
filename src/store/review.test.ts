import { describe, expect, it } from 'vitest';

import {
  EVERY_ASK,
  FIRST_ASK,
  isReviewMilestone,
  shouldAskReview,
} from './review';

/**
 * Lo unico que puede salir mal aca es preguntar de mas. Si el dialogo aparece o no lo decide
 * Google; que la app INSISTA lo decide esta funcion, y por eso es la que se prueba.
 *
 * Los numeros NO se escriben a mano: se derivan de `FIRST_ASK` y `EVERY_ASK`. Una lista fija
 * dejaria de ser cierta el dia que se cambie el intervalo, y el test fallaria sin que nada este
 * roto — que es la peor clase de test, porque enseña a ignorarlo.
 */
describe('cuando se pide la valoracion', () => {
  it('no molesta antes del primer hito', () => {
    for (let n = 0; n < FIRST_ASK; n++) {
      expect(isReviewMilestone(n)).toBe(false);
    }
  });

  it('pregunta en el primer hito', () => {
    expect(isReviewMilestone(FIRST_ASK)).toBe(true);
  });

  it('despues se calla hasta el intervalo largo', () => {
    for (let n = FIRST_ASK + 1; n < EVERY_ASK; n++) {
      expect(isReviewMilestone(n)).toBe(false);
    }
  });

  it('vuelve a preguntar en cada multiplo del intervalo', () => {
    for (const veces of [1, 2, 3, 10]) {
      expect(isReviewMilestone(EVERY_ASK * veces)).toBe(true);
    }
  });

  it('entre dos multiplos no pregunta nunca', () => {
    for (let n = EVERY_ASK + 1; n < EVERY_ASK * 2; n++) {
      expect(isReviewMilestone(n)).toBe(false);
    }
  });

  /**
   * La propiedad que importa de verdad: en toda una vida de uso, cuantas veces preguntamos.
   * Es el primer hito mas uno por cada intervalo completo — y nada mas.
   */
  it('en mil partidos pregunta un puñado de veces', () => {
    const vida = 1000;
    const veces = Array.from({ length: vida }, (_, i) => i + 1).filter(isReviewMilestone);

    expect(veces).toHaveLength(1 + Math.floor(vida / EVERY_ASK));
    expect(veces[0]).toBe(FIRST_ASK);
    expect(veces.length).toBeLessThan(10);
  });

  /**
   * El caso por el que se guarda el NUMERO y no un booleano: alguien borra partidos del
   * historial, vuelve a jugar, y llega otra vez al mismo hito. No se le pregunta de nuevo.
   */
  it('no repite el hito en el que ya pregunto', () => {
    expect(shouldAskReview(FIRST_ASK, 0)).toBe(true);
    expect(shouldAskReview(FIRST_ASK, FIRST_ASK)).toBe(false);
    expect(shouldAskReview(EVERY_ASK, FIRST_ASK)).toBe(true);
    expect(shouldAskReview(EVERY_ASK, EVERY_ASK)).toBe(false);
  });

  it('vuelve a preguntar en el hito siguiente, aunque haya preguntado en el anterior', () => {
    expect(shouldAskReview(EVERY_ASK * 2, EVERY_ASK)).toBe(true);
  });
});
