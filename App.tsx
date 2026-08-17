import * as SplashScreen from 'expo-splash-screen';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as StoreReview from 'expo-store-review';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LOCALE, setLanguage } from './src/i18n';
import { loadPrefs, savePrefs, type Prefs } from './src/store/store';

import { reduce } from './src/engine';
import { career, type CareerStats } from './src/engine/career';
import type { MatchConfig, MatchEvent } from './src/engine';
import {
  getCurrentId,
  loadIndex,
  loadMatch,
  loadMatchesOf,
  newMatchId,
  saveMatch,
  setCurrentId,
  type SavedMatch,
} from './src/store/matches';
import { shouldAskReview } from './src/store/review';
import { CareerScreen } from './src/ui/CareerScreen';
import { HelpScreen } from './src/ui/HelpScreen';
import { HistoryScreen } from './src/ui/HistoryScreen';
import { WelcomeOverlay } from './src/ui/WelcomeOverlay';
import { HomeScreen } from './src/ui/HomeScreen';
import { PlayersScreen } from './src/ui/PlayersScreen';
import { ResumeScreen } from './src/ui/ResumeScreen';
import { RosterProvider, useRoster } from './src/ui/roster';
import { MatchScreen } from './src/ui/MatchScreen';
import { ScoreboardPreview } from './src/ui/ScoreboardPreview';
import { SetupScreen } from './src/ui/SetupScreen';
import { StatsScreen } from './src/ui/StatsScreen';
import { useBackHandler } from './src/ui/useBackHandler';

// Herramienta de desarrollo: pone en pantalla todas las variantes del tanteador juntas.
const PREVIEW = false;

/**
 * EL SPLASH SE QUEDA HASTA QUE SEPAMOS EN QUE IDIOMA HABLAR.
 *
 * El idioma elegido vive en el disco, y leerlo es asincronico: si dibujaramos mientras tanto, la
 * app abriria en el idioma del TELEFONO y un instante despues se daria vuelta entera. Ese
 * parpadeo no se lee como "esta cargando", se lee como que la app esta rota — y es lo primero que
 * ve alguien que justamente eligio otro idioma porque el del telefono no le sirve.
 *
 * No agrega espera: lo que se retiene es un pestañeo. Y de paso el splash deja de irse antes de
 * que se lo pueda ver.
 */
void SplashScreen.preventAutoHideAsync();

type Screen =
  /** La raiz: el fondo de marca y las tres puertas. Solo se muestra cuando NO hay un partido
      en curso — si lo hay, la raiz es 'resume' (ver `home()`). */
  | { name: 'home' }
  /** El formulario de partido nuevo. Ya no es la raiz: se llega desde 'home'. */
  | { name: 'setup' }
  /** El partido a medias, solo, sobre fondo negro. Es la otra raiz posible. */
  | { name: 'resume' }
  | { name: 'match' }
  /** Las estadisticas del partido que se esta jugando. */
  | { name: 'stats' }
  | { name: 'history' }
  /** La gente con la que jugas. La puerta al juego de cada una. */
  | { name: 'players' }
  /** Un partido del historial, de solo lectura. */
  | { name: 'archive'; match: SavedMatch }
  /**
   * El acumulado y la evolucion de una persona.
   *
   * Se llega de dos lados —de la lista de jugadores y del filtro del historial— asi que se
   * anota de cual: cerrar tiene que devolverte a donde estabas, no a un lugar que elegimos
   * nosotros.
   */
  | { name: 'career'; stats: CareerStats; from: 'players' | 'history' }
  /**
   * Ayuda y ajustes. Se abre SIEMPRE a pedido, con el boton del inicio: la primera vez no se abre
   * esta pantalla sino un dialogo chico encima del inicio (ver `WelcomeOverlay`).
   */
  | { name: 'help' };

/**
 * El dueño del partido.
 *
 * El log de eventos vive aca, no en la cancha, y SE GUARDA EN CADA EVENTO. De eso depende que
 * el partido sobreviva a que Android mate la app en el entretiempo — que es el peor bug
 * posible en esta app (§ Local-first): si alguien pierde 40 minutos de partido, no la vuelve
 * a abrir nunca.
 */
