import type { Dict } from './index';

/**
 * English.
 *
 * LOS GOLPES: se traduce solo el que tiene una palabra que un jugador diria en la cancha. Bandeja,
 * vibora, chiquita y gancho se dicen en castellano tambien en ingles — aparecen asi en los
 * glosarios y en las transmisiones. Salida de pared y recuperacion no tienen nombre propio: se
 * describen ("off the wall", "defensive shot"), y una descripcion no es un boton.
 */
export const en: Dict = {
  shots: {
    remate: 'Smash',
    bandeja: 'Bandeja',
    volea: 'Volley',
    chiquita: 'Chiquita',
    /**
     * EL INGLES NO TIENE NOMBRE PARA ESTE GOLPE, ASI QUE SE LO DESCRIBE.
     *
     * Los entrenadores anglofonos no lo nombran: hablan del cristal. Dicen "the back glass" y
     * "play it off the glass". Lo que circula como nombre —"wall exit"— es una traduccion literal
     * que nadie usa en cancha, y la bajada (que es OTRO golpe: el ataque, no la salida) directamente
     * la dicen en castellano, igual que la bandeja o la chiquita.
     *
     * Entre dejarlo en castellano —que seria lo coherente con bandeja/chiquita/vibora— y que un
     * principiante anglofono entienda de que se le habla, gana lo segundo: este golpe no es jerga
     * de iniciados, es uno de los fundamentales, y quien recien empieza tiene que poder encontrarlo
     * en la hoja sin saber castellano.
     */
    salida_de_pared: 'Off the glass',
    fondo: 'Groundstroke',
    globo: 'Lob',
    dejada: 'Drop shot',
    /**
     * NO ES UN GOLPE DEFENSIVO: es la pelota que parecia perdida y volvio. La que se toca antes
     * de que pase, o la que salio por la puerta y alguien la metio de vuelta — el punto ya estaba
     * ganado y se dio vuelta.
     *
     * "Recuperacion" tampoco es un nombre formal en castellano: es una descripcion. Y una
     * descripcion se dice en el idioma de cada uno.
     */
    recuperacion: 'Retrieval',
  },

  variants: {
    vibora: 'Víbora',
    gancho: 'Gancho',
    x3: 'x3',
    x4: 'x4',
    traerla: 'Traerla',
  },

  sides: {
    drive: 'Forehand',
    reves: 'Backhand',
  },

  positions: {
    drive: 'Forehand',
    reves: 'Backhand',
  },

  teams: {
    a: 'Team 1',
    b: 'Team 2',
  },

  setup: {
    newMatch: 'New match',
    onCourt: 'Match in progress',

    resumeEyebrow: 'MATCH IN PROGRESS',
    resume: 'Continue',
    end: 'End',

    namePlaceholder: 'Name',

    firstServe: 'SERVES FIRST',
    draw: 'Toss',
    drawing: 'Tossing…',

    match: 'MATCH',
    advanced: 'Advanced',
    lengths: {
      un_game: '1 game',
      un_set: '1 set',
      tres_sets: '3 sets',
    },

    shotPrompt: 'Shot logging',
    shotPrompts: {
      siempre: 'Always ask',
      opcional: 'Optional',
    },
    shotPromptHints: {
      siempre: 'The shot sheet opens on every point.',
      opcional: 'A tap scores it; hold to open the sheet.',
    },

    language: 'Language',
    languageAuto: 'Automatic',

    gameFormat: 'AT 40-40',
    gameFormats: {
      ventajas: 'Advantage',
      punto_de_oro: 'Golden point',
      punto_estrella: 'Star point',
    },

    thirdSet: 'THIRD SET',
    thirdSets: {
      set_normal: 'Full set',
      super_tiebreak: 'Super tiebreak',
    },

    changeEnds: 'CHANGE OF ENDS',
    changeEndsOptions: {
      games_impares: 'Odd games',
      fin_de_set: 'End of set',
      nunca: 'Never',
    },

    formation: (team: string) => `${team} · WHEN SERVING`,
    formations: {
      australiana: 'Keeps the side',
      cambio: 'Switches side',
    },

    remembered: 'The app remembers this for your next match.',
    start: 'Start',

    history: 'History',
    players: 'Players',
  },

  court: {
    winner: 'Winner',
    forced: 'Forced',
    unforced: 'Unforced',
    winnerShort: 'W',
    forcedShort: 'FE',
    unforcedShort: 'UE',

    fault: 'FAULT',
    double: 'DOUBLE',
    ace: 'ACE',
    let: 'LET',
    firstServe: '1ST SERVE',
    secondServe: '2ND SERVE',
    returning: 'RETURNS',

    goldenPoint: 'GOLDEN POINT',
    goldenPointChoose: 'GOLDEN POINT — PICK THE RETURNER',
    boxRight: 'Deuce',
    boxLeft: 'Ad',

    finished: 'Match finished',
    home: 'Home',
    stats: 'Stats',
    undo: 'Undo',
  },

  history: {
    title: 'History',
    search: 'Search by player',
    periods: {
      '6m': '6 months',
      '30d': '30 days',
      '7d': '7 days',
    },
    career: (name: string) => `${name}'s game`,

    empty: 'No matches saved yet. Play one and it will show up here.',
    emptyFiltered: 'No matches with those filters.',

    points: (n: number) => `${n} points`,
    unfinished: 'unfinished',

    states: {
      finished: 'Finished',
      unfinished: 'Unfinished',
    },

    deleteTitle: 'Delete match',
    deleteNote: 'Gone for good, along with all its stats.',
    delete: 'Delete',
  },

  players: {
    title: 'Players',
    search: 'Search player',
    empty: 'Nobody has played yet. Log a match and players will show up here.',
    emptyFiltered: 'No player by that name.',
    matches: (n: number) => (n === 1 ? '1 match' : `${n} matches`),
    last: (date: string) => `last ${date}`,

    noMatches: 'No matches',
    delete: 'Delete player',
    deleteAsk: (name: string) => `Delete ${name}?`,

    rename: 'Rename',
    namePlaceholder: 'Name',
    save: 'Save',
    cancel: 'Cancel',

    emptyName: 'Type a name.',

    mergeAsk: (existing: string, current: string) =>
      `${existing} already exists. Is that the same person as ${current}?`,
    mergeNote: 'Their two histories become one. No match is deleted.',
    merge: 'Merge',

    playedTogether: (existing: string, current: string) =>
      `${existing} already exists, and has played against ${current}. Pick another name.`,
  },

  stats: {
    title: 'Stats',
    empty: 'No points played yet.',

    winners: 'Winners',
    forcedErrors: 'Forced errors',
    unforcedErrors: 'Unforced errors',
    forcedShort: 'Forced',
    unforcedShort: 'Unforced',
    unforcedLegend: 'Unforced',

    match: 'Match',
    playerByPlayer: 'Player by player',
    shots: 'Shots',
    detail: 'Detail',
    myGame: 'Game',
    evolution: 'Progress',
    evolutionSub: 'one match, one bar',
    byShot: 'by shot, match by match',

    pointsWon: 'Points won',
    winnersPerError: 'Winners per error',
    breakPoints: 'Break points',
    points: (n: number) => `${n} points`,
    pointsPlayed: (n: number) => `${n} points played`,

    serving: 'SERVING',
    returning: 'RETURNING',
    firstServe: '1st serve',
    firstServeIn: '1st serve in',
    wonWithFirst: 'Won w/ 1st',
    wonWithFirstLong: 'Won with 1st serve',
    wonWithSecond: 'Won w/ 2nd',
    aces: 'Aces',
    doubleFaults: 'Double faults',
    wonReturning: 'Won returning',
    acesConceded: 'Aces against',
    doubleFaultsForced: 'Doubles forced',

    winnersOverErrors: 'W / UE',

    matches: 'Matches',
    won: 'Won',
    lost: 'Lost',
    pointsShare: 'Points',
    unfinished: (n: number) => (n === 1 ? '1 unfinished' : `${n} unfinished`),
    allFinished: 'all finished',
    noMatches: 'No matches played yet.',

    finished: 'Match finished.',
    finishedEarly: 'Match unfinished.',
    share: 'Share',
    shareDialog: 'Share the match',

    otherShots: 'Other',
    noShots: 'Not enough data.',
    noShotsCategory: 'Not enough data.',
    oneMatch: 'Not enough data.',
    noPoints: 'Not enough data.',
  },
};
