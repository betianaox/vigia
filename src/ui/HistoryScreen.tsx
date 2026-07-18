import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, PlayerId, TeamId } from '../engine';
import {
  deleteMatch,
  loadIndex,
  loadMatch,
  type MatchSummary,
  type SavedMatch,
} from '../store/matches';
import { L, LOCALE } from '../i18n';
import { applyBackup, buildBackup, readBackupFile, writeBackupFile } from '../store/backup';
import { normalize } from '../store/store';
import { Brand } from './Brand';
import { Confirm } from './Confirm';
import { PlayerField } from './PlayerField';
import { useRoster } from './roster';
import { alpha, colors, pressed, radius, ripple, space, teamColor } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/**
 * Rangos, no un calendario. Nadie se acuerda de la fecha exacta de un partido, pero todos
 * saben si fue "esta semana" o "este año".
 */
const periods = () =>
  [
    { value: '6m', label: L.history.periods['6m'], days: 183 },
    { value: '30d', label: L.history.periods['30d'], days: 30 },
    { value: '7d', label: L.history.periods['7d'], days: 7 },
  ] as const;

type Period = ReturnType<typeof periods>[number]['value'];

/**
 * El otro filtro: si el partido esta completo o quedo a medias.
 *
 * Va en SU PROPIA FILA y no mezclado con los periodos, porque son dos preguntas distintas —cuando
 * jugue, y cuales estan completos— y se COMBINAN: "los partidos de Bea, de los ultimos 7 dias,
 * finalizados" es una sola pregunta con tres partes. Mezclados en una fila, elegir "Finalizados"
 * apagaria "7 dias", que no tiene nada que ver.
 *
 * Y sirve para las dos direcciones: esconder los partidos a medias —cuyas estadisticas estan
 * incompletas y ensucian cualquier lectura— o encontrarlos, que es la unica forma de saber cuales
 * quedaron colgados.
 */
const states = () =>
  [
    { value: 'finished', label: L.history.states.finished },
    { value: 'unfinished', label: L.history.states.unfinished },
  ] as const;

type State = ReturnType<typeof states>[number]['value'];

const DAY = 24 * 60 * 60 * 1000;

/** "Sáb 12 jul", y el año solo si no es este. */
const formatDate = (t: number): string => {
  const d = new Date(t);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(LOCALE, opts);
};

/** "20:30". La hora a la que se empezo, que es como la gente se acuerda de un partido. */
const formatTime = (t: number): string =>
  new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });


