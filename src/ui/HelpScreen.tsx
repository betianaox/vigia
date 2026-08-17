import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Fragment } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import appJson from '../../app.json';
import { L, LANG_NAMES, resolveLang, setLanguage, type Lang, type LangPref } from '../i18n';
import type { Prefs } from '../store/store';
import { Brand } from './Brand';
import { Select } from './Select';
import { alpha, colors, pressed, radius, ripple, space } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/** El icono del boton de ayuda. Se nombra una vez: lo usan esta pantalla y el inicio. */
export const HELP_ICON = 'help-outline' as const;

/**
 * LOS ICONOS DE LOS PASOS, en el mismo orden que los textos de `L.help.steps`.
 *
 * Viven aca y no en el archivo de idioma porque un icono no se traduce: meterlo alli obligaria a
 * repetir los seis en cuatro idiomas, con la garantia de que algun dia uno queda distinto.
 */
/**
 * EL MISMO ICONO QUE EL BOTON QUE NOMBRAN, siempre que la app tenga uno.
 *
 * El icono de un paso no es un adorno: es la referencia visual de lo que la persona va a tener
 * que encontrar despues en la pantalla. Si la ayuda dibuja un grafico de torta y el boton de la
 * app es un grafico de barras, la ayuda esta enseñando a buscar otra cosa.
 *
 * Los que NO tienen equivalente —mirar desde afuera, tocar el punto, la hoja de golpes, el
 * marcador automatico— no corresponden a ningun boton con icono propio, y ahi se elige el que
 * mejor cuenta la idea.
 */
const STEP_ICONS = [
  'visibility', // mirar desde afuera: no hay boton
  'groups', // los cuatro: el mismo del boton "Jugadores" del inicio
  'swap-horiz', // EL SAQUE: el mismo de `onSwapServer`, el que da vuelta el orden en la cancha
  'touch-app', // tocar el punto: los botones de la cancha son texto
  'sports-tennis', // la hoja de golpes: no tiene icono
  'scoreboard', // el marcador automatico: no hay boton
  'bar-chart', // ESTADISTICAS: el mismo de la cancha, el historial y el plantel
  'person', // la ficha de una persona: el mismo del historial y del plantel
  'share', // COMPARTIR: el mismo del boton de la tarjeta
] as const satisfies ReadonlyArray<React.ComponentProps<typeof MaterialIcons>['name']>;

/**
 * Donde entra la linea que parte los pasos: antes de este, lo que hay que hacer PARA jugar;
 * de aca en adelante, lo que queda DESPUES del partido.
 */
const AFTER_MATCH_FROM = 6;

/**
 * La direccion de la politica de privacidad, en el idioma de la app.
 *
 * El castellano vive en la raiz del sitio y los demas idiomas cuelgan de un prefijo. Si el idioma
 * activo no tuviera pagina propia, esto igual devuelve una URL valida — pero hoy los cuatro
 * idiomas de la app existen tambien en el sitio, asi que nadie cae en un idioma que no eligio.
 */
const privacyUrl = (lang: Lang): string => {
  const prefix = lang === 'es' ? '' : `/${lang}`;
  return `https://imagostack.com${prefix}/apps/vigia/privacidad`;
};

const SUPPORT_MAIL = 'support@imagostack.com';

/**
 * La ficha en Google Play.
 *
 * Se arma con el paquete de `app.json` y NO con `StoreReview.storeUrl()`, que parecia lo obvio:
 * esa funcion lee `Constants.expoConfig`, que en un build de desarrollo sale de la configuracion
 * EMBEBIDA en el apk. Agregar el campo a `app.json` no alcanzaba —habia que recompilar para que
 * la fila apareciera—, y una fila que existe o no segun cuando se compilo es una trampa.
 *
 * Leyendo el paquete directo, la URL sale del mismo archivo que declara la app y no puede quedar
 * desincronizada con ella.
 */
const PLAY_URL = `https://play.google.com/store/apps/details?id=${appJson.expo.android.package}`;

/** Los idiomas. `auto` primero, con el que le toca hoy al lado, para no elegir a ciegas. */
const languages = (): Array<{ value: LangPref; label: string }> => [
  { value: 'auto', label: `${L.setup.languageAuto} · ${LANG_NAMES[resolveLang('auto')]}` },
  ...(Object.keys(LANG_NAMES) as Lang[]).map((k) => ({ value: k, label: LANG_NAMES[k] })),
];

