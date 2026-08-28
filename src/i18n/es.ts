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
    /** Golpes propios, no variantes de la bandeja: se pegan distinto y se cuentan aparte. */
    vibora: 'Víbora',
    rulo: 'Rulo',
    volea: 'Volea',
    chiquita: 'Chiquita',
    /** Sin boton propio: la escriben partidos viejos, de antes de dividirla (ver `Stroke`). */
    salida_de_pared: 'Salida de pared',
    /**
     * Las dos de ahora. CORTAS A PROPOSITO: "salida de pared" ya es el nombre mas largo de la
     * hoja y fija el tamaño de letra de las once —era once, ahora son doce— filas (ver
     * `strokeFont` en MatchScreen). Escribir el nombre entero en las dos ("Salida de pared
     * ofensiva/defensiva") las volveria las mas largas de lejos y encogeria la letra de TODA
     * la hoja por dos botones — justo lo contrario de lo que se pidio. "Pared" alcanza: al
     * lado de "Salida de pared" nadie lee otra cosa.
     */
    /** "S." de salida: "Pared" sola es la pared, no el golpe que sale de ella. */
    salida_pared_ofensiva: 'S. Pared ofensiva',
    salida_pared_defensiva: 'S. Pared defensiva',
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
    /** Nunca sale de una hoja: lo pone la app sola en toda falla de recepcion (ver `Stroke`). */
    saque: 'Saque',
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
    archive: 'Archivar',
    archiveNote: 'Al archivar, el partido puede retomarse en el Historial.',

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
    start: 'Comenzar',

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

    /**
     * Los dos botones del que resta, arriba de su tarjeta — el espejo de FALTA/ACE/LET del
     * que saca. Reusan las siglas EF/ENF que ya se conocen de los botones de abajo, con RESTO
     * al lado: dicen lo mismo que esos, acotado a un solo momento del punto. A proposito NO
     * se llaman igual que esos —"EF" solo— para que se lean como otra cosa a simple vista,
     * aunque compartan la abreviatura.
     */
    /** El rotulo de la fila del fallo de devolucion. NO es un boton (ver MatchScreen). */
    returnRow: 'Resto',
    /** El titulo de los dos botones. Dice que fue un ERROR: "resto forzado" se leeria como un
        buen resto. Es la misma palabra que usa `returnErrorPct` en estadisticas. */
    returnFail: 'FALLA',

    /** El duelo del error forzado: quien lo forzo, y con que golpe. Solo en ESE error. */
    forcedByTitle: '¿Quién lo forzó?',
    /** El nombre de QUIEN LO FORZO, no del que se equivoco: sin esto, se elegiria a ciegas. */
    forcedByShotTitle: (name: string) => `¿Con qué golpe forzó ${name}?`,
    /** El tercer paso: ahora el nombre es el de quien SUFRIO el forzado, no el que forzo. */
    erredByShotTitle: (name: string) => `¿Con qué golpe erró ${name}?`,

    goldenPoint: 'PUNTO DE ORO',
    goldenPointChoose: 'PUNTO DE ORO — ELIGE EL QUE RESTA',
    boxRight: 'Derecha',
    boxLeft: 'Izquierda',

    /**
     * UN PARTIDO ESTA "FINALIZADO" O "SIN TERMINAR", Y SE DICE ASI EN TODA LA APP.
     *
     * Habia tres maneras de decir lo mismo: la cancha decia "Partido terminado", las estadisticas
     * "Partido terminado antes de tiempo" y el historial "sin terminar". Tres palabras para un
     * hecho es lo que hace que alguien se pregunte si son tres hechos distintos.
     *
     * El par es: FINALIZADO / SIN TERMINAR. Y no se toca sin cambiarlo en los tres lugares.
     */
    finished: 'Partido finalizado',
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

    /**
     * La copia de seguridad. Los verbos van solos en la barra —se explican solos y aguantan
     * cualquier tamaño de fuente—; el nombre de la cosa aparece como titulo del dialogo.
     */
    backup: 'Copia de seguridad',
    export: 'Exportar',
    import: 'Importar',
    exportNote: 'Tus partidos viven en este teléfono. Guarda esta copia donde quieras.',
    /** El resultado se MUESTRA para que la segunda importación del mismo archivo se vea inocua. */
    imported: (n: number) => (n === 1 ? 'Se agregó 1 partido.' : `Se agregaron ${n} partidos.`),
    importedNone: 'No se agregó ninguno: ya estaban todos.',
    importedSkipped: (n: number) => (n === 1 ? '1 ya estaba.' : `${n} ya estaban.`),
    importBad: 'Ese archivo no es una copia de Vigia.',
    importFailed: 'No se pudo leer el archivo.',
    ok: 'Listo',
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
    /**
     * Las dos leyendas del desglose por golpe, que NO dicen lo mismo que las de arriba.
     *
     * El rojo agrupa: el motor suma el error forzado adentro de `unforcedByShot`, porque para
     * quien lo comete es el mismo dato —con que golpe fallo— y separarlos ahi obligaria a mirar
     * dos numeros para saber cuantas veces erro con la bandeja. Asi que la leyenda tiene que
     * decir "totales" y no "no forzados", que era lo que decia y era mentira.
     *
     * El azul es el otro lado del duelo: los puntos que esa persona GANO haciendo errar al otro.
     */
    errorsLegend: 'Errores totales',
    causedLegend: 'E. provocados',

    /** Las secciones. */
    match: 'Partido',
    playerByPlayer: 'Jugador por jugador',
    shots: 'Golpes',
    detail: 'Detalle',
    myGame: 'Juego',
    evolution: 'Evolución',
    evolutionSub: 'un partido, una barra',
    /** El rango del bloque que se esta mirando: "partidos 11-20 de 47". */
    blockRange: (from: number, to: number, total: number) => `Partidos ${from}-${to} de ${total}`,
    /** La comparacion del final: donde estaba y donde esta, metrica por metrica. */
    beforeAfter: 'Antes y ahora',
    beforeAfterSub: (n: number) => `primeros ${n} contra últimos ${n}`,
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
    /** NO "provocadas": eso afirma que vos las causaste, y la app no lo sabe. Dice el hecho
        —el rival hizo dobles mientras vos restabas— y la lectura queda para el entrenador. */
    doubleFaultsForced: 'Dobles del rival',
    /** Solo aparece si se uso el boton dedicado de la cancha: ver `onReturn` en el motor. */
    /**
     * NO se llama parecido a nada del equipo, a proposito. Estuvo a punto de ser "falla
     * restando", en paralelo con "gana restando" — y eran categorias distintas: aquella era
     * del equipo, esta es de la persona. Un nombre simetrico entre dos cosas que no lo son
     * induce a leerlas como las dos caras de lo mismo.
     */
    returnErrorPct: 'Falla en resto',
    /** Los errores forzados que ESTA persona provoco. El par de `forcedErrors`, del otro lado. */
    forcedErrorsCaused: 'Errores provocados',
    /**
     * Los dos rotulos del desglose de los errores provocados: contra quien, y con que golpe.
     *
     * Antes las dos listas iban pegadas en el subtitulo de la celda, sin distinguirse, y en un
     * tercio del ancho de la tarjeta. Los rivales son como maximo DOS, asi que esa lista siempre
     * fue corta; los golpes son CATORCE, y esa era la que desbordaba. Con el rotulo delante ya no
     * hace falta el "a" de "3 a Beto": la fila dice de que habla.
     */
    causedAgainst: 'A quién',
    causedWith: 'Con qué',

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
    finished: 'Partido finalizado.',
    finishedEarly: 'Partido sin terminar.',
    share: 'Compartir',
    shareDialog: 'Compartir el partido',

    otherShots: 'Otros',
    /** Todo lo que no alcanza para dibujar dice lo MISMO y con las mismas dos palabras. */
    noShots: 'Datos insuficientes.',
    noShotsCategory: 'Datos insuficientes.',
    oneMatch: 'Datos insuficientes.',
    noPoints: 'Datos insuficientes.',
  },

  /**
   * LA PANTALLA DE AYUDA — que la primera vez es la BIENVENIDA.
   *
   * Es una sola pantalla con dos modos, no dos pantallas. La primera vez se abre sola y explica
   * de que se trata; despues se llega con el boton de ayuda del inicio, para releerla o para
   * cambiar el idioma. Un carrusel de onboarding habria servido solo para lo primero: nadie
   * vuelve a abrir un carrusel, y entonces el idioma y la privacidad seguirian sin tener casa.
   *
   * LO QUE HAY QUE EXPLICAR ES EL ROL, no los botones. Que la app la maneje alguien que esta
   * AFUERA de la cancha no se le ocurre a nadie solo, y sin eso la pantalla de un partido no se
   * entiende. Los botones se descubren tocando; el rol, no.
   */
  /**
   * EL SALUDO DE LA PRIMERA VEZ. Chico, encima del inicio, y nada mas.
   *
   * La primera impresion de la app tiene que ser LA APP —la cancha, el logo, el boton verde— y no
   * un manual. Un onboarding a pantalla completa le pone un trámite adelante a alguien que todavia
   * no sabe si le interesa: lo unico que hace falta la primera vez es decirle DONDE esta la ayuda
   * el dia que la necesite.
   */
  welcome: {
    title: 'Bienvenido a Vigia',
    text: 'Para saber cómo usar la app, entra en Ayuda.',
    /** El boton lleva el MISMO icono que va a tener el de ayuda: se lo presenta, no se lo cuenta. */
    help: 'Ayuda',
    /** "Cerrar" y no "Salir": salir se lee como salir DE LA APP, y lo unico que cierra es esto. */
    close: 'Cerrar',
  },

  help: {
    /** Va como subtitulo de la marca, igual que en el resto de las pantallas. */
    title: 'Ayuda',
    /** Etiqueta accesible del boton del inicio: lo que lee un lector de pantalla. */
    openLabel: 'Ayuda y ajustes',
    close: 'Cerrar',

    /**
     * Los seis pasos, en orden. El ICONO NO ESTA ACA: se empareja por posicion en la pantalla,
     * porque un icono no se traduce y no tiene nada que hacer en un archivo de idioma.
     */
    steps: [
      {
        title: 'Tú miras. La app anota.',
        text: 'La maneja alguien que está afuera de la cancha: el entrenador, alguien del banco, un amigo.',
      },
      {
        title: 'Los cuatro, en la cancha',
        text: 'Cada uno aparece en el lugar que ocupa: quién juega de drive y quién de revés en cada pareja.',
      },
      {
        title: 'Quién saca primero',
        text: 'Se sortea, y se puede corregir a mano. Empieza sacando el drive, al principio de cada set se puede cambiar.',
      },
      {
        title: 'Toca qué pasó en el punto',
        text: 'Winner, error forzado o error no forzado. Nada más que eso.',
      },
      {
        title: 'Y con qué golpe fue',
        text: 'Se abre la hoja de golpes: remate, bandeja, víbora, volea. Configurable en esta sección.',
      },
      {
        title: 'El marcador se hace solo',
        text: 'Los saques, los cambios de lado y los tie-breaks salen del reglamento.',
      },
      {
        title: 'Estadísticas de nivel profesional',
        text: 'Winners, errores, aces y break points, como en una transmisión. Cada partido queda guardado.',
      },
      {
        title: 'La evolución de cada jugador',
        text: 'Cada persona acumula sus partidos, y puedes seguir cómo progresa con el tiempo.',
      },
      {
        title: 'Una tarjeta para el grupo',
        text: 'El partido entero en una imagen, lista para compartir por WhatsApp.',
      },
    ],

    settings: 'Ajustes',
    /** Claro u oscuro. El default es oscuro: la app se usa al borde de una cancha, de noche. */
    theme: 'Tema',
    themes: { oscuro: 'Oscuro', claro: 'Claro' },
    themeHints: {
      oscuro: 'Para la cancha de noche y con luz artificial.',
      claro: 'Para mirarla con sol de frente.',
    },
    privacy: 'Política de privacidad',
    contact: 'Escríbenos',
    /**
     * Este boton abre la FICHA de Google Play, no el dialogo de valoracion dentro de la app:
     * Google prohibe expresamente disparar ese dialogo desde un boton. El de adentro aparece
     * solo, y casi nunca (ver `store/review.ts`).
     */
    rate: 'Valorar la app',
    /** {v} es la version que declara `app.json`: no se escribe a mano en ningun lado. */
    version: 'Vigia {v}',

    /**
     * POR DONDE SE EMPIEZA. `{icon}` se reemplaza por el icono de verdad, dibujado dentro de la
     * frase: nombrar un boton obliga a salir a buscarlo, mostrarlo no.
     *
     * Manda a HISTORIAL y no a las estadisticas: el boton para seguir un partido a medias vive en
     * la fila de ese partido, en el historial (ver `HistoryScreen`).
     *
     * Y NO dice ademas que la app lo ofrece al abrirla, aunque sea cierto: eso solo pasa con el
     * ultimo que quedo a medias, y contarlo al lado del historial —de donde se retoma CUALQUIERA—
     * hace parecer que son dos caminos equivalentes. Uno solo funciona siempre.
     */
    /* "Sin terminar" y no "a medias": es la MISMA palabra que ya usa el historial para marcar
       esos partidos. Dos formas de nombrar lo mismo obligan a deducir que son lo mismo. */
    startHint:
      'Para empezar, toca {icon} Partido nuevo. Si dejas un partido sin terminar, lo sigues después desde Historial.',
  },
};
