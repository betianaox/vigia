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
  /**
   * Borra los comentarios y deja todo lo demas donde estaba (los reemplaza por espacios, asi las
   * lineas y las columnas no se mueven).
   *
   * RECORRE CARACTER POR CARACTER Y NO CON UN REGEX, por una razon concreta: un regex de `//`
   * tambien corta adentro de un string, y `'https://play.google.com/…'` tiene dos barras. Cuando
   * eso paso, este test empezo a fallar en una constante que declaraba una URL —nada que ver con
   * el diccionario— y el mensaje de error apuntaba a un lugar que no tenia el problema. Un guard
   * que acusa al inocente se termina ignorando, que es peor que no tenerlo.
   */
  const withoutComments = (src: string): string => {
    let out = '';
    // Que estamos atravesando: nada, un string (con su comilla), o un comentario.
    let quote: string | null = null;
    let comment: 'line' | 'block' | null = null;

    for (let i = 0; i < src.length; i++) {
      const c = src[i]!;
      const next = src[i + 1];

      if (comment) {
        // Los saltos de linea se conservan SIEMPRE: es lo que mantiene la numeracion.
        if (comment === 'line' && c === '\n') comment = null;
        else if (comment === 'block' && c === '*' && next === '/') {
          comment = null;
          out += '  ';
          i++;
          continue;
        }
        out += c === '\n' ? '\n' : ' ';
        continue;
      }

      if (quote) {
        // Una comilla escapada no cierra el string.
        if (c === '\\') {
          out += src.slice(i, i + 2);
          i++;
          continue;
        }
        if (c === quote) quote = null;
        out += c;
        continue;
      }

      if (c === '/' && next === '/') {
        comment = 'line';
        out += ' ';
        continue;
      }
      if (c === '/' && next === '*') {
        comment = 'block';
        out += ' ';
        continue;
      }
      if (c === '"' || c === "'" || c === '`') quote = c;
      out += c;
    }

    return out;
  };

  /**
   * EL GUARD TAMBIEN SE PRUEBA. El de abajo solo sirve si borra los comentarios y NADA MAS: si se
   * come parte del codigo, acusa a archivos sanos; si deja pasar un comentario, no ve al culpable.
   */
  it('saca los comentarios sin tocar lo que hay adentro de un string', () => {
    // El caso que lo rompio: `https://` tiene dos barras y no es un comentario.
    const url = withoutComments('const U = `https://play.google.com/x`;');
    expect(url).toContain('play.google.com');
    expect(url).toContain(';');

    // Y lo que si tiene que borrar.
    expect(withoutComments('const A = 1; // L.stats')).not.toMatch(/\bL\./);
    expect(withoutComments('const B = 2; /* L.stats */')).not.toMatch(/\bL\./);

    // Un comentario despues de un string con barras: el string queda, el comentario no.
    const mixto = withoutComments("const C = 'a//b'; // L.stats");
    expect(mixto).toContain("'a//b'");
    expect(mixto).not.toMatch(/\bL\./);

    // La numeracion de lineas no se mueve: de eso depende que el error apunte al lugar correcto.
    const tresLineas = withoutComments('const A = 1;\n// L.stats\nconst B = 2;');
    expect(tresLineas.split('\n')).toHaveLength(3);
  });

  it('ningun archivo lee `L` en una constante de modulo', async () => {
    const files = [join(ROOT, 'App.tsx'), ...(await sources(join(ROOT, 'src')))];
    const offenders: string[] = [];

    for (const file of files) {
      const lines = withoutComments(readFileSync(file, 'utf8')).split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        // Una declaracion a nivel de modulo: empieza en la columna cero.
        if (!/^(export )?(const|let) /.test(line)) continue;

        // La declaracion entera, hasta que cierre.
        let stmt = line;
        for (let j = i + 1; j < lines.length && !/;\s*$/.test(stmt); j++) {
          stmt += `\n${lines[j]!}`;
        }

        const usa = /\bL\./.exec(stmt);
        if (!usa) continue;

        /**
         * SI EL `=>` VIENE ANTES DEL `L.`, es una funcion que lee el diccionario al llamarla, y
         * eso es lo correcto — no un valor que se copia al cargar el modulo.
         *
         * Se mira el STATEMENT entero y no la primera linea: una funcion con la firma cortada en
         * varias lineas —`const rally = (\n  c: Colors,\n): ... => [`— tiene el `=>` recien en la
         * tercera, y mirando solo la primera se la acusaba de congelar el diccionario. Lo que
         * decide es el ORDEN, no en que renglon cae cada cosa.
         */
        const flecha = stmt.indexOf('=>');
        const esFuncion =
          (flecha !== -1 && flecha < usa.index) ||
          /\bfunction\b/.test(stmt.slice(0, usa.index));
        if (esFuncion) continue;

        offenders.push(`${file.replace(ROOT, '').slice(1)}:${i + 1} — ${line.trim()}`);
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
      expect(dict.shots.vibora).toBe('Víbora');
    }
  });
});