export function HistoryScreen({
  onBack,
  onOpen,
  onCareer,
}: {
  onBack: () => void;
  onOpen: (m: SavedMatch) => void;
  /** Ver el acumulado y la evolucion de una persona. */
  onCareer: (player: Player) => void;
}) {
  // El plantel sale del contexto: una sola fuente, y un renombre se ve en todas las pantallas.
  const { players: roster, all: everyone, canon, reload: reloadRoster } = useRoster();

  /**
   * El nombre de una persona, resuelto AL CANONICO.
   *
   * Un partido viejo guardo el id de antes de una union. Resolverlo contra ese id daria el nombre
   * viejo — y entonces la union no se veria en el historial. Se canonicaliza primero.
   */
  const resolve = useMemo(() => {
    const byId = new Map(everyone.map((p) => [p.id, p.name]));
    return (id: PlayerId): string | undefined => byId.get(canon(id));
  }, [everyone, canon]);

  const [all, setAll] = useState<MatchSummary[]>([]);
  const [query, setQuery] = useState('');
  /** El jugador ELEGIDO del desplegable. Es lo que fija el filtro de verdad. */
  const [player, setPlayer] = useState<PlayerId | null>(null);
  /**
   * NULO ES "TODOS", Y POR ESO NO HAY BOTON "TODOS".
   *
   * Cada pastilla se apaga con su propia ✕: no elegir nada ya es no filtrar. Un boton que dice
   * "sin filtrar" es explicar el estado en el que la pantalla ya arranca — y encima obligaba a que
   * hubiera DOS "Todos" encendidos a la vez, uno por fila, diciendo cosas distintas.
   */
  const [period, setPeriod] = useState<Period | null>(null);
  const [state, setState] = useState<State | null>(null);
  /** El partido que se esta por borrar. Borrar SI se pregunta: el archivo se va y no vuelve. */
  const [deleting, setDeleting] = useState<MatchSummary | null>(null);

  /** El resultado de importar, que se MUESTRA: ver `runImport`. */
  const [notice, setNotice] = useState<string | null>(null);
  /** Un toque doble no puede disparar dos exportaciones ni dos importaciones. */
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadIndex().then(setAll);
  }, []);

  /**
   * Exportar: arma el archivo y se lo entrega a la bandeja de compartir de Android. La app no
   * sube nada a ningun lado — a donde va la copia lo decide la persona.
   */
  const runExport = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) return;
      const uri = await writeBackupFile(await buildBackup());
      // Sin mimeType, el selector de Android no sabe que es y ofrece la mitad de las apps.
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: L.history.backup,
      });
    } catch {
      setNotice(L.history.importFailed);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Importar: SUMA, nunca pisa. Y el resultado se muestra siempre, incluso —sobre todo— cuando
   * no entro nada: quien importe el mismo archivo dos veces tiene que ver con sus ojos que la
   * segunda vez no rompio nada. La idempotencia se ve, no se confia.
   */
  const runImport = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // Muchos gestores de archivos etiquetan el .json como texto plano o no lo etiquetan.
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: false,
      });
      if (picked.canceled) return;

      const file = picked.assets[0];
      if (!file) return;

      const backup = await readBackupFile(file.uri);
      if (!backup) {
        setNotice(L.history.importBad);
        return;
      }

      const r = await applyBackup(backup);
      setAll(await loadIndex());
      await reloadRoster();

      setNotice(
        r.matchesAdded === 0
          ? L.history.importedNone
          : r.matchesSkipped > 0
            ? `${L.history.imported(r.matchesAdded)} ${L.history.importedSkipped(r.matchesSkipped)}`
            : L.history.imported(r.matchesAdded),
      );
    } catch {
      setNotice(L.history.importFailed);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Escribir BUSCA; elegir FIJA.
   *
   * Escribiendo "bea" se van achicando los partidos, pero eso solo no alcanza: no sabes que
   * nombres existen ni podes fijar uno. Por eso, mientras escribis, abajo aparecen los
   * jugadores que coinciden — y al tocar uno, el filtro deja de ser texto y pasa a ser SU ID.
   *
   * Y esa es la diferencia que importa: dos personas se pueden llamar igual, y alguien se
   * puede renombrar. Buscando por texto, las dos "Ana" caen en la misma bolsa. Eligiendo del
   * desplegable, el historial es exactamente el de esa persona.
   */
  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (player || q.length === 0) return [];
    // Solo los que efectivamente jugaron: ofrecer a alguien sin un solo partido es ofrecer nada.
    const played = new Set(all.flatMap((m) => m.playerIds));
    return roster
      .filter((p) => played.has(p.id) && normalize(p.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, LOCALE))
      .slice(0, 6);
  }, [all, roster, query, player]);

  /**
   * LOS TRES FILTROS SE SUMAN, no se pisan: quien, cuando, y en que estado quedo.
   *
   * "Los partidos de Bea, de los ultimos 7 dias, terminados" es una sola pregunta con tres partes,
   * y tiene que poder hacerse. Por eso cada uno vive en su propio control y todos se aplican a la
   * vez — un filtro que apaga a otro no es un filtro, es un menu.
   */
  const matches = useMemo(() => {
    const days = periods().find((p) => p.value === period)?.days ?? 0;
    const since = days === 0 ? 0 : Date.now() - days * DAY;
    const q = normalize(query);
    return all
      .filter((m) => m.startedAt >= since)
      .filter((m) => !state || (state === 'finished' ? m.finished : !m.finished))
      .filter((m) => {
        // `canon` resuelve las uniones: un partido viejo puede tener guardado el id de antes.
        if (player) return m.playerIds.some((id) => canon(id) === player);
        // Contra los nombres RESUELTOS: si alguien se renombro, buscar por el nombre nuevo tiene
        // que encontrarlo. El texto horneado en el indice quedo viejo el dia que se renombro.
        return (
          !q || normalize(`${teamText(m, 'A', resolve)} ${teamText(m, 'B', resolve)}`).includes(q)
        );
      });
  }, [all, period, state, query, player, resolve, canon]);

  const chosen = roster.find((p) => p.id === player);

  const clearPlayer = () => {
    tick();
    setPlayer(null);
    setQuery('');
  };

  const open = async (m: MatchSummary) => {
    tick();
    const saved = await loadMatch(m.id);
    if (saved) onOpen(saved);
  };

  const remove = async (m: MatchSummary) => {
    await deleteMatch(m.id);
    setAll(await loadIndex());
  };

  return (
    <SafeAreaView style={s.root}>
      {/* La ✕ cierra, y es la misma de la hoja de golpes y de las estadisticas. A la derecha:
          ahi vive el cerrar, y el logo deja de estar aplastado contra una flecha. */}
      <View style={s.head}>
        <Brand size={26} subtitle={L.history.title} tint={colors.ball} />
        <Pressable
          style={({ pressed: pr }) => [s.close, pr && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onBack}
          hitSlop={10}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      {/* Los filtros. Sin ellos, un historial deja de servir apenas tenes treinta partidos. */}
      <View style={s.filters}>
        {/* El mismo campo que en el formulario de partido nuevo. Aca, ademas, se FIJA: al
            elegir del desplegable el filtro deja de ser texto y pasa a ser el id de esa
            persona, que es lo unico que distingue a dos que se llaman igual. */}
        <PlayerField
          value={query}
          onChangeText={setQuery}
          placeholder={L.history.search}
          suggestions={suggestions}
          chosen={chosen ?? null}
          onPick={(p) => {
            tick();
            setPlayer(p.id);
          }}
          onClear={clearPlayer}
        />

        {/* Elegida una persona, aparece la puerta a su acumulado. No antes: "el juego de
            quien" no tiene respuesta si no elegiste a nadie, y un boton que no se puede tocar
            es peor que uno que no esta. */}
        {chosen && (
          <Pressable
            style={({ pressed: pr }) => [s.career, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onCareer(chosen);
            }}
          >
            {/**
             * LA MISMA ANATOMIA QUE UNA FILA DE LA LISTA DE JUGADORES, porque lleva EXACTAMENTE al
             * mismo lugar: la persona adelante, y el grafico atras diciendo a donde va.
             *
             * Tenia un chevron ("vas a ir a algun lado") y encima un grafico DISTINTO —de linea, no
             * de barras— para el mismo destino. Dos dibujos para una sola cosa hacen dudar de si son
             * la misma cosa.
             */}
            <MaterialIcons name="person" size={22} color={colors.textDim} />
            <Text style={s.careerText} numberOfLines={1}>
              {L.history.career(chosen.name.split(' ')[0]!)}
            </Text>
            <MaterialIcons name="bar-chart" size={24} color={colors.textDim} />
          </Pressable>
        )}

        {/**
         * CADA PASTILLA SE APAGA SOLA, CON SU ✕. Por eso no hay ninguna que diga "Todos".
         *
         * La ✕ no es un boton aparte: la pastilla entera alterna. Prendida, muestra la ✕ —que es lo
         * que cuenta que se puede soltar— y al tocarla se suelta. Un segundo objetivo tactil de 12
         * px adentro de otro es una trampa para el pulgar.
         */}
        <View style={s.periods}>
          {periods().map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              on={period === p.value}
              onPress={() => {
                tick();
                setPeriod((cur) => (cur === p.value ? null : p.value));
              }}
            />
          ))}
        </View>

        {/* La segunda fila: el estado. Se COMBINA con las otras dos — "los partidos de Bea, de los
            ultimos 7 dias, finalizados" es una sola pregunta con tres partes. */}
        <View style={s.periods}>
          {states().map((x) => (
            <Chip
              key={x.value}
              label={x.label}
              on={state === x.value}
              onPress={() => {
                tick();
                setState((cur) => (cur === x.value ? null : x.value));
              }}
            />
          ))}
        </View>
      </View>

      {/* FlatList dibuja solo las filas que estan en pantalla: con 500 partidos guardados,
          renderiza ocho. Es la paginacion de verdad —no cargar todo— sin ningun boton de
          pagina, que es un patron de web que en un telefono nadie busca. */}
      <FlatList
        data={matches}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text style={s.empty}>
            {all.length === 0
              ? L.history.empty
              : L.history.emptyFiltered}
          </Text>
        }
        renderItem={({ item }) => (
          <Row
            m={item}
            resolve={resolve}
            onPress={() => void open(item)}
            onDelete={() => {
              tick();
              setDeleting(item);
            }}
          />
        )}
      />

      {/* LA COPIA DE SEGURIDAD, abajo y de bajo enfasis.

          Va aca y no en las avanzadas porque es donde viven los datos: se mira el historial que
          uno no quiere perder y la accion esta ahi mismo. Fija, para que no haya que scrollear
          500 partidos para encontrarla.

          Y SOLO LOS DOS VERBOS. El nombre de la cosa ("Copia de seguridad") es el titulo del
          dialogo: metido tambien en la barra, a fuente 1.5 se iba a dos renglones. Los verbos
          se explican solos y aguantan cualquier tamaño. */}
      <View style={s.backup}>
        <Pressable
          style={({ pressed: p }) => [s.backupBtn, p && pressed]}
          android_ripple={ripple}
          onPress={() => void runExport()}
        >
          <MaterialIcons name="save-alt" size={18} color={colors.textDim} />
          <Text style={s.backupText}>{L.history.export}</Text>
        </Pressable>

        <Pressable
          style={({ pressed: p }) => [s.backupBtn, p && pressed]}
          android_ripple={ripple}
          onPress={() => void runImport()}
        >
          <MaterialIcons name="file-upload" size={18} color={colors.textDim} />
          <Text style={s.backupText}>{L.history.import}</Text>
        </Pressable>
      </View>

      {/* El resultado de importar. Un aviso, no una pregunta: un solo boton. */}
      <Confirm
        visible={notice !== null}
        title={L.history.backup}
        message={notice ?? undefined}
        confirmLabel={L.history.ok}
        single
        onCancel={() => setNotice(null)}
        onConfirm={() => setNotice(null)}
      />

      {/* Borrar SI se pregunta. Terminar un partido no destruia nada —quedaba en el historial—
          pero esto se lleva el archivo, y con el los puntos, los golpes y las estadisticas de
          ese dia. No hay deshacer del otro lado.

          Y el cartel dice CUAL. Con los nombres solos no alcanza: la misma gente juega todas
          las semanas, y dos filas seguidas pueden decir exactamente lo mismo. Un cartel que no
          distingue el partido que se va a borrar no es una confirmacion — es un tramite, y el
          error que tenia que evitar lo comete igual. La hora y el resultado son lo que lo
          vuelve UNO. */}
      <Confirm
        visible={deleting !== null}
        title={L.history.deleteTitle}
        message={
          deleting
            ? `${teamText(deleting, 'A', resolve)} vs ${teamText(deleting, 'B', resolve)}\n` +
              `${formatDate(deleting.startedAt)} · ${formatTime(deleting.startedAt)}` +
              `${deleting.score ? ` · ${deleting.score}` : ''}\n\n` +
              L.history.deleteNote
            : undefined
        }
        confirmLabel={L.history.delete}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const m = deleting;
          setDeleting(null);
          if (m) void remove(m);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * UNA PASTILLA DE FILTRO, QUE SE PRENDE Y SE SUELTA.
 *
 * Prendida muestra una ✕, y ese es todo el mecanismo: la ✕ no es un boton aparte —tocar la pastilla
 * la suelta— es el CARTEL que cuenta que se puede soltar. Un segundo objetivo tactil de doce pixeles
 * adentro de otro es una trampa para el pulgar, y aca no hace falta ninguno.
 *
 * De esto sale que no exista ningun boton "Todos": no elegir nada YA ES todos. Un boton que dice
 * "sin filtrar" explica el estado en el que la pantalla arranca — y obligaba a tener dos "Todos"
 * encendidos a la vez, uno por fila, diciendo cosas distintas.
 */
