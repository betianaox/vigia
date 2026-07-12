import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, type Layout } from './layout';

/**
 * Las medidas del diseno, mas los insets crudos.
 *
 * El inset de abajo hace falta para lo que se dibuja FUERA del area segura: un `Modal` se
 * ancla al borde fisico de la pantalla, no al seguro, asi que una hoja pegada abajo se mete
 * debajo de la barra de navegacion si nadie la aparta.
 */
export type Metrics = Layout & { insetBottom: number };

/**
 * El unico punto de entrada de las pantallas a las medidas: nunca constantes sueltas.
 *
 * El alto util es la ventana menos las barras de sistema. La cuenta en si vive en
 * layout.ts, que es puro y esta testeado contra telefonos reales.
 */
export function useMetrics(): Metrics {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const avail = height - insets.top - insets.bottom;
  const availW = width - insets.left - insets.right;
  // La identidad del objeto tiene que ser estable: de ella cuelgan las hojas de estilo.
  return useMemo(
    () => ({ ...layout(avail, availW), insetBottom: insets.bottom }),
    [avail, availW, insets.bottom],
  );
}
