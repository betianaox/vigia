import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MatchConfig } from './src/engine';
import { MatchScreen } from './src/ui/MatchScreen';
import { ScoreboardPreview } from './src/ui/ScoreboardPreview';
import { SetupScreen } from './src/ui/SetupScreen';

// Herramienta de desarrollo: pone en pantalla todas las variantes del tanteador juntas.
const PREVIEW = false;

/**
 * La app entra siempre por el inicio y vuelve ahi al terminar.
 *
 * El partido vive en la KEY del MatchScreen: al volver al inicio se desmonta y el log de
 * eventos se pierde. Hoy eso es correcto —todavia no hay guardado— y el boton de la casita
 * avisa antes con un cartel. Cuando exista el historial, ahi se guarda y el cartel cambia.
 */
export default function App() {
  const [match, setMatch] = useState<MatchConfig | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {PREVIEW ? (
        <ScoreboardPreview />
      ) : match ? (
        <MatchScreen config={match} onHome={() => setMatch(null)} />
      ) : (
        <SetupScreen onStart={setMatch} />
      )}
    </SafeAreaProvider>
  );
}
