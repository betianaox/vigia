import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Player, PlayerId } from '../engine';
import { canonical, loadMerges, loadPlayers, type Merges } from '../store/store';

/**
 * De donde sale el NOMBRE de una persona.
 *
 * LA TABLA MANDA; LA COPIA DEL PARTIDO ES EL PARACAIDAS.
 *
 * Cada partido guarda una copia del nombre adentro (`config.players`). Eso parece redundante y
 * no lo es: los partidos viven en ARCHIVOS y el plantel en AsyncStorage — dos sistemas de
 * almacenamiento distintos, con fallas distintas. Si el plantel se pierde y los partidos solo
 * tuvieran ids, dos años de historia se volverian `p_abc vs p_def`. Es el peor bug posible en
 * esta app, y lo estariamos habilitando para ahorrar unas decenas de bytes por archivo.
 *
 * Pero la copia NO puede ser la fuente de verdad, porque entonces renombrar a alguien no
 * cambiaria sus partidos viejos, y unificar dos personas seria imposible sin reescribir la
 * historia. Asi que: el nombre que se MUESTRA sale de la tabla, por id. Si esa persona ya no
 * esta en la tabla, se usa la copia. El partido nunca se vuelve ilegible, y el nombre tiene un
 * solo dueño.
 */
interface Roster {
  /** Los que se ven: los absorbidos por una union NO estan. */
  players: Player[];
  /** Todos, incluidos los absorbidos. Hace falta para resolver un nombre viejo. */
  all: Player[];
  merges: Merges;
  /** El id que representa a esta persona HOY: sigue la cadena de uniones. */
  canon: (id: PlayerId) => PlayerId;
  /** El nombre de esa persona HOY. `fallback` es la copia guardada en el partido. */
  nameOf: (id: PlayerId, fallback?: string) => string;
  /** Volver a leer. Se llama despues de renombrar o unificar. */
  reload: () => Promise<void>;
}

const Ctx = createContext<Roster>({
  players: [],
  all: [],
  merges: {},
  canon: (id) => id,
  nameOf: (id, fallback) => fallback ?? id,
  reload: async () => {},
});

export function RosterProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<Player[]>([]);
  const [merges, setMerges] = useState<Merges>({});

  const reload = useCallback(async () => {
    const [p, m] = await Promise.all([loadPlayers(), loadMerges()]);
    setAll(p);
    setMerges(m);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<Roster>(() => {
    const byId = new Map(all.map((p) => [p.id, p.name]));
    const canon = (id: PlayerId) => canonical(id, merges);

    return {
      all,
      merges,
      canon,
      // Los absorbidos desaparecen de la lista: siguen existiendo en los partidos viejos, pero
      // como PERSONA ya no son una — son la misma que la que las absorbio.
      players: all.filter((p) => !merges[p.id]),
      /**
       * El nombre se resuelve SOBRE EL CANONICO: si Ana absorbio a "Ana R.", un partido viejo que
       * guardo el id de "Ana R." ahora muestra "Ana Ruiz". Es la union entera, hecha al leer, sin
       * haber tocado un solo archivo.
       */
      nameOf: (id, fallback) => byId.get(canon(id)) ?? byId.get(id) ?? fallback ?? id,
      reload,
    };
  }, [all, merges, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRoster = (): Roster => useContext(Ctx);
