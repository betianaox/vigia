import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { themes } from './theme';

/**
 * NADIE CONGELA LOS COLORES.
 *
 * Es el hermano del guard del diccionario, y existe por lo mismo. Un `StyleSheet.create` a nivel
 * de modulo corre UNA SOLA VEZ, cuando se carga el archivo: lo que lea de ahi se queda con el
 * tema que estuviera puesto en ese momento y no se entera nunca de que la persona lo cambio.
 *
 * Sin esta prueba, la migracion al tema claro se deshace sola. Alcanza con que alguien agregue
 * una pantalla copiando el patron viejo —y el patron viejo es el que esta en la mayoria de los
 * archivos hasta que se termine de migrar— para que esa pantalla quede oscura para siempre.
 *
 * Lo que se permite: `colors` (el tema oscuro) importado a proposito en los pocos lugares que NO
 * pueden seguir al tema y estan documentados como tales: el icono sobre la foto del inicio y el
 * texto sobre el verde de los botones, que se apoyan en algo que NO cambia con el tema.
 */
describe('nadie congela los colores', () => {
  const ROOT = join(__dirname, '..', '..');

  const sources = async (dir: string): Promise<string[]> => {
    const out: string[] = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue;
        out.push(...(await sources(full)));
      } else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) {
        out.push(full);
      }
    }
    return out;
  };

  it('los dos temas definen exactamente los mismos colores', () => {
    const oscuro = Object.keys(themes.oscuro).sort();
    const claro = Object.keys(themes.claro).sort();
    expect(claro).toEqual(oscuro);
  });

  it('todos los colores son hex de seis digitos', () => {
    for (const [nombre, paleta] of Object.entries(themes)) {
      for (const [clave, valor] of Object.entries(paleta)) {
        expect(valor, `${nombre}.${clave}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  /**
   * El claro NO puede ser una copia del oscuro con otro nombre: si alguien agrega un color al
   * oscuro y se olvida de pensarlo para el claro, el spread lo hereda y nadie se entera. Esta
   * prueba no dice CUALES tienen que cambiar —eso es criterio— pero si que el fondo y el texto,
   * que son la definicion misma de un tema, no pueden ser iguales en los dos.
   */
  it('el claro no es el oscuro disfrazado', () => {
    for (const clave of ['bg', 'surface', 'text', 'textDim'] as const) {
      expect(themes.claro[clave], clave).not.toBe(themes.oscuro[clave]);
    }
  });

  it('ninguna pantalla arma sus estilos con colores congelados', async () => {
    const archivos = await sources(join(ROOT, 'src', 'ui'));
    const culpables: string[] = [];

    for (const archivo of archivos) {
      const src = readFileSync(archivo, 'utf8');
      // `theme.ts` ES la definicion, y la tarjeta compartible es oscura a proposito.
      if (/theme\.ts$/.test(archivo)) continue;

      const lineas = src.split('\n');
      for (let i = 0; i < lineas.length; i++) {
        // Un `StyleSheet.create` que arranca en la columna cero es de modulo.
        if (!/^const \w+ = StyleSheet\.create\(/.test(lineas[i]!)) continue;

        // Desde ahi hasta el final del archivo: si adentro se lee `colors.`, quedo congelado.
        const resto = lineas.slice(i).join('\n');
        if (/\bcolors\./.test(resto)) {
          culpables.push(archivo.replace(ROOT, '').slice(1).replace(/\\/g, '/'));
        }
      }
    }

    expect(culpables).toEqual([]);
  });

  /**
   * Y NADIE VUELVE A ESCRIBIR "UN POCO MAS CLARO QUE EL FONDO".
   *
   * Es el mismo error cuatro veces: el perdedor atenuado con `opacity`, el borde blanco del que
   * saca, el boton deshabilitado, y el casillero de puntos en vivo. Los cuatro decian lo mismo
   * —"esto va un paso mas claro"— y los cuatro se rompieron igual, porque sobre un fondo claro
   * aclarar es acercarse al fondo, o sea desaparecer. Ninguno se ve en un `git diff` como un
   * problema: se ve como un color.
   *
   * Lo que se prohibe es el BLANCO literal dentro de `alpha`, que es como se escribe esa idea.
   * Con un color del tema —`c.text`, `c.bg`— la relacion se mantiene sola en los dos.
   *
   * El negro literal SI se permite, y es la unica excepcion: el velo detras de un dialogo es
   * oscuro en todos lados, en cualquier app y con cualquier tema. Ahi el literal no es un
   * descuido, es la decision.
   */
  it('nadie escribe un blanco literal adentro de alpha', async () => {
    const archivos = await sources(join(ROOT, 'src'));
    const culpables: string[] = [];

    for (const archivo of archivos) {
      const src = readFileSync(archivo, 'utf8');
      // `#FFF` y `#FFFFFF`, en cualquier caja: los dos se escriben empezando por tres efes.
      if (/alpha\(\s*['"]#[Ff]{3}/.test(src)) {
        culpables.push(archivo.replace(ROOT, '').slice(1).replace(/\\/g, '/'));
      }
    }

    expect(culpables).toEqual([]);
  });
});
