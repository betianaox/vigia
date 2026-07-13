import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Player, PlayerId } from '../engine';
import { loadIndex, type MatchSummary } from '../store/matches';
import { mergePlayers, renamePlayer, type RenameError } from '../store/store';
import { Brand } from './Brand';
import { useRoster } from './roster';
import { alpha, colors, pressed, radius, ripple, space } from './theme';

const tick = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const formatDate = (t: number): string => {
  const d = new Date(t);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('es', opts);
};

/**
 * La gente con la que jugas, y la puerta al juego de cada una.
 *
 * Antes esto se llegaba desde el historial: escribir un nombre, elegirlo del desplegable, y
 * recien ahi aparecia una tarjeta. Tres pasos — y si nunca usabas el buscador, no te enterabas
 * nunca de que existia. Justo la funcion que hace que alguien vuelva a abrir la app en tres
 * meses, escondida detras de un campo de busqueda.
 *
 * LA LISTA NO CALCULA NADA. Solo muestra lo que el indice ya sabe: cuantos partidos y cuando
 * fue el ultimo. El acumulado se recalcula del log —abriendo cada archivo— recien al tocar a
 * alguien. Si la lista lo hiciera para todos, abrirla significaria leer quinientos archivos
 * para dibujar cuatro renglones.
 */
export function PlayersScreen({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (p: Player) => void;
}) {
  // Del contexto: una sola fuente para el plantel, en toda la app.
  const { players: roster, merges, canon, reload } = useRoster();
  const [index, setIndex] = useState<MatchSummary[]>([]);

  /** La persona que se esta renombrando, lo que se escribio, y por que no se puede guardar. */
  const [editing, setEditing] = useState<Player | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<RenameError | null>(null);

  useEffect(() => {
    void loadIndex().then(setIndex);
  }, []);

  const save = async () => {
    if (!editing) return;

    const r = await renamePlayer(editing.id, draft, roster);
    if (!r.ok) {
      // No se cierra el dialogo: se dice POR QUE no se pudo, ahi mismo, sin perder lo escrito — y
      // si el problema es que el nombre ya existe, se ofrece unir las dos personas.
      setError(r.error);
      return;
    }

    tick();
    await reload();
    setEditing(null);
  };

  /**
   * Unir a la persona que se esta editando DENTRO de la otra.
   *
   * Sobrevive la otra: su id es el canonico y su nombre es el que se ve. Ningun partido se toca —
   * los archivos siguen guardando el id viejo, y la union se resuelve al leer.
   */
  const merge = async (other: Player) => {
    if (!editing) return;

    await mergePlayers(editing.id, other.id, roster, merges);
    tick();
    await reload();
    setEditing(null);
  };

  /**
   * SI JUGARON JUNTOS, NO SON LA MISMA PERSONA. Y no es una sospecha: es una certeza.
   *
   * Nadie es su propio rival ni su propio compañero. Si estas dos aparecieron alguna vez en el
   * mismo partido, unirlas produciria un log imposible —alguien jugando contra si mismo— y las
   * estadisticas de ese partido pasarian a ser basura.
   *
   * La app SABE esto sin preguntarle a nadie, asi que no ofrece unirlas: lo dice.
   */
  const playedTogether = (a: PlayerId, b: PlayerId): boolean =>
    index.some((m) => {
      const ids = new Set(m.playerIds.map(canon));
      return ids.has(canon(a)) && ids.has(canon(b));
    });

  /**
   * Los que efectivamente jugaron. Alguien del plantel sin un solo partido no tiene juego.
   *
   * Los partidos se cuentan CONTRA EL CANONICO: si "Ana R." se unio a "Ana Ruiz", los partidos
   * que quedaron guardados con el id viejo son de Ana Ruiz. La union se resuelve al leer.
   */
  const rows = useMemo(() => {
    const stats = new Map<string, { matches: number; last: number }>();
    for (const m of index) {
      // Un partido cuenta UNA vez por persona, aunque los dos ids esten unidos (imposible en un
      // partido real —nadie juega contra si mismo— pero un dato raro no puede inflar el numero).
      for (const id of new Set(m.playerIds.map(canon))) {
        const prev = stats.get(id) ?? { matches: 0, last: 0 };
        stats.set(id, {
          matches: prev.matches + 1,
          last: Math.max(prev.last, m.startedAt),
        });
      }
    }

    return roster
      .filter((p) => stats.has(p.id))
      .map((p) => ({ player: p, ...stats.get(p.id)! }))
      // El que mas jugo, primero: es de quien hay mas para decir.
      .sort((a, b) => b.matches - a.matches || b.last - a.last);
  }, [index, roster, canon]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.head}>
        <Brand size={26} subtitle="Jugadores" tint={colors.ball} />
        <Pressable
          style={({ pressed: pr }) => [s.close, pr && pressed]}
          android_ripple={{ ...ripple, borderless: true }}
          onPress={onBack}
          hitSlop={10}
        >
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <FlatList
        style={s.scroll}
        data={rows}
        keyExtractor={(r) => r.player.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <Text style={s.empty}>
            Todavía no jugó nadie. Carga un partido y aquí aparecerán los jugadores.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed: pr }) => [s.row, pr && pressed]}
            android_ripple={ripple}
            onPress={() => {
              tick();
              onOpen(item.player);
            }}
          >
            <MaterialIcons name="person" size={22} color={colors.textDim} />
            <View style={s.rowMain}>
              <Text style={s.name} numberOfLines={1}>
                {item.player.name}
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {item.matches} {item.matches === 1 ? 'partido' : 'partidos'} · último{' '}
                {formatDate(item.last)}
              </Text>
            </View>

            {/* El lapiz se ve. Un toque largo seria mas limpio, pero es invisible — y en esta app
                no hay funcionalidades escondidas. Su propio Pressable: el toque no llega al de
                abajo, que abre el juego de la persona. */}
            <Pressable
              style={({ pressed: pr }) => [s.edit, pr && pressed]}
              android_ripple={{ ...ripple, borderless: true }}
              onPress={() => {
                tick();
                setEditing(item.player);
                setDraft(item.player.name);
                setError(null);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="edit" size={20} color={colors.textFaint} />
            </Pressable>

            <MaterialIcons name="chevron-right" size={22} color={colors.textFaint} />
          </Pressable>
        )}
      />

      {/* Renombrar. El ID NO CAMBIA: de el cuelga todo su historial, y los partidos guardados no
          se tocan. Lo que se ve en pantalla sale del plantel, asi que el nombre nuevo aparece en
          todos lados — incluidos los partidos de hace dos años. */}
      <Rename
        player={editing}
        value={draft}
        error={error}
        onChange={(v) => {
          setDraft(v);
          setError(null);
        }}
        onCancel={() => setEditing(null)}
        onConfirm={() => void save()}
        onMerge={(other) => void merge(other)}
        canMerge={(other) => !editing || !playedTogether(editing.id, other.id)}
      />
    </SafeAreaView>
  );
}

