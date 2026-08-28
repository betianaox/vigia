import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { MatchConfig, MatchEvent, MatchState, PlayerId, TeamId } from '../engine';
import { computeStats } from '../engine/stats';
import { L, LOCALE, type Lang } from '../i18n';
import { Brand } from './Brand';
import { FixedText as Text } from './FixedText';
import { HeadToHead } from './charts/HeadToHead';
import { playerRows } from './charts/playerRows';
import { gridPlayers, ShotGrid, shotGrid } from './charts/ShotGrid';
import { useRoster } from './roster';
import { Scoreboard } from './Scoreboard';
import { useColors } from './theme-context';
import { radius, space, type Colors } from './theme';


/**
 * El ancho del lienzo, en puntos. NO es el ancho de la pantalla: la tarjeta no depende del
 * telefono que la genero — el mismo partido tiene que dar la misma imagen en cualquier equipo.
 * La captura la multiplica por la densidad, asi que de aca sale un PNG de ~1000px de ancho.
 *
 * Por eso TODO EL TEXTO DE LA TARJETA VA EN `FixedText`, y por eso el `HeadToHead` de abajo
 * recibe `allowFontScaling={false}`. El lienzo era fijo pero su letra no: la tarjeta que mandaba
 * alguien con la fuente del sistema al 150% salia con la ultima columna de golpes afuera de la
 * imagen, y el que la recibia veia eso sin saber por que. Una imagen no se puede adaptar despues:
 * lo que sale del lienzo no esta.
 *
 * La contracara es que la letra de la tarjeta no la agranda nadie, asi que la agrandamos nosotros:
 * la tarjeta se mira dentro de una burbuja de WhatsApp, y tiene que leerse SIN hacer pinch.
 */
export const CARD_WIDTH = 420;

/**
 * EL BADGE DE GOOGLE PLAY, EN EL IDIOMA DE LA APP.
 *
 * Hay un archivo por idioma y son los de Google, sin tocar: sus reglas de marca piden usar el
 * artwork tal cual —no se recolorea, no se recorta y no se rehace con el texto traducido aunque
 * quede identico—, asi que lo unico que hacemos es escalarlo. Los nombres son los que traen al
 * descargarlos, a proposito: renombrarlos invita a que alguien crea que son nuestros.
 *
 * Los cuatro miden 478x142, con lo cual la proporcion no cambia entre idiomas y el pie de la
 * tarjeta mide siempre lo mismo.
 *
 * `LOCALE` esta tipado como string porque lo reasigna `setLanguage`, asi que la busqueda cae al
 * ingles si algun dia aparece un idioma sin archivo. Es lo que corresponde: el badge en ingles se
 * entiende igual, y quedarse sin badge seria perder la unica invitacion que tiene la tarjeta.
 */
const BADGES: Record<Lang, number> = {
  es: require('../../assets/googleplay/GetItOnGooglePlay_Badge_Web_color_Spanish-LATAM.png'),
  en: require('../../assets/googleplay/GetItOnGooglePlay_Badge_Web_color_English.png'),
  pt: require('../../assets/googleplay/GetItOnGooglePlay_Badge_Web_color_Portuguese-Brazil.png'),
  it: require('../../assets/googleplay/GetItOnGooglePlay_Badge_Web_color_Italian.png'),
};

