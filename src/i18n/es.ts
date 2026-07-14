/**
 * EL CASTELLANO. Y, de paso, EL MAPA DE TODO EL TEXTO DE LA APP.
 *
 * No hay ningun documento que liste los textos: seria una segunda fuente de verdad, y las dos
 * fuentes se separan siempre. Este archivo ES el inventario, y no puede desincronizarse porque la
 * app lo lee de aca.
 *
 * Y el detector de cambios es git: cualquier texto que se toque aparece como un diff en este
 * archivo, y ese diff es —literalmente— lo que hay que volver a traducir.
 *
 * Los otros idiomas se declaran como `Dict` (ver `index.ts`), asi que TypeScript NO COMPILA si a
 * uno le falta una clave. "¿Tradujimos todo?" deja de ser una pregunta y pasa a ser un error de
 * build.
 *
 * El castellano va NEUTRO: sin voseo. La app apunta tambien a España y a Mexico.
 */
export const es = {
  /**
   * LOS GOLPES. Un golpe se traduce solo si el idioma tiene una palabra que un jugador diria en
   * la cancha. Si no la tiene, se queda en castellano — el vocabulario del padel ES español en
   * todo el mundo, y eso juega a favor: inventar un termino que nadie usa es peor que dejar el
   * original, porque el original al menos lo reconocen.
   *
   * Bandeja, vibora y chiquita no se traducen en NINGUN idioma: estan verificadas en los glosarios
   * ingleses e italianos, y asi las enseña un profesor en Milan.
   *
   * La salida de pared tampoco tiene nombre propio afuera y se queda en castellano. La
   * RECUPERACION, en cambio, si se traduce — porque tampoco es un nombre formal en castellano: es
   * una descripcion. Y una descripcion se dice en el idioma de cada uno.
   */
  shots: {
    remate: 'Remate',
    bandeja: 'Bandeja',
    volea: 'Volea',
    chiquita: 'Chiquita',
    salida_de_pared: 'Salida de pared',
    fondo: 'Fondo',
    globo: 'Globo',
    dejada: 'Dejada',
    /**
     * La pelota que parecia perdida y volvio: la que se toca antes de que pase, o la que salio
     * por la puerta y alguien la metio de vuelta. El punto ya estaba ganado y se dio vuelta.
     *
     * No es un golpe defensivo cualquiera, y por eso no se traduce como tal.
     */
    recuperacion: 'Recuperación',
  },

  variants: {
    vibora: 'Víbora',
    gancho: 'Gancho',
    x3: 'x3',
    x4: 'x4',
    traerla: 'Traerla',
  },

  /**
   * El lado del GOLPE (con que cara le pego), que no es el lado del JUGADOR (de que lado de la
   * cancha juega). Ver `SIDE_LABELS` en `shots.ts`: usar la misma palabra para las dos cosas las
   * confunde, y ademas en España a la derecha le dicen derecha.
   */
  sides: {
    drive: 'Derecha',
    reves: 'Revés',
  },

  /**
   * De que lado de la cancha juega la PERSONA. No es el lado del golpe (ver `sides`): son dos
   * cosas distintas y por eso tienen dos claves distintas — la app las decia con la misma letra
   * y un "D" queria decir dos cosas en la misma pantalla.
   */
  positions: {
    drive: 'Drive',
    reves: 'Revés',
  },

  teams: {
    a: 'Equipo 1',
    b: 'Equipo 2',
  },

  /** El formulario de partido nuevo. */
  setup: {
    newMatch: 'Partido nuevo',
    onCourt: 'Partido en curso',

    /** La tarjeta del partido que quedo a medias. */
    resumeEyebrow: 'PARTIDO EN CURSO',
    resume: 'Seguir',
    end: 'Terminar',

    namePlaceholder: 'Nombre',

    firstServe: 'EMPIEZA SACANDO',
    draw: 'Sortear',
    drawing: 'Sorteando…',

    match: 'PARTIDO',
    advanced: 'Avanzadas',
    lengths: {
      un_game: '1 game',
      un_set: '1 set',
      tres_sets: '3 sets',
    },

    shotPrompt: 'Registro de golpe',
    shotPrompts: {
      siempre: 'Preguntar siempre',
      opcional: 'Registro opcional',
    },
    shotPromptHints: {
      siempre: 'La hoja de golpes se abre en cada punto.',
      opcional: 'El toque corto registra, sostenido abre la hoja.',
    },

    language: 'Idioma',
    /** Sigue al telefono. El nombre del idioma que le toca lo pone la app, no el diccionario. */
    languageAuto: 'Automático',

    gameFormat: 'AL 40-40',
    gameFormats: {
      ventajas: 'Ventajas',
      punto_de_oro: 'Punto de oro',
      punto_estrella: 'Punto estrella',
    },

    thirdSet: 'TERCER SET',
    thirdSets: {
      set_normal: 'Set normal',
      super_tiebreak: 'Súper tiebreak',
    },

    changeEnds: 'CAMBIOS DE LADO',
    changeEndsOptions: {
      games_impares: 'Games impares',
      fin_de_set: 'Fin de set',
      nunca: 'Nunca',
    },

    /** Como se para la pareja cuando saca. "Australiana" es ambigua: cada uno le dice a otra cosa. */
    formation: (team: string) => `${team} · CUANDO SACA`,
    formations: {
      australiana: 'Mantiene el lado',
      cambio: 'Cambia de lado',
    },

    remembered: 'La app recuerda esto para el próximo partido.',
    start: 'Empezar',

    history: 'Historial',
    players: 'Jugadores',
  },

  /**
   * LA CANCHA. Es la pantalla que se toca doscientas veces por partido, mirando el juego y no el
   * telefono: cada palabra de aca se lee de reojo, o no se lee.
   */
  court: {
    /** Los tres botones del punto. La inicial manda; la descripcion chica hace que se entienda. */
    winner: 'Winner',
    forced: 'Forzado',
    unforced: 'No forzado',
    winnerShort: 'W',
    forcedShort: 'EF',
    unforcedShort: 'ENF',

    /** El saque. "DOBLE" y no "doble falta": una sola palabra, y la pildora ya dice 2DO SAQUE. */
    fault: 'FALTA',
    double: 'DOBLE',
    ace: 'ACE',
    let: 'LET',
    firstServe: '1ER SAQUE',
    secondServe: '2DO SAQUE',
    returning: 'RESTA',

    goldenPoint: 'PUNTO DE ORO',
    goldenPointChoose: 'PUNTO DE ORO — ELIGE EL QUE RESTA',
    boxRight: 'Derecha',
    boxLeft: 'Izquierda',

    finished: 'Partido terminado',
    home: 'Inicio',
    stats: 'Stats',
    undo: 'Deshacer',
  },

  /** El historial: la lista de partidos, con su buscador. */
  history: {
    title: 'Historial',
    search: 'Buscar por jugador',
    periods: {
      '6m': '6 meses',
      '30d': '30 días',
      '7d': '7 días',
    },
    /** La puerta al acumulado. Solo el nombre de pila: es un titulo, no una frase. */
    career: (name: string) => `Juego de ${name}`,

    empty: 'Todavía no hay partidos guardados. Juega uno y aparecerá aquí.',
    emptyFiltered: 'Ningún partido con esos filtros.',

    points: (n: number) => `${n} puntos`,
    unfinished: 'sin terminar',

    /**
     * El segundo filtro. Son DOS preguntas distintas —cuando jugue, y cuales estan completos— y se
     * COMBINAN: "los partidos de Bea, de los ultimos 7 dias, finalizados" es una sola pregunta con
     * tres partes. Por eso cada filtro vive en su propio control y todos se aplican a la vez.
     *
     * No hay opcion "Todos" en ninguno de los dos: cada pastilla se apaga con su propia ✕, y no
     * elegir nada YA ES todos. Un boton que dice "sin filtrar" es explicar el estado en el que
     * arranca la pantalla.
     */
    states: {
      finished: 'Finalizados',
      unfinished: 'Sin terminar',
    },

    /**
     * El cartel de borrar dice CUAL partido: la misma gente juega todas las semanas, y dos filas
     * seguidas pueden decir exactamente lo mismo. Una confirmacion que no distingue el partido
     * que se va a borrar no es una confirmacion, es un tramite.
     */
    deleteTitle: 'Borrar el partido',
    deleteNote: 'Se borra para siempre, con todas sus estadísticas.',
    delete: 'Borrar',
  },

  /** El plantel: la gente con la que jugas. La puerta al juego de cada una. */
  players: {
    title: 'Jugadores',
    search: 'Buscar jugador',
    empty: 'Todavía no jugó nadie. Carga un partido y aquí aparecerán los jugadores.',
    emptyFiltered: 'Ningún jugador con ese nombre.',
    matches: (n: number) => (n === 1 ? '1 partido' : `${n} partidos`),
    last: (date: string) => `último ${date}`,

    /**
     * Un jugador sin partidos es RESIDUO, y por eso se lo puede borrar (ver `deletePlayer`).
     *
     * Nadie se carga a mano: se nace jugando. Si hoy no tiene ningun partido es porque el partido
     * que lo trajo se borro. No sale en ninguna estadistica, no se puede abrir su juego, y sin
     * embargo sigue apareciendo en el autocompletado del formulario.
     */
    noMatches: 'Sin partidos',
    delete: 'Borrar jugador',
    deleteAsk: (name: string) => `¿Borrar a ${name}?`,

    rename: 'Renombrar',
    namePlaceholder: 'Nombre',
    save: 'Guardar',
    cancel: 'Cancelar',

    emptyName: 'Escribe un nombre.',

    /**
     * Que el nombre ya exista suele significar que son la misma persona: alguien escribe "Ana
     * Ruiz" sobre "Ana". Se pregunta ahi mismo, y GUARDAR DESAPARECE — el nombre choca, guardar
     * no puede funcionar, y las dos respuestas validas son cancelar o unir.
     */
    mergeAsk: (existing: string, current: string) =>
      `Ya existe ${existing}. ¿Es la misma persona que ${current}?`,
    mergeNote: 'Se juntan sus dos historiales. Ningún partido se borra.',
    merge: 'Unir',

    /** SI JUGARON JUNTAS, NO SON LA MISMA PERSONA. Nadie es su propio rival ni su compañero. */
    playedTogether: (existing: string, current: string) =>
      `Ya existe ${existing}, y jugó partidos contra ${current}. Elige otro nombre.`,
  },

  /**
   * LAS ESTADISTICAS. Las comparten cuatro pantallas —el partido, el acumulado, la tarjeta y los
   * graficos—, asi que viven juntas: si "Gana c/ 1ro" se dijera distinto en dos lugares, serian
   * dos numeros distintos para el que lee.
   */
  stats: {
    title: 'Estadísticas',
    empty: 'Todavía no se jugó ningún punto.',

    /** Las tres acciones. El mismo vocabulario que los botones de la cancha. */
    winners: 'Winners',
    forcedErrors: 'Errores forzados',
    unforcedErrors: 'Errores no forzados',
    forcedShort: 'E. forzados',
    unforcedShort: 'E. no forz.',
    unforcedLegend: 'E. no forzados',

    /** Las secciones. */
    match: 'Partido',
    playerByPlayer: 'Jugador por jugador',
    shots: 'Golpes',
    detail: 'Detalle',
    myGame: 'Su juego',
    evolution: 'Evolución',
    evolutionSub: 'un partido, una barra',
    byShot: 'por golpe, partido a partido',

    /** El global del partido. */
    pointsWon: 'Puntos ganados',
    winnersPerError: 'Winners por error',
    breakPoints: 'Break points',
    points: (n: number) => `${n} puntos`,
    pointsPlayed: (n: number) => `${n} puntos jugados`,

    /** La ficha de cada jugador. */
    serving: 'SACANDO',
    returning: 'RESTANDO',
    firstServe: '1er saque',
    firstServeIn: '1er saque adentro',
    wonWithFirst: 'Gana c/ 1ro',
    wonWithFirstLong: 'Gana con 1er saque',
    wonWithSecond: 'Gana c/ 2do',
    aces: 'Aces',
    doubleFaults: 'Dobles faltas',
    wonReturning: 'Gana restando',
    acesConceded: 'Aces recibidos',
    doubleFaultsForced: 'Dobles provocadas',

    /**
     * Winners contra errores no forzados, los dos crudos: "22/14". El par no tiene umbral
     * invisible —tiene COLOR—, a diferencia del ratio, donde hay que saber que el corte esta en
     * 1.0 y nadie lo sabe la primera vez.
     */
    winnersOverErrors: 'W / ENF',

    /** El acumulado de una persona: lo unico que crece. */
    matches: 'Partidos',
    won: 'Ganados',
    lost: 'Perdidos',
    pointsShare: 'Puntos',
    unfinished: (n: number) => (n === 1 ? '1 sin terminar' : `${n} sin terminar`),
    allFinished: 'todos terminados',
    noMatches: 'Todavía no jugó ningún partido.',

    /** El pie de la pantalla del partido. */
    finished: 'Partido terminado.',
    finishedEarly: 'Partido terminado antes de tiempo.',
    share: 'Compartir',
    shareDialog: 'Compartir el partido',

    /** Sin golpes cargados no hay nada que dibujar: una tabla de ceros diria otra cosa. */
    otherShots: 'Otros',
    noShots: 'Sin golpes cargados.',
    noShotsCategory: 'Sin golpes cargados en esta categoría.',
    oneMatch: 'Con un solo partido no hay evolución que mostrar. Juega otro y esto se llena.',
  },
};
