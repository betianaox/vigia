import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Player, PlayerId } from '../engine';
import { loadPlayers } from '../store/store';

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
  players: Player[];
  /** El nombre de esa persona HOY. `fallback` es la copia guardada en el partido. */
  nameOf: (id: PlayerId, fallback?: string) => string;
  /** Volver a leer el plantel. Se llama despues de renombrar o unificar. */
  reload: () => Promise<void>;
}

const Ctx = createContext<Roster>({
  players: [],
  nameOf: (id, fallback) => fallback ?? id,
  reload: async () => {},
});

export function RosterProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);

  const reload = useCallback(async () => {
    setPlayers(await loadPlayers());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<Roster>(() => {
    const byId = new Map(players.map((p) => [p.id, p.name]));
    return {
      players,
      nameOf: (id, fallback) => byId.get(id) ?? fallback ?? id,
      reload,
    };
  }, [players, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRoster = (): Roster => useContext(Ctx);
