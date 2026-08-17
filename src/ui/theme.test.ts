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
 * pueden seguir al tema y estan documentados como tales — la tarjeta que se comparte por
 * WhatsApp, el icono sobre la foto del inicio, el texto sobre el verde del boton.
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

  /**
   * LO QUE FALTA MIGRAR, ESCRITO. La lista solo puede ACHICARSE: si aparece un archivo que no
   * esta aca, el test falla.
   *
   * Va como lista y no como un `skip` general por una razon: un test que falla porque hay trabajo
   * pendiente se ignora a los dos dias, y entonces deja de proteger lo que ya se migro. Asi,
   * cada pantalla que se migra se borra de aca, y el dia que quede vacia se borra la lista.
   */
  const PENDIENTES = [
    'src/ui/Brand.tsx',
    'src/ui/CareerScreen.tsx',
    'src/ui/Confirm.tsx',
    'src/ui/HistoryScreen.tsx',
    'src/ui/PlayersScreen.tsx',
    'src/ui/ResumeScreen.tsx',
    'src/ui/ScoreboardPreview.tsx',
    'src/ui/StatsScreen.tsx',
    'src/ui/WideStat.tsx',
    'src/ui/charts/HeadToHead.tsx',
    'src/ui/charts/ShotBars.tsx',
    'src/ui/charts/ShotGrid.tsx',
    'src/ui/charts/ShotStack.tsx',
    'src/ui/charts/TeamCompare.tsx',
    'src/ui/charts/Trend.tsx',
  ];

  it('ninguna pantalla NUEVA arma sus estilos con colores congelados', async () => {
    const archivos = await sources(join(ROOT, 'src', 'ui'));
    const culpables: string[] = [];

    for (const archivo of archivos) {
      const src = readFileSync(archivo, 'utf8');
      // `theme.ts` ES la definicion, y la tarjeta compartible es oscura a proposito.
      if (/theme\.ts$/.test(archivo) || /ShareCard\.tsx$/.test(archivo)) continue;

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

    const nuevos = culpables.filter((f) => !PENDIENTES.includes(f));
    expect(nuevos).toEqual([]);
  });

  /**
   * Y LA DEUDA NO PUEDE ENVEJECER EN SILENCIO. Si una pantalla se migra y nadie la saca de la
   * lista, esta prueba avisa: la lista tiene que decir la verdad para servir de algo.
   */
  it('la lista de pendientes no tiene archivos que ya se migraron', async () => {
    const archivos = await sources(join(ROOT, 'src', 'ui'));
    const congelados = new Set<string>();

    for (const archivo of archivos) {
      const src = readFileSync(archivo, 'utf8');
      const lineas = src.split('\n');
      for (let i = 0; i < lineas.length; i++) {
        if (!/^const \w+ = StyleSheet\.create\(/.test(lineas[i]!)) continue;
        if (/\bcolors\./.test(lineas.slice(i).join('\n'))) {
          congelados.add(archivo.replace(ROOT, '').slice(1).replace(/\\/g, '/'));
        }
      }
    }

    const yaMigrados = PENDIENTES.filter((f) => !congelados.has(f));
    expect(yaMigrados).toEqual([]);
  });
});
