import { describe, expect, it } from 'vitest';

import { BASE_TOTAL, LINE, layout, TOUCH_MIN } from './layout';

/**
 * Telefonos reales, con el alto y el ancho UTILES: ya descontadas las barras de sistema,
 * que es lo que `useMetrics` le pasa a `layout`.
 *
 * Son todos Android a proposito: la version 1 sale solo para Android, en Play Store. El mas
 * chico de la lista (360x640) es el piso real del parque de dispositivos — si ahi entra,
 * entra en cualquier cosa que alguien lleve a una cancha.
 *
 * ⚠️ Cuando se agregue iOS hay que volver a correr esto: un iPhone SE de primera generacion
 * mide 320 de ancho y la hoja de golpes no le entra sin apretar los botones por debajo del
 * piso tactil.
 */
const PHONES = [
  { name: 'Android chico (360x640)', avail: 568, availW: 360 },
  { name: 'Galaxy A (360x780)', avail: 708, availW: 360 },
  { name: 'el telefono de Betiana (360x800)', avail: 728, availW: 360 },
  { name: 'Pixel 7 (412x883)', avail: 811, availW: 412 },
  { name: 'Pixel 8 Pro (412x892)', avail: 820, availW: 412 },
  { name: 'tablet Android (800x1280)', avail: 1208, availW: 800 },
];

/**
 * Rehace la reparticion que hace flex en pantalla, para poder afirmar algo que de otra
 * forma solo se puede ver a ojo en un dispositivo: que el contenido de la tarjeta ENTRA en
 * la tarjeta. Es exactamente el bug que teniamos — los botones se salian por abajo y la
 * fila siguiente les pasaba por encima.
 */
const fit = (avail: number, availW: number) => {
  const m = layout(avail, availW);

  const boardH = m.board.padV * 2 + m.board.header + m.board.cell * 2 + m.board.rowGap;
  const bottomH = m.bottom.pad * 2 + m.bottom.util;
  const courtH = avail - boardH - bottomH;

  // Dos filas de tarjetas, con el gap entre ellas y el padding de la cancha alrededor.
  const cardH = Math.floor((courtH - m.court.pad * 2 - m.court.gap) / 2);
  const cardW = (availW - m.court.pad * 2 - m.court.gap) / 2;

  // Lo que la tarjeta gasta si o si; lo que sobra es para el avatar, que se estira solo.
  const nameH = Math.round(m.card.name * LINE);
  const identityH = cardH - m.card.pad * 2 - m.card.serve - m.card.rally;
  const avatar = Math.min(m.card.avatarMax, identityH - m.card.gap * 2 - nameH - m.card.pill);

  // Los tres botones de una fila, con su gap y el padding interno de cada uno.
  const btnW = (cardW - m.card.pad * 2 - m.card.rowGap * 2) / 3;
  const textW = btnW - m.card.btnPadH * 2;

  return { m, cardH, identityH, avatar, textW };
};

/** Lo que ocupa una palabra, con el mismo criterio con el que layout.ts decide la fuente. */
const wordW = (chars: number, size: number, ratio: number) => chars * size * ratio;

