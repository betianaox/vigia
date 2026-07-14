import { describe, expect, it } from 'vitest';

import { en } from './en';
import { es } from './es';
import { it as italiano } from './it';
import { pt } from './pt';

/**
 * "¿TRADUJIMOS TODO?" NO ES UNA PREGUNTA, ES UN ERROR DE BUILD.
 *
 * TypeScript ya obliga a que los cuatro diccionarios tengan las mismas claves (los tres se
 * declaran como `Dict`, ver `index.ts`). Este test agrega lo que el tipo NO puede ver: que
 * ningun texto haya quedado vacio, y que las claves anidadas sean exactamente las mismas —
 * un objeto de mas adentro de una seccion pasa el tipo y rompe la app.
 *
 * Sin esto, la unica forma de descubrir que falta un texto es que un italiano abra la app y vea
 * un hueco.
 */
const LOCALES = { es, en, pt, it: italiano };

/** Todas las claves, aplanadas: "shots.remate", "sides.drive". */
const flatten = (o: object, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatten(v as object, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const keys = (o: object): string[] => flatten(o).sort();

describe('los cuatro idiomas', () => {
  const base = keys(es);

  for (const [lang, dict] of Object.entries(LOCALES)) {
    it(`${lang}: tiene exactamente las mismas claves que el castellano`, () => {
      expect(keys(dict)).toEqual(base);
    });

    it(`${lang}: no tiene ningun texto vacio`, () => {
      const empty = flatten(dict).filter((k) => {
        const value = k.split('.').reduce<unknown>((o, part) => (o as never)[part], dict);
        return typeof value === 'string' && value.trim().length === 0;
      });
      expect(empty).toEqual([]);
    });
  }
});

/**
 * Los tres golpes que NO se traducen en ningun idioma. Esta verificado en los glosarios ingleses
 * e italianos: bandeja, vibora y chiquita se dicen en castellano en todo el mundo.
 *
 * El test existe para que nadie los "traduzca" de buena fe. Una bandeja no es una "tray shot".
 */
describe('el vocabulario del padel es español', () => {
  it('bandeja, vibora y chiquita no se traducen en ningun idioma', () => {
    for (const dict of Object.values(LOCALES)) {
      expect(dict.shots.bandeja).toBe('Bandeja');
      expect(dict.shots.chiquita).toBe('Chiquita');
      expect(dict.variants.vibora).toBe('Víbora');
    }
  });
});
