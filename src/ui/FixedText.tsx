import { Text, type TextProps } from 'react-native';

/**
 * UN TEXTO QUE NO OBEDECE EL TAMAÑO DE LETRA DEL SISTEMA. Y por que eso, aca, es lo correcto.
 *
 * La regla de la app es la contraria: si alguien puso la letra grande en el telefono, la app tiene
 * que respetarla. Se respeta en el formulario, en el historial, en la hoja de golpes y —sobre
 * todo— en las estadisticas, que es donde hay texto para LEER y donde la pantalla scrollea.
 *
 * La cancha y el tanteador son otra cosa, y no por comodidad nuestra:
 *
 * 1. NO SE LEEN, SE MIRAN DE REOJO. Casi no tienen texto: tienen una W, un FE, un UE, dos nombres
 *    y numeros. Lo que hace legible a esa pantalla no es el tamaño de la letra, son los COLORES y
 *    la POSICION — cada boton en el mismo lugar, siempre. Eso no lo agranda ninguna escala.
 *
 * 2. NO TIENEN A DONDE CRECER. No scrollean (scrollear en medio de un punto es perder el punto) y
 *    cada boton tiene que seguir siendo tocable con el pulgar. Con la letra del sistema en grande,
 *    "FAULT" se convertia en "FAU…" y "Unforced" en "Unfor…". Un texto cortado no se lee al 70%:
 *    no se lee. La escala del sistema, aca, EMPEORA la accesibilidad.
 *
 * 3. UN TOPE INTERMEDIO NO SERVIA DE NADA. Dejarla crecer un 15% —lo unico que la caja aguanta—
 *    no le cambia la vida a nadie con vision reducida, y a cambio deja abierta toda una familia de
 *    roturas. Es riesgo sin beneficio.
 *
 * Asi que la cancha no escala, y a cambio se agranda DE FABRICA: la letra grande la gana todo el
 * mundo, tenga o no tocado los ajustes del telefono. La app no le esta sacando nada a nadie —
 * le esta dando de entrada lo que la escala solo le daria a algunos.
 */
export function FixedText(props: TextProps) {
  return <Text {...props} allowFontScaling={false} />;
}
