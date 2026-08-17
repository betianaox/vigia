import type { Dict } from './index';

/**
 * Italiano.
 *
 * El italiano del padel usa "smash" (no "schiacciata", que es lo tenistico), "pallonetto" para el
 * globo y "smorzata" para la dejada — verificado en glosarios italianos. Bandeja, vibora y
 * chiquita van en castellano: asi las enseña un profesor en Milan.
 */
export const it: Dict = {
  shots: {
    remate: 'Smash',
    bandeja: 'Bandeja',
    vibora: 'Víbora',
    rulo: 'Gancho',
    volea: 'Volée',
    chiquita: 'Chiquita',
    /** El italiano SI tiene nombre propio, y es uno de sus ocho golpes fundamentales. */
    salida_de_pared: 'Uscita di parete',
    /** "U." di uscita: "Parete" da sola e il muro, non il colpo che ne esce. */
    salida_pared_ofensiva: 'U. Parete offensiva',
    salida_pared_defensiva: 'U. Parete difensiva',
    fondo: 'Fondo',
    globo: 'Pallonetto',
    dejada: 'Smorzata',
    recuperacion: 'Recupero',
    saque: 'Servizio',
  },

  sides: {
    drive: 'Dritto',
    reves: 'Rovescio',
  },

  positions: {
    drive: 'Dritto',
    reves: 'Rovescio',
  },

  teams: {
    a: 'Squadra 1',
    b: 'Squadra 2',
  },

  setup: {
    newMatch: 'Nuova partita',
    onCourt: 'Partita in corso',

    resumeEyebrow: 'PARTITA IN CORSO',
    resume: 'Continua',
    end: 'Termina',

    namePlaceholder: 'Nome',

    firstServe: 'INIZIA AL SERVIZIO',
    draw: 'Sorteggia',
    drawing: 'Sorteggio…',

    match: 'PARTITA',
    advanced: 'Avanzate',
    lengths: {
      un_game: '1 game',
      un_set: '1 set',
      tres_sets: '3 set',
    },

    shotPrompt: 'Registro del colpo',
    shotPrompts: {
      siempre: 'Chiedi sempre',
      opcional: 'Registro opzionale',
    },
    shotPromptHints: {
      siempre: 'Il foglio dei colpi si apre a ogni punto.',
      opcional: 'Il tocco breve registra; tenendo premuto si apre.',
    },

    language: 'Lingua',
    languageAuto: 'Automatica',

    gameFormat: 'SUL 40-40',
    gameFormats: {
      ventajas: 'Vantaggi',
      punto_de_oro: 'Punto d’oro',
      punto_estrella: 'Punto stella',
    },

    thirdSet: 'TERZO SET',
    thirdSets: {
      set_normal: 'Set normale',
      super_tiebreak: 'Super tiebreak',
    },

    changeEnds: 'CAMBI DI CAMPO',
    changeEndsOptions: {
      games_impares: 'Game dispari',
      fin_de_set: 'Fine set',
      nunca: 'Mai',
    },

    formation: (team: string) => `${team} · AL SERVIZIO`,
    formations: {
      australiana: 'Mantiene il lato',
      cambio: 'Cambia lato',
    },

    remembered: 'L’app ricorda tutto questo per la prossima partita.',
    start: 'Inizia',

    history: 'Storico',
    players: 'Giocatori',
  },

  court: {
    winner: 'Winner',
    forced: 'Forzato',
    unforced: 'Non forzato',
    winnerShort: 'W',
    forcedShort: 'EF',
    unforcedShort: 'ENF',

    fault: 'FALLO',
    double: 'DOPPIO',
    ace: 'ACE',
    let: 'LET',
    firstServe: '1° SERVIZIO',
    secondServe: '2° SERVIZIO',
    returning: 'RISPONDE',

    returnRow: 'Risposta',
    returnFail: 'ERRORE',

    forcedByTitle: 'Chi l’ha forzato?',
    forcedByShotTitle: (name: string) => `Con che colpo l’ha forzato ${name}?`,
    erredByShotTitle: (name: string) => `Con che colpo ha sbagliato ${name}?`,

    goldenPoint: 'PUNTO D’ORO',
    goldenPointChoose: 'PUNTO D’ORO — SCEGLI CHI RISPONDE',
    boxRight: 'Destra',
    boxLeft: 'Sinistra',

    finished: 'Partita finita',
    home: 'Inizio',
    stats: 'Stats',
    undo: 'Annulla',
  },

  history: {
    title: 'Storico',
    search: 'Cerca per giocatore',
    periods: {
      '6m': '6 mesi',
      '30d': '30 giorni',
      '7d': '7 giorni',
    },
    career: (name: string) => `Il gioco di ${name}`,

    empty: 'Non ci sono ancora partite salvate. Giocane una e apparirà qui.',
    emptyFiltered: 'Nessuna partita con questi filtri.',

    points: (n: number) => `${n} punti`,
    unfinished: 'non finita',

    states: {
      finished: 'Finite',
      unfinished: 'Non finite',
    },

    deleteTitle: 'Elimina la partita',
    deleteNote: 'Sparisce per sempre, con tutte le sue statistiche.',
    delete: 'Elimina',

    backup: 'Copia di sicurezza',
    export: 'Esporta',
    import: 'Importa',
    exportNote: 'Le tue partite vivono in questo telefono. Conserva questa copia dove vuoi.',
    imported: (n: number) => (n === 1 ? 'Aggiunta 1 partita.' : `Aggiunte ${n} partite.`),
    importedNone: 'Non è stata aggiunta nessuna: le avevi già tutte.',
    importedSkipped: (n: number) => (n === 1 ? '1 c’era già.' : `${n} c’erano già.`),
    importBad: 'Quel file non è una copia di Vigía.',
    importFailed: 'Non è stato possibile leggere il file.',
    ok: 'Fatto',
  },

  players: {
    title: 'Giocatori',
    search: 'Cerca giocatore',
    empty: 'Non ha ancora giocato nessuno. Registra una partita e appariranno qui.',
    emptyFiltered: 'Nessun giocatore con quel nome.',
    matches: (n: number) => (n === 1 ? '1 partita' : `${n} partite`),
    last: (date: string) => `ultima ${date}`,

    noMatches: 'Nessuna partita',
    delete: 'Elimina giocatore',
    deleteAsk: (name: string) => `Eliminare ${name}?`,

    rename: 'Rinomina',
    namePlaceholder: 'Nome',
    save: 'Salva',
    cancel: 'Annulla',

    emptyName: 'Scrivi un nome.',

    mergeAsk: (existing: string, current: string) =>
      `${existing} esiste già. È la stessa persona di ${current}?`,
    mergeNote: 'I due storici diventano uno. Nessuna partita viene eliminata.',
    merge: 'Unisci',

    playedTogether: (existing: string, current: string) =>
      `${existing} esiste già e ha giocato contro ${current}. Scegli un altro nome.`,
  },

  stats: {
    title: 'Statistiche',
    empty: 'Non si è ancora giocato nessun punto.',

    winners: 'Winner',
    forcedErrors: 'Errori forzati',
    unforcedErrors: 'Errori non forzati',
    forcedShort: 'E. forzati',
    unforcedShort: 'E. non forz.',
    unforcedLegend: 'E. non forzati',

    match: 'Partita',
    playerByPlayer: 'Giocatore per giocatore',
    shots: 'Colpi',
    detail: 'Dettaglio',
    myGame: 'Gioco',
    evolution: 'Evoluzione',
    evolutionSub: 'una partita, una barra',
    blockRange: (from: number, to: number, total: number) => `Partite ${from}-${to} di ${total}`,
    beforeAfter: 'Prima e ora',
    beforeAfterSub: (n: number) => `prime ${n} contro ultime ${n}`,
    byShot: 'per colpo, partita per partita',

    pointsWon: 'Punti vinti',
    winnersPerError: 'Winner per errore',
    breakPoints: 'Break point',
    points: (n: number) => `${n} punti`,
    pointsPlayed: (n: number) => `${n} punti giocati`,

    serving: 'AL SERVIZIO',
    returning: 'IN RISPOSTA',
    firstServe: '1° servizio',
    firstServeIn: '1° servizio dentro',
    wonWithFirst: 'Vince c/ 1°',
    wonWithFirstLong: 'Vince con 1° servizio',
    wonWithSecond: 'Vince c/ 2°',
    aces: 'Ace',
    doubleFaults: 'Doppi falli',
    wonReturning: 'Vince in risposta',
    acesConceded: 'Ace subiti',
    doubleFaultsForced: 'Doppi avversari',
    returnErrorPct: 'Errore in risposta',
    forcedErrorsCaused: 'Errori provocati',
    causedAgainst: 'A chi',
    causedWith: 'Con quale',

    winnersOverErrors: 'W / ENF',

    matches: 'Partite',
    won: 'Vinte',
    lost: 'Perse',
    pointsShare: 'Punti',
    unfinished: (n: number) => (n === 1 ? '1 non finita' : `${n} non finite`),
    allFinished: 'tutte finite',
    noMatches: 'Non ha ancora giocato nessuna partita.',

    finished: 'Partita finita.',
    finishedEarly: 'Partita non finita.',
    share: 'Condividi',
    shareDialog: 'Condividi la partita',

    otherShots: 'Altri',
    noShots: 'Dati insufficienti.',
    noShotsCategory: 'Dati insufficienti.',
    oneMatch: 'Dati insufficienti.',
    noPoints: 'Dati insufficienti.',
  },

  welcome: {
    title: 'Benvenuto in Vigía',
    text: 'Per sapere come si usa l’app, entra in Aiuto.',
    help: 'Aiuto',
    close: 'Chiudi',
  },

  help: {
    title: 'Aiuto',
    openLabel: 'Aiuto e impostazioni',
    close: 'Chiudi',

    steps: [
      {
        title: 'Tu guardi. L’app scrive.',
        text: 'La usa qualcuno che sta fuori dal campo: l’allenatore, qualcuno in panchina, un amico.',
      },
      {
        title: 'Tutti e quattro, in campo',
        text: 'Ognuno compare nel posto che occupa: chi gioca di diritto e chi di rovescio in ogni coppia.',
      },
      {
        title: 'Chi serve per primo',
        text: 'Si sorteggia, e si può correggere a mano. Inizia il giocatore di diritto, all’inizio di ogni set si può cambiare.',
      },
      {
        title: 'Tocca che cosa è successo nel punto',
        text: 'Winner, errore forzato o errore non forzato. Nient’altro.',
      },
      {
        title: 'E con quale colpo',
        text: 'Si apre la scheda dei colpi: smash, bandeja, víbora, volée. Configurabile in questa sezione.',
      },
      {
        title: 'Il punteggio si fa da solo',
        text: 'Servizi, cambi di campo e tie-break escono dal regolamento.',
      },
      {
        title: 'Statistiche da telecronaca',
        text: 'Winner, errori, ace e break point, come in una trasmissione. Ogni partita resta salvata.',
      },
      {
        title: 'L’evoluzione di ogni giocatore',
        text: 'Ognuno accumula le proprie partite, e puoi seguire come migliora nel tempo.',
      },
      {
        title: 'Una scheda per il gruppo',
        text: 'L’intera partita in una sola immagine, pronta da condividere su WhatsApp.',
      },
    ],

    settings: 'Impostazioni',
    privacy: 'Informativa sulla privacy',
    contact: 'Scrivici',
    rate: 'Valuta l’app',
    version: 'Vigía {v}',

    startHint:
      'Per iniziare, tocca {icon} Partita nuova. Se lasci una partita non finita, la riprendi dallo Storico.',
  },
};