const BADGE_WIDTH = 104;
const BADGE_HEIGHT = Math.round(BADGE_WIDTH * (142 / 478));

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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

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
        <Brand size={30} tint={c.ball} />
        {/* EL BADGE VA ARRIBA, AL LADO DE LA MARCA, Y NO EN EL PIE.
            Abajo estiraba la tarjeta 18 puntos, porque reemplazaba un texto de 13 por una imagen
            de 31. Aca no cuesta nada: el logo ya mide 30, asi que el renglon no crece. En una
            imagen que se mira adentro de una burbuja de chat, cada punto de alto se paga.
            Y de paso queda donde corresponde: quien la hizo y donde conseguirla, juntos. */}
        <Image source={BADGES[LOCALE as Lang] ?? BADGES.en} style={s.badge} resizeMode="contain" />
      </View>

      {/* Los nombres los dice el tanteador, en el color de cada equipo. Estaban tambien arriba,
          en una fila propia, y sumados a la cabecera del bloque de abajo daban TRES veces los
          mismos cuatro nombres en una imagen del tamaño de una mano. Se fue la fila. */}
      <Scoreboard config={config} state={state} width={CARD_WIDTH - space.md * 2} />

      {/* EL BREAK ES DEL EQUIPO. Por eso vive aca arriba, entre el tanteador y el bloque por
          jugador, y no adentro de la ficha de nadie: un set se define por un quiebre, y "3 de 7"
          cuenta la mitad del partido que el resultado no cuenta. */}
      <View style={s.team}>
        <Text style={[s.teamValue, { color: c.teamAFill }]}>{bp('A')}</Text>
        <Text style={s.teamLabel}>{L.stats.breakPoints.toUpperCase()}</Text>
        <Text style={[s.teamValue, s.teamValueRight, { color: c.teamBFill }]}>{bp('B')}</Text>
      </View>

      {/* Los nombres van GRANDES y encendidos. En la app son una etiqueta, porque arriba esta el
          tanteador enorme; aca el tanteador entra chico y al que perdio lo dibuja en gris, asi
          que estos nombres son los que dicen quien jugo. */}
      <View style={s.block}>
        <HeadToHead
          rows={playerRows(stats, config, 'tarjeta')}
          playersA={names('A')}
          playersB={names('B')}
          colorA={c.teamAFill}
          colorB={c.teamBFill}
          nameSize={15}
          nameColor={c.text}
          nameWeight="500"
          nameGap={12}
          valueSize={15}
          labelSize={13}
          /* Mas apretada que en la pantalla: en una imagen, el aire se paga en alto (ver
             `rowPad`). Lo que NO se toca es el cuerpo de la letra. */
          rowPad={5}
          subGap={2}
          allowFontScaling={false}
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
          colorA={c.teamAFill}
          colorB={c.teamBFill}
        />
      </View>

      {/* El pie: cuando se jugo y cuanto duro. La marca ya no se repite aca —decia "Vigia" en
          texto gris, que era el logo por segunda vez— y arriba quedaron solo el logo y el badge,
          que es de donde salio y donde conseguirla. Los datos del partido van todos juntos abajo. */}
      <View style={s.foot}>
        <Text style={s.meta}>{meta}</Text>
        <Text style={s.date}>{playedOn(events)}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  /**
   * EL AIRE DE LA TARJETA SE MIDE DISTINTO QUE EL DE UNA PANTALLA.
   *
   * En una pantalla, un margen de mas no cuesta nada: se scrollea. Aca cada punto de separacion
   * entre los cinco bloques se suma al alto de una imagen que tiene que entrar de una en una
   * burbuja de chat — y una tarjeta que hay que scrollear adentro del chat no la mira nadie. Por
   * eso el marco y las juntas van mas apretados que en el resto de la app, y por eso el ajuste
   * empieza siempre por el aire y nunca por el cuerpo de la letra.
   */
  card: {
    width: CARD_WIDTH,
    padding: space.md,
    gap: space.sm,
    backgroundColor: c.bg,
  },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: {
    color: c.textFaint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  team: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    /**
     * El mismo padding que tienen los bloques ADENTRO. Sin esto la fila se alineaba con el BORDE
     * de las tarjetas de abajo y no con su contenido, asi que los dos numeros parecian escaparse
     * hacia los costados mientras todo lo demas respetaba un margen.
     */
    paddingHorizontal: space.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  teamValue: { flex: 1, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  teamValueRight: { textAlign: 'right' },
  teamLabel: {
    color: c.textDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  block: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },

  blockLabel: {
    color: c.textFaint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    paddingBottom: 6,
  },

  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: c.textFaint, fontSize: 12, fontWeight: '600' },
  /**
   * SIN MARGEN. El PNG de Google no tiene aire: el dibujo llega al borde del archivo en los
   * cuatro lados (medido). Asi que el borde derecho del badge cae exactamente donde caen el borde
   * de los cuadros de abajo y el final de la fecha — los tres contra el padding de la tarjeta.
   * Cualquier margen aca desalinea esa columna, que es justo lo que se nota en una imagen.
   */
  badge: { width: BADGE_WIDTH, height: BADGE_HEIGHT },
});
