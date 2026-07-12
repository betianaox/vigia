import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Formation, MatchConfig, Player, TeamId } from '../engine';
import {
  addPlayer,
  DEFAULT_PREFS,
  findPlayer,
  loadPlayers,
  loadPrefs,
  normalize,
  savePrefs,
} from '../store/store';
import type { Prefs } from '../store/store';
import { Brand } from './Brand';
import { alpha, colors, pressed, radius, ripple, space, teamColor } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
/** El golpe seco con el que aterriza el sorteo. */
const thud = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/** Los cuatro lugares de la cancha. El orden importa: es el que se muestra. */
type Slot = 'a1' | 'a2' | 'b1' | 'b2';
const SLOTS: Array<{ slot: Slot; team: TeamId; label: string }> = [
  { slot: 'a1', team: 'A', label: 'Drive' },
  { slot: 'a2', team: 'A', label: 'Revés' },
  { slot: 'b1', team: 'B', label: 'Drive' },
  { slot: 'b2', team: 'B', label: 'Revés' },
];

/**
 * Las opciones de formato. Los textos cortos son a proposito: entran en un segmento y no hay
 * que leer un parrafo para elegir. Lo largo va en la ayuda de abajo.
 */
const LENGTHS = [
  { value: 'un_game', label: '1 game' },
  { value: 'un_set', label: '1 set' },
  { value: 'tres_sets', label: '3 sets' },
] as const;

const FORMATS = [
  { value: 'ventajas', label: 'Ventajas' },
  { value: 'punto_de_oro', label: 'Punto de oro' },
  { value: 'punto_estrella', label: 'Punto estrella' },
] as const;

const THIRD_SETS = [
  { value: 'set_normal', label: 'Set normal' },
  { value: 'super_tiebreak', label: 'Súper tiebreak' },
] as const;

const CHANGE_ENDS = [
  { value: 'games_impares', label: 'Games impares' },
  { value: 'fin_de_set', label: 'Fin de set' },
  { value: 'nunca', label: 'Nunca' },
] as const;

/**
 * Como se para la pareja cuando saca. Es por PAREJA, no por partido — cada equipo elige.
 * Recibiendo no cambia nada: eso esta fijo por reglamento.
 */
const FORMATIONS = [
  { value: 'australiana', label: 'Australiana' },
  { value: 'cambio', label: 'Cambiando de lado' },
] as const;

