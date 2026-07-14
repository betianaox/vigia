# Vigia

**Marcador y estadísticas de pádel, operado por alguien desde afuera de la cancha.**

Una persona fuera de la cancha —el entrenador, alguien del banco— va tocando qué pasó en cada
punto. La app deriva **todo** lo demás: el marcador, quién saca, quién resta, los cambios de lado,
los tie-breaks. Al final produce estadísticas por jugador y una **tarjeta compartible** por
WhatsApp.

---

## Por qué existe

La competencia mide desde un **reloj o un sensor en la pala**. Eso tiene un techo:

> Un sensor en tu muñeca puede adivinar qué golpe pegaste **vos**.
> **No puede saber si el error del rival fue forzado o no forzado.**
> No puede atribuir un winner entre cuatro jugadores. No puede juzgar el punto.

Esas son justamente las estadísticas que muestra Premier Padel, y **solo se pueden capturar desde
afuera, con un humano que juzga**. Vigia no es una versión pobre de una app de reloj: es **lo
único que un reloj no puede hacer**.

Todas las decisiones de producto se subordinan a esto.

---

## Cómo se corre

```bash
npm install
npm start          # Expo: se abre con Expo Go o con un development build
npm test           # 171 tests (vitest, sin UI)
npm run typecheck  # tsc --noEmit
```

Un APK instalable se arma con EAS:

```bash
npx eas-cli build -p android --profile preview    # APK, para probar en un teléfono
npx eas-cli build -p android --profile production # .aab, para Google Play
```

> El `.aab` es lo que Play necesita, pero **no se puede instalar a mano**. Para probar en un
> teléfono hace falta el APK.

---

## Cómo está organizado

| | |
|---|---|
| `src/engine/` | **El motor. No sabe que existe React.** Reglas del pádel y estadísticas, como funciones puras sobre un log de eventos. Es donde están todos los bugs, y por eso es donde están casi todos los tests. |
| `src/store/` | Guardado local. Los partidos en archivos, el plantel y las preferencias en AsyncStorage. |
| `src/ui/` | Las pantallas. `layout.ts` y `metrics.ts` son la escala: **ningún tamaño está escrito a mano**. |
| `src/i18n/` | Los cuatro idiomas. `es.ts` es, además, el mapa de todo el texto de la app. |
| `src/dev/` | Herramientas (`__DEV__`): un simulador que juega partidos completos para poder diseñar contra datos reales. |

---

## Las cuatro decisiones que sostienen todo

Si vas a tocar el código, estas cuatro cosas te van a parecer raras hasta que entiendas por qué
están. Todas tienen su explicación completa en [`../Docs/vigia.md`](../Docs/vigia.md).

### 1. Event sourcing: nada derivado se guarda

Un partido **es** una lista de eventos. El marcador, el sacador, el receptor, los cambios de lado,
las estadísticas: **todo se deriva** con `reduce(config, events)`, que es una función pura.

Gratis, sin escribir una línea más: deshacer es borrar el último evento; las estadísticas son una
función de la lista; y **deshacer un punto también deshace su efecto en las estadísticas**.

La tentación va a ser cachear un número calculado. **No.** En el momento en que se guarda un dato
derivado aparece la clase de bug donde las estadísticas dicen una cosa y los partidos dicen otra.

### 2. Local-first: la red nunca está en el camino del tap

Durante el partido la app **no puede depender de la red ni un segundo**. El wifi de un club se
cae. Si en el 5-4 del segundo set alguien pierde 40 minutos de partido, no vuelve a abrir la app
nunca. Es el peor bug posible acá.

Por eso el log se escribe a disco **en cada evento**, y el partido sobrevive a que Android mate la
app en el entretiempo.

### 3. El nombre lo posee la tabla de jugadores — y unir dos personas no reescribe nada

Cada partido guarda igual una copia del nombre adentro: es el **paracaídas** (los partidos viven
en archivos y el plantel en AsyncStorage, dos sistemas con fallas distintas).

Unir dos personas duplicadas **no toca ningún archivo de partido**: se guarda un mapa de alias y
la unión se resuelve **al leer**. Es reversible, y no hay forma de corromper un partido en el
intento.

Y hay un límite duro: **si dos personas jugaron el mismo partido, no pueden ser la misma persona.**
Nadie es su propio rival.

### 4. La pantalla se dibuja para una cancha, no para una demo

Se opera **con una mano, mirando el partido y no el teléfono**, con sol de frente y entre dos
puntos. De ahí salen reglas que en otra app serían caprichos:

- El punto **siempre** se registra antes de cualquier otra cosa. Nunca se pierde un punto.
- La hoja de golpes **no scrollea**: entra entera o se achica hasta entrar.
- La hoja **es un mapa de la cancha**, no una lista: arriba la red, abajo la pared; el revés a la
  izquierda, la derecha a la derecha. Se encuentra por posición, sin leer.
- Nada oculto detrás de un gesto invisible: **el default enseña, la configuración acelera**.

---

## Los textos

`src/i18n/es.ts` **es** el inventario de todo el texto de la app. No hay ningún documento aparte
—sería una segunda fuente de verdad, y las dos fuentes se separan siempre—: la app lee de ahí.

Los otros tres idiomas se declaran como `Dict`, así que **si a uno le falta una clave, el proyecto
no compila**. "¿Tradujimos todo?" no es una pregunta: es un error de build.

Y los nombres de los golpes tienen su propia regla: **se traduce solo el golpe que tiene una
palabra que un jugador diría en la cancha.** Bandeja, víbora y chiquita se dicen en castellano en
todo el mundo, y así se quedan.

---

## Estado

La app está completa de punta a punta: se configura un partido, se juega, se guarda, se consulta
el historial, se ve el acumulado de cada persona y se comparte la tarjeta. **171 tests, typecheck
limpio.**

Lo que falta es publicarla. El plan, las decisiones abiertas y el registro de todo lo que se
descartó (y por qué) están en [`../Docs/vigia.md`](../Docs/vigia.md).
