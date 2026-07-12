import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { MatchConfig } from './src/engine';
import { MatchScreen } from './src/ui/MatchScreen';
import { ScoreboardPreview } from './src/ui/ScoreboardPreview';

// Herramienta de desarrollo: pone en pantalla todas las variantes del tanteador juntas.
const PREVIEW = false;

// Partido de prueba, hasta que exista la pantalla de setup.
const demo: MatchConfig = {
  players: {
    a1: { id: 'a1', name: 'Ana Ruiz' },
    a2: { id: 'a2', name: 'Aldo Vega' },
    b1: { id: 'b1', name: 'Bea Sosa' },
    b2: { id: 'b2', name: 'Beto Lino' },
  },
  teams: {
    A: { id: 'A', drive: 'a1', reves: 'a2' },
    B: { id: 'B', drive: 'b1', reves: 'b2' },
  },
  serveOrder: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  firstServingTeam: 'A',
  gameFormat: 'punto_estrella',
  length: 'tres_sets',
  thirdSet: 'super_tiebreak',
  changeEnds: 'nunca',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {PREVIEW ? <ScoreboardPreview /> : <MatchScreen config={demo} />}
    </SafeAreaProvider>
  );
}
