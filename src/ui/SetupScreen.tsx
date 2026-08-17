import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Formation, MatchConfig, Player, TeamId } from '../engine';
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
import { Select } from './Select';
import { useColors } from './theme-context';
import { alpha, pressed, radius, ripple, space, teamColor, type Colors } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
/** El golpe seco con el que aterriza el sorteo. */
const thud = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

/**
 * TODAS ESTAS LISTAS SON FUNCIONES, NO CONSTANTES.
 *
 * Una constante de modulo copia los textos cuando carga el bundle: quedaria en el idioma con el
 * que arranco la app y no se enteraria nunca de que la persona lo cambio. Leen el diccionario al
 * DIBUJAR, y por eso el idioma se puede cambiar en caliente (ver la regla en `i18n/index.ts`).
 */

/** Los cuatro lugares de la cancha. El orden importa: es el que se muestra. */
type Slot = 'a1' | 'a2' | 'b1' | 'b2';
const slots = (): Array<{ slot: Slot; team: TeamId; label: string }> => [
  { slot: 'a1', team: 'A', label: L.positions.drive },
  { slot: 'a2', team: 'A', label: L.positions.reves },
  { slot: 'b1', team: 'B', label: L.positions.drive },
  { slot: 'b2', team: 'B', label: L.positions.reves },
];

/** El tamano de la etiqueta del lugar. */
const SLOT_FONT = 14;

/** El nombre del equipo, que se usa en media pantalla. */
const teamName = (t: TeamId): string => (t === 'A' ? L.teams.a : L.teams.b);

/**
 * Las opciones de formato. Los textos cortos son a proposito: entran en un segmento y no hay
 * que leer un parrafo para elegir. Lo largo va en la ayuda de abajo.
 */
const lengths = () =>
  [
    { value: 'un_game', label: L.setup.lengths.un_game },
    { value: 'un_set', label: L.setup.lengths.un_set },
    { value: 'tres_sets', label: L.setup.lengths.tres_sets },
  ] as const;

const formats = () =>
  [
    { value: 'ventajas', label: L.setup.gameFormats.ventajas },
    { value: 'punto_de_oro', label: L.setup.gameFormats.punto_de_oro },
    { value: 'punto_estrella', label: L.setup.gameFormats.punto_estrella },
  ] as const;

const thirdSets = () =>
  [
    { value: 'set_normal', label: L.setup.thirdSets.set_normal },
    { value: 'super_tiebreak', label: L.setup.thirdSets.super_tiebreak },
  ] as const;

const changeEnds = () =>
  [
    { value: 'games_impares', label: L.setup.changeEndsOptions.games_impares },
    { value: 'fin_de_set', label: L.setup.changeEndsOptions.fin_de_set },
    { value: 'nunca', label: L.setup.changeEndsOptions.nunca },
  ] as const;

/* Los golpes y los idiomas se eligen ahora en la pantalla de ayuda: son de la app y no del
   partido de hoy. Sus opciones se fueron con ellos, a `HelpScreen`. */

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
const formationOptions = () =>
  [
    { value: 'australiana', label: L.setup.formations.australiana },
    { value: 'cambio', label: L.setup.formations.cambio },
  ] as const;

