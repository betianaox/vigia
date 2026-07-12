import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { reduce, undo } from '../engine';
import type { Box, MatchConfig, MatchEvent, MatchState, PlayerId, Shot, TeamId } from '../engine';
import { SHOT_LABELS, SHOTS } from './shots';
import { colors, radius, space, teamColor } from './theme';

type RallyAction = 'WINNER' | 'ERROR_FORZADO' | 'ERROR_NO_FORZADO';

/** Semaforo, desde la perspectiva del jugador de la tarjeta. */
const RALLY: Array<{ type: RallyAction; label: string; bg: string; fg: string }> = [
  { type: 'WINNER', label: 'Winner', bg: colors.winner, fg: colors.onLight },
  { type: 'ERROR_FORZADO', label: 'Error\nforzado', bg: colors.errorForced, fg: colors.onLight },
  { type: 'ERROR_NO_FORZADO', label: 'Error no\nforzado', bg: colors.errorUnforced, fg: '#FFF' },
];

/** Nombre y apellido -> "AR". Un solo nombre -> las dos primeras letras, para no colisionar. */
const initials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : words[0]!.slice(0, 2);
  return raw.slice(0, 2).toUpperCase();
};

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const thud = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

export function MatchScreen({ config }: { config: MatchConfig }) {
  useKeepAwake();

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [shotFor, setShotFor] = useState<number | null>(null);
  const [rotated, setRotated] = useState(false);

  const state = useMemo(() => reduce(config, events), [config, events]);
  const push = (e: MatchEvent) => setEvents((prev) => [...prev, e]);

  /** Tap corto: registra el punto y listo. Un solo tap, sin seleccionar nada antes. */
  const registerPoint = (type: RallyAction, player: PlayerId) => {
    thud();
    push({ type, player });
  };

  /**
   * Long press: registra el punto IGUAL, y ademas abre el menu de golpe.
   * Nunca se pierde un punto por intentar el gesto largo y que salga mal.
   */
  const registerPointWithShot = (type: RallyAction, player: PlayerId) => {
    thud();
    setEvents((prev) => {
      setShotFor(prev.length);
      return [...prev, { type, player }];
    });
  };

  const setShot = (shot: Shot) => {
    if (shotFor === null) return;
    tick();
    setEvents((prev) => prev.map((e, i) => (i === shotFor && 'player' in e ? { ...e, shot } : e)));
    setShotFor(null);
  };

  // Giro de 180 grados de la cancha: se dan vuelta los dos ejes.
  const mirrored = state.endsSwapped !== rotated;
  const teamsInOrder: TeamId[] = mirrored ? ['B', 'A'] : ['A', 'B'];
  const playersOf = (t: TeamId): PlayerId[] => {
    const pair = [config.teams[t].drive, config.teams[t].reves];
    return mirrored ? pair.reverse() : pair;
  };

  return (
    <SafeAreaView style={s.root}>
      <Scoreboard config={config} state={state} />

      {state.isGoldenPoint && (
        <View style={s.goldenBar}>
          <Text style={s.goldenText}>
            {state.awaitingBoxChoice ? 'PUNTO DE ORO — ELIGE EL QUE RESTA' : 'PUNTO DE ORO'}
          </Text>
          {state.awaitingBoxChoice && (
            <View style={s.row}>
              {(['derecha', 'izquierda'] as Box[]).map((b) => (
                <Pressable
                  key={b}
                  style={s.goldenBtn}
                  onPress={() => {
                    tick();
                    push({ type: 'ELECCION_CUADRO', box: b });
                  }}
                >
                  <Text style={s.goldenBtnText}>{b === 'derecha' ? 'Derecha' : 'Izquierda'}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={s.court}>
        {teamsInOrder.map((t) => (
          <View key={t} style={s.teamRow}>
            {playersOf(t).map((p) => (
              <PlayerCard
                key={p}
                name={config.players[p]!.name}
                team={t}
                serving={state.server === p}
                receiving={state.receiver === p}
                serveState={state.serveState}
                onRally={(type) => registerPoint(type, p)}
                onRallyLong={(type) => registerPointWithShot(type, p)}
                onFalta={() => {
                  thud();
                  push({ type: 'FALTA' });
                }}
                onAce={() => {
                  thud();
                  push({ type: 'ACE' });
                }}
                onLet={() => {
                  tick();
                  push({ type: 'LET' });
                }}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={s.bottom}>
        <Pressable
          style={[s.utilBtn, events.length === 0 && s.utilBtnOff]}
          onPress={() => {
            tick();
            setEvents(undo);
          }}
          disabled={events.length === 0}
        >
          <Text style={s.utilText}>↺  Deshacer</Text>
        </Pressable>
        <Pressable
          style={s.utilBtn}
          onPress={() => {
            tick();
            setRotated((r) => !r);
          }}
        >
          <Text style={s.utilText}>⟲  Rotar</Text>
        </Pressable>
      </View>

      <Modal visible={shotFor !== null} transparent animationType="slide">
        <Pressable style={s.modalBg} onPress={() => setShotFor(null)}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>¿Con qué golpe?</Text>
            <ScrollView contentContainerStyle={s.shotGrid}>
              {SHOTS.map((sh) => (
                <Pressable key={sh} style={s.shotBtn} onPress={() => setShot(sh)}>
                  <Text style={s.shotText}>{SHOT_LABELS[sh]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={s.skipBtn} onPress={() => setShotFor(null)}>
              <Text style={s.skipText}>Saltear — el punto ya quedó registrado</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {state.finished && (
        <View style={s.finished}>
          <Text style={s.finishedText}>
            Ganó {playersOf(state.winner!).map((p) => config.players[p]!.name).join(' / ')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function PlayerCard(props: {
  name: string;
  team: TeamId;
  serving: boolean;
  receiving: boolean;
  serveState: 'PRIMERO' | 'SEGUNDO';
  onRally: (t: RallyAction) => void;
  onRallyLong: (t: RallyAction) => void;
  onFalta: () => void;
  onAce: () => void;
  onLet: () => void;
}) {
  const c = teamColor(props.team);
  const second = props.serveState === 'SEGUNDO';

  return (
    <View style={[s.card, props.serving && s.cardServing]}>
      {/* Las acciones de saque solo existen para el que saca. Que la tarjeta sea
          distinta hace imposible no ver quien esta sacando. */}
      {props.serving ? (
        <View style={s.serveRow}>
          <Pressable style={[s.serveBtn, s.faltaBtn]} onPress={props.onFalta}>
            <Text style={s.faltaText}>{second ? 'DOBLE FALTA' : 'FALTA'}</Text>
          </Pressable>
          <Pressable style={s.serveBtn} onPress={props.onAce}>
            <Text style={s.serveText}>Ace</Text>
          </Pressable>
          <Pressable style={[s.serveBtn, s.letBtn]} onPress={props.onLet}>
            <Text style={s.serveText}>Let</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.serveRowEmpty} />
      )}

      <View style={s.identity}>
        <View style={[s.avatar, { backgroundColor: c }]}>
          <Text style={s.avatarText}>{initials(props.name)}</Text>
        </View>
        <Text style={s.cardName} numberOfLines={1}>
          {props.name}
        </Text>
        <Text style={[s.cardTag, props.serving && { color: colors.serve }]}>
          {props.serving ? (second ? '2DO SAQUE' : 'SACA') : props.receiving ? 'RESTA' : ' '}
        </Text>
      </View>

      <View style={s.row}>
        {RALLY.map((a) => (
          <Pressable
            key={a.type}
            style={[s.rallyBtn, { backgroundColor: a.bg }]}
            onPress={() => props.onRally(a.type)}
            onLongPress={() => props.onRallyLong(a.type)}
          >
            <Text style={[s.rallyText, { color: a.fg }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Scoreboard({ config, state }: { config: MatchConfig; state: MatchState }) {
  const row = (t: TeamId) => {
    const names = [config.teams[t].drive, config.teams[t].reves]
      .map((p) => config.players[p]!.name)
      .join(' / ');
    return (
      <View key={t} style={s.sbRow}>
        <View
          style={[s.sbDot, { backgroundColor: state.servingTeam === t ? colors.serve : 'transparent' }]}
        />
        <Text style={[s.sbNames, { color: teamColor(t) }]} numberOfLines={1}>
          {names}
        </Text>
        {state.completedSets.map((cs, i) => (
          <Text key={i} style={s.sbSet}>
            {cs.games[t]}
          </Text>
        ))}
        {!state.finished && <Text style={s.sbGames}>{state.games[t]}</Text>}
        {!state.finished && <Text style={s.sbPoints}>{state.display[t]}</Text>}
      </View>
    );
  };
  return (
    <View style={s.sb}>
      {row('A')}
      {row('B')}
      {state.inTiebreak && !state.finished && (
        <Text style={s.sbTag}>{state.isSuperTiebreak ? 'SÚPER TIEBREAK' : 'TIEBREAK'}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: space.xs },

  sb: { backgroundColor: colors.surface, padding: space.md, gap: space.xs },
  sbRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sbDot: { width: 8, height: 8, borderRadius: radius.pill },
  sbNames: { flex: 1, fontSize: 15, fontWeight: '600' },
  sbSet: { width: 24, textAlign: 'center', fontSize: 17, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  sbGames: { width: 30, textAlign: 'center', fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  sbPoints: {
    width: 62,
    marginLeft: space.sm,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  sbTag: { color: colors.golden, fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'right' },

  goldenBar: { backgroundColor: colors.golden, padding: space.sm, gap: space.sm, alignItems: 'center' },
  goldenText: { color: '#3B2708', fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  goldenBtn: { backgroundColor: '#3B2708', paddingVertical: space.sm, paddingHorizontal: space.xl, borderRadius: radius.sm },
  goldenBtnText: { color: colors.golden, fontWeight: '800' },

  court: { flex: 1, gap: space.sm, padding: space.sm },
  teamRow: { flex: 1, flexDirection: 'row', gap: space.sm },

  card: {
    flex: 1,
    justifyContent: 'space-between',
    padding: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardServing: { borderColor: colors.serve, borderWidth: 2, backgroundColor: colors.surfaceAlt },

  serveRow: { flexDirection: 'row', gap: space.xs },
  serveRowEmpty: { height: 44 },
  serveBtn: {
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  // La falta es el boton mas frecuente y el que menos tiempo tiene: se lleva el espacio.
  faltaBtn: { flex: 1, backgroundColor: colors.serve, borderColor: colors.serve },
  faltaText: { color: colors.onLight, fontWeight: '900', fontSize: 12 },
  letBtn: { opacity: 0.7 },
  serveText: { color: colors.textDim, fontWeight: '700', fontSize: 12 },

  identity: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  avatar: { width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontWeight: '900', fontSize: 20 },
  cardName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  cardTag: { color: colors.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 1, height: 13 },

  rallyBtn: {
    flex: 1,
    minHeight: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  rallyText: { fontWeight: '900', fontSize: 11, textAlign: 'center', lineHeight: 13 },

  bottom: { flexDirection: 'row', gap: space.sm, padding: space.sm, backgroundColor: colors.surface },
  utilBtn: { flex: 1, paddingVertical: space.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  utilBtnOff: { opacity: 0.35 },
  utilText: { color: colors.text, fontWeight: '800', fontSize: 15 },

  modalBg: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.surface, padding: space.lg, gap: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '70%' },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  shotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  shotBtn: { paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  shotText: { color: colors.text, fontWeight: '600' },
  skipBtn: { paddingVertical: space.md, alignItems: 'center' },
  skipText: { color: colors.textFaint, fontSize: 12 },

  finished: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000C', alignItems: 'center', justifyContent: 'center' },
  finishedText: { color: colors.text, fontSize: 24, fontWeight: '900' },
});
