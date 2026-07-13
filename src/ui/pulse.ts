import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * El destello que avisa "esto acaba de cambiar".
 *
 * Sube rapido y se va despacio: el ojo lo caza aunque estuviera mirando la cancha —que es lo que
 * la persona esta haciendo, no mirando la pantalla— y no queda parpadeando en la periferia
 * mientras se juega el punto siguiente.
 *
 * Se dispara con un instante (`at`), no con un booleano: dos puntos seguidos del mismo equipo
 * tienen que destellar dos veces, y un booleano que ya estaba en `true` no vuelve a disparar.
 * Pasar `0` no dispara nada.
 */
export const usePulse = (at: number): Animated.Value => {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!at) return;
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, {
        toValue: 1,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(v, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [at, v]);

  return v;
};
