import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Convierte la tarjeta en un PNG y se lo entrega al sistema.
 *
 * El archivo se arma DENTRO del telefono y no sale a ningun servidor: lo unico que hace la app es
 * dejarlo en la bandeja de compartir de Android, y a quien se le manda lo elige la persona. Una
 * app de estadisticas que sube tus partidos a algun lado sin que se lo pidan es exactamente lo que
 * nadie quiere instalar.
 *
 * Devuelve `false` si el telefono no sabe compartir (no deberia pasar en Android, pero antes de
 * abrir una bandeja que no existe conviene preguntar).
 */
export const shareCard = async (
  ref: RefObject<View | null>,
  dialogTitle: string,
): Promise<boolean> => {
  if (!ref.current) return false;
  if (!(await Sharing.isAvailableAsync())) return false;

  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });

  // En Android el mimeType no es un detalle: sin el, el selector no sabe que es una imagen y
  // ofrece la mitad de las apps.
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle });
  return true;
};