/** Como se cargan los golpes. Cada opcion trae su explicacion adentro (ver `Select`). */
const shotPrompts = () =>
  [
    {
      value: 'siempre',
      label: L.setup.shotPrompts.siempre,
      desc: L.setup.shotPromptHints.siempre,
    },
    {
      value: 'opcional',
      label: L.setup.shotPrompts.opcional,
      desc: L.setup.shotPromptHints.opcional,
    },
  ] as const;

/**
 * AYUDA Y AJUSTES. UNA SOLA PANTALLA, SIEMPRE IGUAL.
 *
 * No tiene modo "bienvenida": la primera vez se muestra un dialogo chico encima del inicio (ver
 * `WelcomeOverlay`) que solo dice donde esta la ayuda. Esta pantalla se abre siempre a pedido, y
 * entonces se abre siempre igual — el que la busca por primera vez y el que vuelve por decima ven
 * lo mismo, que es una pantalla menos que mantener y una variante menos que probar.
 *
 * Y ES ADEMAS LA CASA DE LO QUE NO TENIA CASA. El idioma y el modo de cargar los golpes vivian
 * dentro de las avanzadas del formulario de partido nuevo: para cambiar el idioma de la app habia
 * que empezar a crear un partido. No son del partido de hoy, son de la app, y ahora estan donde
 * se los busca. En las avanzadas quedo solo el reglamento, que es de lo que las avanzadas hablan.
 */
