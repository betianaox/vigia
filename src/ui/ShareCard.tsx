import { StyleSheet, Text, View } from 'react-native';

import type { MatchConfig, MatchEvent, MatchState, PlayerId, TeamId } from '../engine';
import { computeStats } from '../engine/stats';
import { L, LOCALE } from '../i18n';
import { Brand } from './Brand';
import { HeadToHead } from './charts/HeadToHead';
import { playerRows } from './charts/playerRows';
import { gridPlayers, ShotGrid, shotGrid } from './charts/ShotGrid';
import { useRoster } from './roster';
import { Scoreboard } from './Scoreboard';
import { colors, radius, space } from './theme';


/**
 * El ancho del lienzo, en puntos. NO es el ancho de la pantalla: la tarjeta no depende del
 * telefono que la genero — el mismo partido tiene que dar la misma imagen en cualquier equipo.
 * La captura la multiplica por la densidad, asi que de aca sale un PNG de ~1000px de ancho.
 */
export const CARD_WIDTH = 420;

/** "lun 13 jul", del primer punto que se jugo. */
const playedOn = (events: MatchEvent[]): string => {
  const stamps = events.map((e) => e.t).filter((t): t is number => typeof t === 'number');
  if (stamps.length === 0) return '';
  const d = new Date(Math.min(...stamps));
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
};

const duration = (events: MatchEvent[]): string => {
  const stamps = events.map((e) => e.t).filter((t): t is number => typeof t === 'number');
  if (stamps.length < 2) return '';
  const min = Math.round((Math.max(...stamps) - Math.min(...stamps)) / 60000);
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h ${min % 60}m`;
};

/**
 * LA TARJETA QUE SE MANDA POR WHATSAPP.
 *
 * No es una captura de la pantalla: es un lienzo propio, con su ancho fijo, pensado para leerse
 * chico y en el chat de otro. Cada partido compartido es la app frente a ocho personas que juegan
 * padel, asi que esto es publicidad — pero la unica publicidad honesta es mostrar el producto.
 *
 * Todo lo que dibuja sale de los MISMOS componentes que la app: el tanteador es el tanteador, y
 * el bloque por jugador es el mismo `HeadToHead` con las mismas filas y los mismos colores. Que
 * el que la recibe y despues baja la app no tenga que aprender nada dos veces no es una comodidad:
 * es lo que hace que la tarjeta sea una promesa que la app cumple.
 */
export function ShareCard({
  config,
  events,
  state,
}: {
  config: MatchConfig;
  events: MatchEvent[];
  state: MatchState;
}) {
  const { nameOf } = useRoster();
  const stats = computeStats(config, events);

  const names = (t: TeamId): [string, string] =>
    [config.teams[t].drive, config.teams[t].reves].map((id: PlayerId) =>
      nameOf(id, config.players[id]?.name),
    ) as [string, string];

  const bp = (t: TeamId): string =>
    `${stats.teams[t].breakPointsConverted}/${stats.teams[t].breakPointsPlayed}`;

  const meta = [duration(events), L.stats.points(stats.totalPoints)].filter(Boolean).join(' · ');

  return (
    <View style={s.card}>
      {/* El logo va GRANDE. Esta tarjeta existe para dos cosas: contarle el partido a alguien y
          que ese alguien sepa de donde salio. Achicar la marca en la unica pieza que sale de la
          app es sabotearse solo. */}
      <View style={s.head}>
        <Brand size={30} tint={colors.ball} />
        <Text style={s.date}>{playedOn(events)}</Text>
      </View>

      {/* Los nombres los dice el tanteador, en el color de cada equipo. Estaban tambien arriba,
          en una fila propia, y sumados a la cabecera del bloque de abajo daban TRES veces los
          mismos cuatro nombres en una imagen del tamaño de una mano. Se fue la fila. */}
      <Scoreboard config={config} state={state} width={CARD_WIDTH - space.md * 2} />

      {/* EL BREAK ES DEL EQUIPO. Por eso vive aca arriba, entre el tanteador y el bloque por
          jugador, y no adentro de la ficha de nadie: un set se define por un quiebre, y "3 de 7"
          cuenta la mitad del partido que el resultado no cuenta. */}
      <View style={s.team}>
        <Text style={[s.teamValue, { color: colors.teamAFill }]}>{bp('A')}</Text>
        <Text style={s.teamLabel}>{L.stats.breakPoints.toUpperCase()}</Text>
        <Text style={[s.teamValue, s.teamValueRight, { color: colors.teamBFill }]}>{bp('B')}</Text>
      </View>

      {/* Los nombres van GRANDES y encendidos. En la app son una etiqueta, porque arriba esta el
          tanteador enorme; aca el tanteador entra chico y al que perdio lo dibuja en gris, asi
          que estos nombres son los que dicen quien jugo. */}
      <View style={s.block}>
        <HeadToHead
          rows={playerRows(stats, config, false)}
          playersA={names('A')}
          playersB={names('B')}
          colorA={colors.teamAFill}
          colorB={colors.teamBFill}
          nameSize={13.5}
          nameColor={colors.text}
          nameWeight="500"
          nameGap={12}
        />
      </View>

      {/* LOS GOLPES. Es lo unico que la tarjeta cuenta y que no se puede sacar de ningun reloj ni
          de ninguna camara: para saber que la bandeja regalo seis errores tiene que haber alguien
          juzgando cada punto. Es lo mas caro de producir, y por eso es lo que hay que mostrar.

          LA TABLA ES FIJA: los mismos cuatro golpes, en el mismo orden, SIEMPRE. Si el partido se
          anoto en modo simple, van ceros — y eso es correcto, porque es la verdad: nadie los
          cargo. Se penso en reemplazarla por el saque cuando no hubiera datos, y estaba mal: una
          tarjeta que a veces muestra una tabla y a veces otra le enseña al que la recibe que la
          app es impredecible. Que dos tarjetas cualesquiera se puedan poner una al lado de la
          otra vale mas que llenar un hueco. */}
      <View style={s.block}>
        <Text style={s.blockLabel}>{L.stats.shots.toUpperCase()}</Text>
        <ShotGrid
          rows={shotGrid(stats, config)}
          names={
            gridPlayers(config).map((id) => nameOf(id, config.players[id]?.name).split(' ')[0]) as [
              string,
              string,
              string,
              string,
            ]
          }
          colorA={colors.teamAFill}
          colorB={colors.teamBFill}
        />
      </View>

      {/* El pie: lo que duro, y de donde salio. Es la unica publicidad, y no tiene que gritar. */}
      <View style={s.foot}>
        <Text style={s.meta}>{meta}</Text>
        <Text style={s.cta}>Vigia</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    padding: space.md,
    gap: space.md,
    backgroundColor: colors.bg,
  },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  team: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    /**
     * El mismo padding que tienen los bloques ADENTRO. Sin esto la fila se alineaba con el BORDE
     * de las tarjetas de abajo y no con su contenido, asi que los dos numeros parecian escaparse
     * hacia los costados mientras todo lo demas respetaba un margen.
     */
    paddingHorizontal: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  teamValue: { flex: 1, fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  teamValueRight: { textAlign: 'right' },
  teamLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  block: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  blockLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingBottom: space.sm,
  },

  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  cta: { color: colors.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
});
