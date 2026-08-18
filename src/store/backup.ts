import { File, Paths } from 'expo-file-system';
import { readAsStringAsync, StorageAccessFramework } from 'expo-file-system/legacy';

import { loadIndex, loadMatch, saveMatch } from './matches';
import { loadMerges, loadPlayers, saveMerges, savePlayers } from './store';
import { backupFileName, isBackup, mergeRosters, newMatches, playersInMatches } from './backupRules';
import type { Backup, ImportResult } from './backupRules';
import type { SavedMatch } from './summary';

/**
 * LA COPIA DE SEGURIDAD.
 *
 * Los partidos viven en este telefono y en ningun otro lado. Android ya los respalda solo en el
 * Drive del usuario (`allowBackup` viene en true), pero eso es invisible, se restaura unicamente
 * al instalar y depende de que la persona tenga el backup de Google prendido. A alguien que
 * perdio dos años de estadisticas no lo consuela que "tendria que haberlo tenido activado".
 *
 * Asi que ademas hay una copia que el usuario controla: un archivo suyo, que se lleva a donde
 * quiera. No sube nada a ningun servidor — la app se lo entrega a la bandeja de compartir de
 * Android y a donde va lo decide el.
 *
 * Las reglas —que entra, que ya estaba— son puras y viven en `backupRules.ts`. Se reexportan
 * para que nadie tenga que saber que son dos archivos.
 */

export {
  BACKUP_VERSION,
  backupFileName,
  isBackup,
  mergeRosters,
  newMatches,
  playersInMatches,
} from './backupRules';
export type { Backup, ImportResult } from './backupRules';

/**
 * NO SE EXPORTAN LAS PREFERENCIAS. El archivo es "tus partidos", no "tu telefono configurado":
 * restaurar una copia no tiene por que cambiarte el idioma ni el formato del proximo partido.
 *
 * NO SE EXPORTA EL INDICE. Se deriva de los partidos (`summarize`), asi que guardarlo seria
 * guardar dos veces la misma verdad y arriesgar que queden en desacuerdo. Al importar se
 * reconstruye solo, partido por partido.
 */
export const buildBackup = async (): Promise<Backup> => {
  const [index, players, merges] = await Promise.all([loadIndex(), loadPlayers(), loadMerges()]);

  const matches: SavedMatch[] = [];
  for (const s of index) {
    const m = await loadMatch(s.id);
    // Un archivo corrupto se pierde solo; no puede impedir que se respalden los otros doscientos.
    if (m) matches.push(m);
  }

  return { app: 'vigia', version: 1, exportedAt: Date.now(), matches, players, merges };
};

export const writeBackupFile = async (b: Backup): Promise<string> => {
  const f = new File(Paths.cache, backupFileName(b.exportedAt));
  f.create({ overwrite: true });
  f.write(JSON.stringify(b));
  return f.uri;
};

/**
 * SE LEE CON LA API LEGACY, Y NO ES PEREZA.
 *
 * La API nueva de archivos esta SCOPEADA: solo deja leer adentro del sandbox de la app. El
 * archivo que devuelve el selector queda en la carpeta del DocumentPicker, que esta afuera, y
 * `File.text()` lo rechaza con "Missing 'READ' permission" — verificado en el emulador, no
 * deducido. `readAsStringAsync` no aplica ese scoping y lee la copia que el selector ya hizo.
 *
 * Escribir sigue con la API nueva: ahi el destino es nuestra propia cache y no hay problema.
 */
/**
 * LEER EL ARCHIVO QUE ELIGIO EL USUARIO: TRES INTENTOS, PORQUE NINGUNO SIRVE SIEMPRE.
 *
 * Leer un archivo de afuera es lo mas fragil de todo esto — cada camino lo bloquea un permiso
 * distinto, y se verificaron los tres en el emulador, no se dedujeron:
 *
 * 1. `File.text()` (API nueva) es el que corresponde y el que va a andar en la app instalada,
 *    donde la copia del selector cae adentro del sandbox de la app. En Expo Go NO: esa carpeta
 *    queda afuera del scope y tira "Missing 'READ' permission".
 * 2. `readAsStringAsync` (legacy) no aplica ese scope, pero solo entiende rutas `file://`;
 *    con un `content://` responde "Unsupported scheme".
 * 3. El de SAF lee `content://` por el ContentResolver de Android, que es como se leen los
 *    archivos que otra app te presta.
 *
 * Se prueban en orden y gana el primero que devuelva algo. Cuesta tres lineas y hace que el
 * boton funcione igual en Expo Go, en el APK y con cualquier gestor de archivos.
 */
const readText = async (uri: string): Promise<string | null> => {
  for (const attempt of [
    () => new File(uri).text(),
    () => readAsStringAsync(uri),
    () => StorageAccessFramework.readAsStringAsync(uri),
  ]) {
    try {
      return await attempt();
    } catch {
      // El siguiente.
    }
  }
  return null;
};

export const readBackupFile = async (uri: string): Promise<Backup | null> => {
  try {
    const raw = await readText(uri);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBackup(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const applyBackup = async (b: Backup): Promise<ImportResult> => {
  const [index, players, merges] = await Promise.all([loadIndex(), loadPlayers(), loadMerges()]);

  const add = newMatches(b.matches ?? [], new Set(index.map((s) => s.id)));
  // `saveMatch` escribe el archivo y actualiza el indice: el indice se reconstruye solo.
  for (const m of add) await saveMatch(m);

  /**
   * EL PLANTEL SALE DE DOS LADOS, Y EL SEGUNDO NO ES REDUNDANTE.
   *
   * Primero la lista de jugadores del archivo, que es la buena: trae los nombres como estan hoy.
   * Despues, la gente que viene adentro de los partidos que acaban de entrar — que es lo que
   * garantiza que a NINGUN partido importado le falte alguien en la lista de jugadores. Sin eso,
   * un partido podia aparecer en el historial con cuatro personas a las que no se les podia abrir
   * la ficha, porque a las estadisticas individuales se entra desde ahi.
   *
   * El orden importa: `mergeRosters` se queda con la primera aparicion de cada id.
   */
  const roster = mergeRosters(
    [...(b.players ?? []), ...playersInMatches(b.matches ?? [])],
    players,
  );
  if (roster.added > 0) await savePlayers(roster.roster);

  // Las uniones locales ganan: una decision que se tomo en ESTE telefono no la pisa un archivo.
  await saveMerges({ ...(b.merges ?? {}), ...merges });

  return {
    matchesAdded: add.length,
    matchesSkipped: (b.matches ?? []).length - add.length,
    playersAdded: roster.added,
  };
};
