/**
 * La escala del diseno. Modulo puro a proposito: no importa React ni React Native, asi se
 * puede testear contra teléfonos de verdad sin levantar la app (ver layout.test.ts).
 *
 * El problema que resuelve: el diseno estaba escrito en pixeles fijos, adentro de cajas
 * elasticas. Cuando la pantalla no daba, el contenido no encogia — se desbordaba, y la fila
 * de tarjetas de abajo le pasaba por encima a los botones de la de arriba.
 *
 * Se mide UNA vez el alto realmente disponible (la ventana menos las barras de sistema) y
 * de ese numero sale todo lo demas. No hay variantes ni escalones: es el mismo diseno
 * multiplicado por un factor.
 *
 * Ojo con lo que este modulo NO hace: no reparte el alto de la cancha ni el de las
 * tarjetas. De eso se encarga flex, que para eso esta. Aca solo se decide CUANTO encoge el
 * diseno, y se publican las medidas que flex no puede deducir solo: las que dependen del
 * cuerpo — el pulgar, el ojo — y que por eso son absolutas y no un porcentaje de la
 * pantalla. Un pulgar no se agranda cuando el telefono es mas grande.
 */

/**
 * Piso tactil. Lo unico que NO encoge.
 *
 * Un boton mas chico que esto no se acierta con el pulgar, y menos en una cancha, apurado y
 * con la mano transpirada. Cuando falta alto, el espacio se lo sacamos al avatar y a los
 * paddings — que nadie toca con el dedo — antes que a lo que se toca.
 */
export const TOUCH_MIN = 44;

/** Cuanto puede encoger antes de que ya no valga la pena: mas abajo no hay telefonos. */
const MIN_SCALE = 0.7;

/**
 * El diseno con escala 1, en dp. Todo lo que se ve en pantalla sale de aca, y el alto que el
 * diseno PIDE (BASE_TOTAL) se calcula sumando estos mismos numeros: si toco uno, la escala
 * se reajusta sola y no queda nada desincronizado.
 */
const BASE = {
  /**
   * Tanteador. Cada equipo ocupa DOS lineas (un jugador arriba del otro, el de drive
   * primero, para que el orden coincida con las tarjetas de la cancha).
   *
   * Apilar los nombres no fue solo para que entren los largos: al ocupar dos lineas, las
   * celdas de GM y PTS pasan a abarcar el bloque entero — y con el doble de alto, el numero
   * crece un 30% mientras el tanteador crece un 4%.
   */
  boardPadV: 5,
  boardHeader: 11,
  boardNameLine: 16,
  boardRowGap: 2,
  /** La celda abarca las dos lineas del equipo. */
  cell: 32,
  cellGap: 4,
  ballSlot: 16,
  boardNames: 12,
  boardSmall: 9,
  setNum: 16,
  liveNum: 22,

  // Tarjeta de jugador
  cardPad: 8,
  rowGap: 4,
  btnPadH: 3,
  serve: 46,
  serveFont: 13,
  rally: 54,
  rallyFont: 15,
  rallyDesc: 9,
  avatar: 60,
  name: 13,
  pill: 19,
  gap: 8,
  pillFont: 9,

  // Cancha
  courtPad: 12,
  courtGap: 12,

  // Barra de abajo
  bottomPad: 8,
  util: 50,
  utilFont: 15,
  utilIcon: 24,

  // Hoja de golpes
  sheetPad: 12,
  /** El aire entre botones: si estan pegados, la grilla se lee como una pared. */
  sheetGap: 9,
  sheetTitle: 15,
  sheetLabel: 13,
  sheetBtn: 12,
  sheetVariant: 11,
  sheetRow: 56,
  sheetClose: 44,
  sheetCloseIcon: 24,
} as const;

/**
 * Las filas de la hoja de golpes: 5 golpes con lado + la fila sin lado (dejada y recuperacion)
 * + bandeja + remate.
 *
 * Eran 9. La hoja ahora se abre en CADA punto —el golpe dejo de estar detras de un gesto
 * invisible— asi que se paga en tiempo de lectura, no solo en espacio: cada fila que sobra es
 * medio segundo mirando la pantalla en vez de la cancha.
 */
const SHEET_ROWS = 8;

