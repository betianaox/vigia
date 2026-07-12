import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { reduce } from './src/engine';
import type { MatchConfig, MatchEvent } from './src/engine';
import {
  getCurrentId,
  loadMatch,
  newMatchId,
  saveMatch,
  setCurrentId,
  type SavedMatch,
} from './src/store/matches';
import { HistoryScreen } from './src/ui/HistoryScreen';
import { MatchScreen } from './src/ui/MatchScreen';
import { ScoreboardPreview } from './src/ui/ScoreboardPreview';
import { SetupScreen } from './src/ui/SetupScreen';
import { StatsScreen } from './src/ui/StatsScreen';

// Herramienta de desarrollo: pone en pantalla todas las variantes del tanteador juntas.
const PREVIEW = false;

type Screen =
  | { name: 'setup' }
  | { name: 'match' }
  | { name: 'history' }
  /** Un partido del historial, de solo lectura. */
  | { name: 'archive'; match: SavedMatch };

/**
 * El dueño del partido.
 *
 * El log de eventos vive aca, no en la cancha, y SE GUARDA EN CADA EVENTO. De eso depende que
 * el partido sobreviva a que Android mate la app en el entretiempo — que es el peor bug
 * posible en esta app (§ Local-first): si alguien pierde 40 minutos de partido, no la vuelve
 * a abrir nunca.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'setup' });
  const [match, setMatch] = useState<SavedMatch | null>(null);
  /** El partido a medias que quedo de la vez pasada, para poder ofrecer retomarlo. */
  const [resumable, setResumable] = useState<SavedMatch | null>(null);

  // Al abrir la app: si habia un partido sin terminar, se ofrece seguirlo.
  useEffect(() => {
    void (async () => {
      const id = await getCurrentId();
      if (!id) return;
      const saved = await loadMatch(id);
      if (saved) setResumable(saved);
      else await setCurrentId(null); // el archivo no esta: no dejar un puntero colgado
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

  const resume = (m: SavedMatch) => {
    setMatch(m);
    setResumable(null);
    setScreen({ name: 'match' });
  };

  /**
   * Terminar el partido a medias. NO lo borra: sigue guardado y aparece en el historial como
   * "sin terminar", con las estadisticas de lo que se jugo. Solo deja de ofrecerse.
   */
  const closePending = () => {
    void setCurrentId(null);
    setResumable(null);
  };

  /**
   * Volver al inicio. Si el partido quedo a medias, sigue siendo el partido en curso.
   *
   * El partido YA ESTA EN MEMORIA: se lo pasa directo, sin volver a leerlo del disco. Leerlo
   * es asincrono, y en ese hueco el inicio se dibujaba creyendo que no habia nada — mostraba
   * el formulario y despues, cuando el disco contestaba, aparecia la tarjeta. Preguntarle al
   * disco algo que uno ya sabe siempre se paga con un parpadeo.
   */
  const home = () => {
    const unfinished = match && !reduce(match.config, match.events).finished;
    setResumable(unfinished ? match : null);
    setMatch(null);
    setScreen({ name: 'setup' });
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />

      {PREVIEW ? (
        <ScoreboardPreview />
      ) : screen.name === 'match' && match ? (
        <MatchScreen
          config={match.config}
          events={match.events}
          onEvents={onEvents}
          onHome={home}
        />
      ) : screen.name === 'history' ? (
        <HistoryScreen
          onBack={() => setScreen({ name: 'setup' })}
          onOpen={(m) => setScreen({ name: 'archive', match: m })}
        />
      ) : screen.name === 'archive' ? (
        <StatsScreen
          config={screen.match.config}
          events={screen.match.events}
          state={reduce(screen.match.config, screen.match.events)}
          finishedEarly
          onBack={() => setScreen({ name: 'history' })}
          onShare={() => {}}
        />
      ) : (
        <SetupScreen
          resumable={resumable}
          onResume={resume}
          onClosePending={closePending}
          onStart={start}
          onHistory={() => setScreen({ name: 'history' })}
        />
      )}
    </SafeAreaProvider>
  );
}
