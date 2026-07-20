import * as SplashScreen from 'expo-splash-screen';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LOCALE, setLanguage } from './src/i18n';
import { loadPrefs } from './src/store/store';

import { reduce } from './src/engine';
import { career, type CareerStats } from './src/engine/career';
import type { MatchConfig, MatchEvent } from './src/engine';
import {
  getCurrentId,
  loadMatch,
  loadMatchesOf,
  newMatchId,
  saveMatch,
  setCurrentId,
  type SavedMatch,
} from './src/store/matches';
import { CareerScreen } from './src/ui/CareerScreen';
import { HistoryScreen } from './src/ui/HistoryScreen';
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
  | { name: 'career'; stats: CareerStats; from: 'players' | 'history' };

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
          /* El formulario ya cambio el diccionario; esto es lo que hace que React se entere. */
          onLanguage={onLanguage}
        />
      ) : (
        <HomeScreen
          onNewMatch={() => setScreen({ name: 'setup' })}
          onHistory={() => setScreen({ name: 'history' })}
          onPlayers={() => setScreen({ name: 'players' })}
        />
      )}
    </SafeAreaProvider>
  );
}