/** Una linea de texto ocupa algo mas que su tamano de fuente. */
export const LINE = 1.35;

/** Avatar + nombre + pildora, con un gap entre medio. Sin padding propio: ya lo pone la tarjeta. */
const BASE_IDENTITY = BASE.avatar + BASE.gap + BASE.name * LINE + BASE.gap + BASE.pill;
const BASE_CARD = BASE.cardPad * 2 + BASE.serve + BASE_IDENTITY + BASE.rally;
const BASE_BOARD =
  BASE.boardPadV * 2 + BASE.boardHeader + BASE.cell * 2 + BASE.boardRowGap;
const BASE_COURT = BASE.courtPad * 2 + BASE.courtGap + BASE_CARD * 2;
const BASE_BOTTOM = BASE.bottomPad * 2 + BASE.util;

/** Lo que el diseno pide, entero, para una pantalla a la que no le queda chico. */
export const BASE_TOTAL = BASE_BOARD + BASE_COURT + BASE_BOTTOM;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Ancho aproximado de un caracter, en fracciones del tamano de fuente. La negrita gruesa de
 * los botones es mucho mas ancha que el texto normal, y las mayusculas mas que las
 * minusculas. Son valores medidos sobre Roboto/Inter, redondeados para arriba: la idea es
 * quedarse corto con la fuente antes que partir una palabra en dos lineas.
 */
export const CHAR = { boldCaps: 0.72, semiLower: 0.56 } as const;

/** El tamano de fuente mas grande con el que `chars` caracteres entran en `boxW`. */
export const fitWidth = (chars: number, boxW: number, ratio: number) =>
  Math.floor(boxW / (chars * ratio));

export type Layout = ReturnType<typeof layout>;

/**
 * `avail` es el alto util y `availW` el ancho util: la ventana menos las barras de sistema.
 *
 * El alto decide CUANTO encoge el diseno. El ancho decide algo distinto y que antes no
 * miraba nadie: cuanto puede medir el TEXTO. Un boton de 46 dp de ancho no admite una
 * negrita de 19 px diga lo que diga la escala vertical — y cuando no admite, React Native
 * no avisa: parte la palabra o la corta con puntos suspensivos. Por eso cada fuente de los
 * botones se toma como el menor de los dos limites.
 */
