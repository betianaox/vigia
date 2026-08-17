import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { reduce } from '../engine';
import type { SavedMatch } from '../store/matches';
import { L } from '../i18n';
import { Brand } from './Brand';
import { Scoreboard } from './Scoreboard';
import { useColors } from './theme-context';
import { alpha, colors, pressed, radius, ripple, space, type Colors } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/**
 * EL PARTIDO A MEDIAS, SOLO. Sin las tres puertas del inicio, sin fondo de marca: esta pantalla
 * existe para una sola decisión — seguir o terminar — y todo lo que no sea esa decisión es
 * ruido. Mientras haya un partido en curso, es acá donde se aterriza al volver a la app; el
 * inicio con sus tres puertas queda un paso más allá, detrás de "Terminar".
 *
 * Fondo LISO —el del tema, claro u oscuro— y no el de marca: la tarjeta es lo único que tiene
 * que brillar. Un fondo con personalidad al lado del tanteador competiría con el único dato que
 * importa.
 */
export function ResumeScreen({
  match,
  onResume,
  onEnd,
}: {
  match: SavedMatch;
  onResume: (m: SavedMatch) => void;
  /** Cerrarlo: deja de ofrecerse, pero queda en el historial como sin terminar. */
  onEnd: () => void;
}) {
  const { width } = useWindowDimensions();
  const boardW = width - space.lg * 2 - space.md * 2;

  /**
   * No se resume a un string: se le da el estado entero al MISMO tanteador de la cancha. Un
   * texto tipo "6-4 · 40-30" siempre tiene un partido que lo corta —un tercer set, un
   * tiebreak— y no hay ancho que lo salve. Con columnas no existe el caso largo, y de paso
   * quien vuelve a la app ve exactamente lo que dejó, dibujado igual que como lo dejó.
   */
  const state = useMemo(() => reduce(match.config, match.events), [match]);

  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.body}>
        <Brand size={30} subtitle={L.setup.onCourt} tint={c.ball} />

        {/* Arriba de todo, chico y apagado: dice QUE es esta tarjeta, y después se calla. No
            compite con lo único que importa mirar, que es el tanteo. */}
        <Text style={s.eyebrow}>{L.setup.resumeEyebrow}</Text>

        {/* El MISMO tanteador de la cancha, con el estado tal cual quedó: los nombres enteros,
            la pelotita en quien tenía el saque, el punto en vivo. Quien vuelve a la app no lee
            un resumen del partido — ve el partido. */}
        <View style={s.board}>
          <Scoreboard config={match.config} state={state} width={boardW} />
        </View>

        <View style={s.actions}>
          <Pressable
            style={({ pressed: pr }) => [s.btn, s.go, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onResume(match);
            }}
          >
            {/* Blanco fijo: va sobre el verde del boton, que es el mismo en los dos temas. */}
            <MaterialIcons name="play-arrow" size={22} color={colors.text} />
            <Text style={s.btnText}>{L.setup.resume}</Text>
          </Pressable>

          {/* SIN CONFIRMACION. Esta tarjeta YA ES la pregunta: dice que hay un partido a medias
              y ofrece las dos respuestas, una al lado de la otra. Un diálogo encima sería
              preguntar dos veces lo mismo — y a la segunda nadie lee, se toca el botón de la
              derecha y listo. Terminarlo tampoco borra nada: el partido queda en el historial
              como "sin terminar", con las estadísticas de lo que se jugó. */}
          <Pressable
            style={({ pressed: pr }) => [s.btn, s.end, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onEnd();
            }}
          >
            {/* Play y stop: el par que ya existe en el mundo. */}
            <MaterialIcons name="stop" size={22} color={c.textDim} />
            <Text style={s.btnTextDim}>{L.setup.end}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: '18%',
    padding: space.lg,
    gap: space.md,
  },

  eyebrow: { color: c.textDim, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  /** El tanteador trae su propio fondo: `overflow` lo recorta al radio en vez de dejar esquinas. */
  board: { borderRadius: radius.sm, overflow: 'hidden' },

  /**
   * La separación es la única protección que tiene Terminar, porque ya no hay confirmación:
   * los dos botones no pueden tocarse. Y Seguir se lleva más ancho — es lo que se va a tocar
   * casi siempre.
   */
  actions: { flexDirection: 'row', gap: space.lg },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  go: { flex: 3, backgroundColor: c.cta },
  end: { flex: 2, borderWidth: 1, borderColor: alpha(c.text, 0.2) },
  /** Blanco fijo por lo mismo que el icono: el fondo verde no cambia con el tema. */
  btnText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  btnTextDim: { color: c.textDim, fontSize: 15, fontWeight: '800' },
});
