import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { reduce, undo } from '../engine';
import type { Box, MatchConfig, MatchEvent, PlayerId, Shot, TeamId } from '../engine';
import { Scoreboard } from './Scoreboard';
import { SHOT_LABELS, SHOTS } from './shots';
import { StatsScreen } from './StatsScreen';
import { alpha, colors, radius, space, teamColor } from './theme';

type RallyAction = 'WINNER' | 'ERROR_FORZADO' | 'ERROR_NO_FORZADO';

/**
 * Semaforo, desde la perspectiva del jugador de la tarjeta.
 * La inicial manda (es lo que se busca de un vistazo) y la descripcion chica debajo
 * hace que se entienda solo, sin tener que explicarle nada a nadie.
 */
const RALLY: Array<{ type: RallyAction; label: string; desc: string; color: string }> = [
  { type: 'WINNER', label: 'W', desc: 'Winner', color: colors.winner },
  { type: 'ERROR_FORZADO', label: 'EF', desc: 'Error forzado', color: colors.errorForced },
  { type: 'ERROR_NO_FORZADO', label: 'ENF', desc: 'Error no forzado', color: colors.errorUnforced },
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
  const [showStats, setShowStats] = useState(false);
  const [abandoned, setAbandoned] = useState(false);

  const state = useMemo(() => reduce(config, events), [config, events]);
  const push = (e: MatchEvent) => setEvents((prev) => [...prev, e]);

  if (showStats) {
    return (
      <StatsScreen
        config={config}
        events={events}
        state={state}
        finishedEarly={abandoned}
        onBack={() => setShowStats(false)}
        onShare={() => {}}
        onFinish={() => setAbandoned(true)}
      />
    );
  }

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

      {/* Deshacer se lleva el doble de espacio: se usa todo el tiempo y bajo presion.
          Rotar y las estadisticas se tocan poco y con calma. */}
      <View style={s.bottom}>
        <Pressable
          style={[s.utilBtn, s.utilBtnWide, events.length === 0 && s.utilBtnOff]}
          onPress={() => {
            tick();
            setEvents(undo);
          }}
          disabled={events.length === 0}
        >
          <MaterialIcons name="undo" size={22} color={colors.text} />
          <Text style={s.utilText}>Deshacer</Text>
        </Pressable>
        {/* Solo icono: la etiqueta no explicaba nada (¿"dar vuelta" que?) y ocupaba lugar.
            Da vuelta la vista 180 grados para que coincida con lo que ve el que mira. */}
        <Pressable
          style={[s.utilBtn, s.utilBtnIcon]}
          onPress={() => {
            tick();
            setRotated((r) => !r);
          }}
        >
          <MaterialIcons name="swap-vert" size={28} color={colors.text} />
        </Pressable>
        <Pressable
          style={[s.utilBtn, s.utilBtnIcon]}
          onPress={() => {
            tick();
            setShowStats(true);
          }}
        >
          <MaterialIcons name="bar-chart" size={28} color={colors.text} />
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

  // Mismo tamano los tres, los distingue el color. Pero la falta va SOLIDA: es la mas
  // frecuente y la que menos tiempo tiene (cae entre los dos saques). El ace, en cambio,
  // en padel es raro: no merece resaltar.
  const serveBtn = (label: string, color: string, onPress: () => void, solid = false) => (
    <Pressable
      style={[
        s.serveBtn,
        solid
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: alpha(color, 0.16), borderColor: alpha(color, 0.55) },
      ]}
      onPress={onPress}
    >
      <Text style={[s.serveText, { color: solid ? colors.onLight : color }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[s.card, props.serving && s.cardServing]}>
      {/* Las acciones de saque solo existen para el que saca. Que la tarjeta sea
          distinta hace imposible no ver quien esta sacando. */}
      {props.serving ? (
        <View style={s.row}>
          {/* En 2do saque dice DOBLE, no "doble falta": una sola palabra, una sola linea,
              y la pildora de abajo ya dice 2DO SAQUE. */}
          {serveBtn(second ? 'DOBLE' : 'FALTA', colors.falta, props.onFalta, true)}
          {serveBtn('ACE', colors.ace, props.onAce)}
          {serveBtn('LET', colors.let, props.onLet)}
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

        {props.serving ? (
          // El segundo saque se muestra invertido: es el estado peligroso, tiene que saltar.
          <View style={[s.pill, second ? s.pillHot : s.pillCool]}>
            <Text style={[s.pillText, second && { color: colors.onLight }]}>
              {second ? '2DO SAQUE' : '1ER SAQUE'}
            </Text>
          </View>
        ) : props.receiving ? (
          <View style={[s.pill, s.pillGhost]}>
            <Text style={[s.pillText, { color: colors.textFaint }]}>RESTA</Text>
          </View>
        ) : (
          <View style={s.pillEmpty} />
        )}
      </View>

      <View style={s.row}>
        {RALLY.map((a) => (
          <Pressable
            key={a.type}
            style={[
              s.rallyBtn,
              { backgroundColor: alpha(a.color, 0.15), borderColor: alpha(a.color, 0.5) },
            ]}
            onPress={() => props.onRally(a.type)}
            onLongPress={() => props.onRallyLong(a.type)}
          >
            <Text style={[s.rallyText, { color: a.color }]} numberOfLines={1} adjustsFontSizeToFit>
              {a.label}
            </Text>
            {/* Tamano fijo, sin auto-shrink: si cada una se achica por su cuenta, las tres
                terminan de distinto tamano, que es justo lo que queremos evitar. La caja
                tiene alto fijo de dos lineas para que los tres botones queden parejos
                aunque la descripcion ocupe una sola. */}
            <View style={s.descBox}>
              <Text style={[s.rallyDesc, { color: alpha(a.color, 0.8) }]} numberOfLines={2}>
                {a.desc}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', gap: space.xs },


  goldenBar: { backgroundColor: colors.golden, padding: space.sm, gap: space.sm, alignItems: 'center' },
  goldenText: { color: '#3B2708', fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  goldenBtn: { backgroundColor: '#3B2708', paddingVertical: space.sm, paddingHorizontal: space.xl, borderRadius: radius.sm },
  goldenBtnText: { color: colors.golden, fontWeight: '800' },

  court: { flex: 1, gap: space.md, padding: space.md },
  teamRow: { flex: 1, flexDirection: 'row', gap: space.md },

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

  // Los tres del saque son del mismo tamano; los distingue el color, no la jerarquia.
  serveRowEmpty: { height: 46 },
  serveBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  serveText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  identity: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  avatar: { width: 76, height: 76, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.bg, fontWeight: '900', fontSize: 27 },
  cardName: { color: colors.text, fontWeight: '700', fontSize: 15 },

  pill: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  pillEmpty: { height: 22 },
  pillCool: { borderColor: alpha(colors.serve, 0.5), backgroundColor: alpha(colors.serve, 0.1) },
  pillHot: { borderColor: colors.serve, backgroundColor: colors.serve },
  pillGhost: { borderColor: colors.border },
  pillText: { color: colors.serve, fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  rallyBtn: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: space.xs,
    gap: 1,
  },
  rallyText: { fontWeight: '900', fontSize: 19, textAlign: 'center' },
  descBox: { height: 19, justifyContent: 'center' },
  rallyDesc: { fontWeight: '700', fontSize: 7.5, lineHeight: 9, textAlign: 'center' },

  bottom: { flexDirection: 'row', gap: space.sm, padding: space.sm, backgroundColor: colors.surface },
  utilBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilBtnWide: { flex: 1 },
  /** Solo icono: no necesita crecer, y el ancho que sobra se lo lleva Deshacer. */
  utilBtnIcon: { flex: 0, width: 64 },
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