export function HelpScreen({
  prefs,
  onPref,
  onLanguage,
  onClose,
  onReplayWelcome,
}: {
  prefs: Prefs;
  /** Guarda la preferencia. La pantalla no escribe en el disco por su cuenta. */
  onPref: (patch: Partial<Prefs>) => void;
  /** Avisa que hay que redibujar: el diccionario cambio (ver `App.tsx`). */
  onLanguage: () => void;
  onClose: () => void;
  /** Solo en desarrollo: vuelve a mostrar el saludo de la primera vez. */
  onReplayWelcome: () => void;
}) {
  const open = (url: string) => {
    tick();
    // Si no hay con que abrirlo —un telefono sin navegador, sin cliente de correo— no pasa nada.
    // Un cartel de error no le sirve a nadie: la direccion esta escrita ahi mismo.
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.head}>
        <Brand size={26} subtitle={L.help.title} tint={colors.ball} />
        <Pressable
          style={({ pressed: pr }) => [s.close, pr && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={() => {
            tick();
            onClose();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={L.help.close}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* POR DONDE SE EMPIEZA, ARRIBA DE TODO. Es lo unico de esta pantalla que se necesita
            ANTES de haber usado la app; los seis pasos de abajo explican como funciona, pero esto
            dice que tocar ahora. */}
        <Hint text={L.help.startHint} icon="play-arrow" />

        {/* LOS PASOS. Cada uno es un icono a la izquierda y dos renglones a la derecha: el titulo
            dice QUE, la linea de abajo dice COMO. El icono no decora — es el ancla que hace que
            se lean como una secuencia y no como una pila de parrafos.

            Y LLEVAN UNA LINEA EN EL MEDIO. Nueve bloques seguidos se leen como un muro. La linea
            no dice nada —no hace falta un titulo— pero parte la lectura en dos: lo que hay que
            hacer PARA jugar, y lo que queda DESPUES del partido. */}
        <View style={s.steps}>
          {L.help.steps.map((step, i) => (
            <Fragment key={step.title}>
              {i === AFTER_MATCH_FROM && <View style={s.stepsCut} />}

              <View style={s.step}>
                <View style={s.stepIcon}>
                  <MaterialIcons
                    name={STEP_ICONS[i] ?? 'chevron-right'}
                    size={22}
                    color={colors.ball}
                  />
                </View>
                <View style={s.stepText}>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <Text style={s.stepBody}>{step.text}</Text>
                </View>
              </View>
            </Fragment>
          ))}
        </View>

        <View style={s.divider} />

        <Text style={s.blockLabel}>{L.help.settings}</Text>

        <Select
          title={L.setup.language}
          options={languages()}
          value={prefs.language}
          onChange={(v) => {
            /* Primero el diccionario, despues el aviso: `onLanguage` redibuja, y si se hiciera al
               reves esta misma pantalla se volveria a dibujar con los textos viejos. */
            setLanguage(v as LangPref);
            onPref({ language: v as LangPref });
            onLanguage();
          }}
        />

        <Select
          title={L.setup.shotPrompt}
          options={shotPrompts()}
          value={prefs.shotPrompt}
          onChange={(v) => onPref({ shotPrompt: v as Prefs['shotPrompt'] })}
        />

        <View style={s.divider} />

        {/* PRIMERA, arriba de las dos legales: es la unica de las tres que se ofrece, no que se
            cumple. Abre la FICHA de Play, no el dialogo de valoracion — Google prohibe
            expresamente disparar ese dialogo desde un boton. El dialogo aparece solo, y casi
            nunca (ver `store/review.ts`). */}
        <Link icon="star-outline" label={L.help.rate} onPress={() => open(PLAY_URL)} />

        <Link
          icon="shield"
          label={L.help.privacy}
          /* Del idioma EFECTIVO, no del guardado: con la preferencia en `auto` hay que resolver
             cual le toca hoy, o la politica se abriria siempre en castellano. */
          onPress={() => open(privacyUrl(resolveLang(prefs.language)))}
        />
        <Link
          icon="mail-outline"
          label={L.help.contact}
          sub={SUPPORT_MAIL}
          onPress={() => open(`mailto:${SUPPORT_MAIL}`)}
        />

        <Text style={s.version}>
          {L.help.version.replace('{v}', appJson.expo.version)}
        </Text>

        {/* El saludo se muestra UNA vez y despues no hay forma de volver a verlo sin borrar los
            datos de la app —que se llevaria puesto el historial—. Esto lo reabre. `__DEV__` es
            false en produccion, asi que ni el boton ni su texto existen alli. */}
        {__DEV__ && (
          <Pressable
            style={({ pressed: pr }) => [s.dev, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onReplayWelcome();
            }}
          >
            <MaterialIcons name="science" size={16} color={colors.textFaint} />
            <Text style={s.devText}>Ver la bienvenida otra vez</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Un aviso con un icono DIBUJADO dentro de la frase, en el lugar del `{icon}`.
 *
 * Nombrar un boton ("toca Partido nuevo") obliga a salir a buscar cual es entre los que hay;
 * mostrarlo al lado del nombre no deja lugar a la duda. Es el mismo icono, con el mismo color,
 * que va a estar esperando en la pantalla.
 */
function Hint({
  text,
  icon,
}: {
  text: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}) {
  const [before, after] = text.split('{icon}');

  return (
    <View style={s.hint}>
      <Text style={s.hintText}>
        {before}
        <MaterialIcons name={icon} size={15} color={colors.cta} />
        {after}
      </Text>
    </View>
  );
}

function Link({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed: pr }) => [s.link, pr && pressed]}
      android_ripple={ripple}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <MaterialIcons name={icon} size={20} color={colors.textDim} />
      <View style={s.linkText}>
        <Text style={s.linkLabel}>{label}</Text>
        {sub ? <Text style={s.linkSub}>{sub}</Text> : null}
      </View>
      <MaterialIcons name="open-in-new" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },

  scroll: { flex: 1 },
  /** El aire de abajo es para que el ultimo renglon no quede pegado al boton de Empezar. */
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },

  /**
   * LOS PASOS RESPIRAN. Un `gap` grande entre ellos y no un borde: seis bloques con linea de por
   * medio se leen como una tabla, y esto no es una tabla — es una secuencia que se lee de arriba
   * hacia abajo una sola vez.
   */
  steps: { gap: space.lg },
  /**
   * La linea que parte los pasos en dos. Va SIN titulo: el corte solo tiene que dar un respiro
   * y agrupar, y un rotulo ahi seria una seccion nueva que nadie pidio.
   *
   * Mas apagada que `divider`, que separa BLOQUES distintos (los pasos de los ajustes). Este
   * separa dos mitades de la misma cosa, y tiene que pesar menos que el otro o los dos cortes
   * dirian lo mismo.
   */
  stepsCut: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.text, 0.12),
    marginVertical: space.xs,
  },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  /**
   * El icono en su propia caja de ancho fijo: asi los seis titulos arrancan en la misma columna
   * aunque un icono sea mas angosto que otro. Sin esto, el texto baila de paso en paso.
   */
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.ball, 0.1),
  },
  /** `flex: 1` para que el texto envuelva usando el ancho que sobra, y no se corte. */
  stepText: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  stepBody: { color: colors.textDim, fontSize: 13, lineHeight: 19 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },

  blockLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  linkText: { flex: 1, gap: 2 },
  linkLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  linkSub: { color: colors.textFaint, fontSize: 12 },

  version: { color: colors.textFaint, fontSize: 12, alignSelf: 'center' },

  /** El aviso: su propio fondo, para que se lea como una nota y no como un paso mas. */
  hint: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hintText: { color: colors.textDim, fontSize: 13, lineHeight: 20 },

  /** Herramienta de desarrollo: apagada, chica, y lo mas lejos posible de todo lo demas. */
  dev: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  devText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
});
