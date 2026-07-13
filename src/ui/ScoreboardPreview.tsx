import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { reduce } from '../engine';
import type { GameFormat, MatchConfig, MatchEvent, TeamId } from '../engine';
import { Scoreboard } from './Scoreboard';
import { colors, space } from './theme';

// Todos los estados salen de correr el motor sobre eventos reales: nada esta maqueteado.
const cfg = (over: Partial<MatchConfig> = {}): MatchConfig => ({
  players: {
    a1: { id: 'a1', name: 'Sebastián Etcheverry' },
    a2: { id: 'a2', name: 'Maria Fernanda' },
    b1: { id: 'b1', name: 'Bea' },
    b2: { id: 'b2', name: 'Juan Cruz Villagra' },
  },
  teams: { A: { id: 'A', drive: 'a1', reves: 'a2' }, B: { id: 'B', drive: 'b1', reves: 'b2' } },
  serveOrder: { A: ['a1', 'a2'], B: ['b1', 'b2'] },
  firstServingTeam: 'A',
  gameFormat: 'ventajas',
  length: 'tres_sets',
  thirdSet: 'set_normal',
  changeEnds: 'nunca',
  ...over,
});

const pt = (t: TeamId): MatchEvent => ({ type: 'WINNER', player: t === 'A' ? 'a1' : 'b1' });
const pts = (t: TeamId, n: number) => Array.from({ length: n }, () => pt(t));
const game = (t: TeamId) => pts(t, 4);
const games = (t: TeamId, n: number) => Array.from({ length: n }, () => game(t)).flat();
const alt = (n: number) => Array.from({ length: n }, () => [...game('A'), ...game('B')]).flat();
/** Puntos alternados: sirve para no cerrar un game/tiebreak antes de tiempo. */
const altPts = (n: number) => Array.from({ length: n }, (_, i) => pt(i % 2 === 0 ? 'A' : 'B'));

const set = (t: TeamId) => games(t, 6);
/** Un set 7-6 con tiebreak 7-5, que es el que deja superindice y ensancha el casillero. */
const setEnTiebreak = (t: TeamId) => [...alt(6), ...altPts(10), ...pts(t, 2)];

const VARIANTS: Array<{ title: string; note: string; config: MatchConfig; events: MatchEvent[] }> = [
  {
    /**
     * EL PEOR CASO: la mayor cantidad de columnas que el tanteador puede llegar a tener.
     * Dos sets terminados (los dos en tiebreak, o sea con superindice) mas el tercero en
     * curso con games y puntos. De aca sale cuanto ancho le queda REALMENTE a los nombres.
     */
    title: '⚠️ El peor caso — nombres vs. tanteador lleno',
    note: 'Dos sets en tiebreak (con superíndice) + súper tiebreak en curso. Es el máximo de columnas.',
    config: cfg({ thirdSet: 'super_tiebreak' }),
    events: [
      ...setEnTiebreak('A'),
      ...setEnTiebreak('B'),
      ...pts('A', 8),
      ...pts('B', 7),
    ],
  },
  {
    /**
     * La red de seguridad. Estos nombres NO los va a permitir el setup ("Nombre" o "Nombre
     * Apellido" y nada mas), pero si alguna vez se cuela uno, tiene que degradar bien:
     * primero achicarse, y solo despues cortar con puntos. No romper el layout ni empujar
     * los casilleros.
     */
    title: 'Red de seguridad — nombre imposible',
    note: 'Nombres que el setup no va a permitir. Se achican primero; si ni así entran, se cortan.',
    config: cfg({
      thirdSet: 'super_tiebreak',
      players: {
        a1: { id: 'a1', name: 'Bartolomé Constantinopolous' },
        a2: { id: 'a2', name: 'Wilhelmina Etchegaray' },
        b1: { id: 'b1', name: 'Bea' },
        b2: { id: 'b2', name: 'Juan Cruz Villagra' },
      },
    }),
    events: [...setEnTiebreak('A'), ...setEnTiebreak('B'), ...pts('A', 8), ...pts('B', 7)],
  },
  {
    title: 'Arranque',
    note: 'Todo en cero. La pelotita marca quién saca.',
    config: cfg(),
    events: [],
  },
  {
    title: 'Set en curso',
    note: '2do set, 4-3, 30-15.',
    config: cfg(),
    events: [...set('A'), ...games('A', 4), ...games('B', 3), ...pts('A', 2), ...pts('B', 1)],
  },
  {
    title: 'Ventaja',
    note: 'Pasado el 40-40. El casillero en vivo muestra AD.',
    config: cfg({ gameFormat: 'ventajas' }),
    events: [...pts('A', 3), ...pts('B', 3), ...pts('B', 1)],
  },
  {
    title: 'Punto de oro',
    note: 'El casillero en vivo se enciende en dorado.',
    config: cfg({ gameFormat: 'punto_de_oro' }),
    events: [...pts('A', 3), ...pts('B', 3)],
  },
  {
    title: 'Tiebreak',
    note: '6-6, y los puntos pasan a ser números crudos.',
    config: cfg(),
    events: [...alt(6), ...pts('A', 5), ...pts('B', 4)],
  },
  {
    title: 'Súper tiebreak (3er set)',
    note: '1-1 en sets; el tercero se juega a 10.',
    config: cfg({ thirdSet: 'super_tiebreak' }),
    events: [...set('A'), ...set('B'), ...pts('A', 7), ...pts('B', 6)],
  },
  {
    title: 'Set ganado en tiebreak',
    note: 'El 7-6 queda con el superíndice del tiebreak (aquí lo ganó A por 7-5).',
    config: cfg(),
    // 5-5 en el tiebreak y despues A gana dos: 7-5.
    events: [...alt(6), ...altPts(10), ...pts('A', 2), ...games('B', 3), ...pts('A', 1)],
  },
  {
    title: 'Partido terminado',
    note: 'Desaparecen las columnas en vivo; queda el resultado.',
    config: cfg(),
    events: [...set('A'), ...set('A')],
  },
];

export function ScoreboardPreview() {
  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.list}>
        {VARIANTS.map((v) => (
          <View key={v.title} style={s.item}>
            <Text style={s.title}>{v.title}</Text>
            <Scoreboard config={v.config} state={reduce(v.config, v.events)} />
            <Text style={s.note}>{v.note}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.md, gap: space.lg },
  item: { gap: space.xs },
  title: { color: colors.text, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  note: { color: colors.textFaint, fontSize: 11 },
});