export default function App() {
  /**
   * El idioma, resuelto ANTES del primer dibujo.
   *
   * Se guarda en el estado —aunque el diccionario de verdad viva en un modulo— por una sola
   * razon: React no se entera de que `setLanguage` cambio algo. Este valor no lo lee nadie: lo
   * unico que hace es DISPARAR EL REDIBUJO, y con eso alcanza, porque cada pantalla lee el
   * diccionario mientras se dibuja (ver la regla en `i18n/index.ts`).
   *
   * Y NO es la `key` del arbol, aunque remontar todo seria mas facil de razonar: remontar borra
   * el estado, y el estado de esta pantalla son los cuatro nombres que la persona acaba de
   * escribir. Nadie deberia perder el equipo que cargo por cambiar el idioma.
   */
  const [lang, setLang] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const prefs = await loadPrefs();
      setLanguage(prefs.language);
      setLang(LOCALE);
      await SplashScreen.hideAsync();
    })();
  }, []);

  // Todavia no sabemos el idioma: no hay nada que se pueda dibujar sin mentir. Sigue el splash.
  if (!lang) return null;

  return (
    <RosterProvider>
      <Vigia onLanguage={() => setLang(LOCALE)} />
    </RosterProvider>
  );
}

/**
 * El plantel envuelve a TODO: el nombre de una persona se lee de la tabla, por id, en cualquier
 * pantalla. La copia que cada partido guarda adentro queda como respaldo (ver `roster.tsx`).
 */