export function SetupScreen({ onStart }: { onStart: (config: MatchConfig) => void }) {
  const [roster, setRoster] = useState<Player[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  /** Lo escrito en cada lugar. El jugador se resuelve al empezar, no antes. */
  const [names, setNames] = useState<Record<Slot, string>>({ a1: '', a2: '', b1: '', b2: '' });
  const [focused, setFocused] = useState<Slot | null>(null);
  const [firstServingTeam, setFirstServingTeam] = useState<TeamId>('A');
  /** Como se para cada pareja cuando saca. Es del equipo, no del partido. */
  const [formations, setFormations] = useState<Record<TeamId, Formation>>({
    A: 'australiana',
    B: 'australiana',
  });
  const [advanced, setAdvanced] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si la pantalla se va a la mitad del sorteo, no queda un timer suelto tocando estado muerto.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /**
   * El sorteo del saque: el ritual que ya existe en la cancha antes de empezar.
   *
   * LA ANIMACION ES TEATRO, PERO EL SORTEO ES DE VERDAD. El ganador se elige primero, al azar,
   * y la animacion aterriza ahi. No es una ruleta que decide por donde frena: se ve saltar de
   * un equipo al otro, cada vez mas lento, hasta parar en el que salio. Nadie puede acusar a
   * la app de haber elegido con la animacion.
   */
  const drawServe = () => {
    if (drawing) return;
    tick();
    setDrawing(true);

    const winner: TeamId = Math.random() < 0.5 ? 'A' : 'B';
    const flips = 14 + Math.floor(Math.random() * 6);
    let n = 0;

    const step = () => {
      n += 1;
      if (n >= flips) {
        setFirstServingTeam(winner);
        setDrawing(false);
        thud();
        return;
      }
      setFirstServingTeam(n % 2 === 0 ? 'A' : 'B');
      // Arranca rapido y frena: la desaceleracion es lo que hace que se sienta un sorteo.
      timer.current = setTimeout(step, 45 + Math.pow(n / flips, 3) * 300);
    };
    step();
  };

  // El plantel y las preferencias de la ultima vez. La app no pregunta nada que ya sepa.
  useEffect(() => {
    void loadPlayers().then(setRoster);
    void loadPrefs().then(setPrefs);
  }, []);

  const filled = SLOTS.map(({ slot }) => names[slot].trim()).filter((n) => n.length > 0);
  /** Los cuatro lugares llenos y con cuatro personas distintas (sin acentos ni mayusculas). */
  const ready = filled.length === 4 && new Set(filled.map(normalize)).size === 4;

  /** Los jugadores guardados que coinciden con lo escrito, sin los que ya estan en otro lugar. */
  const suggest = (slot: Slot): Player[] => {
    const q = normalize(names[slot]);
    const used = SLOTS.filter((x) => x.slot !== slot).map((x) => normalize(names[x.slot]));
    return roster
      .filter((p) => !used.includes(normalize(p.name)))
      .filter((p) => q.length > 0 && normalize(p.name).includes(q))
      .filter((p) => normalize(p.name) !== q) // ya escribiste su nombre exacto: no hay nada que sugerir
      .slice(0, 4);
  };

  const start = async () => {
    if (!ready) return;
    tick();
    void savePrefs(prefs);

    /**
     * Recien aca los nombres se convierten en JUGADORES con identidad estable. Si el nombre ya
     * existe en el plantel (comparando sin acentos ni mayusculas), se reusa ese id; si no, se
     * crea uno. Es lo que evita que "Ana Ruíz" y "Ana Ruiz" sean dos personas distintas y le
     * partan el historial a alguien para siempre.
     */
    let next = roster;
    const resolved = {} as Record<Slot, Player>;
    for (const { slot } of SLOTS) {
      const name = names[slot].trim();
      next = await addPlayer(name, next);
      resolved[slot] = findPlayer(name, next)!;
    }
    setRoster(next);

    /**
     * El orden de saque arranca por el de DRIVE, siempre. No se pregunta aca: se resuelve en
     * la cancha, con el ⇄ que aparece en la tarjeta justo cuando el equipo va a sacar por
     * primera vez en el set. Ahi la respuesta se ve; aca habria que adivinarla — y el equipo
     * que resta muchas veces todavia no la decidio.
     */
    onStart({
      players: Object.fromEntries(Object.values(resolved).map((p) => [p.id, p])),
      teams: {
        A: { id: 'A', drive: resolved.a1.id, reves: resolved.a2.id, formation: formations.A },
        B: { id: 'B', drive: resolved.b1.id, reves: resolved.b2.id, formation: formations.B },
      },
      serveOrder: {
        A: [resolved.a1.id, resolved.a2.id],
        B: [resolved.b1.id, resolved.b2.id],
      },
      firstServingTeam,
      ...prefs,
    });
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.page}>
        <View style={s.head}>
          <Brand subtitle="Partido nuevo" />
        </View>

        {(['A', 'B'] as TeamId[]).map((team) => (
          <View key={team} style={s.block}>
            <Text style={[s.blockTitle, { color: teamColor(team) }]}>
              {team === 'A' ? 'EQUIPO 1' : 'EQUIPO 2'}
            </Text>

            {/* El campo se resuelve solo: escribis y abajo aparecen los jugadores guardados que
                coinciden. Abrir un modal a pantalla completa para llenar UN campo de texto es
                un peso injustificado — el campo tiene que poder solo. */}
            {SLOTS.filter((x) => x.team === team).map(({ slot, label }) => {
              const hits = focused === slot ? suggest(slot) : [];
              return (
                <View key={slot} style={s.slotBlock}>
                  <View style={s.slotRow}>
                    <Text style={s.slotLabel}>{label}</Text>
                    <TextInput
                      style={[s.slot, !names[slot] && s.slotVacant]}
                      value={names[slot]}
                      onChangeText={(v) => setNames((n) => ({ ...n, [slot]: v }))}
                      onFocus={() => setFocused(slot)}
                      onBlur={() => setFocused((f) => (f === slot ? null : f))}
                      placeholder="Nombre"
                      placeholderTextColor={colors.textFaint}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                  </View>

                  {hits.map((p) => (
                    <Pressable
                      key={p.id}
                      style={({ pressed: pr }) => [s.hit, pr && pressed]}
                      android_ripple={ripple}
                      onPress={() => {
                        tick();
                        setNames((n) => ({ ...n, [slot]: p.name }));
                        setFocused(null);
                      }}
                    >
                      <MaterialIcons name="person" size={18} color={colors.textDim} />
                      <Text style={s.hitText} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        ))}

        <Segmented
          title="EMPIEZA SACANDO"
          options={[
            { value: 'A', label: 'Equipo 1' },
            { value: 'B', label: 'Equipo 2' },
          ]}
          value={firstServingTeam}
          onChange={(v) => setFirstServingTeam(v as TeamId)}
          disabled={drawing}
          right={
            <Pressable
              style={({ pressed: pr }) => [s.draw, drawing && s.drawOn, pr && pressed]}
              android_ripple={ripple}
              onPress={drawServe}
              disabled={drawing}
            >
              <MaterialIcons
                name="casino"
                size={16}
                color={drawing ? colors.text : colors.textDim}
              />
              <Text style={[s.drawText, drawing && { color: colors.text }]}>
                {drawing ? 'Sorteando…' : 'Sortear'}
              </Text>
            </Pressable>
          }
        />

        <Segmented
          title="PARTIDO"
          options={LENGTHS}
          value={prefs.length}
          onChange={(v) => setPrefs((x) => ({ ...x, length: v as Prefs['length'] }))}
        />

        <Pressable
          style={({ pressed: pr }) => [s.advanced, pr && pressed]}
          android_ripple={ripple}
          onPress={() => {
            tick();
            setAdvanced((a) => !a);
          }}
        >
          <MaterialIcons name="tune" size={18} color={colors.textDim} />
          <Text style={s.advancedText}>Opciones avanzadas</Text>
          <MaterialIcons
            name={advanced ? 'expand-less' : 'expand-more'}
            size={20}
            color={colors.textDim}
          />
        </Pressable>

        {advanced && (
          <>
            <Segmented
              title="AL 40-40"
              options={FORMATS}
              value={prefs.gameFormat}
              onChange={(v) => setPrefs((x) => ({ ...x, gameFormat: v as Prefs['gameFormat'] }))}
            />
            {prefs.length === 'tres_sets' && (
              <Segmented
                title="TERCER SET"
                options={THIRD_SETS}
                value={prefs.thirdSet}
                onChange={(v) => setPrefs((x) => ({ ...x, thirdSet: v as Prefs['thirdSet'] }))}
              />
            )}
            <Segmented
              title="CAMBIOS DE LADO"
              options={CHANGE_ENDS}
              value={prefs.changeEnds}
              onChange={(v) => setPrefs((x) => ({ ...x, changeEnds: v as Prefs['changeEnds'] }))}
            />

            {/* La formacion es por PAREJA, no por partido: cada equipo elige la suya. Solo
                afecta como se paran cuando SACAN — recibiendo, el reglamento las obliga a
                mantener el lugar que eligieron al empezar el set. */}
            {(['A', 'B'] as TeamId[]).map((team) => (
              <Segmented
                key={team}
                title={`${team === 'A' ? 'EQUIPO 1' : 'EQUIPO 2'} · CUANDO SACA`}
                options={FORMATIONS}
                value={formations[team]}
                onChange={(v) => setFormations((f) => ({ ...f, [team]: v as Formation }))}
              />
            ))}

            <Text style={s.hint}>La app recuerda esto para el próximo partido.</Text>
          </>
        )}

        <Pressable
          style={({ pressed: pr }) => [s.start, !ready && s.startOff, pr && pressed]}
          android_ripple={ripple}
          onPress={start}
          disabled={!ready}
        >
          <MaterialIcons
            name="play-arrow"
            size={26}
            color={ready ? colors.text : colors.textFaint}
          />
          <Text style={[s.startText, !ready && s.startTextOff]}>Empezar</Text>
        </Pressable>

        {/* Todavia no hay guardado de partidos: el historial no tiene nada que mostrar. */}
        <Pressable style={[s.history, s.off]} disabled>
          <MaterialIcons name="history" size={20} color={colors.textDim} />
          <Text style={s.historyText}>Historial</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Un grupo de opciones excluyentes. Todas visibles: elegir no puede costar dos toques. */
function Segmented(props: {
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  /** Una accion al lado del titulo (el sorteo del saque). */
  right?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <View style={s.segBlock}>
      <View style={s.segHead}>
        <Text style={s.segTitle}>{props.title}</Text>
        {props.right}
      </View>
      <View style={s.segRow}>
        {props.options.map((o) => {
          const on = o.value === props.value;
          return (
            <Pressable
              key={o.value}
              style={({ pressed: pr }) => [s.seg, on && s.segOn, pr && pressed]}
              android_ripple={ripple}
              onPress={() => {
                tick();
                props.onChange(o.value);
              }}
              disabled={props.disabled}
            >
              <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * El aire de esta pantalla es a proposito. No se toca bajo presion —se llena una vez, antes
 * de empezar— asi que puede respirar. Es lo contrario de la cancha, donde cada dp cuenta.
 */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  page: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },

  head: { marginBottom: space.md },

  block: { gap: space.sm },
  blockTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },

  /** El campo y, debajo, las sugerencias del plantel mientras esta enfocado. */
  slotBlock: { gap: space.xs },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  slotLabel: { width: 48, color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  slot: {
    flex: 1,
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  /** Vacio: mas apagado y con el borde apenas insinuado. Se ve que falta llenarlo. */
  slotVacant: { backgroundColor: 'transparent', borderColor: alpha(colors.text, 0.12) },

  /** Una sugerencia del plantel. Va indentada bajo el campo, no encima: no tapa nada. */
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginLeft: 48 + space.sm,
    height: 42,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  hitText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },

  hint: { color: colors.textFaint, fontSize: 11, lineHeight: 15 },

  segBlock: { gap: space.sm },
  segHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  segTitle: { flex: 1, color: colors.textFaint, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },

  draw: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  drawOn: { backgroundColor: colors.cta, borderColor: colors.cta },
  drawText: { color: colors.textDim, fontSize: 11, fontWeight: '800' },
  segRow: { flexDirection: 'row', gap: space.sm },
  seg: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  segOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  segText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  segTextOn: { color: colors.text, fontWeight: '900' },

  advanced: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  advancedText: { flex: 1, color: colors.textDim, fontSize: 13, fontWeight: '700' },

  start: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.cta,
    marginTop: space.md,
  },
  startText: { color: colors.text, fontSize: 17, fontWeight: '900' },
  /**
   * Deshabilitado NO es "el mismo boton mas transparente": el lima al 35% sobre fondo oscuro
   * da un verde oliva sucio que no se lee como apagado, se lee como roto. Se apaga cambiando
   * el color, no la opacidad.
   */
  startOff: { backgroundColor: colors.surface },
  startTextOff: { color: colors.textFaint },
  off: { opacity: 0.45 },

  history: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  historyText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
});