export function SetupScreen({
  onStart,
  onBack,
}: {
  onStart: (config: MatchConfig) => void;
  /** Volver al inicio. El formulario ya no es la raiz: tiene su propio boton de volver, y
      ademas atiende el back de Android (ver App.tsx). */
  onBack: () => void;
}) {
  // El plantel sale del contexto: una sola fuente en toda la app.
  const { players: roster, reload } = useRoster();

  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
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

  // Las preferencias de la ultima vez. La app no pregunta nada que ya sepa.
  useEffect(() => {
    void loadPrefs().then(setPrefs);
  }, []);

  const filled = slots().map(({ slot }) => names[slot].trim()).filter((n) => n.length > 0);
  /** Los cuatro lugares llenos y con cuatro personas distintas (sin acentos ni mayusculas). */
  const ready = filled.length === 4 && new Set(filled.map(normalize)).size === 4;

  /** Los jugadores guardados que coinciden con lo escrito, sin los que ya estan en otro lugar. */
  const suggest = (slot: Slot): Player[] => {
    const q = normalize(names[slot]);
    const used = slots().filter((x) => x.slot !== slot).map((x) => normalize(names[x.slot]));
    return roster
      .filter((p) => !used.includes(normalize(p.name)))
      .filter((p) => q.length > 0 && normalize(p.name).includes(q))
      .filter((p) => normalize(p.name) !== q) // ya escribiste su nombre exacto: no hay nada que sugerir
      .slice(0, 4);
  };

  /* El guardado inmediato se fue con las preferencias de la app: lo que queda aca —el formato, el
     tercer set— NO es una configuracion, es el recuerdo de como jugaste la ultima vez, y por eso
     se guarda recien en `start`. Si abandonaste el formulario, no jugaste, y no hay nada que
     recordar. La escritura al tocar vive ahora en `App.tsx`, junto a las prefs. */

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
    for (const { slot } of slots()) {
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
        {/* La ✕ vuelve al inicio. El formulario dejo de ser la raiz: ahora se llega desde una
            puerta en el inicio, y tiene que poder cerrarse igual que cualquier otra pantalla
            que se abre desde ahi (Historial, Jugadores). Misma posicion, mismo icono, en toda
            la app. */}
        <View style={s.head}>
          <Brand subtitle={L.setup.newMatch} tint={c.ball} />
          <Pressable
            style={({ pressed: pr }) => [s.close, pr && pressed]}
            android_ripple={{ ...ripple, borderless: true }}
            onPress={onBack}
            hitSlop={10}
          >
            <MaterialIcons name="close" size={24} color={c.text} />
          </Pressable>
        </View>

        <View style={s.body}>
        {(['A', 'B'] as TeamId[]).map((team) => (
          <View key={team} style={s.block}>
            {/* El titulo solo no anclaba nada: dos palabras chicas flotando arriba de dos campos.
                La linea del color del equipo, corriendo hasta el borde, lo convierte en un
                encabezado de verdad — y dice donde empieza cada equipo sin que haya que leerlo. */}
            <View style={s.blockHead}>
              <Text style={[s.blockTitle, { color: teamColor(team, c) }]}>
                {teamName(team).toUpperCase()}
              </Text>
              <View style={[s.blockRule, { backgroundColor: alpha(teamColor(team, c), 0.5) }]} />
            </View>

            {/* El campo se resuelve solo: escribis y abajo aparecen los jugadores guardados que
                coinciden. Abrir un modal a pantalla completa para llenar UN campo de texto es
                un peso injustificado — el campo tiene que poder solo. */}
            {/* El MISMO campo que el filtro del historial. La accion es la misma —nombrar a una
                persona— y hasta hoy se veia distinta en cada pantalla, que es lo que hace que
                una app se sienta hecha de retazos.

                Aca, a diferencia del historial, el texto libre VALE: es donde nacen los
                jugadores nuevos. El desplegable ayuda, no obliga. */}
            {slots().filter((x) => x.team === team).map(({ slot, label }) => (
              <View key={slot} style={s.slotRow}>
                {/**
                 * LAS CUATRO ETIQUETAS MIDEN LO MISMO, Y NADIE CALCULA CUANTO.
                 *
                 * Tienen que medir lo mismo: si cada una tomara el ancho de su palabra, los cuatro
                 * campos empezarian en cuatro sitios distintos y la columna se torceria. La
                 * pregunta era de donde sale ese ancho, y las dos respuestas obvias fallan.
                 *
                 * Un numero a mano (52) es el ancho de "Revés" con ESTA letra: en ingles se leia
                 * "Forehan". Estimarlo —caracteres por el ancho medio de un caracter— tambien
                 * falla, y tiene que fallar: ese ancho medio depende de la TIPOGRAFIA, y la
                 * tipografia la pone cada telefono.
                 *
                 * Asi que no se calcula: se DIBUJAN LAS DOS PALABRAS, una encima de la otra, y la
                 * que no va se deja invisible y sin alto. La caja termina midiendo lo que mide la
                 * mas ancha —la fuente que sea, el idioma que sea, el tamaño de letra que sea— y
                 * las cuatro cajas contienen las mismas dos palabras, asi que las cuatro miden
                 * igual. Sin medir en JavaScript, sin estado y sin un cuadro desalineado al
                 * arrancar: lo resuelve el layout, que es el unico que sabe cuanto ocupa un texto.
                 */}
                <View style={s.slotLabelBox}>
                  <Text style={s.slotLabel} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={[s.slotLabel, s.slotGhost]} numberOfLines={1}>
                    {L.positions.drive}
                  </Text>
                  <Text style={[s.slotLabel, s.slotGhost]} numberOfLines={1}>
                    {L.positions.reves}
                  </Text>
                </View>
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
          colorOf={(v) => teamColor(v as TeamId, c)}
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
          options={lengths()}
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
            {/* Lo del PARTIDO: el reglamento con el que se va a jugar hoy. Botones, todos a la
                vista, porque son decisiones que se toman mirando las opciones juntas. */}
            <Segmented
              title={L.setup.gameFormat}
              options={formats()}
              value={prefs.gameFormat}
              onChange={(v) => setPrefs((x) => ({ ...x, gameFormat: v as Prefs['gameFormat'] }))}
              stack
            />

            {prefs.length === 'tres_sets' && (
              <>
                {/* UNA LINEA ENTRE OPCION Y OPCION. Hacia abajo no hay limite —esta pantalla ya
                    scrollea— asi que el aire es gratis, y la linea convierte una lista continua
                    en bloques que se leen de a uno. */}
                <View style={s.panelRule} />
                <Segmented
                  title={L.setup.thirdSet}
                  options={thirdSets()}
                  value={prefs.thirdSet}
                  onChange={(v) => setPrefs((x) => ({ ...x, thirdSet: v as Prefs['thirdSet'] }))}
                />
              </>
            )}

            <View style={s.panelRule} />

            <Segmented
              title={L.setup.changeEnds}
              options={changeEnds()}
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
                  options={formationOptions()}
                  value={formations[team]}
                  onChange={(v) => setFormations((f) => ({ ...f, [team]: v as Formation }))}
                />
              </View>
            ))}

            <Text style={s.hint}>{L.setup.remembered}</Text>

            {/**
             * ACA VIVIAN EL IDIOMA Y EL MODO DE CARGAR LOS GOLPES, Y SE FUERON.
             *
             * No eran del partido de hoy: eran de la APP. Y estando aca, cambiar el idioma
             * obligaba a empezar a crear un partido —abrir el formulario, desplegar las
             * avanzadas, bajar hasta el final— para tocar algo que no tiene nada que ver con el
             * partido que se esta cargando.
             *
             * Ahora estan en la pantalla de ayuda (`HelpScreen`), que es la que se abre sola la
             * primera vez y despues queda a un toque del inicio. Las avanzadas quedaron con el
             * reglamento y nada mas, que es de lo que las avanzadas hablan.
             */}
          </View>
        )}

        {/* EMPEZAR CIERRA EL FORMULARIO. Ahi termina el camino: se llenan los nombres, se elige
            el formato, se toca Empezar. Nada mas. Historial y Jugadores ya no cuelgan de aca
            abajo: son puertas del inicio, un paso antes de llegar a este formulario. */}
        <Pressable
          style={({ pressed: pr }) => [s.start, !ready && s.startOff, pr && pressed]}
          android_ripple={ripple}
          onPress={start}
          disabled={!ready}
        >
          <MaterialIcons
            name="play-arrow"
            size={26}
            color={ready ? c.text : c.textFaint}
          />
          <Text style={[s.startText, !ready && s.startTextOff]}>{L.setup.start}</Text>
        </Pressable>
        </View>
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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  return (
    <Pressable
      style={({ pressed: pr }) => [s.chip, on && s.chipOn, pr && pressed]}
      android_ripple={ripple}
      onPress={onPress}
      disabled={disabled}
    >
      <MaterialIcons name={icon} size={16} color={on ? c.text : c.textDim} />
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
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

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
            {button(props, 0, c, s)}
            {button(props, 1, c, s)}
          </View>
          <View style={s.segRow}>
            <View style={s.segSpacer} />
            {button(props, 2, c, s)}
            <View style={s.segSpacer} />
          </View>
        </>
      ) : (
        <View style={s.segRow}>{props.options.map((_, i) => button(props, i, c, s))}</View>
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

/**
 * Un boton del grupo. Vive afuera para poder dibujarlo en cualquier renglon (ver el 2+1).
 *
 * NO es un componente, es una funcion que devuelve JSX: por eso no puede pedir el tema con un
 * hook y lo recibe. Y lo recibe como `theme` y no como `c` porque aca `c` ya significa otra
 * cosa desde antes —el color del EQUIPO de esta opcion—, que no tiene nada que ver con el tema.
 */
function button(
  props: SegmentedProps,
  i: number,
  theme: Colors,
  s: ReturnType<typeof makeStyles>,
): ReactNode {
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
        c && on && { borderColor: theme.serve },
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
const makeStyles = (c: Colors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
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

  /** El logo a la izquierda, la ✕ a la derecha: mismo patron que Historial, Jugadores y
      Estadisticas. El `gap` del cuerpo ya separa el encabezado de lo que sigue. */
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  body: { gap: space.lg },

  block: { gap: space.sm },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: 2 },
  blockTitle: { fontSize: 12.5, fontWeight: '900', letterSpacing: 1.5 },
  /** Corre desde el titulo hasta el borde. Al 50%: marca la seccion, no la grita. */
  blockRule: { flex: 1, height: 1, borderRadius: radius.pill },

  /** La etiqueta del lugar, y al lado el campo (que se dibuja solo, en PlayerField). */
  slotRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  slotField: { flex: 1 },
  /** La caja mide lo que la mas ancha de las dos palabras: ver el bloque de arriba. */
  slotLabelBox: { alignItems: 'flex-start' },
  slotLabel: {
    height: 48,
    color: c.textFaint,
    fontSize: SLOT_FONT,
    fontWeight: '700',
    lineHeight: 48,
  },
  /** Reserva el ancho y no ocupa alto ni se ve. Solo esta para que la caja mida bien. */
  slotGhost: { height: 0, opacity: 0 },

  hint: { color: c.textFaint, fontSize: 12.5, lineHeight: 17 },

  segBlock: { gap: space.sm },
  segHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  /** Una explicacion ocupa lo mismo que el boton del que habla: quedan alineadas en columna. */
  segCell: { flex: 1 },
  /** El hueco a los costados de la opcion suelta del 2+1: la deja centrada y del mismo ancho. */
  segSpacer: { flex: 0.5 },
  segHint: { color: c.textFaint, fontSize: 12.5, lineHeight: 16 },
  segTitle: { flex: 1, color: c.textFaint, fontSize: 11.5, fontWeight: '900', letterSpacing: 1.5 },

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
    borderColor: alpha(c.text, 0.2),
    backgroundColor: c.surfaceAlt,
  },
  segOn: { backgroundColor: alpha(c.text, 0.16), borderColor: alpha(c.text, 0.5) },
  segText: { color: c.textDim, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  segTextOn: { color: c.text, fontWeight: '900' },

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
    borderColor: alpha(c.text, 0.2),
    backgroundColor: c.surfaceAlt,
  },
  chipOn: { backgroundColor: alpha(c.text, 0.16), borderColor: alpha(c.text, 0.5) },
  chipText: { color: c.textDim, fontSize: 13, fontWeight: '800' },
  chipTextOn: { color: c.text, fontWeight: '900' },

  /** Una caja propia, justo debajo de lo que la abrio: lo que agrupa a las opciones ES la caja. */
  panel: {
    gap: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surface,
  },
  /** Sutil: separa sin dibujar cajas adentro de la caja. */
  panelRule: { height: StyleSheet.hairlineWidth, backgroundColor: alpha(c.text, 0.12) },
  /* Aca vivia EL CORTE, la linea que separaba el reglamento del partido de lo que era de la app.
     Se fue con ellas: en este panel ya no conviven dos categorias, asi que no hay nada que
     cortar. */
  /** Cada formacion con su propia linea arriba, sin romper el `gap` del panel. */
  panelBlock: { gap: space.lg },

  /**
   * Va sola, a lo ancho, con el verde que en toda la app significa "esto arranca". Historial y
   * Jugadores ya no comparten esta pantalla — viven un paso antes, en el inicio.
   */
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 56,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: c.cta,
  },
  startText: { color: c.text, fontSize: 17, fontWeight: '900' },
  /**
   * Deshabilitado NO es "el mismo boton mas transparente": el lima al 35% sobre fondo oscuro
   * da un verde oliva sucio que no se lee como apagado, se lee como roto. Se apaga cambiando
   * el color, no la opacidad.
   */
  startOff: { backgroundColor: c.surface },
  startTextOff: { color: c.textFaint },
});
