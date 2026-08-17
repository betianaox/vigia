import type {
  Formation,
  GameFormat,
  MatchConfig,
  Player,
  TeamId,
  ThirdSetFormat,
} from '../engine';

/**
 * EL PLAN DE UNA TEMPORADA, sin tocar el disco.
 *
 * Vive aparte de `seed.ts` porque ese importa `store/matches`, que a su vez importa
 * expo-file-system y no se puede cargar fuera de un telefono. Separandolo, la temporada se puede
 * verificar en los tests: que la mejora del protagonista se note de verdad, que aparezcan los
 * tres reglamentos y que las fechas salgan en orden. Esas son las cosas que hacen que una captura
 * sirva o no sirva, y descubrirlas enchufando el telefono cuesta un ciclo entero.
 */

/** El que juega todos los partidos. Su ficha es la que se mira en las capturas. */
export const PROTAGONISTA = 'Ana Ruiz';

/** Rotan de compañero. Nombres cortos: en una tarjeta compartible el espacio es real. */
export const COMPANEROS = ['Aldo Vega', 'Sofi Bravo', 'Meli Arce'];

/**
 * Los rivales van de a PAREJAS FIJAS, no sorteados de una bolsa: asi el cara a cara tiene
 * sentido —te enfrentaste varias veces a la misma pareja— en vez de cuatro nombres distintos
 * cada vez, que no deja comparar nada.
 */
export const RIVALES: [string, string][] = [
  ['Bea Sosa', 'Beto Lino'],
  ['Caro Vidal', 'Nico Paz'],
  ['Delfi Ortiz', 'Tomi Ferro'],
];

/** Todo el plantel de la temporada, en el orden en que conviene crearlo. */
export const PLANTEL = [PROTAGONISTA, ...COMPANEROS, ...RIVALES.flat()];

const DIA = 24 * 60 * 60 * 1000;

/** Como queda un partido de la temporada, antes de saber quien es quien. */
export interface SeasonSlot {
  companero: string;
  rivales: [string, string];
  gameFormat: GameFormat;
  thirdSet: ThirdSetFormat;
  formationB: Formation;
  firstServingTeam: TeamId;
  strengthA: number;
  seed: number;
  startedAt: number;
}

export function planSeason(total: number, spanDays: number, now: number): SeasonSlot[] {
  const slots: SeasonSlot[] = [];

  for (let i = 0; i < total; i++) {
    /* El formato rota por posicion y no al azar: asi la muestra tiene con certeza los tres
       reglamentos y los dos formatos de tercer set, en vez de depender de la suerte. */
    const gameFormat: GameFormat = (
      ['ventajas', 'punto_de_oro', 'punto_estrella'] as GameFormat[]
    )[i % 3]!;

    /* LA MEJORA. De 0.44 a 0.60 a lo largo de la temporada: empieza perdiendo la mayoria y
       termina ganando la mayoria. El ruido de ±0.03 evita la escalera perfecta, que en un
       grafico se nota falsa a simple vista. */
    const avance = total > 1 ? i / (total - 1) : 1;
    const ruido = ((i * 37) % 7) / 100 - 0.03;

    // De mas viejo a mas nuevo, con dias irregulares en el medio: una temporada no se juega
    // con un partido cada exactamente cinco dias.
    const diasAtras = Math.round(spanDays * (1 - avance)) + ((i * 13) % 4);

    slots.push({
      companero: COMPANEROS[i % COMPANEROS.length]!,
      rivales: RIVALES[i % RIVALES.length]!,
      gameFormat,
      thirdSet: i % 4 === 3 ? 'super_tiebreak' : 'set_normal',
      formationB: i % 2 === 0 ? 'australiana' : 'cambio',
      firstServingTeam: i % 2 === 0 ? 'A' : 'B',
      strengthA: 0.44 + avance * 0.16 + ruido,
      seed: 1000 + i * 17,
      startedAt: now - diasAtras * DIA - ((i * 7) % 9) * 60 * 60 * 1000,
    });
  }

  return slots;
}

/** Arma la configuracion de un partido de la temporada. Pura: no toca el disco. */
export function seasonConfig(
  slot: SeasonSlot,
  hero: Player,
  companero: Player,
  rivalDrive: Player,
  rivalReves: Player,
): MatchConfig {
  return {
    players: Object.fromEntries(
      [hero, companero, rivalDrive, rivalReves].map((p) => [p.id, p]),
    ),
    teams: {
      A: { id: 'A', drive: hero.id, reves: companero.id, formation: 'australiana' },
      B: {
        id: 'B',
        drive: rivalDrive.id,
        reves: rivalReves.id,
        formation: slot.formationB,
      },
    },
    serveOrder: { A: [hero.id, companero.id], B: [rivalDrive.id, rivalReves.id] },
    firstServingTeam: slot.firstServingTeam,
    gameFormat: slot.gameFormat,
    length: 'tres_sets',
    thirdSet: slot.thirdSet,
    changeEnds: 'fin_de_set',
  };
}