function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed: pr }) => [s.chip, on && s.chipOn, pr && pressed]}
      android_ripple={ripple}
      onPress={onPress}
    >
      <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
      {on && <MaterialIcons name="close" size={15} color={colors.text} />}
    </Pressable>
  );
}

/**
 * Los nombres de una pareja, resueltos contra el PLANTEL.
 *
 * El indice guarda el par ya armado como texto ("Ana Ruiz / Aldo Vega"), pero eso se horneo el
 * dia que se guardo el partido: si despues alguien se renombra, ese texto queda viejo para
 * siempre. Se reconstruye desde los ids —que si son estables— y el texto guardado queda de
 * respaldo por si alguno ya no esta en la tabla.
 *
 * `playerIds` viene en orden: [A drive, A reves, B drive, B reves].
 */
const teamText = (
  m: MatchSummary,
  t: TeamId,
  resolve: (id: PlayerId) => string | undefined,
): string => {
  const ids = t === 'A' ? m.playerIds.slice(0, 2) : m.playerIds.slice(2, 4);
  const names = ids.map(resolve);

  // Si alguno de los dos ya no esta en la tabla, se usa el texto guardado del par entero: mejor
  // "Ana Ruiz / Aldo Vega" con un nombre viejo que "Ana Ruiz / p_k3f9a2".
  if (names.length < 2 || names.some((n) => !n)) return m.teams[t];
  return names.join(' / ');
};