describe('la escala del diseno', () => {
  it('nunca agranda: en una pantalla grande sobra aire, no crece nada', () => {
    expect(layout(BASE_TOTAL, 400).scale).toBe(1);
    expect(layout(BASE_TOTAL * 3, 400).scale).toBe(1);
  });

  it('encoge en proporcion cuando la pantalla es mas chica que el diseno', () => {
    expect(layout(BASE_TOTAL / 2, 320).scale).toBeLessThan(1);
    // Pero nunca hasta desaparecer.
    expect(layout(1, 320).scale).toBeGreaterThan(0.5);
  });

  it.each(PHONES)('$name: la tarjeta entra entera', ({ avail, availW }) => {
    const { identityH, avatar } = fit(avail, availW);

    // Que la identidad tenga alto positivo es lo que dice que los botones no se desbordan.
    expect(identityH).toBeGreaterThan(0);
    // Y un avatar de menos de 28 dp ya no es un avatar, es una mancha.
    expect(avatar).toBeGreaterThanOrEqual(28);
  });

  it.each(PHONES)('$name: lo que se toca respeta el piso tactil', ({ avail, availW }) => {
    const { m } = fit(avail, availW);

    expect(m.card.serve).toBeGreaterThanOrEqual(TOUCH_MIN);
    expect(m.card.rally).toBeGreaterThanOrEqual(TOUCH_MIN);
    expect(m.bottom.util).toBeGreaterThanOrEqual(TOUCH_MIN);
  });

  /**
   * LO QUE NO SE PUEDE CORTAR NUNCA: la palabra del boton de saque y la inicial del de punto.
   *
   * Son las dos cosas que se tocan sin leer, mirando la cancha. Un "FAU…" o un "E…" no es un
   * texto mas chico: es un boton que hay que descifrar justo cuando no hay tiempo.
   *
   * LA DESCRIPCION SI SE PUEDE CORTAR, Y ESTA DECIDIDO. En un telefono de 360 dp ese boton deja
   * unos 36 dp de texto —seis caracteres— y las descripciones miden entre 8 y 11 ("Unforced",
   * "No forzado", "Non forzato"). Entrarlas enteras costaba partirlas en dos lineas o inventar
   * palabras mas cortas, y no lo valen: quien elige el boton se guia por la inicial y por el
   * color, que son enormes. La descripcion esta para que alguien entienda QUE es un ENF la
   * primera vez, y para eso "No forz…" alcanza.
   *
   * Este test decia que la descripcion tampoco se cortaba, y era mentira: media contra
   * "forzado" (7 caracteres), que fue la palabra mas larga hasta que dejo de serlo. Un test en
   * verde que afirma algo falso es peor que no tenerlo — es el que te hace confiar.
   */
  it.each(PHONES)('$name: lo que se toca sin leer nunca se corta', ({ avail, availW }) => {
    const { m, textW } = fit(avail, availW);

    // FALTA y DOBLE: cinco caracteres en negrita.
    expect(wordW(5, m.card.serveFont, 0.72)).toBeLessThanOrEqual(textW);
    // ENF: tres.
    expect(wordW(3, m.card.rallyFont, 0.72)).toBeLessThanOrEqual(textW);
  });

  it.each(PHONES)('$name: y aun asi se sigue leyendo', ({ avail, availW }) => {
    const { m } = fit(avail, availW);

    // La inicial del boton es lo que se busca de un vistazo: es lo ultimo que puede encoger.
    expect(m.card.rallyFont).toBeGreaterThanOrEqual(13);
    expect(m.card.serveFont).toBeGreaterThanOrEqual(9);
    expect(m.card.rallyDesc).toBeGreaterThanOrEqual(7);
    expect(m.card.name).toBeGreaterThanOrEqual(11);
    expect(m.board.names).toBeGreaterThanOrEqual(11);
  });

  /**
   * La promesa de la hoja de golpes: NO scrollea. Scrollear en medio de un punto es lo peor
   * que puede pasar. Asi que tiene que entrar entera en la pantalla, en todos los telefonos
   * y con los 9 golpes visibles a la vez.
   */
  it.each(PHONES)('$name: la hoja de golpes entra sin scroll', ({ avail, availW }) => {
    const m = layout(avail, availW);
    expect(m.sheet.height).toBeLessThanOrEqual(avail);
  });

  it.each(PHONES)('$name: y sus filas se siguen pudiendo tocar', ({ avail, availW }) => {
    const m = layout(avail, availW);
    // Si esto empieza a bajar del piso tactil, hay que SACAR algo de la hoja — no seguir
    // apretando las filas hasta que no se puedan tocar.
    expect(m.sheet.row).toBeGreaterThanOrEqual(TOUCH_MIN);
    // La X que cierra tambien se toca, y con la mano apurada.
    expect(m.sheet.close).toBeGreaterThanOrEqual(TOUCH_MIN);
  });

  /**
   * El techo paso de 15% a 17%, y no fue porque el test molestaba.
   *
   * El tanteador estaba escrito en letra chica, y es la unica parte de la cancha que hay que LEER:
   * un nombre, un "40", un 6-4. Los botones no se leen —se reconocen por color y por posicion— asi
   * que tenerlos grandes a ellos y el tanteador chico era exactamente al reves. Se le devolvieron
   * dos puntos de alto, que salen del avatar, que no los necesita.
   *
   * El techo sigue puesto porque el peligro es real y es lento: cada vez que algo del tanteador
   * crece un poquito, la cancha pierde un poquito, y nadie se da cuenta hasta que los botones no
   * se pueden tocar. Si esto vuelve a fallar, la pregunta no es "¿subimos el numero?" — es "¿que
   * sacamos del tanteador?".
   */
  it('el tanteador no se come la cancha: en ninguna pantalla se lleva mas del 17%', () => {
    for (const { avail, availW } of PHONES) {
      const m = layout(avail, availW);
      const boardH = m.board.padV * 2 + m.board.header + m.board.cell * 2 + m.board.rowGap;
      expect(boardH / avail).toBeLessThan(0.17);
    }
  });
});
