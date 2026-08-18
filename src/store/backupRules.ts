import type { Player } from '../engine';
import type { Merges } from './store';
import type { SavedMatch } from './summary';

/**
 * Las REGLAS de la copia de seguridad: que entra, que se descarta y que ya estaba.
 *
 * Puro, sin tocar el disco — por eso se puede probar en un segundo (mismo criterio que
 * `summary.ts`). Lo que abre archivos y llama a la bandeja de compartir vive en `backup.ts`.
 */

export const BACKUP_VERSION = 1;

export interface Backup {
  app: 'vigia';
  version: number;
  exportedAt: number;
  matches: SavedMatch[];
  players: Player[];
  merges: Merges;
}

export interface ImportResult {
  matchesAdded: number;
  /** Ya los tenia. Que este numero sea alto no es un error: es la copia haciendo su trabajo. */
  matchesSkipped: number;
  playersAdded: number;
}

/** "vigia-2026-07-15.json": el que lo vea en su Drive dentro de un año tiene que saber que es. */
export const backupFileName = (at: number): string =>
  `vigia-${new Date(at).toISOString().slice(0, 10)}.json`;

/**
 * Que lo que se abrio sea una copia de Vigia y no cualquier JSON del telefono.
 *
 * Es a proposito tolerante con lo de adentro: lo que no sea un partido valido se filtra despues,
 * uno por uno. Un archivo al que le falta una lista no puede voltear la importacion entera.
 */
export const isBackup = (x: unknown): x is Backup => {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as Partial<Backup>;
  return b.app === 'vigia' && typeof b.version === 'number' && Array.isArray(b.matches);
};

/**
 * LOS PARTIDOS QUE FALTAN, POR ID.
 *
 * Cada partido nace con un id unico (`m_<tiempo>_<azar>`) que se guarda adentro del archivo y
 * viaja con el. Importar el mismo archivo dos veces es, por lo tanto, una operacion vacia: en la
 * segunda pasada todos los ids ya estan y no se agrega nada. Esa es toda la defensa contra
 * duplicar, y no depende de que el usuario se acuerde de nada.
 *
 * Y por eso importar SUMA en vez de reemplazar. Un "restaurar" que pisa lo que hay puede borrar
 * partidos mas nuevos que la copia — justo la perdida que esto viene a evitar. Coincide ademas
 * con la regla de la app: aca no se borra nada nunca (ver `matches.ts`).
 */
export const newMatches = (incoming: SavedMatch[], have: Set<string>): SavedMatch[] =>
  incoming.filter(
    (m): m is SavedMatch =>
      typeof m === 'object' && m !== null && typeof m.id === 'string' && !have.has(m.id),
  );

/**
 * LA GENTE QUE VIENE ADENTRO DE LOS PARTIDOS.
 *
 * Cada partido guarda una copia entera de sus cuatro jugadores (`config.players`), y esa copia es
 * la red de seguridad de todo esto: mientras el partido este, se sabe quienes lo jugaron.
 *
 * Hace falta porque el plantel y los partidos son DOS listas, y una copia puede traer la segunda
 * sin la primera — un archivo de una version vieja, uno al que se le rompio el plantel, o
 * simplemente uno donde alguien no quedo guardado. En ese caso el partido entraba al historial y
 * la persona no aparecia en ningun lado: sus estadisticas individuales existian —se calculan del
 * log, no se guardan— pero no habia por donde entrar a verlas, porque a la ficha de alguien se
 * llega desde la lista de jugadores.
 *
 * Con esto la garantia deja de depender del archivo: si el partido entro, sus cuatro personas
 * estan en el plantel.
 */
export const playersInMatches = (matches: SavedMatch[]): Player[] => {
  const out = new Map<string, Player>();
  for (const m of matches) {
    for (const p of Object.values(m?.config?.players ?? {})) {
      if (typeof p?.id === 'string' && typeof p.name === 'string' && !out.has(p.id)) {
        out.set(p.id, { id: p.id, name: p.name });
      }
    }
  }
  return [...out.values()];
};

/**
 * El plantel, tambien por id.
 *
 * Dos telefonos distintos donde se escribio "Ana" por separado dan dos ids: la union deja las
 * dos, porque no hay forma de saber desde aca si son la misma persona. Para eso ya existe unir
 * jugadores, que junta los dos historiales sin tocar un solo partido (ver `mergePlayers`).
 *
 * `incoming` puede traer a la misma persona varias veces —la lista del archivo mas la copia que
 * guarda cada uno de sus partidos— asi que el filtro mira tambien lo que ya agrego el mismo. El
 * PRIMERO gana: por eso quien llama pone la lista del plantel adelante y las copias de los
 * partidos atras. Si a alguien lo renombraron, el nombre bueno es el del plantel, no el que quedo
 * congelado adentro de un partido de hace dos años.
 */
export const mergeRosters = (
  incoming: Player[],
  local: Player[],
): { roster: Player[]; added: number } => {
  const have = new Set(local.map((p) => p.id));
  const add: Player[] = [];
  for (const p of incoming) {
    if (typeof p !== 'object' || p === null || typeof p.id !== 'string') continue;
    if (have.has(p.id)) continue;
    have.add(p.id);
    add.push(p);
  }
  return { roster: [...local, ...add], added: add.length };
};
