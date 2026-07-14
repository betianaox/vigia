import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

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
 * LA REGLA QUE HACE POSIBLE CAMBIAR EL IDIOMA SIN REINICIAR, Y QUE NADIE PUEDE ROMPER SIN QUERER.
 *
 * `L` es una referencia viva: al elegir otro idioma se reasigna, y toda pantalla que lo lea
 * MIENTRAS SE DIBUJA cambia sola. Pero una constante de modulo —`const TITULOS = [L.a, L.b]`— se
 * evalua una sola vez, cuando carga el bundle: copia los strings y se queda con ellos para
 * siempre. Media pantalla cambiaria de idioma y esa constante no.
 *
 * Es un error silencioso: compila, pasa los tests, funciona perfecto en el idioma del telefono.
 * Se descubre unicamente si alguien cambia el idioma Y mira justo ese texto. Por eso lo busca un
 * test y no un par de ojos.
 *
 * Lo permitido es leer `L` adentro de una FUNCION (un componente, o una funcion como `rally()`),
 * porque una funcion se ejecuta al dibujar, no al importar.
 */
describe('nadie congela el diccionario', () => {
  const ROOT = join(__dirname, '..', '..');

  /** Los archivos de la app, menos los diccionarios (que obviamente hablan de `L`). */
  const sources = async (dir: string): Promise<string[]> => {
    const out: string[] = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'i18n') continue;
        out.push(...(await sources(full)));
      } else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) {
        out.push(full);
      }
    }
    return out;
  };

  /**
   * Los comentarios se borran ANTES de mirar el codigo, y se reemplazan por espacios para no
   * correr los renglones. Sin esto, un `const GAP = 2; // ...` no parecia terminar (el `;` no
   * quedaba al final del renglon) y el test se comia las lineas siguientes.
   */
  const withoutComments = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  it('ningun archivo lee `L` en una constante de modulo', async () => {
    const files = [join(ROOT, 'App.tsx'), ...(await sources(join(ROOT, 'src')))];
    const offenders: string[] = [];

    for (const file of files) {
      const lines = withoutComments(readFileSync(file, 'utf8')).split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Una declaracion a nivel de modulo: empieza en la columna cero.
        if (!/^(export )?(const|let) /.test(line)) continue;
        // Si lo que se declara es una FUNCION, lee el diccionario al llamarla. Es lo correcto.
        if (line.includes('=>') || line.includes('function')) continue;

        // El resto de la declaracion, hasta que cierre en la columna cero.
        let stmt = line;
        for (let j = i + 1; j < lines.length && !/;\s*$/.test(stmt); j++) {
          stmt += `\n${lines[j]!}`;
        }
        if (/\bL\./.test(stmt)) {
          offenders.push(`${file.replace(ROOT, '').slice(1)}:${i + 1} — ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
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