export function layout(avail: number, availW: number) {
  const scale = clamp(avail / BASE_TOTAL, MIN_SCALE, 1);

  /** Escala una medida. Nunca hacia arriba: en una pantalla grande sobra aire, no crece nada. */
  const px = (n: number) => Math.round(n * scale);
  /** Las fuentes tienen su propio piso: una etiqueta ilegible no ocupa espacio, estorba. */
  const font = (n: number, min: number) => Math.max(min, Math.round(n * scale));

  const boardNameLine = px(BASE.boardNameLine);
  const board = {
    padV: px(BASE.boardPadV),
    padH: px(BASE.courtPad),
    header: px(BASE.boardHeader),
    nameLine: boardNameLine,
    rowGap: px(BASE.boardRowGap),
    /** Siempre exactamente las dos lineas del equipo: si no, la celda no alinea con los nombres. */
    cell: boardNameLine * 2,
    cellW: px(30),
    gap: px(BASE.cellGap),
    ballSlot: px(BASE.ballSlot),
    ball: px(8),
    names: font(BASE.boardNames, 10),
    small: font(BASE.boardSmall, 8),
    setNum: font(BASE.setNum, 13),
    sup: font(9, 8),
    liveNum: font(BASE.liveNum, 16),
  };

  const bottom = {
    pad: px(BASE.bottomPad),
    util: Math.max(TOUCH_MIN, px(BASE.util)),
    font: font(BASE.utilFont, 12),
    icon: px(BASE.utilIcon),
    gap: px(BASE.gap),
  };

  const court = { pad: px(BASE.courtPad), gap: px(BASE.courtGap) };

  const pad = px(BASE.cardPad);
  const rowGap = px(BASE.rowGap);

  /**
   * El ancho real de un boton de la tarjeta, que es el que manda sobre el texto: la fila
   * tiene tres botones iguales, con un gap entre medio, adentro de media pantalla.
   */
  const cardW = (availW - court.pad * 2 - court.gap) / 2;
  const btnW = (cardW - pad * 2 - rowGap * 2) / 3;
  const textW = btnW - px(BASE.btnPadH) * 2;

  /**
   * El avatar no tiene medida propia: en la tarjeta es un cuadrado con `aspectRatio: 1`
   * adentro de una caja `flex: 1`, asi que sale de lo que sobre. Lo unico que hace falta es
   * un techo, para que en una pantalla muy alta no se convierta en una pelota gigante.
   */
  const card = {
    pad,
    rowGap,
    gap: px(BASE.gap),
    btnPadH: px(BASE.btnPadH),

    serve: Math.max(TOUCH_MIN, px(BASE.serve)),
    /** Cinco caracteres: la palabra mas larga que va a entrar aca es FALTA (o DOBLE). */
    serveFont: Math.min(font(BASE.serveFont, 10), fitWidth(5, textW, CHAR.boldCaps)),

    rally: Math.max(TOUCH_MIN, px(BASE.rally)),
    /** Tres: ENF. Es la que rompia — se cortaba en "E...". */
    rallyFont: Math.min(font(BASE.rallyFont, 13), fitWidth(3, textW, CHAR.boldCaps)),
    /** Siete: "forzado", la palabra mas larga de las descripciones. */
    rallyDesc: Math.min(font(BASE.rallyDesc, 8), fitWidth(7, textW, CHAR.semiLower)),

    avatarMax: px(BASE.avatar),
    name: font(BASE.name, 11),
    pill: px(BASE.pill),
    pillFont: font(BASE.pillFont, 8),
  };

  /**
   * La hoja de golpes NO scrollea: scrollear en medio de un punto es lo peor que puede
   * pasar — se va el tiempo y se va la atencion. Asi que en vez de dejarla crecer y
   * deslizarse, se calcula el alto de fila que hace que las 9 filas MAS el encabezado
   * entren exactas en la pantalla. Si el telefono es chico, las filas se achican; el
   * contenido no se recorta ni se esconde nunca.
   */
  const sheetPad = px(BASE.sheetPad);
  const sheetGap = px(BASE.sheetGap);
  const sheetTitle = font(BASE.sheetTitle, 12);
  /** La X que cierra: es lo unico que se toca fuera de la grilla, y se toca igual que todo. */
  const sheetClose = Math.max(TOUCH_MIN, px(BASE.sheetClose));

  /**
   * Lo unico que la hoja gasta fuera de las filas: la barra del titulo, con la X.
   *
   * No hay subtitulo ("¿con que golpe?" es obvio mirando una grilla de golpes), ni encabezado
   * de columna (cada boton ya dice su lado), ni boton de saltear abajo (cierran el fondo, la X
   * y el boton de atras). Cada cosa que se saco de aca se convirtio en alto de boton.
   */
  const sheetChrome = sheetPad * 2 + sheetClose + sheetGap;
  /**
   * Al sacar el subtitulo y el boton de saltear, la fila entra en el piso tactil hasta en el
   * Android mas chico (360x640 da 48). El piso esta para que, si alguien agrega una fila a la
   * hoja, la cuenta no la absorba en silencio achicando todo: hay que SACAR algo, no seguir
   * apretando hasta que los botones no se puedan tocar.
   */
  const sheetRow = clamp(
    Math.floor((avail - sheetChrome - sheetGap * (SHEET_ROWS - 1)) / SHEET_ROWS),
    TOUCH_MIN,
    BASE.sheetRow,
  );

  const sheet = {
    pad: sheetPad,
    gap: sheetGap,
    title: sheetTitle,
    /** El area tactil de la X. */
    close: sheetClose,
    /** La X dibujada: mas grande que el titulo, porque es un boton y tiene que verse. */
    closeIcon: font(BASE.sheetCloseIcon, 18),
    label: font(BASE.sheetLabel, 10),
    btn: font(BASE.sheetBtn, 10),
    variant: font(BASE.sheetVariant, 9),
    row: sheetRow,
    /** Lo que mide la hoja entera, ya resuelta. De aca sale que no necesite scroll. */
    height: sheetChrome + sheetGap * (SHEET_ROWS - 1) + sheetRow * SHEET_ROWS,
  };

  return { avail, availW, scale, board, court, card, bottom, sheet };
}
