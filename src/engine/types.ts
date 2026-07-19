export type PlayerId = string;
export type TeamId = 'A' | 'B';

/** El cuadro desde el que se saca / al que se recibe. */
export type Box = 'derecha' | 'izquierda';

/**
 * La posicion de cada jugador dentro de su equipo. El de drive recibe siempre en el cuadro
 * derecho; el de reves, en el izquierdo. De aca se deriva quien resta en cada punto, sin
 * preguntarle nada al usuario.
 *
 * Se mantiene durante todo el set, pero la pareja PUEDE darse vuelta al empezar uno nuevo, y
 * el reglamento lo permite. Por eso las posiciones no se leen de `MatchConfig`: se derivan
 * del log, igual que todo lo demas (ver `CAMBIO_POSICION`).
 */
export type Position = 'drive' | 'reves';

/** Quien esta de drive y quien de reves en cada equipo, AHORA. Sale del log, no de la config. */
export type Positions = Record<TeamId, Record<Position, PlayerId>>;

/**
 * Como se para la pareja CUANDO SACA. Es una eleccion por PAREJA, no por partido: cada equipo
 * elige la suya.
 *
 * Recibiendo, las posiciones son fijas — el reglamento obliga a mantener el lugar que se
 * eligio al empezar el set. Pero sacando hay dos convenciones:
 *
 * - `australiana` (el default): cada uno mantiene su lado siempre. La pareja no se mueve.
 * - `cambio`: el sacador se queda del lado desde el que saco. Como el cuadro alterna en cada
 *   punto, los dos jugadores INTERCAMBIAN LUGAR EN LA CANCHA punto a punto.
 *
 * No cambia el tanteo, ni quien saca, ni quien resta, ni el golpe. Cambia DONDE ESTAN PARADOS
 * — y por eso cambia como se dibuja la cancha, que es lo que el observador esta mirando.
 */
export type Formation = 'australiana' | 'cambio';

export type GameFormat =
  /** Clasico: hay que sacar 2 puntos de diferencia, sin limite. */
  | 'ventajas'
  /** El primer 40-40 define el game en un solo punto. */
  | 'punto_de_oro'
  /** Maximo 2 ventajas; el tercer 40-40 consecutivo es punto de oro. Lo que usa Premier. */
  | 'punto_estrella';

export type MatchLength = 'un_game' | 'un_set' | 'tres_sets';
export type ThirdSetFormat = 'set_normal' | 'super_tiebreak';
export type ChangeEndsRule = 'games_impares' | 'fin_de_set' | 'nunca';

/**
 * De que lado le pega. Solo lo llevan los golpes de abajo: no existe una bandeja de reves.
 * Es el mismo eje que `Position`, pero son cosas distintas — la posicion es donde juega el
 * jugador todo el set; el lado es con que mano-cara le pego a ESTA pelota.
 */
export type Side = 'drive' | 'reves';

/**
 * El golpe. Van ordenados de defensa a ataque, que es el orden en que se los busca.
 *
 * `bandeja` y `remate` son NOMBRES PARAGUAS, no dos golpes mas de la lista: la vibora y el
 * gancho son bandejas (cambia como se pega), y el x3, el x4 y la traida son remates (cambia
 * como termina la pelota). El detalle va en `Variant`, que es opcional.
 *
 * `recuperacion` agrupa igual: la dormilona, meterla por la puerta y todo lo demas son
 * formas de recuperar. No se enumeran porque es infinito.
 */
export type Stroke =
  // Con lado.
  | 'recuperacion'
  | 'fondo'
  /**
   * SIN BOTON PROPIO DESDE QUE SE DIVIDIO EN OFENSIVA/DEFENSIVA (ver las dos de abajo). Se
   * queda en el tipo por lo mismo que x3/x4/traerla siguen en `Variant`: los partidos ya
   * jugados con este golpe tienen que poder seguir leyendose. Ningun boton la escribe de aca
   * en mas.
   */
  | 'salida_de_pared'
  /** La salida de pared jugada para atacar: sale distinta a la defensiva y se cuenta aparte. */
  | 'salida_pared_ofensiva'
  /** La salida de pared jugada para sostener el punto, sin buscar nada mas que seguir viva. */
  | 'salida_pared_defensiva'
  | 'globo'
  | 'chiquita'
  | 'dejada'
  | 'volea'
  // Por alto: sin lado.
  | 'bandeja'
  | 'remate';

