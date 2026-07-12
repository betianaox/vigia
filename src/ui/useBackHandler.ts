import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * El boton "atras" de Android — el triangulo de la barra Y el gesto de deslizar desde el borde,
 * que en los telefonos de hoy es lo mismo.
 *
 * Sin esto, el back cae en el comportamiento por defecto: CERRAR LA APP. En medio de un
 * partido, con el telefono en la mano y la raqueta en la otra, un gesto reflejo te sacaba
 * afuera. El partido no se perdia —se guarda en cada punto— pero el susto no tiene por que
 * existir.
 *
 * Se registra en UN SOLO LUGAR, el dueño de la navegacion. Android llama a los manejadores en
 * orden inverso al que se registraron, y React monta los efectos de los hijos ANTES que los del
 * padre: si cada pantalla registrara el suyo, el del padre ganaria siempre. Dos dueños de la
 * navegacion es no tener ninguno.
 *
 * `onBack` en null = no lo manejamos, que Android haga lo suyo (en el inicio: salir).
 */
export function useBackHandler(onBack: (() => void) | null): void {
  // Por referencia: el manejador cambia en cada render, pero la suscripcion se hace una vez.
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const fn = handler.current;
      if (!fn) return false; // que siga su curso
      fn();
      return true; // consumido: la app no se cierra
    });
    return () => sub.remove();
  }, []);
}
