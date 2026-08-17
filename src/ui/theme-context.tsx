import { createContext, useContext } from 'react';

import { colors as dark, themes, type Colors, type ThemeName } from './theme';

/**
 * DE DONDE SALEN LOS COLORES.
 *
 * Es el mismo problema que el diccionario, y por eso se resuelve igual: hay una sola fuente y las
 * pantallas la leen MIENTRAS SE DIBUJAN. Lo que cambia es el mecanismo — el idioma se lee del
 * módulo porque el texto vive en el JSX, pero los colores viven en `StyleSheet.create`, que se
 * ejecuta UNA VEZ al cargar el archivo.
 *
 * Por eso los estilos no pueden ser una constante de módulo: tienen que armarse adentro del
 * componente, con los colores del tema de ese momento. El patrón, en cada pantalla:
 *
 *     const c = useColors();
 *     const s = useMemo(() => makeStyles(c), [c]);
 *
 * El `useMemo` importa: sin él, `StyleSheet.create` correría en cada dibujo. Con él, corre una
 * vez por tema y después es la misma referencia — que es justo lo que React necesita para no
 * volver a pintar de más.
 */
const Ctx = createContext<Colors>(dark);

export function ThemeProvider({
  name,
  children,
}: {
  name: ThemeName;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={themes[name]}>{children}</Ctx.Provider>;
}

/** Los colores del tema activo. Se llama en cada pantalla que dibuje algo con color. */
export const useColors = (): Colors => useContext(Ctx);