/**
 * Refinamiento del golpe. Siempre esta disponible y nunca es obligatorio.
 *
 * Hubo un momento en que esto iba a estar detras de un "modo detallado" configurable, para
 * no abrumar al que no sabe. Se descarto: el que no sabe ya esta protegido dos veces —el tap
 * corto registra el punto SIN golpe, y en la hoja siempre puede tocar el boton base. Esconder
 * cinco botones no justificaba arrastrar una opcion de configuracion para siempre, ni la
 * pregunta de "¿este partido en que modo se cargo?" cada vez que se comparan estadisticas.
 */
export type Variant =
  /** De la bandeja: como se pego. */
  | 'vibora'
  | 'gancho'
  /** Del remate: como termino la pelota. */
  | 'x3'
  | 'x4'
  | 'traerla';

/**
 * La variante REFINA el golpe, no lo reemplaza: un x3 sigue siendo un remate y suma como
 * remate. Por eso el modo simple y el completo son comparables entre si — si el detalle
 * fuera otra clave, el historial de un jugador quedaria escrito en dos idiomas y no se
 * podria sumar entre partidos.
 */
export interface Shot {
  stroke: Stroke;
  /** Solo los golpes con lado. Los de arriba no lo llevan. */
  side?: Side;
  /** Opcional siempre. Si esta vacia, el golpe cuenta igual. */
  variant?: Variant;
}

export interface Player {
  id: PlayerId;
  name: string;
}

export interface Team {
  id: TeamId;
  drive: PlayerId;
  reves: PlayerId;
  /** Como se para la pareja cuando saca. Si falta, es 'australiana'. */
  formation?: Formation;
}

/** Para cuando el partido ya empezo y se empieza a cargar tarde. */
export interface InitialScore {
  /** Sets ya terminados, en games. */
  sets: Array<Record<TeamId, number>>;
  /** Games del set en curso. */
  games: Record<TeamId, number>;
}

export interface MatchConfig {
  players: Record<PlayerId, Player>;
  teams: Record<TeamId, Team>;
  /** Orden de saque dentro de cada equipo para el primer set. Se puede cambiar por set. */
  serveOrder: Record<TeamId, [PlayerId, PlayerId]>;
  /** Quien saca el primer game (el que gana el sorteo puede optar por restar). */
  firstServingTeam: TeamId;
  gameFormat: GameFormat;
  length: MatchLength;
  thirdSet: ThirdSetFormat;
  changeEnds: ChangeEndsRule;
  initialScore?: InitialScore;
}

/**
 * Todo lo que puede pasar en un partido. El log es append-only y el estado se deriva
 * de el: por eso el undo es "sacar el ultimo evento y recalcular".
 *
 * Ni LET, ni FALTA, ni ACE llevan jugador: el sacador se deriva. Un evento menos que
 * puede quedar mal cargado.
 */
export type MatchEvent = (
  /** Saque a la red. Se repite; no avanza el contador de saques. */
  | { type: 'LET' }
  /** Falta de saque. Primer saque -> segundo. Segundo saque -> doble falta. */
  | { type: 'FALTA' }
  | { type: 'ACE' }
  | { type: 'WINNER'; player: PlayerId; shot?: Shot }
  | {
      type: 'ERROR_NO_FORZADO';
      player: PlayerId;
      shot?: Shot;
      /** Paso devolviendo el saque: alimenta "% falla de recepcion", ademas de sumar como
          error no forzado de siempre. Lo pone SOLO el boton dedicado de la cancha — un error
          en medio de un peloteo largo no es esto, aunque lo haya cometido el que resta. */
      onReturn?: boolean;
    }
  | {
      type: 'ERROR_FORZADO';
      player: PlayerId;
      onReturn?: boolean;
      /**
       * ESTE EVENTO NO LLEVA `shot`, Y ES LA DECISION QUE LO DEFINE.
       *
       * Un error forzado es el unico que tiene responsable de los dos lados, y de esos dos
       * golpes solo uno dice algo: el del que FORZO. El del que lo sufrio no aporta —te
       * obligaron, y pegaste lo que pudiste—, y preguntarlo costaba un toque mas en la unica
       * pantalla que se opera entre dos puntos.
       *
       * Asi que la hoja pregunta quien forzo y con que, y ahi termina. El desglose por golpe
       * vive en la ficha del que fuerza (`forcedErrorsCausedByShot`); el que lo sufrio se
       * queda con su EF, sin desglose.
       */
      forcedBy?: PlayerId;
      forcedByShot?: Shot;
    }
  /** En punto de oro, el equipo que resta elige el cuadro. */
  | { type: 'ELECCION_CUADRO'; box: Box }
  /** Al empezar un set, cada equipo puede reordenar sus sacadores. */
  | { type: 'ORDEN_SAQUE'; team: TeamId; order: [PlayerId, PlayerId] }
  /**
   * La pareja se dio vuelta: el que estaba de drive pasa a reves y viceversa. El reglamento
   * lo permite al empezar un set, y cambia quien resta en cada cuadro de ahi en adelante.
   */
  | { type: 'CAMBIO_POSICION'; team: TeamId }
  /** Escape hatch. Deja el partido marcado: las estadisticas ya no reconcilian. */
  | { type: 'CORRECCION_MANUAL'; sets: Array<Record<TeamId, number>>; games: Record<TeamId, number> }
) & {
  /**
   * Cuando paso, en milisegundos desde epoch. Lo pone la UI al crear el evento, NUNCA el
   * motor: `reduce` tiene que seguir siendo una funcion pura del log, y una llamada a
   * Date.now() adentro la volveria impredecible y no testeable.
   *
   * Es opcional porque el tiempo es ORTOGONAL al tanteo: derivar el marcador, el sacador y el
   * restador no necesita saber la hora, y los tests del motor no tienen por que inventarla.
   * Pero todo evento que sale de la app la lleva, y de ahi salen la fecha del partido, su
   * duracion, la de cada set, la de cada game y el ritmo de juego.
   */
  t?: number;
};