function Vigia({ onLanguage }: { onLanguage: () => void }) {
  const { canon } = useRoster();
  /**
   * Arranca en 'home'. Si al leer el disco aparece un partido sin terminar, la pantalla salta
   * sola a 'resume' — pero SOLO si nadie se movio de 'home' mientras tanto (ver el efecto de
   * abajo): la lectura es asincronica, y no hay que arrancarle a alguien de una pantalla a la
   * que ya navego por su cuenta en ese hueco.
   */
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [match, setMatch] = useState<SavedMatch | null>(null);
  /** El partido a medias que quedo de la vez pasada, para poder ofrecer retomarlo. */
  const [resumable, setResumable] = useState<SavedMatch | null>(null);

  /**
   * Las preferencias viven aca porque ahora las miran DOS pantallas: el formulario, para el
   * reglamento del partido, y la de ayuda, para el idioma y los golpes. Con una copia en cada
   * una, cambiar el idioma en una dejaria a la otra con el valor viejo hasta remontarla.
   */
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  const setPref = useCallback((patch: Partial<Prefs>) => {
    setPrefs((x) => {
      if (!x) return x;
      const next = { ...x, ...patch };
      void savePrefs(next);
      return next;
    });
  }, []);

  // Al abrir la app: si habia un partido sin terminar, se ofrece seguirlo.
  useEffect(() => {
    void (async () => {
      const id = await getCurrentId();
      if (!id) return;
      const saved = await loadMatch(id);
      if (saved) {
        setResumable(saved);
        setScreen((s) => (s.name === 'home' ? { name: 'resume' } : s));
      } else await setCurrentId(null); // el archivo no esta: no dejar un puntero colgado
    })();
  }, []);

  /**
   * EL SALUDO DE LA PRIMERA VEZ.
   *
   * No cambia de pantalla: es un dialogo chico ENCIMA de lo que haya, asi que la primera impresion
   * sigue siendo la app y no un manual. Por eso vive en su propio estado y no en `Screen` — no es
   * un lugar al que se navega, es algo que aparece arriba.
   *
   * El flag se escribe al CERRARLO, no al abrirlo: si la app muere mientras esta abierto, la
   * proxima vez se vuelve a ofrecer en lugar de perderse para siempre.
   */
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    void (async () => {
      const p = await loadPrefs();
      setPrefs(p);
      if (!p.seenWelcome) setWelcome(true);
    })();
  }, []);

  /**
   * Pide la valoracion si toca. Cuenta los partidos TERMINADOS del indice —no los guardados—
   * porque uno abandonado a los tres puntos no dice nada sobre si la app le sirvio a alguien.
   *
   * Nada de esto avisa si el dialogo se mostro: Google tiene su propia cuota y decide solo, sin
   * contarselo a la app. Por eso el hito se marca como pedido igual, se haya visto o no — insistir
   * hasta "acertar" es exactamente lo que vuelve molesta a una app.
   */
  const maybeAskReview = useCallback(async () => {
    const p = prefs;
    if (!p) return;

    const finished = (await loadIndex()).filter((m) => m.finished).length;
    if (!shouldAskReview(finished, p.lastReviewAsk)) return;

    setPref({ lastReviewAsk: finished });

    // Si el telefono no lo soporta —una version vieja de Play Services, un dispositivo sin
    // Play— no pasa nada: no hay nada que ofrecerle y no se le inventa un cartel.
    if (!(await StoreReview.hasAction())) return;
    await StoreReview.requestReview().catch(() => {});
  }, [prefs, setPref]);

  /** Las dos salidas del saludo lo dan por visto: la que entra a la ayuda y la que se va. */
  const closeWelcome = (goToHelp: boolean) => {
    setPref({ seenWelcome: true });
    setWelcome(false);
    if (goToHelp) setScreen({ name: 'help' });
  };

  /** Cada evento: se actualiza en memoria y se escribe a disco. La escritura nunca bloquea. */
  const onEvents = useCallback(
    (events: MatchEvent[]) => {
      setMatch((prev) => {
        if (!prev) return prev;
        const next: SavedMatch = { ...prev, events, updatedAt: Date.now() };
        void saveMatch(next);
        // Terminado el partido, deja de ser "el que esta en curso".
        if (reduce(next.config, events).finished) void setCurrentId(null);
        return next;
      });
    },
    [],
  );

  const start = async (config: MatchConfig) => {
    const now = Date.now();
    const m: SavedMatch = { id: newMatchId(), config, events: [], startedAt: now, updatedAt: now };
    await saveMatch(m);
    await setCurrentId(m.id);
    setResumable(null);
    setMatch(m);
    setScreen({ name: 'match' });
  };

  /**
   * Retomar un partido. SIEMPRE lo marca como "el que esta en curso" — no solo cuando venia
   * de la tarjeta del inicio, tambien cuando se elige uno viejo desde el historial. El log es
   * la unica verdad (`reduce` es puro): cualquier partido guardado se puede seguir jugando,
   * este a medias desde hace un minuto o desde hace tres semanas.
   *
   * Si habia OTRO partido en curso, deja de estarlo — pero no se pierde nada: sigue guardado,
   * sigue "sin terminar" en el historial, y se puede retomar despues por el mismo camino.
   */
  const resume = (m: SavedMatch) => {
    void setCurrentId(m.id);
    setMatch(m);
    setResumable(null);
    setScreen({ name: 'match' });
  };

  /**
   * Terminar el partido a medias. NO lo borra: sigue guardado y aparece en el historial como
   * "sin terminar", con las estadisticas de lo que se jugo. Solo deja de ofrecerse — y con eso
   * deja de haber una razon para estar en 'resume': se vuelve a la raiz de verdad.
   */
  const closePending = () => {
    void setCurrentId(null);
    setResumable(null);
    setScreen({ name: 'home' });
  };

  /**
   * Volver a la raiz. Si el partido quedo a medias, sigue siendo el partido en curso — y la
   * raiz, mientras tanto, es 'resume', no 'home'. Empezar uno nuevo con uno a medias obligaria
   * a decidir que hacer con el viejo, y esa decision no se toma desde las tres puertas.
   *
   * El partido YA ESTA EN MEMORIA: se lo pasa directo, sin volver a leerlo del disco. Leerlo
   * es asincrono, y en ese hueco se dibujaria creyendo que no habia nada. Preguntarle al disco
   * algo que uno ya sabe siempre se paga con un parpadeo.
   */
  const home = () => {
    const unfinished = match && !reduce(match.config, match.events).finished;
    setResumable(unfinished ? match : null);
    setMatch(null);
    setScreen(unfinished ? { name: 'resume' } : { name: 'home' });

    /**
     * LA VALORACION SE PIDE AL SALIR DE UN PARTIDO TERMINADO, no al terminarlo.
     *
     * Terminar el partido y que aparezca un dialogo encima de la cancha seria interrumpir el
     * momento en el que la persona esta mirando el resultado. Aca ya cerro, ya vio lo que queria
     * ver, y esta volviendo: es el hueco donde una pregunta no pisa nada.
     *
     * Y solo si era el partido TERMINADO: abandonar uno a medias no es el momento de preguntar
     * si le gusta la app.
     */
    if (match && !unfinished) void maybeAskReview();
  };

  /**
   * El back de Android, en UN solo lugar. Cada pantalla vuelve a la que la abrio; 'home' y
   * 'resume' son las dos raices posibles y ahi si sale de la app, que es lo que se espera.
   */
  useBackHandler(
    screen.name === 'home' || screen.name === 'resume'
      ? null
      : screen.name === 'setup'
        ? () => setScreen({ name: 'home' })
        : screen.name === 'match'
          ? home
          : screen.name === 'stats'
            ? () => setScreen({ name: 'match' })
            : screen.name === 'archive'
              ? () => setScreen({ name: 'history' })
              : screen.name === 'career'
                ? () => setScreen(screen.from === 'players' ? { name: 'players' } : { name: 'history' })
                : () => setScreen({ name: 'home' }),
  );

  /**
   * Abrir el juego de alguien. Se recalcula del log, y solo se abren SUS partidos.
   *
   * `canon` resuelve las uniones: un partido viejo puede tener guardado el id de antes, y tambien
   * es suyo. Nada se reescribio — la union se resuelve al leer.
   */
  const openCareer = (p: { id: string }, from: 'players' | 'history') => {
    void loadMatchesOf(p.id).then((ms) =>
      setScreen({ name: 'career', stats: career(p.id, ms, canon), from }),
    );
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      {/* La barra de navegacion de Android, abajo. Sin esto queda CLARA en los telefonos que
          usan tres botones —un rectangulo blanco pegado a una app oscura— porque Android le
          dibuja un velo de contraste por su cuenta. Ese velo se apaga en el plugin
          (`enforceContrast: false`) y aca se pide barra oscura con iconos claros.

          `dark` es "barra oscura con contenido claro", al reves de lo que uno diria: es la
          convencion de la libreria, verificada en sus tipos. */}
      <NavigationBar style="dark" />

      {PREVIEW ? (
        <ScoreboardPreview />
      ) : screen.name === 'match' && match ? (
        <MatchScreen
          config={match.config}
          events={match.events}
          onEvents={onEvents}
          onHome={home}
          onStats={() => setScreen({ name: 'stats' })}
        />
      ) : screen.name === 'stats' && match ? (
        <StatsScreen
          config={match.config}
          events={match.events}
          state={reduce(match.config, match.events)}
          finishedEarly={false}
          onClose={() => setScreen({ name: 'match' })}
        />
      ) : screen.name === 'history' ? (
        <HistoryScreen
          onBack={() => setScreen({ name: 'home' })}
          onOpen={(m) => setScreen({ name: 'archive', match: m })}
          onCareer={(p) => openCareer(p, 'history')}
          onResume={resume}
        />
      ) : screen.name === 'players' ? (
        <PlayersScreen
          onBack={() => setScreen({ name: 'home' })}
          onOpen={(p) => openCareer(p, 'players')}
        />
      ) : screen.name === 'career' ? (
        <CareerScreen
          stats={screen.stats}
          onClose={() =>
            setScreen(screen.from === 'players' ? { name: 'players' } : { name: 'history' })
          }
        />
      ) : screen.name === 'archive' ? (
        <StatsScreen
          config={screen.match.config}
          events={screen.match.events}
          state={reduce(screen.match.config, screen.match.events)}
          finishedEarly
          onClose={() => setScreen({ name: 'history' })}
        />
      ) : screen.name === 'resume' && resumable ? (
        <ResumeScreen match={resumable} onResume={resume} onEnd={closePending} />
      ) : screen.name === 'setup' ? (
        <SetupScreen
          onStart={start}
          onBack={() => setScreen({ name: 'home' })}
        />
      ) : screen.name === 'help' && prefs ? (
        /* `prefs` es la condicion y no un default: la pantalla ofrece cambiar el idioma y los
           golpes, y dibujarla con valores inventados mostraria seleccionada una opcion que no es
           la que esta guardada. */
        <HelpScreen
          prefs={prefs}
          onPref={setPref}
          onLanguage={onLanguage}
          onClose={() => setScreen({ name: 'home' })}
          /* Solo lo usa el boton de `__DEV__`: vuelve a marcar el saludo como no visto, sale al
             inicio y lo abre — que es exactamente lo que ve alguien que instala la app. */
          onReplayWelcome={() => {
            setPref({ seenWelcome: false });
            setScreen({ name: 'home' });
            setWelcome(true);
          }}
        />
      ) : (
        <HomeScreen
          onNewMatch={() => setScreen({ name: 'setup' })}
          onHistory={() => setScreen({ name: 'history' })}
          onPlayers={() => setScreen({ name: 'players' })}
          onHelp={() => setScreen({ name: 'help' })}
        />
      )}

      {/* ENCIMA DE TODO, y fuera del arbol de pantallas: no es un lugar al que se navega. Va
          ultimo para que quede por arriba de la pantalla que se este dibujando, sea cual sea. */}
      <WelcomeOverlay
        visible={welcome}
        onHelp={() => closeWelcome(true)}
        onClose={() => closeWelcome(false)}
      />
    </SafeAreaProvider>
  );
}
