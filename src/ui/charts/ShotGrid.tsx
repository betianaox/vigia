import { StyleSheet, Text, View } from 'react-native';

import type { MatchConfig, PlayerId, Stroke, TeamId } from '../../engine';
import type { MatchStats, PlayerStats } from '../../engine/stats';
import { L } from '../../i18n';
import { STROKE_LABELS } from '../shots';
import { colors, space } from '../theme';

/** Lo que rindio UN golpe en las manos de UNA persona. */
interface Cell {
  winners: number;
  forced: number;
  unforced: number;
}

export interface GridRow {
  shot: Stroke;
  /**
   * En el orden de la cabecera: drive y reves de A, drive y reves de B.
   *
   * `null` NO ES CERO. Cero es un dato —"no pego ni un remate ganador"— y se puede leer. Que a
   * esa persona no le hayan cargado un solo golpe en todo el partido es otra cosa completamente
   * distinta, y escribirla como un cero seria mentir con un numero. Va un guion.
   */
  cells: [Cell | null, Cell | null, Cell | null, Cell | null];
}

/** Si no tiene UN solo golpe cargado en todo el partido, no hay nada que contar. */
const tagged = (p: PlayerStats): boolean =>
  Object.keys(p.winnersByShot).length > 0 ||
  Object.keys(p.forcedByShot).length > 0 ||
  Object.keys(p.unforcedByShot).length > 0;

const cellOf = (p: PlayerStats, shot: Stroke): Cell | null =>
  tagged(p)
    ? {
        winners: p.winnersByShot[shot] ?? 0,
        forced: p.forcedByShot[shot] ?? 0,
        unforced: p.unforcedByShot[shot] ?? 0,
      }
    : null;

/** Los cuatro, en el orden en que se leen: drive y reves de A, drive y reves de B. */
export const gridPlayers = (config: MatchConfig): PlayerId[] =>
  (['A', 'B'] as TeamId[]).flatMap((t) => [config.teams[t].drive, config.teams[t].reves]);

/**
 * LOS CUATRO GOLPES DE LA TARJETA. Siempre estos, siempre en este orden.
 *
 * No son los mas usados: son los que DECIDEN. El remate y la bandeja son con lo que se ataca
 * desde la red, la volea es como se sostiene, y el globo es como se sale de abajo — son las
 * cuatro decisiones que definen un punto de padel. La chiquita, la dejada y la recuperacion se
 * juegan mucho, pero que alguien haya pegado quince recuperaciones no dice casi nada de como
 * jugo: son golpes de transito.
 *
 * Que sean FIJOS ademas hace que dos tarjetas se puedan comparar entre si. Si cada partido
 * mostrara sus mas usados, la fila de arriba diria una cosa distinta en cada imagen, y ninguna
 * seria comparable con la de la semana pasada. La app tiene el desglose completo; la tarjeta
 * tiene una tabla estable.
 */
export const CARD_STROKES: Stroke[] = ['remate', 'bandeja', 'volea', 'globo'];

export const shotGrid = (stats: MatchStats, config: MatchConfig): GridRow[] => {
  const ids = gridPlayers(config);
  return CARD_STROKES.map((shot) => ({
    shot,
    cells: ids.map((id) => cellOf(stats.players[id]!, shot)) as [Cell, Cell, Cell, Cell],
  }));
};

/**
 * Los golpes de cada persona, en numeros.
 *
 * En la app este mismo dato va en barras apiladas, que es lo que hay que mirar para ESTUDIAR un
 * partido: la proporcion de winners y errores de un golpe se ve sin leer. Pero en la tarjeta esa
 * barra cuesta carisima —un bloque por equipo, con su cabecera— y una tarjeta que hay que hacer
 * scroll en un chat no la mira nadie.
 *
 * Con numeros, los CUATRO jugadores entran en la misma fila. El bloque se parte al medio de alto
 * y de paso se comparan de un vistazo, que es lo que uno hace cuando la recibe. Estudiar es en la
 * app; la tarjeta es la foto.
 */
export function ShotGrid({
  rows,
  names,
  colorA,
  colorB,
}: {
  rows: GridRow[];
  /** Los cuatro nombres, en el orden de `gridPlayers`. */
  names: [string, string, string, string];
  colorA: string;
  colorB: string;
}) {
  const tint = [colorA, colorA, colorB, colorB];

  return (
    <View>
      {/* La leyenda, UNA vez. Los tres colores son los de siempre: los de la cancha, apagados
          como corresponde a un grafico. Si el que la recibe ya vio la app, no lee nada de esto. */}
      <View style={s.legend}>
        {[
          [L.stats.winners, colors.winnerChart],
          [L.stats.forcedShort, colors.errorForcedChart],
          [L.stats.unforcedLegend, colors.errorUnforcedChart],
        ].map(([label, color]) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.swatch, { backgroundColor: color }]} />
            <Text style={s.legendText}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={s.head}>
        <View style={s.label} />
        {names.map((n, i) => (
          <Text key={n + i} style={[s.name, { color: tint[i] }]} numberOfLines={1}>
            {n}
          </Text>
        ))}
      </View>

      {rows.map((r) => (
        <View key={r.shot} style={s.row}>
          <Text style={[s.label, s.labelText]} numberOfLines={1}>
            {STROKE_LABELS[r.shot]}
          </Text>

          {r.cells.map((c, i) => (
            <View key={i} style={s.cell}>
              {c === null ? (
                // Un guion, no tres ceros: nadie cargo los golpes de esta persona.
                <Text style={s.none}>—</Text>
              ) : (
                <>
                  <Text style={[s.n, { color: colors.winnerChart }]}>{c.winners}</Text>
                  <Text style={[s.n, { color: colors.errorForcedChart }]}>{c.forced}</Text>
                  <Text style={[s.n, { color: colors.errorUnforcedChart }]}>{c.unforced}</Text>
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  legend: { flexDirection: 'row', gap: space.md, paddingBottom: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { color: colors.textDim, fontSize: 9, fontWeight: '700' },

  head: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 4 },
  /** El nombre de pila, centrado sobre SUS tres numeros. */
  name: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '800' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  label: { width: 84 },
  labelText: { color: colors.textDim, fontSize: 10.5, fontWeight: '600' },

  /** Los tres numeros de una persona, juntos: se leen como un grupo, no como tres columnas. */
  cell: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  n: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  /** Apagado a proposito: la ausencia de dato no compite con los datos. */
  none: { color: colors.textFaint, fontSize: 12, fontWeight: '800' },
});