/** Con que saque se jugo el punto. Necesario para las estadisticas de saque. */
export type ServeState = 'PRIMERO' | 'SEGUNDO';

export interface CompletedSet {
  games: Record<TeamId, number>;
  tiebreak?: Record<TeamId, number>;
  winner: TeamId;
}

export interface MatchState {
  finished: boolean;
  winner: TeamId | null;

  completedSets: CompletedSet[];
  setsWon: Record<TeamId, number>;

  /** Games del set en curso. */
  games: Record<TeamId, number>;
  /** Puntos crudos (0,1,2,3,4...) del game o tiebreak en curso. El display se deriva. */
  points: Record<TeamId, number>;

  inTiebreak: boolean;
  /** El tercer set jugado integramente como super tiebreak a 10. */
  isSuperTiebreak: boolean;

  serveState: ServeState;
  servingTeam: TeamId;
  server: PlayerId;
  receiver: PlayerId;
  box: Box;

  /**
   * El ROL de cada jugador: quien juega de drive y quien de reves. Es lo que define quien
   * resta en cada cuadro, y no se mueve durante el set.
   */
  positions: Positions;

  /**
   * DONDE ESTA PARADO cada uno EN ESTE PUNTO. Es lo que la UI dibuja.
   *
   * Casi siempre coincide con `positions`. Se separa de ellas en un solo caso: el equipo que
   * SACA con formacion `cambio` — el sacador se queda del lado desde el que saco, y como el
   * cuadro alterna en cada punto, los dos INTERCAMBIAN LUGAR punto a punto. Eso es lo que
   * pasa en la cancha, y la cancha de la app tiene que espejarlo.
   */
  layout: Positions;
  /** El orden de saque vigente de cada equipo. La UI lo necesita para poder invertirlo. */
  serveOrder: Record<TeamId, [PlayerId, PlayerId]>;

  /**
   * Se puede cambiar el orden de saque del equipo que saca.
   *
   * Solo en el primer game de saque de cada equipo en el set, y solo si ese game todavia no
   * tiene ningun evento. Si ya hay una falta cargada, esa falta YA quedo atribuida a ese
   * sacador: darlo vuelta despues no arregla nada, ensucia. Para eso esta el Deshacer.
   */
  canSwapServer: boolean;

  /** Se pueden dar vuelta las posiciones: solo antes del primer punto del set. */
  canSwapPositions: boolean;

  /** El punto en juego define el game de una sola vez. */
  isGoldenPoint: boolean;
  /** Punto de oro y el equipo que resta todavia no eligio cuadro. */
  awaitingBoxChoice: boolean;

  /** Los equipos intercambiaron lados de la cancha. Solo afecta al display. */
  endsSwapped: boolean;
  manuallyCorrected: boolean;

  /** "0" | "15" | "30" | "40" | "AD", o el numero crudo si es tiebreak. */
  display: Record<TeamId, string>;
}