/** El ganador en el color de su equipo, el perdedor atenuado: el mismo vocabulario del tanteador. */
function Row({
  m,
  resolve,
  onPress,
  onDelete,
}: {
  m: MatchSummary;
  resolve: (id: PlayerId) => string | undefined;
  onPress: () => void;
  onDelete: () => void;
}) {
  const line = (t: TeamId) => {
    const lost = m.finished && m.winner !== t;
    return (
      /* DOS RENGLONES. Los cuatro nombres son EL dato de la fila —es como la gente reconoce un
         partido— y con la letra del sistema en grande una pareja de nombres largos no entra en
         uno: se leia "Carla Mendez / Diego Per…". La lista scrollea, asi que el alto no cuesta
         nada; el nombre de alguien cortado, si. */
      <Text
        style={[s.team, { color: teamColor(t) }, lost && s.lost]}
        numberOfLines={2}
      >
        {teamText(m, t, resolve)}
      </Text>
    );
  };

  return (
    <Pressable
      style={({ pressed: pr }) => [s.row, pr && pressed]}
      android_ripple={ripple}
      onPress={onPress}
    >
      <View style={s.rowMain}>
        {line('A')}
        {line('B')}

        {/* El resultado en un renglon propio, a lo ancho. Metido en la columna de los iconos
            entraba "1-0" y nada mas: un partido de tres sets con tiebreaks es tres veces mas
            largo que eso, y se cortaba justo el dia que mas ganas hay de mirarlo. */}
        <Text style={s.score} numberOfLines={1}>
          {m.score || '—'}
        </Text>

        {/**
         * CUATRO DATOS SEPARADOS POR PUNTOS ERAN UNA TIRA QUE HAY QUE LEER ENTERA. Se desarmo por
         * funcion, preguntandole a cada uno para que esta:
         *
         * LA FECHA Y LA HORA IDENTIFICAN al partido —"el del martes a las 8"— y son lo unico que se
         * usa para encontrarlo. Se quedan solas en su renglon, encendidas, y por eso entran en una
         * linea en cualquier telefono. La hora y no solo el dia: en un club se juegan varios la
         * misma tarde, y asi los distingue la gente que estuvo ahi.
         *
         * LOS PUNTOS dicen cuanto se cargo: si es un partido de verdad o una fila de dos puntos que
         * conviene borrar. Pasan a una pastilla apagada — la MISMA que el conteo de la lista de
         * jugadores. Un conteo se ve igual en toda la app.
         *
         * LA DURACION SE FUE. No contesta ninguna pregunta que uno se haga mirando una lista, y era
         * justo el dato que empujaba el renglon a dos lineas en un telefono angosto. Sigue estando
         * en las estadisticas del partido, que es donde se la busca.
         */}
        <Text style={s.metaWhen} numberOfLines={1}>
          {formatDate(m.startedAt)} · {formatTime(m.startedAt)}
        </Text>

        {/* Las marcas: el conteo en celeste, la salvedad en gris. Ver `tagCount`. */}
        <View style={s.tags}>
          <View style={[s.tag, s.tagCount]}>
            <Text style={[s.tagText, s.tagCountText]}>{L.history.points(m.points)}</Text>
          </View>

          {!m.finished && (
            <View style={s.tag}>
              <Text style={s.tagText}>{L.history.unfinished}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.actions}>
        <MaterialIcons name="bar-chart" size={22} color={colors.textDim} />

        {/* Su propio Pressable adentro de la fila: el toque no llega al de abajo. Va apagado —
            no compite con abrir el partido, que es lo que se hace el 99% de las veces. */}
        <Pressable
          style={({ pressed: pr }) => [s.trash, pr && s.trashOn]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onDelete}
          hitSlop={8}
        >
          {/* ROJO, Y NO GRIS. Es la unica accion de la app que destruye algo — un partido borrado
              no vuelve, con todas sus estadisticas adentro. Estaba pintado igual que un chevron.
              El color no esta para llamar la atencion: esta para que la mano dude medio segundo. */}
          <MaterialIcons name="delete-outline" size={22} color={colors.errorUnforcedChart} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  filters: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md },

  /**
   * La puerta al acumulado. NEUTRA, y no en el lima de la marca.
   *
   * Estaba pintada de lima con el argumento de que es "lo que crece". Pero en esta app el lima es
   * la MARCA —el logo, la pelotita del que saca— y no un color de accion: ninguna otra accion lo
   * usa. Un boton del color de la marca se lee como si fuera otra clase de cosa, y no lo es: es la
   * misma fila que la de la lista de jugadores, con el mismo destino.
   */
  career: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  careerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },

  periods: { flexDirection: 'row', gap: space.sm },
  /** Alto MINIMO: con la letra del sistema en grande, la pastilla crece en vez de recortar. */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: { backgroundColor: alpha(colors.text, 0.16), borderColor: alpha(colors.text, 0.5) },
  chipText: { color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.text, fontWeight: '900' },

  list: { padding: space.lg, paddingTop: 0, gap: space.sm },

  /**
   * La barra de la copia: importante que se vea, pero no que compita con los partidos. Por eso
   * va sin relleno de color y en `textDim` — es una herramienta, no una accion del dia a dia.
   * Arriba ya hay buscador y cinco pastillas; esto no puede sumar ruido.
   */
  backup: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.md,
  },
  backupText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowMain: { flex: 1, gap: 2 },
  team: { fontSize: 15.5, fontWeight: '800' },
  lost: { opacity: 0.45 },
  /** El resultado: es lo primero que se busca de un partido viejo. Va mas grande que los nombres. */
  score: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  /**
   * Estaba en 11, y es lo que DISTINGUE UN PARTIDO DE OTRO: la misma gente juega todas las
   * semanas, asi que dos filas seguidas pueden tener los mismos cuatro nombres y el mismo
   * resultado. Lo unico que las separa es esta linea — la hora, la duracion, si quedo sin
   * terminar. Estaba escrita mas chica que todo lo demas.
   *
   * `lineHeight` explicito: con dos renglones, sin el, Android los pega uno contra el otro.
   */
  /** Lo que identifica al partido: cuando fue. Solo en su renglon, encendido. */
  metaWhen: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 2,
  },

  /**
   * LAS MARCAS DE LA FILA. La misma pastilla apagada que el conteo de la lista de jugadores: una
   * app no puede tener una forma distinta para cada dato — se aprende una y sirve en todas.
   *
   * APAGADAS, Y ESO IMPORTA TANTO COMO LA FORMA. "Sin terminar" estuvo un rato en ambar encendido
   * y estaba mal: desde el historial un partido a medias NO SE PUEDE RETOMAR (eso vive en el
   * inicio, y solo para el ultimo). Aca no es una accion pendiente sino una advertencia sobre el
   * DATO —sus estadisticas estan incompletas— y encendida hacia lo contrario de lo que hay que
   * hacer: los partidos incompletos se llevaban la vista, y los completos, que son los que valen,
   * quedaban como la fila apagada.
   *
   * Y no hay ninguna que diga "FINALIZADO": si todas las filas tienen la misma marca, la marca deja
   * de marcar. Ademas diria lo que ya se ve — el resultado completo esta arriba, en la letra mas
   * grande de la fila.
   */
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 6 },

  /**
   * UNA PLACA, NO UNA PASTILLA — Y LA DIFERENCIA NO ES DECORATIVA.
   *
   * Arriba de esta lista hay pastillas que SE TOCAN (los filtros). Estas no se tocan: son datos
   * impresos en la fila. Cuando las dos cosas se veian igual —misma pildora, mismo borde— la fila
   * invitaba a tocar "5 puntos", que no hace nada.
   *
   * Asi que lo que las separa es la FORMA, que es lo que dice si algo es un boton: el filtro tiene
   * borde y esquinas de pildora (parece un boton); la marca es plana, sin borde y con las esquinas
   * apenas redondeadas (parece un sello). No hace falta explicarlo — se ve.
   */
  tag: {
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: alpha(colors.text, 0.08),
  },
  tagText: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  /**
   * EL CELESTE ES EL CONTEO: cuanto hay detras de esta fila. Y significa lo MISMO en la lista de
   * jugadores ("2 partidos"). De eso se trata tener un sistema de color y no una coleccion de
   * decisiones sueltas que se parecen.
   *
   * El gris, en cambio, es la nota de estado ("sin terminar"): no cuenta nada, avisa algo.
   *
   * El color se eligio por descarte, que es como se elige bien. No podia ser ambar —esta a un paso
   * del naranja del Equipo 2, y los nombres de un equipo son naranjas en esta misma fila—, ni rojo
   * (en esta app es lo que destruye: el tachito), ni verde (winner), ni lima (la marca), ni violeta
   * (Equipo 1). El celeste es el unico que no le debe nada a nadie.
   *
   * Y es el celeste APAGADO (`aceChart`), no el del boton de ACE: ese es un celeste de boton, para
   * mirar una vez. Este vive en una lista de veinte filas, y ahi un color saturado chilla — que es
   * justo el problema que veniamos arreglando.
   */
  tagCount: { backgroundColor: alpha(colors.aceChart, 0.18) },
  tagCountText: { color: colors.aceChart },

  /** Los dos iconos juntos, en fila. */
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  /** Apagado: abrir el partido es lo que se hace siempre, borrarlo casi nunca. */
  trash: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -6 },
  trashOn: { opacity: 0.6 },

  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19, padding: space.md },
});
