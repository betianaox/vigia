import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { seedMatch } from '../dev/seed';
import { L } from '../i18n';
import { alpha, colors, pressed, radius, ripple, space } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const BG = require('../../assets/bg-home.webp');
const LOGO = require('../../assets/logo-home.png');
/** 398 x 299 px del archivo real. De ahi sale el ancho: nadie tiene que acordarse del numero. */
const LOGO_RATIO = 398 / 299;

/**
 * EL INICIO. La raiz de la app: el fondo de marca, el logo, y las puertas.
 *
 * Antes esta pantalla y el formulario de partido nuevo eran la misma —el formulario SE ABRIA
 * de una, con Historial y Jugadores colgando al final del scroll—, y eso era brusco: alguien
 * que solo quiere ver su historial tiene que atravesar un formulario entero para llegar a un
 * boton que no tiene nada que ver con jugar. Ahora las tres cosas que se pueden querer hacer
 * estan aca, al mismo nivel, antes de comprometerse con ninguna.
 *
 * Cuando hay un partido en curso, esta pantalla NO SE MUESTRA: se muestra `ResumeScreen` en su
 * lugar, sola, sobre fondo negro. Empezar un partido nuevo con uno a medias obligaria a decidir
 * que pasa con el viejo en una pantalla que no es el lugar para esa decision.
 */
export function HomeScreen({
  onNewMatch,
  onHistory,
  onPlayers,
}: {
  onNewMatch: () => void;
  onHistory: () => void;
  onPlayers: () => void;
}) {
  return (
    <ImageBackground source={BG} style={s.root} resizeMode="cover">
      <SafeAreaView style={s.safe}>
        <View style={s.head}>
          <Image source={LOGO} style={s.logo} resizeMode="contain" />
        </View>

        {/* TODO LO DE ABAJO SE ANCLA AL PISO, NO AL TECHO. `s.bottom` es flex:1 con
            `justifyContent: 'flex-end'`: las puertas y el boton de siembra se apilan
            contra el borde inferior sin importar cuanto espacio libre haya arriba. Si
            dependieran de un padding-top fijo, una resolucion mas alta o mas baja que la
            que se probo dejaria el bloque flotando a mitad de pantalla o pegado al notch. */}
        <View style={s.bottom}>
          {/* LAS PUERTAS. Nuevo partido es la unica que ARRANCA algo, asi que lleva el verde que
              en el resto de la app significa "esto empieza"; las demas abren algo que ya existe
              y van todas del mismo tamano, en una fila que ENVUELVE (`flexWrap`).
              Envolver y no una fila fija de dos es a proposito: el dia que aparezca una tercera
              puerta —o una cuarta— cae en un renglon nuevo sola, sin que haya que rediseñar la
              pantalla para que entre. */}
          <View style={s.doors}>
            <Pressable
              style={({ pressed: pr }) => [s.primary, pr && pressed]}
              android_ripple={ripple}
              onPress={() => {
                tick();
                onNewMatch();
              }}
            >
              <MaterialIcons name="play-arrow" size={26} color={colors.text} />
              <Text style={s.primaryText}>{L.setup.newMatch}</Text>
            </Pressable>

            <View style={s.row}>
              <Pressable
                style={({ pressed: pr }) => [s.door, pr && pressed]}
                android_ripple={ripple}
                onPress={() => {
                  tick();
                  onHistory();
                }}
              >
                <MaterialIcons name="history" size={22} color={colors.text} />
                <Text style={s.doorText}>{L.setup.history}</Text>
              </Pressable>

              <Pressable
                style={({ pressed: pr }) => [s.door, pr && pressed]}
                android_ripple={ripple}
                onPress={() => {
                  tick();
                  onPlayers();
                }}
              >
                <MaterialIcons name="groups" size={22} color={colors.text} />
                <Text style={s.doorText}>{L.setup.players}</Text>
              </Pressable>
            </View>
          </View>

          {/* Siembra un partido entero, jugado por el motor, para poder probar las estadisticas
              sin cargar cien puntos a mano. `__DEV__` es false en el build de produccion, asi
              que este boton no existe alli — ni el codigo que cuelga de el. Vive en el inicio y
              no en el formulario: es una herramienta de la app entera, no de cargar un partido. */}
          {__DEV__ && (
            <Pressable
              style={({ pressed: pr }) => [s.seed, pr && pressed]}
              android_ripple={ripple}
              onPress={() => {
                tick();
                void (async () => {
                  const day = 24 * 60 * 60 * 1000;
                  for (let i = 0; i < 5; i++) {
                    await seedMatch({
                      seed: Math.floor(Math.random() * 10000),
                      strengthA: 0.42 + i * 0.05,
                      startedAt: Date.now() - (75 - i * 15) * day,
                    });
                  }
                  onHistory();
                })();
              }}
            >
              <MaterialIcons name="science" size={16} color={colors.textFaint} />
              <Text style={s.seedText}>Sembrar 5 partidos de prueba</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, padding: space.lg },

  head: { alignItems: 'center', paddingTop: space.xl },
  /** El ancho manda, el alto sale de la proporcion real del archivo (ver `LOGO_RATIO`). */
  logo: { width: 180, height: 180 / LOGO_RATIO },

  /** Ancla todo lo de abajo al piso de la pantalla, no al techo (ver comentario en el JSX). */
  bottom: { flex: 1, justifyContent: 'flex-end', gap: space.md },

  /**
   * SOBRE EL FONDO, LOS BOTONES NECESITAN SU PROPIO CONTRASTE. Un texto blanco solo sobre una
   * foto es ilegible en la mitad de los fondos posibles — por eso cada puerta lleva su propio
   * relleno oscuro semitransparente, no confia en que el fondo vaya a ser oscuro justo ahi.
   */
  doors: { gap: space.md },

  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.cta,
  },
  primaryText: { color: colors.text, fontSize: 18, fontWeight: '900' },

  /** `flexWrap` y no una fila fija: una puerta nueva cae en su propio renglon, sin rediseñar. */
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  door: {
    flex: 1,
    minWidth: '44%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.35),
    backgroundColor: alpha(colors.bg, 0.55),
  },
  doorText: { color: colors.text, fontSize: 15, fontWeight: '800' },

  seed: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  seedText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
});
