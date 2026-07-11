import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { reduce, undo } from '../engine';
import type { Box, MatchConfig, MatchEvent, PlayerId, Shot, TeamId } from '../engine';
import { SHOT_LABELS, SHOTS } from './shots';
import { colors, radius, space, teamColor } from './theme';

type RallyAction = 'WINNER' | 'ERROR_FORZADO' | 'ERROR_NO_FORZADO';

const RALLY: Array<{ type: RallyAction; label: string; color: string }> = [
  { type: 'WINNER', label: 'Winner', color: colors.winner },
  { type: 'ERROR_FORZADO', label: 'Error forzado', color: colors.errorForced },
  { type: 'ERROR_NO_FORZADO', label: 'Error no forzado', color: colors.errorUnforced },
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
  const [selected, setSelected] = useState<PlayerId | null>(null);
  const [shotFor, setShotFor] = useState<number | null>(null);
  const [rotated, setRotated] = useState(false);

  const state = useMemo(() => reduce(config, events), [config, events]);

  const push = (e: MatchEvent) => {
    setEvents((prev) => [...prev, e]);
    setSelected(null);
  };

  /** Tap corto: registra el punto y listo. */
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
    setSelected(null);
  };

  const setShot = (shot: Shot) => {
    if (shotFor === null) return;
    tick();
    setEvents((prev) =>
      prev.map((e, i) => (i === shotFor && 'player' in e ? { ...e, shot } : e)),
    );
    setShotFor(null);
  };

  const chooseBox = (box: Box) => {
    tick();
    setEvents((prev) => [...prev, { type: 'ELECCION_CUADRO', box }]);
  };

  const doUndo = () => {
    tick();
    setEvents(undo);
    setSelected(null);
  };

  // Los equipos cambian de lado segun la regla, y el boton de rotacion permite
  // ajustar la vista a donde este parado el que mira. Es un giro de 180 grados:
  // se dan vuelta los dos ejes.
  const mirrored = state.endsSwapped !== rotated;
  const teamsInOrder: TeamId[] = mirrored ? ['B', 'A'] : ['A', 'B'];
  const playersOf = (t: TeamId): PlayerId[] => {
    const pair = [config.teams[t].drive, config.teams[t].reves];
    return mirrored ? pair.reverse() : pair;
  };

  const name = (id: PlayerId) => config.players[id]!.name;
  const selectedTeam = selected ? (config.teams.A.drive === selected || config.teams.A.reves === selected ? 'A' : 'B') : null;

  return (
    <SafeAreaView style={s.root}>
      <Scoreboard config={config} state={state} />

      {state.isGoldenPoint && (
        <View style={s.goldenBar}>
          <Text style={s.goldenText}>
            {state.awaitingBoxChoice ? 'PUNTO DE ORO — elige el que resta' : 'PUNTO DE ORO'}
          </Text>
          {state.awaitingBoxChoice && (
            <View style={s.row}>
              <Pressable style={s.goldenBtn} onPress={() => chooseBox('derecha')}>
                <Text style={s.goldenBtnText}>Derecha</Text>
              </Pressable>
              <Pressable style={s.goldenBtn} onPress={() => chooseBox('izquierda')}>
                <Text style={s.goldenBtnText}>Izquierda</Text>
              </Pressable>
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
                name={name(p)}
                team={t}
                serving={state.server === p}
                receiving={state.receiver === p}
                selected={selected === p}
                onPress={() => {
                  tick();
                  setSelected((cur) => (cur === p ? null : p));
                }}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={s.bottom}>
        {selected ? (
          <View style={s.actions}>
            <Text style={s.actionsTitle}>{name(selected)}</Text>
            <View style={s.row}>
              {RALLY.map((a) => (
                <Pressable
                  key={a.type}
                  style={[s.actionBtn, { borderColor: a.color }]}
                  onPress={() => registerPoint(a.type, selected)}
                  onLongPress={() => registerPointWithShot(a.type, selected)}
                >
                  <Text style={[s.actionText, { color: a.color }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.hint}>Mantené apretado para elegir el golpe</Text>
          </View>
        ) : (
          <Text style={s.hint}>Tocá al jugador que definió el punto</Text>
        )}

        <ServeBar
          server={name(state.server)}
          serveState={state.serveState}
          team={state.servingTeam}
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

        <View style={s.row}>
          <Pressable
            style={[s.utilBtn, events.length === 0 && s.utilBtnOff]}
            onPress={doUndo}
            disabled={events.length === 0}
          >
            <Text style={s.utilText}>↺  Deshacer</Text>
          </Pressable>
          <Pressable style={s.utilBtn} onPress={() => { tick(); setRotated((r) => !r); }}>
            <Text style={s.utilText}>⟲  Rotar</Text>
          </Pressable>
        </View>
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
            Ganó {playersOf(state.winner!).map(name).join(' / ')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function Scoreboard({ config, state }: { config: MatchConfig; state: ReturnType<typeof reduce> }) {
  const row = (t: TeamId) => {
    const players = [config.teams[t].drive, config.teams[t].reves]
      .map((p) => config.players[p]!.name)
      .join(' / ');
    return (
      <View key={t} style={s.sbRow}>
        <View style={[s.sbDot, { backgroundColor: state.servingTeam === t ? colors.serve : 'transparent' }]} />
        <Text style={[s.sbNames, { color: teamColor(t) }]} numberOfLines={1}>
          {players}
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

function PlayerCard(props: {
  name: string;
  team: TeamId;
  serving: boolean;
  receiving: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const c = teamColor(props.team);
  const cardStyle: ViewStyle[] = [s.card];
  if (props.selected) cardStyle.push({ backgroundColor: colors.surfaceAlt, borderColor: c });
  if (props.serving) cardStyle.push({ borderColor: colors.serve, borderWidth: 2 });

  return (
    <Pressable style={cardStyle} onPress={props.onPress}>
      <View style={[s.avatar, { backgroundColor: c }]}>
        <Text style={s.avatarText}>{initials(props.name)}</Text>
      </View>
      <Text style={s.cardName} numberOfLines={1}>
        {props.name}
      </Text>
      <Text style={s.cardTag}>
        {props.serving ? 'SACA' : props.receiving ? 'RESTA' : ' '}
      </Text>
    </Pressable>
  );
}

function ServeBar(props: {
  server: string;
  serveState: 'PRIMERO' | 'SEGUNDO';
  team: TeamId;
  onFalta: () => void;
  onAce: () => void;
  onLet: () => void;
}) {
  const second = props.serveState === 'SEGUNDO';
  return (
    <View style={s.serveBar}>
      <View style={s.serveHeader}>
        <Text style={s.serveWho}>
          Saca <Text style={{ color: teamColor(props.team) }}>{props.server}</Text>
        </Text>
        <Text style={[s.serveState, second && { color: colors.errorForced }]}>
          {second ? '2do saque' : '1er saque'}
        </Text>
      </View>
      <View style={s.row}>
        {/* La falta es el boton mas frecuente y el que menos tiempo tiene: el mas grande. */}
        <Pressable style={[s.serveBtn, s.serveBtnBig]} onPress={props.onFalta}>
          <Text style={s.serveBtnBigText}>{second ? 'DOBLE FALTA' : 'FALTA'}</Text>
        </Pressable>
        <Pressable style={s.serveBtn} onPress={props.onAce}>
          <Text style={s.serveBtnText}>Ace</Text>
        </Pressable>
        <Pressable style={[s.serveBtn, s.serveBtnSmall]} onPress={props.onLet}>
          <Text style={s.serveBtnText}>Let</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: space.sm },

  sb: { backgroundColor: colors.surface, padding: space.md, gap: space.xs },
  sbRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sbDot: { width: 8, height: 8, borderRadius: radius.pill },
  sbNames: { flex: 1, fontSize: 15, fontWeight: '600' },
  sbSet: { width: 24, textAlign: 'center', fontSize: 17, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  sbGames: { width: 30, textAlign: 'center', fontSize: 20, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  // Los puntos son lo que mas se mira: separados del resto y bien grandes.
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
  sbTag: { color: colors.serve, fontSize: 11, fontWeight: '800', letterSpacing: 1, textAlign: 'right' },

  goldenBar: { backgroundColor: colors.golden, padding: space.sm, gap: space.sm, alignItems: 'center' },
  goldenText: { color: '#3B2708', fontWeight: '900', letterSpacing: 1, fontSize: 13 },
  goldenBtn: { backgroundColor: '#3B2708', paddingVertical: space.sm, paddingHorizontal: space.xl, borderRadius: radius.sm },
  goldenBtnText: { color: colors.golden, fontWeight: '800' },

  court: { flex: 1, justifyContent: 'center', gap: space.md, padding: space.md },
  teamRow: { flexDirection: 'row', gap: space.md },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontWeight: '900', fontSize: 19 },
  cardName: { color: colors.text, fontWeight: '600', fontSize: 14 },
  cardTag: { color: colors.serve, fontSize: 10, fontWeight: '800', letterSpacing: 1, height: 13 },

  bottom: { padding: space.md, gap: space.md, backgroundColor: colors.surface },
  actions: { gap: space.sm },
  actionsTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  actionBtn: { flex: 1, paddingVertical: space.md, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  actionText: { fontWeight: '800', fontSize: 12, textAlign: 'center' },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },

  serveBar: { gap: space.sm, borderTopWidth: 1, borderColor: colors.border, paddingTop: space.md },
  serveHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  serveWho: { color: colors.textDim, fontSize: 13 },
  serveState: { color: colors.serve, fontSize: 13, fontWeight: '700' },
  serveBtn: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serveBtnBig: { flex: 1, backgroundColor: colors.serve },
  serveBtnBigText: { color: '#3B2708', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  serveBtnSmall: { paddingHorizontal: space.md },
  serveBtnText: { color: colors.textDim, fontWeight: '700', fontSize: 13 },

  utilBtn: { flex: 1, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, alignItems: 'center' },
  utilBtnOff: { opacity: 0.35 },
  utilText: { color: colors.text, fontWeight: '700' },

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