/**
 * El dialogo de renombrar.
 *
 * No usa `Confirm` porque este tiene un CAMPO adentro, y sobre todo porque tiene que poder
 * FALLAR sin cerrarse: si el nombre choca con otra persona, se dice por que ahi mismo, sin
 * perder lo que ya se escribio. Un dialogo que se cierra y te deja adivinando que paso es peor
 * que no tenerlo.
 */
function Rename({
  player,
  value,
  error,
  onChange,
  onCancel,
  onConfirm,
  onMerge,
  canMerge,
}: {
  player: Player | null;
  value: string;
  error: RenameError | null;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Unir a esta persona dentro de la otra. Los dos historiales pasan a ser uno. */
  onMerge: (other: Player) => void;
  /** False si jugaron juntas: entonces NO son la misma persona, y no hay nada que ofrecer. */
  canMerge: (other: Player) => boolean;
}) {
  const clash = error?.kind === 'ya_existe' ? error.other : null;
  const mergeable = clash ? canMerge(clash) : false;

  return (
    <Modal
      visible={player !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={s.dialogBg}>
        <View style={s.dialog}>
          <Text style={s.dialogTitle}>Renombrar</Text>

          <TextInput
            style={s.input}
            value={value}
            onChangeText={onChange}
            placeholder="Nombre"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onConfirm}
          />

          {error?.kind === 'vacio' && <Text style={s.error}>Escribe un nombre.</Text>}

          {/* EL CHOQUE ES UNA OFERTA, no un rechazo.
              Que el nombre ya exista es justo el momento en que se descubre el duplicado: alguien
              escribe "Ana Ruiz" sobre "Ana" porque son la misma persona. Decirle que no se puede
              y dejarlo ahi seria abandonarlo con el problema. */}
          {/* EL CHOQUE ES UNA PREGUNTA. Que el nombre ya exista suele significar que son la misma
              persona: alguien escribe "Ana Ruiz" sobre "Ana". Se pregunta ahi mismo. */}
          {clash && player && mergeable && (
            <View style={s.merge}>
              <Text style={s.mergeText}>
                Ya existe <Text style={s.mergeName}>{clash.name}</Text>. ¿Es la misma persona que{' '}
                <Text style={s.mergeName}>{player.name}</Text>?
              </Text>
              <Text style={s.mergeNote}>
                Se juntan sus dos historiales. Ningún partido se borra.
              </Text>
            </View>
          )}

          {/* JUGARON JUNTAS: no son la misma persona, y no es una sospecha — es una certeza.
              Nadie es su propio rival ni su propio compañero. Unirlas produciria partidos donde
              alguien juega contra si mismo. No se ofrece: se dice. */}
          {clash && player && !mergeable && (
            <Text style={s.error}>
              Ya existe {clash.name}, y jugó partidos contra {player.name}. Elige otro nombre.
            </Text>
          )}

          <View style={s.dialogActions}>
            <Pressable
              style={({ pressed: pr }) => [s.dialogBtn, s.dialogCancel, pr && pressed]}
              android_ripple={ripple}
              onPress={onCancel}
            >
              <Text style={s.dialogCancelText}>Cancelar</Text>
            </Pressable>

            {/* GUARDAR NO EXISTE cuando hay una union posible: el nombre choca, asi que guardar
                volveria a dar el mismo error. Un boton que no puede hacer lo que dice es peor que
                uno que no esta. Las dos respuestas validas son cancelar o unir, y Unir ocupa
                exactamente el lugar donde estaba Guardar. */}
            {clash && mergeable ? (
              <Pressable
                style={({ pressed: pr }) => [s.dialogBtn, s.dialogOk, pr && pressed]}
                android_ripple={ripple}
                onPress={() => onMerge(clash)}
              >
                <MaterialIcons name="merge" size={18} color={colors.text} />
                <Text style={s.dialogOkText}>Unir</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed: pr }) => [s.dialogBtn, s.dialogOk, pr && pressed]}
                android_ripple={ripple}
                onPress={onConfirm}
              >
                <Text style={s.dialogOkText}>Guardar</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
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

  scroll: { flex: 1, borderTopWidth: 1, borderColor: colors.border },
  list: { padding: space.lg, gap: space.sm },

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
  /** Peso de lista, no de titulo: en una lista de nombres, un 800 hace que cada renglon grite. */
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },

  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19, padding: space.md },

  /** Apagado y al margen: abrir el juego de la persona es lo que se hace siempre; renombrar, casi nunca. */
  edit: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  dialogBg: {
    flex: 1,
    backgroundColor: '#000C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.14),
    backgroundColor: colors.surface,
  },
  dialogTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  dialogNote: { color: colors.textDim, fontSize: 13, lineHeight: 18 },

  input: {
    height: 48,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.25),
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  /** El error vive PEGADO al campo que lo causo, no en un cartel aparte. */
  error: { color: colors.errorUnforcedChart, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  /**
   * La oferta de unir. NO es un cartel de error: es una pregunta con una respuesta a mano.
   * Que el nombre ya exista suele significar que son la misma persona — y ese es justo el
   * momento de resolverlo, no de mandar a alguien a otra pantalla.
   */
  merge: {
    gap: space.sm,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.ball, 0.35),
    backgroundColor: alpha(colors.ball, 0.07),
  },
  mergeText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  mergeName: { fontWeight: '900' },
  mergeNote: { color: colors.textDim, fontSize: 11, lineHeight: 16 },

  dialogActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  dialogBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: space.sm,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  dialogCancel: {
    borderWidth: 1,
    borderColor: alpha(colors.text, 0.2),
    backgroundColor: colors.surfaceAlt,
  },
  dialogCancelText: { color: colors.textDim, fontSize: 15, fontWeight: '800' },
  dialogOk: { backgroundColor: colors.cta },
  dialogOkText: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
