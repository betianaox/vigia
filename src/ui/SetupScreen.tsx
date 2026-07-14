import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { seedMatch } from '../dev/seed';
import { reduce } from '../engine';
import type { Formation, MatchConfig, Player, TeamId } from '../engine';
import { type SavedMatch } from '../store/matches';
import { Scoreboard } from './Scoreboard';
import {
  addPlayer,
  DEFAULT_PREFS,
  findPlayer,
  loadPrefs,
  normalize,
  savePrefs,
} from '../store/store';
import type { Prefs } from '../store/store';
import { L } from '../i18n';
import { Brand } from './Brand';
import { PlayerField } from './PlayerField';
import { useRoster } from './roster';
import { alpha, colors, pressed, radius, ripple, space, teamColor } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
/** El golpe seco con el que aterriza el sorteo. */
const thud = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/** Los cuatro lugares de la cancha. El orden importa: es el que se muestra. */
type Slot = 'a1' | 'a2' | 'b1' | 'b2';
const SLOTS: Array<{ slot: Slot; team: TeamId; label: string }> = [
  { slot: 'a1', team: 'A', label: L.positions.drive },
  { slot: 'a2', team: 'A', label: L.positions.reves },
  { slot: 'b1', team: 'B', label: L.positions.drive },
  { slot: 'b2', team: 'B', label: L.positions.reves },
];

/** El nombre del equipo, que se usa en media pantalla. */
const teamName = (t: TeamId): string => (t === 'A' ? L.teams.a : L.teams.b);

/**
 * Las opciones de formato. Los textos cortos son a proposito: entran en un segmento y no hay
 * que leer un parrafo para elegir. Lo largo va en la ayuda de abajo.
 */
const LENGTHS = [
  { value: 'un_game', label: L.setup.lengths.un_game },
  { value: 'un_set', label: L.setup.lengths.un_set },
  { value: 'tres_sets', label: L.setup.lengths.tres_sets },
] as const;

const FORMATS = [
  { value: 'ventajas', label: L.setup.gameFormats.ventajas },
  { value: 'punto_de_oro', label: L.setup.gameFormats.punto_de_oro },
  { value: 'punto_estrella', label: L.setup.gameFormats.punto_estrella },
] as const;

const THIRD_SETS = [
  { value: 'set_normal', label: L.setup.thirdSets.set_normal },
  { value: 'super_tiebreak', label: L.setup.thirdSets.super_tiebreak },
] as const;

const CHANGE_ENDS = [
  { value: 'games_impares', label: L.setup.changeEndsOptions.games_impares },
  { value: 'fin_de_set', label: L.setup.changeEndsOptions.fin_de_set },
  { value: 'nunca', label: L.setup.changeEndsOptions.nunca },
] as const;

/** Las dos maneras de cargar un golpe. La primera es el default, y es la que enseña. */
const SHOT_PROMPTS = [
  { value: 'siempre', label: L.setup.shotPrompts.siempre },
  { value: 'opcional', label: L.setup.shotPrompts.opcional },
] as const;

/**
 * Como se para la pareja cuando saca. Es por PAREJA, no por partido — cada equipo elige.
 * Recibiendo no cambia nada: eso esta fijo por reglamento.
 *
 * SE DICE LO QUE PASA, no como se llama. La palabra "australiana" significa cosas distintas
 * segun con quien hables —unos le dicen asi a no cambiar de lado, otros a otra cosa— y una
 * palabra ambigua en un formulario no es un nombre: es una trampa. "Mantiene el lado" no se
 * puede malinterpretar.
 *
 * La CLAVE sigue siendo `australiana` / `cambio`: el motor no se entera, y los partidos ya
 * jugados no se tocan. Para esto existe la separacion entre la etiqueta y el dato.
 */
const FORMATIONS = [
  { value: 'australiana', label: L.setup.formations.australiana },
  { value: 'cambio', label: L.setup.formations.cambio },
] as const;

