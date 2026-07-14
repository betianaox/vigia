import type { MatchConfig, PlayerId, TeamId } from '../../engine';
import { pct, type MatchStats, type PlayerStats } from '../../engine/stats';
import { L } from '../../i18n';
import { colors } from '../theme';
import type { Cell, Row } from './HeadToHead';

const num = (n: number | null, suffix = ''): string =>
  n === null ? '—' : `${Math.round(n)}${suffix}`;

/**
 * Parte la etiqueta en dos renglones, por el ultimo espacio.
 *
 * Todas las filas tienen que medir lo mismo para que la grilla se lea pareja, y antes el corte
 * venia escrito a mano en el texto ("Errores\nno forzados"). Un salto de linea adentro de una
 * traduccion es una trampa: en ingles la frase tiene otro largo y otro quiebre, y el traductor no
 * tiene por que saber donde poner el `\n`. Que lo calcule el codigo.
 */
const wrap = (label: string): string => {
  const cut = label.lastIndexOf(' ');
  return cut === -1 ? label : `${label.slice(0, cut)}\n${label.slice(cut + 1)}`;
};

/**
 * Las filas de la comparativa, POR JUGADOR. Un entrenador no corrige a un equipo: la suma por
 * equipo esconde cual de los dos esta tirando los errores.
 *
 * Vive fuera de la pantalla porque la tarjeta que se comparte muestra ESTAS MISMAS filas. Que
 * las dos las calculen por su cuenta seria pedir que dos codigos distintos digan siempre lo
 * mismo — y el dia que uno cambie, la tarjeta va a mentir sin que nadie se entere.
 *
 * Las etiquetas van partidas en dos renglones a proposito, para que todas las filas midan lo
 * mismo y la grilla se lea pareja.
 */
export const playerRows = (
  stats: MatchStats,
  config: MatchConfig,
  /**
   * Los tres porcentajes de saque.
   *
   * En la pantalla van, porque hay lugar y quien la abre fue a buscar el detalle. En la tarjeta
   * NO: el saque importa, pero en padel no define el punto como en tenis, y darle tres de ocho
   * filas seria gastar media tarjeta en un solo golpe mientras winners y errores —que si deciden
   * el partido— se quedan afuera. El saque conserva ahi lo que aporta de verdad: aces y dobles.
   *
   * La excepcion es la tarjeta de un partido anotado en modo simple: sin golpes que mostrar,
   * queda un hueco, y el saque es lo mejor que hay para llenarlo (ver `serveRows`).
   */
  serveDetail: boolean,
): Row[] => {
  const four = (['A', 'B'] as TeamId[]).map((t) =>
    [config.teams[t].drive, config.teams[t].reves].map((id: PlayerId) => stats.players[id]!),
  ) as [PlayerStats[], PlayerStats[]];

  const cells = (
    pick: (p: PlayerStats) => number,
    fmt: (p: PlayerStats) => string,
  ): Pick<Row, 'a' | 'b'> => ({
    a: four[0].map((p) => ({ text: fmt(p), value: pick(p) })) as [Cell, Cell],
    b: four[1].map((p) => ({ text: fmt(p), value: pick(p) })) as [Cell, Cell],
  });

  const count = (label: string, pick: (p: PlayerStats) => number, fill?: string): Row => ({
    label,
    fill,
    ...cells(pick, (p) => `${pick(p)}`),
  });

  const percent = (
    label: string,
    won: (p: PlayerStats) => number,
    played: (p: PlayerStats) => number,
  ): Row => ({
    label,
    ...cells(
      (p) => pct(won(p), played(p)) ?? 0,
      (p) => num(pct(won(p), played(p)), '%'),
    ),
  });

  /**
   * Cada fila con el color del BOTON que la genero. La barra deja de decir "quien va ganando" y
   * pasa a decir "de que accion hablamos" — y asi ninguna fila se lee al reves de las otras.
   *
   * La doble falta no tiene boton propio (existe FALTA, que es blanco, y una barra blanca seria
   * lo mas brillante de la pantalla para la peor estadistica). Va en bordo, que es el color con
   * el que la app ya dice "mas es peor".
   *
   * Los porcentajes de saque no salen de ningun boton y ahi mas SI es mejor: color de equipo.
   */
  const rows: Row[] = [
    count(L.stats.winners, (p) => p.winners, colors.winnerChart),
    count(wrap(L.stats.unforcedErrors), (p) => p.unforcedErrors, colors.errorUnforcedChart),
    count(wrap(L.stats.forcedErrors), (p) => p.forcedErrors, colors.errorForcedChart),
    count(L.stats.aces, (p) => p.aces, colors.ace),
    count(wrap(L.stats.doubleFaults), (p) => p.doubleFaults, colors.worse),
  ];

  if (!serveDetail) return rows;

  return [
    ...rows,
    percent(
      wrap(L.stats.firstServeIn),
      (p) => p.firstServesIn,
      (p) => p.servePointsPlayed,
    ),
    percent(
      wrap(L.stats.wonWithFirstLong),
      (p) => p.firstServePointsWon,
      (p) => p.firstServesIn,
    ),
    percent(
      wrap(L.stats.wonWithSecond),
      (p) => p.secondServePointsWon,
      (p) => p.secondServePointsPlayed,
    ),
  ];
};