export function SetupScreen({
  onStart,
  onHistory,
  onPlayers,
  resumable,
  onResume,
  onClosePending,
}: {
  onStart: (config: MatchConfig) => void;
  onHistory: () => void;
  /** La gente con la que jugas, y el acumulado de cada una. */
  onPlayers: () => void;
  /** El partido que quedo a medias, si hay uno. */
  resumable: SavedMatch | null;
  onResume: (m: SavedMatch) => void;
  /** Cerrarlo: deja de ofrecerse, pero queda en el historial como sin terminar. */
  onClosePending: () => void;
}) {
  const { width } = useWindowDimensions();
  // El plantel sale del contexto: una sola fuente en toda la app.
  const { players: roster, reload } = useRoster();
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

  /** Hay un partido en curso: no se puede empezar otro sin decidir que paso con este. */
  const busy = resumable !== null;

  /**
   * El partido a medias, reconstruido del log.
   *
   * No se resume a un string: se le da el estado entero al MISMO tanteador de la cancha. Un
   * texto tipo "6-4 · 40-30" siempre tiene un partido que lo corta —un tercer set, un
   * tiebreak— y no hay ancho que lo salve. Con columnas no existe el caso largo, y de paso
   * quien vuelve a la app ve exactamente lo que dejo, dibujado igual que como lo dejo.
   */
  const pending = useMemo(() => {
    if (!resumable) return null;
    return {
      config: resumable.config,
      state: reduce(resumable.config, resumable.events),
      match: resumable,
    };
  }, [resumable]);

  /** Lo que le queda al tanteador adentro de la tarjeta: la pantalla, menos los dos padding. */
  const boardW = width - space.lg * 2 - space.md * 2;

  /**
   * El relevo entre la tarjeta del partido en curso y el formulario.
   *
   * `shown` va UN PASO ATRAS de `busy`: al terminar el partido, `resumable` se vuelve null en
   * el acto, pero la tarjeta tiene que quedarse en pantalla el tiempo que dura su salida. Sin
   * esto no hay fade — hay un parpadeo. Por eso tambien se retiene una copia del partido
   * (`held`): lo que se dibuja mientras se va ya no existe en el estado.
   */
  const [shown, setShown] = useState<'busy' | 'form'>(busy ? 'busy' : 'form');
  const held = useRef(pending);
  if (pending) held.current = pending;

  const fade = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const next = busy ? 'busy' : 'form';
    if (next === shown) return;

    // Se va lo viejo, entra lo nuevo. Nunca los dos juntos: se pisarian.
    Animated.timing(fade, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setShown(next);
      rise.setValue(12); // entra desde abajo: el movimiento es lo que lo hace sentir vivo
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rise, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [busy, shown, fade, rise]);

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

  // Las preferencias de la ultima vez. La app no pregunta nada que ya sepa.
  useEffect(() => {
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
    // Aca es donde nacen los jugadores nuevos: el resto de la app tiene que enterarse.
    await reload();

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

  /** Lo que se esta dibujando AHORA, que durante el relevo no es lo mismo que `busy`. */
  const onCourt = shown === 'busy';
  const card = held.current;

  return (
    <SafeAreaView style={s.root}>
      {/**
       * `keyboardShouldPersistTaps="handled"` NO es un detalle de scroll: sin esto, el
       * desplegable de nombres no se puede tocar.
       *
       * Por default, con el teclado abierto, el ScrollView se queda con el primer toque que cae
       * afuera del campo —lo usa para cerrar el teclado— y el toque nunca llega al boton. El
       * desplegable aparecia, se tocaba, y no pasaba nada: habia que escribir el nombre entero.
       * En el historial funcionaba porque alli el campo vive fuera del scroll.
       *
       * Con "handled", si un hijo atiende el toque, el toque es suyo; el teclado se cierra solo
       * cuando el toque no lo atiende nadie.
       */}
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.head}>
          <Brand
            subtitle={onCourt ? L.setup.onCourt : L.setup.newMatch}
            tint={colors.ball}
          />
        </View>

        <Animated.View
          style={[
            s.body,
            /* Sin formulario, la tarjeta sola arriba dejaba media pantalla muerta. Centrada, el
               vacio deja de leerse como "falta algo" y pasa a leerse como "esto es todo". */
            onCourt && s.bodyCentered,
            { opacity: fade, transform: [{ translateY: rise }] },
          ]}
        >
        {/* El partido que quedo a medias. Si alguien vuelve a abrir la app despues de que
            Android la mato en el entretiempo, esto es lo unico que quiere ver. Nada se perdio
            — el log estaba en disco.

            Y mientras haya uno en curso, NO SE PUEDE EMPEZAR OTRO: hay que decidir que paso
            con este. Si no, se acumulan partidos huerfanos en silencio y nadie los termina
            nunca. Terminar un partido se hace aca, en un solo lugar. */}
        {onCourt && card ? (
          <View style={s.resume}>
            {/* Arriba de todo, chico y apagado: dice QUE es esta tarjeta, y despues se calla.
                No compite con lo unico que importa mirar, que es el tanteo. */}
            <Text style={s.resumeEyebrow}>{L.setup.resumeEyebrow}</Text>

            {/* El MISMO tanteador de la cancha, con el estado tal cual quedo: los nombres
                enteros, la pelotita en quien tenia el saque, el punto en vivo. Quien vuelve
                a la app no lee un resumen del partido — ve el partido. */}
            <View style={s.resumeBoard}>
              <Scoreboard config={card.config} state={card.state} width={boardW} />
            </View>

            <View style={s.resumeActions}>
              <Pressable
                style={({ pressed: pr }) => [s.resumeBtn, s.resumeGo, pr && pressed]}
                android_ripple={ripple}
                onPress={() => {
                  tick();
                  onResume(card.match);
                }}
              >
                <MaterialIcons name="play-arrow" size={22} color={colors.text} />
                <Text style={s.resumeBtnText}>{L.setup.resume}</Text>
              </Pressable>

              {/* SIN CONFIRMACION. Esta tarjeta YA ES la pregunta: dice que hay un partido a
                  medias y ofrece las dos respuestas, una al lado de la otra. Un dialogo encima
                  seria preguntar dos veces lo mismo — y a la segunda nadie lee, se toca el
                  boton de la derecha y listo. Una confirmacion que no se lee no protege nada:
                  solo agrega un toque.

                  Terminarlo tampoco borra nada: el partido queda en el historial como "sin
                  terminar", con las estadisticas de lo que se jugo. Lo unico que se pierde es
                  poder seguir anotandolo. */}
              <Pressable
                style={({ pressed: pr }) => [s.resumeBtn, s.resumeEnd, pr && pressed]}
                android_ripple={ripple}
                onPress={() => {
                  tick();
                  onClosePending();
                }}
              >
                {/* Play y stop: el par que ya existe en el mundo. Al lado de un ▶ que dice
                    "Seguir", un ■ no hay que explicarlo — y lo que se detiene es, literalmente,
                    algo que esta EN CURSO. La banderita no significaba nada. */}
                <MaterialIcons name="stop" size={22} color={colors.textDim} />
                <Text style={s.resumeBtnTextDim}>{L.setup.end}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
        {(['A', 'B'] as TeamId[]).map((team) => (
          <View key={team} style={s.block}>
            {/* El titulo solo no anclaba nada: dos palabras chicas flotando arriba de dos campos.
                La linea del color del equipo, corriendo hasta el borde, lo convierte en un
                encabezado de verdad — y dice donde empieza cada equipo sin que haya que leerlo. */}
            <View style={s.blockHead}>
              <Text style={[s.blockTitle, { color: teamColor(team) }]}>
                {teamName(team).toUpperCase()}
              </Text>
              <View style={[s.blockRule, { backgroundColor: alpha(teamColor(team), 0.5) }]} />
            </View>

            {/* El campo se resuelve solo: escribis y abajo aparecen los jugadores guardados que
                coinciden. Abrir un modal a pantalla completa para llenar UN campo de texto es
                un peso injustificado — el campo tiene que poder solo. */}
            {/* El MISMO campo que el filtro del historial. La accion es la misma —nombrar a una
                persona— y hasta hoy se veia distinta en cada pantalla, que es lo que hace que
                una app se sienta hecha de retazos.

                Aca, a diferencia del historial, el texto libre VALE: es donde nacen los
                jugadores nuevos. El desplegable ayuda, no obliga. */}
            {SLOTS.filter((x) => x.team === team).map(({ slot, label }) => (
              <View key={slot} style={s.slotRow}>
                <Text style={s.slotLabel}>{label}</Text>
                {/* El ancho que sobra lo pide QUIEN LO USA, no el componente. */}
                <View style={s.slotField}>
                <PlayerField
                  value={names[slot]}
                  onChangeText={(v) => setNames((n) => ({ ...n, [slot]: v }))}
                  placeholder={L.setup.namePlaceholder}
                  suggestions={focused === slot ? suggest(slot) : []}
                  onPick={(p) => {
                    tick();
                    setNames((n) => ({ ...n, [slot]: p.name }));
                    setFocused(null);
                  }}
                  onClear={() => {
                    tick();
                    setNames((n) => ({ ...n, [slot]: '' }));
                  }}
                  /**
                   * EL DESPLEGABLE NO SE CIERRA AL PERDER EL FOCO, y eso no es un olvido.
                   *
                   * Tocar una sugerencia hace que el campo pierda el foco ANTES de que el toque
                   * se complete. Si el blur cerrara la lista, la lista se desmontaria entre el
                   * dedo bajando y el dedo subiendo, y el toque terminaria cayendo en el vacio:
                   * el desplegable aparecia, se tocaba, y no pasaba nada.
                   *
                   * Se cierra sola donde corresponde: al elegir a alguien, al vaciar el campo, o
                   * al pasar a otro campo (que se apropia del foco). Y `suggest` no ofrece nada
                   * cuando el nombre ya esta escrito entero, asi que tampoco queda colgada.
                   */
                  onFocus={() => setFocused(slot)}
                />
                </View>
              </View>
            ))}
          </View>
        ))}

        <Segmented
          title={L.setup.firstServe}
          options={[
            { value: 'A', label: L.teams.a },
            { value: 'B', label: L.teams.b },
          ]}
          value={firstServingTeam}
          onChange={(v) => setFirstServingTeam(v as TeamId)}
          disabled={drawing}
          /* Cada equipo con SU color: es el mismo violeta y naranja de la cancha y del
             tanteador. Sin esto, "Equipo 1" y "Equipo 2" son dos palabras iguales y hay que
             leerlas; con el color, se reconocen sin leer. */
          colorOf={(v) => teamColor(v as TeamId)}
          right={
            <HeadChip
              icon="casino"
              label={drawing ? L.setup.drawing : L.setup.draw}
              on={drawing}
              disabled={drawing}
              onPress={drawServe}
            />
          }
        />

        {/* Avanzadas viaja MONTADO en el renglon del titulo, igual que Sortear en EMPIEZA
            SACANDO. No cuesta un solo pixel de alto — y sobre todo, vive donde pertenece: es
            una opcion del partido que estas armando, no una puerta a otra pantalla.

            Estuvo un rato abajo, en la misma fila que Historial y Jugadores. Entraba, pero
            juntaba dos cosas que no son la misma: esos dos te sacan de la pantalla, este
            configura lo que tenes delante. La costura se notaba por mas que se pintara
            distinto. */}
        <Segmented
          title={L.setup.match}
          options={LENGTHS}
          value={prefs.length}
          onChange={(v) => setPrefs((x) => ({ ...x, length: v as Prefs['length'] }))}
          right={
            /* UN solo icono, y es el que cambia: cerrado, el `tune` dice que hay opciones
               adentro; abierto, el chevron ocupa su lugar y dice como se cierra. Los dos a la
               vez eran uno de mas — el estado ya lo cuenta el panel que esta ahi abajo. */
            <HeadChip
              icon={advanced ? 'expand-less' : 'tune'}
              label={L.setup.advanced}
              on={advanced}
              onPress={() => {
                tick();
                setAdvanced((a) => !a);
              }}
            />
          }
        />

        {/* El panel: justo debajo de lo que lo abrio, y adentro del formulario.

            El problema original nunca fue que faltara una pestaña — era que las opciones se
            soltaban DESNUDAS en el flujo, indistinguibles de PARTIDO o de EMPIEZA SACANDO. Lo
            que las agrupa es la CAJA. */}
        {advanced && (
          <View style={s.panel}>
            {/**
             * PRIMERA DE TODAS, y no por orden alfabetico: es la unica opcion de la lista que le
             * enseña algo al que no sabe. Las otras configuran el reglamento; esta le cuenta que
             * los golpes se pueden registrar — que es el diferencial entero de la app y hasta hoy
             * vivia detras de un gesto invisible.
             *
             * El default es "Preguntar siempre" a proposito (ver `DEFAULT_PREFS`): el que no
             * quiere que le pregunten lo apaga una vez y no lo ve nunca mas.
             */}
            <Segmented
              title={L.setup.shotPrompt}
              options={SHOT_PROMPTS}
              value={prefs.shotPrompt}
              onChange={(v) => setPrefs((x) => ({ ...x, shotPrompt: v as Prefs['shotPrompt'] }))}
              hints={[L.setup.shotPromptHints.siempre, L.setup.shotPromptHints.opcional]}
            />

            {/* UNA LINEA ENTRE OPCION Y OPCION. Hacia abajo no hay limite —esta pantalla ya
                scrollea— asi que el aire es gratis, y la linea convierte una lista continua en
                bloques que se leen de a uno. */}
            <View style={s.panelRule} />

            <Segmented
              title={L.setup.gameFormat}
              options={FORMATS}
              value={prefs.gameFormat}
              onChange={(v) => setPrefs((x) => ({ ...x, gameFormat: v as Prefs['gameFormat'] }))}
              stack
            />

            {prefs.length === 'tres_sets' && (
              <>
                <View style={s.panelRule} />
                <Segmented
                  title={L.setup.thirdSet}
                  options={THIRD_SETS}
                  value={prefs.thirdSet}
                  onChange={(v) => setPrefs((x) => ({ ...x, thirdSet: v as Prefs['thirdSet'] }))}
                />
              </>
            )}

            <View style={s.panelRule} />

            <Segmented
              title={L.setup.changeEnds}
              options={CHANGE_ENDS}
              value={prefs.changeEnds}
              onChange={(v) => setPrefs((x) => ({ ...x, changeEnds: v as Prefs['changeEnds'] }))}
              stack
            />

            {/* La formacion es por PAREJA, no por partido: cada equipo elige la suya. Solo
                afecta como se paran cuando SACAN — recibiendo, el reglamento las obliga a
                mantener el lugar que eligieron al empezar el set. */}
            {(['A', 'B'] as TeamId[]).map((team) => (
              <View key={team} style={s.panelBlock}>
                <View style={s.panelRule} />
                <Segmented
                  title={L.setup.formation(teamName(team).toUpperCase())}
                  options={FORMATIONS}
                  value={formations[team]}
                  onChange={(v) => setFormations((f) => ({ ...f, [team]: v as Formation }))}
                />
              </View>
            ))}

            <Text style={s.hint}>{L.setup.remembered}</Text>
          </View>
        )}

          </>
        )}

        {/* EMPEZAR CIERRA EL FORMULARIO. Ahi termina el camino: se llenan los nombres, se elige
            el formato, se toca Empezar. Nada mas.

            Estaba DEBAJO de Historial y Jugadores, y eso hacia que un usuario nuevo tuviera que
            pasar por encima de dos botones que no tienen nada que ver para llegar al que si.
            Parecian escalones del camino, y no lo son. */}
        {!onCourt && (
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
            <Text style={[s.startText, !ready && s.startTextOff]}>{L.setup.start}</Text>
          </Pressable>
        )}

        {/* Y aca se corta. La linea no es decoracion: le dice a alguien que abre la app por
            primera vez que lo de abajo NO HACE FALTA para empezar a jugar. */}
        <View style={s.split} />

        {/* Debajo de la linea, SOLO las dos puertas. Hermanas de verdad: las dos te sacan de esta
            pantalla, van iguales y van juntas. Avanzadas ya no esta aca — se fue al renglon de
            PARTIDO, que es donde pertenece. */}
        <View style={s.doors}>
          <Pressable
            style={({ pressed: pr }) => [s.door, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onHistory();
            }}
          >
            <MaterialIcons name="history" size={22} color={colors.textDim} />
            <Text style={s.doorText}>{L.setup.history}</Text>
          </Pressable>

          {/* El acumulado de cada persona es lo que hace que alguien vuelva a abrir la app en
              tres meses. Estaba escondido detras del buscador del historial —escribir, elegir,
              y recien ahi aparecia— y asi no se descubre nunca. Merece una puerta propia. */}
          <Pressable
            style={({ pressed: pr }) => [s.door, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onPlayers();
            }}
          >
            {/* Personas, no un grafico: lo que hay del otro lado son las personas. El grafico
                vive adentro. */}
            <MaterialIcons name="groups" size={22} color={colors.textDim} />
            <Text style={s.doorText}>{L.setup.players}</Text>
          </Pressable>
        </View>

        {/* Siembra un partido entero, jugado por el motor, para poder probar las estadisticas
            sin cargar cien puntos a mano. `__DEV__` es false en el build de produccion, asi
            que este boton no existe alli — ni el codigo que cuelga de el. */}
        {__DEV__ && (
          <Pressable
            style={({ pressed: pr }) => [s.seed, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              // Cinco partidos, repartidos en los ultimos tres meses y con fuerzas distintas:
              // uno solo no muestra ninguna evolucion, y todos iguales tampoco.
              void (async () => {
                const day = 24 * 60 * 60 * 1000;
                for (let i = 0; i < 5; i++) {
                  await seedMatch({
                    seed: Math.floor(Math.random() * 10000),
                    strengthA: 0.42 + i * 0.05, // va mejorando: eso es lo que hay que poder ver
                    startedAt: Date.now() - (75 - i * 15) * day,
                  });
                }
                onHistory();
              })();
            }}
          >
            <MaterialIcons name="science" size={16} color={colors.textFaint} />
            <Text style={s.seedText}>Sembrar 5 partidos de prueba</Text>
          </Pressable>
        )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * La pastilla que viaja montada en el renglon de un titulo: Sortear, Avanzadas.
 *
 * ES UN SOLO COMPONENTE, no dos estilos parecidos. Tenian que verse iguales, y dos cosas que
 * "tienen que verse iguales" se separan el dia que alguien toca una sola.
 */
function HeadChip({
  icon,
  label,
  on,
  disabled,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  /** Encendida: el sorteo corriendo, las avanzadas abiertas. */
  on?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed: pr }) => [s.chip, on && s.chipOn, pr && pressed]}
      android_ripple={ripple}
      onPress={onPress}
      disabled={disabled}
    >
      <MaterialIcons name={icon} size={16} color={on ? colors.text : colors.textDim} />
      <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

interface SegmentedProps {
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  /** Una accion al lado del titulo (el sorteo del saque). */
  right?: ReactNode;
  disabled?: boolean;
  /** Un color propio por opcion (los equipos). Sin esto, el segmento va en gris neutro. */
  colorOf?: (value: string) => string;
  /**
   * Que hace cada opcion, una linea por opcion, y LAS DOS SIEMPRE A LA VISTA.
   *
   * No solo la elegida: si para saber que hace la otra hay que tocarla, entonces para comparar
   * hay que cambiar de modo — y quien esta aprendiendo que existen los golpes no tiene por que
   * probar a ciegas.
   *
   * Va solo donde el label no alcanza, y hay un solo lugar asi: el registro de golpe, que le
   * esta contando a alguien una funcion que no conoce. En el resto (ventajas, punto de oro, fin
   * de set) el nombre YA lo dice todo, y explicar lo obvio es ruido.
   */
  hints?: readonly string[];
  /** Tres opciones en dos renglones (2 + 1 centrada). Solo en las avanzadas: ver abajo. */
  stack?: boolean;
}

/** Un grupo de opciones excluyentes. Todas visibles: elegir no puede costar dos toques. */
function Segmented(props: SegmentedProps) {
  return (
    <View style={s.segBlock}>
      <View style={s.segHead}>
        <Text style={s.segTitle}>{props.title}</Text>
        {props.right}
      </View>
      {/**
       * TRES OPCIONES EN DOS RENGLONES: dos arriba y una centrada abajo.
       *
       * Tres botones en una fila dejan un tercio de pantalla para cada uno, y ahi "Punto estrella"
       * no entra: o se corta, o hay que achicar la letra de las tres. Abajo, en cambio, el espacio
       * es GRATIS — la pantalla ya scrollea. Se paga con un renglon y se gana el doble de ancho.
       *
       * Solo en las avanzadas: en el formulario principal las opciones son cortas (1 game, 1 set)
       * y entran las tres al hilo.
       */}
      {props.stack && props.options.length === 3 ? (
        <>
          <View style={s.segRow}>
            {button(props, 0)}
            {button(props, 1)}
          </View>
          <View style={s.segRow}>
            <View style={s.segSpacer} />
            {button(props, 2)}
            <View style={s.segSpacer} />
          </View>
        </>
      ) : (
        <View style={s.segRow}>{props.options.map((_, i) => button(props, i))}</View>
      )}

      {/**
       * Las explicaciones van en SU PROPIO renglon, no adentro de cada boton.
       *
       * Cuando el sistema tiene la letra grande, "Preguntar siempre" pasa a dos lineas y ese boton
       * crece. Si cada boton viviera en su columna junto con su explicacion, el de al lado —que
       * entra en una linea— quedaria mas bajo, y dos botones hermanos de distinto alto se leen como
       * un error. En una fila, en cambio, se estiran los dos al mismo alto sin pedir permiso.
       */}
      {props.hints && (
        <View style={s.segRow}>
          {props.hints.map((hint, i) => (
            <Text key={props.options[i]!.value} style={[s.segCell, s.segHint]}>
              {hint}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/** Un boton del grupo. Vive afuera para poder dibujarlo en cualquier renglon (ver el 2+1). */
function button(props: SegmentedProps, i: number): ReactNode {
  const o = props.options[i]!;
  const on = o.value === props.value;
  const c = props.colorOf?.(o.value);

  return (
    <Pressable
      key={o.value}
      style={({ pressed: pr }) => [
        s.seg,
        on && s.segOn,
        /* Con color propio, los DOS van del color de su equipo — nunca en gris. Lo que
           distingue al elegido es el BORDE BLANCO, que es el mismo vocabulario de la
           cancha: alla, el borde blanco marca al que saca. Nada nuevo que aprender. */
        c && { backgroundColor: alpha(c, on ? 0.24 : 0.1), borderColor: alpha(c, 0.45) },
        c && on && { borderColor: colors.serve },
        pr && pressed,
      ]}
      android_ripple={ripple}
      onPress={() => {
        tick();
        props.onChange(o.value);
      }}
      disabled={props.disabled}
    >
      {/* DOS LINEAS, NO PUNTOS SUSPENSIVOS. Con la letra del sistema en grande, "Preguntar
          siempre" ya no entra de un renglon: cortarlo en "Preguntar siem…" es peor que no
          escribirlo. El boton tiene alto MINIMO, no alto fijo — si la palabra necesita otra
          linea, la toma. La pantalla scrollea; el alto no es un recurso escaso. */}
      <Text style={[s.segText, on && s.segTextOn, c && { color: c }]} numberOfLines={2}>
        {o.label}
      </Text>
    </Pressable>
  );
}

/**
 * El aire de esta pantalla es a proposito. No se toca bajo presion —se llena una vez, antes
 * de empezar— asi que puede respirar. Es lo contrario de la cancha, donde cada dp cuenta.
 */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  /**
   * `flexGrow` para que el contenido pueda OCUPAR la pantalla aunque no la llene: sin esto,
   * centrar no significa nada — el contenedor mide lo mismo que su contenido.
   *
   * El aire se saca de ARRIBA, no se agrega abajo. Los botones tocaban el borde inferior porque
   * el contenido no entraba y la pantalla scrolleaba; agregarle margen abajo solo alarga el
   * scroll. Subiendolo, entra — y el fondo se acomoda solo.
   */
  page: {
    flexGrow: 1,
    padding: space.lg,
    paddingTop: space.sm,
    gap: space.lg,
    paddingBottom: space.xl,
  },

  /** El `gap` del cuerpo ya separa el encabezado de lo que sigue: no hace falta sumarle margen. */
  head: {},

  body: { gap: space.lg },
  /** La tarjeta y el historial en el centro optico —un poco arriba del geometrico, que es donde
      el ojo espera encontrarlos— y no colgando del titulo con medio telefono vacio abajo. */
  bodyCentered: { flex: 1, justifyContent: 'center', paddingBottom: '18%' },

  /**
   * El partido a medias. Ya no comparte la pantalla con el formulario, asi que dejo de estar
   * apretada: es lo unico que hay, y puede ocupar lo que necesite para no esconder nada.
   */
  resume: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.cta, 0.6),
    backgroundColor: alpha(colors.cta, 0.14),
  },
  resumeEyebrow: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  /** El tanteador trae su propio fondo: `overflow` lo recorta al radio en vez de dejar esquinas. */
  resumeBoard: { borderRadius: radius.sm, overflow: 'hidden' },

  /**
   * La separacion es la unica proteccion que tiene Terminar, porque ya no hay confirmacion:
   * los dos botones no pueden tocarse. Y Seguir se lleva mas ancho — es lo que se va a tocar
   * casi siempre, y de paso Terminar deja de ser un blanco del mismo tamano justo al lado.
   */
  resumeActions: { flexDirection: 'row', gap: space.lg },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  resumeGo: { flex: 3, backgroundColor: colors.cta },
  resumeEnd: { flex: 2, borderWidth: 1, borderColor: alpha(colors.text, 0.2) },
  resumeBtnText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  resumeBtnTextDim: { color: colors.textDim, fontSize: 15, fontWeight: '800' },

  block: { gap: space.sm },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: 2 },
  blockTitle: { fontSize: 12.5, fontWeight: '900', letterSpacing: 1.5 },
  /** Corre desde el titulo hasta el borde. Al 50%: marca la seccion, no la grita. */
  blockRule: { flex: 1, height: 1, borderRadius: radius.pill },

  /** La etiqueta del lugar, y al lado el campo (que se dibuja solo, en PlayerField). */
  slotRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  slotField: { flex: 1 },
  slotLabel: {
    /**
     * ANCHO FIJO PERO NO CONSTANTE. Fijo, porque las cuatro etiquetas tienen que medir lo mismo:
     * si cada una tomara el ancho de su palabra, los cuatro campos empezarian en cuatro sitios
     * distintos y la columna se torceria. Pero 52 es el ancho de "Revés" con la letra normal —
     * con la del sistema en grande la palabra crece y la caja no, y quedaba "Revé".
     *
     * Asi que la caja crece con la letra: la misma escala que agranda la palabra agranda el
     * lugar donde vive.
     */
    width: 52 * PixelRatio.getFontScale(),
    height: 48,
    color: colors.textFaint,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 48,
  },

  hint: { color: colors.textFaint, fontSize: 12.5, lineHeight: 17 },

  segBlock: { gap: space.sm },
  segHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  /** Una explicacion ocupa lo mismo que el boton del que habla: quedan alineadas en columna. */
  segCell: { flex: 1 },
  /** El hueco a los costados de la opcion suelta del 2+1: la deja centrada y del mismo ancho. */
  segSpacer: { flex: 0.5 },
  segHint: { color: colors.textFaint, fontSize: 12.5, lineHeight: 16 },
  segTitle: { flex: 1, color: colors.textFaint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.5 },

  segRow: { flexDirection: 'row', gap: space.sm },
  seg: {
    flex: 1,
    /** MINIMO, no fijo: ver el porque en el Text de adentro. */
    minHeight: 44,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    /**
     * AIRE LATERAL DE VERDAD. Estaba en 2: la palabra tocaba el borde, y un texto pegado al
     * borde se lee como un error de imprenta aunque entre. El boton pide su aire PRIMERO, y la
     * letra usa lo que queda — nunca al reves.
     */
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  segOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  segText: { color: colors.textDim, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  segTextOn: { color: colors.text, fontWeight: '900' },

  /**
   * La pastilla del renglon de titulo. Ver `HeadChip`.
   *
   * Probamos darla vuelta —maciza, fondo claro, texto oscuro— y era estridente: en una pantalla
   * oscura, un rectangulo blanco al lado de un titulo se lleva toda la atencion, y estas dos son
   * acciones secundarias. Se queda tenue, y encendida se aclara apenas: lo justo para que se vea
   * que esta activa sin gritarlo.
   */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    /** Sortear y Avanzadas tienen espacio de sobra: el aire aca es todo ganancia. */
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '800' },
  chipTextOn: { color: colors.text, fontWeight: '900' },

  /** Una caja propia, justo debajo de lo que la abrio: lo que agrupa a las opciones ES la caja. */
  panel: {
    gap: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  /** Sutil: separa sin dibujar cajas adentro de la caja. */
  panelRule: { height: StyleSheet.hairlineWidth, backgroundColor: alpha(colors.text, 0.12) },
  /** Cada formacion con su propia linea arriba, sin romper el `gap` del panel. */
  panelBlock: { gap: space.lg },

  /**
   * La linea que corta el formulario.
   *
   * Arriba: llenar los nombres, elegir el formato, Empezar. Ese es el camino, y termina ahi.
   * Abajo: dos puertas que no tienen nada que ver con jugar un partido.
   *
   * No es decoracion: le dice a alguien que abre la app por primera vez que lo de abajo NO HACE
   * FALTA para arrancar. Sin la linea, Historial y Jugadores parecen escalones del camino.
   */
  /** Sin margenes propios: el `gap` del cuerpo ya la separa de arriba y de abajo. Agregarle mas
      aire empujaba las dos puertas fuera de la pantalla, que es lo que veniamos de arreglar. */
  split: { height: 1, backgroundColor: colors.border },

  /** Las dos puertas: iguales y juntas, porque las dos hacen lo mismo — sacarte de esta pantalla. */
  doors: { flexDirection: 'row', gap: space.sm },
  /**
   * Icono y texto EN LINEA. Apilados fue una solucion a un problema que ya no existe: cuando
   * eran tres en la fila, cada uno tenia un tercio de pantalla y no entraban. Ahora son dos, con
   * la mitad cada uno, y les sobra el ancho.
   */
  door: {
    flex: 1,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  doorText: { color: colors.textDim, fontSize: 15, fontWeight: '800' },

  /**
   * Empezar no es una de esas dos: es lo que ARRANCA el partido. Va solo, a lo ancho, y con el
   * verde que ninguno de los otros tiene. Metido en la misma fila quedaba igualado con ellos, y
   * mirar lo que ya paso y empezar algo nuevo no son la misma categoria de cosa.
   */
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.cta,
  },
  startText: { color: colors.text, fontSize: 17, fontWeight: '900' },
  /**
   * Deshabilitado NO es "el mismo boton mas transparente": el lima al 35% sobre fondo oscuro
   * da un verde oliva sucio que no se lee como apagado, se lee como roto. Se apaga cambiando
   * el color, no la opacidad.
   */
  startOff: { backgroundColor: colors.surface },
  startTextOff: { color: colors.textFaint },

  /** Solo en desarrollo. Apagado a proposito: es una herramienta, no una funcion de la app. */
  seed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 40,
  },
  seedText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
});
