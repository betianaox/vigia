import type { Dict } from './index';

/**
 * Português.
 *
 * El portugues es el que menos se mueve: "remate" es la misma palabra, y globo, dejada y salida
 * de pared se entienden tal cual. Lo que cambia es lo que de verdad cambia — voleio, fundo,
 * recuperação.
 */
export const pt: Dict = {
  shots: {
    remate: 'Remate',
    bandeja: 'Bandeja',
    volea: 'Voleio',
    chiquita: 'Chiquita',
    /** El portugues tiene el suyo, y no es el castellano: se dice "saída", no "salida". */
    salida_de_pared: 'Saída de parede',
    fondo: 'Fundo',
    globo: 'Globo',
    dejada: 'Dejada',
    recuperacion: 'Recuperação',
  },

  variants: {
    vibora: 'Víbora',
    gancho: 'Gancho',
    x3: 'x3',
    x4: 'x4',
    traerla: 'Traerla',
  },

  sides: {
    drive: 'Direita',
    reves: 'Esquerda',
  },

  positions: {
    drive: 'Direita',
    reves: 'Esquerda',
  },

  teams: {
    a: 'Equipa 1',
    b: 'Equipa 2',
  },

  setup: {
    newMatch: 'Novo jogo',
    onCourt: 'Jogo em curso',

    resumeEyebrow: 'JOGO EM CURSO',
    resume: 'Continuar',
    end: 'Terminar',

    namePlaceholder: 'Nome',

    firstServe: 'COMEÇA A SERVIR',
    draw: 'Sortear',
    drawing: 'A sortear…',

    match: 'JOGO',
    advanced: 'Avançadas',
    lengths: {
      un_game: '1 game',
      un_set: '1 set',
      tres_sets: '3 sets',
    },

    shotPrompt: 'Registo do golpe',
    shotPrompts: {
      siempre: 'Perguntar sempre',
      opcional: 'Registo opcional',
    },
    shotPromptHints: {
      siempre: 'A folha de golpes abre em cada ponto.',
      opcional: 'O toque curto regista; manter abre a folha.',
    },

    language: 'Idioma',
    languageAuto: 'Automático',

    gameFormat: 'AOS 40-40',
    gameFormats: {
      ventajas: 'Vantagens',
      punto_de_oro: 'Ponto de ouro',
      punto_estrella: 'Ponto estrela',
    },

    thirdSet: 'TERCEIRO SET',
    thirdSets: {
      set_normal: 'Set normal',
      super_tiebreak: 'Super tiebreak',
    },

    changeEnds: 'MUDANÇAS DE LADO',
    changeEndsOptions: {
      games_impares: 'Games ímpares',
      fin_de_set: 'Fim de set',
      nunca: 'Nunca',
    },

    formation: (team: string) => `${team} · AO SERVIR`,
    formations: {
      australiana: 'Mantém o lado',
      cambio: 'Muda de lado',
    },

    remembered: 'A app guarda isto para o próximo jogo.',
    start: 'Começar',

    history: 'Histórico',
    players: 'Jogadores',
  },

  court: {
    winner: 'Winner',
    forced: 'Forçado',
    unforced: 'Não forçado',
    winnerShort: 'W',
    forcedShort: 'EF',
    unforcedShort: 'ENF',

    fault: 'FALTA',
    double: 'DUPLA',
    ace: 'ACE',
    let: 'LET',
    firstServe: '1.º SERVIÇO',
    secondServe: '2.º SERVIÇO',
    returning: 'RECEBE',

    goldenPoint: 'PONTO DE OURO',
    goldenPointChoose: 'PONTO DE OURO — ESCOLHE QUEM RECEBE',
    boxRight: 'Direita',
    boxLeft: 'Esquerda',

    finished: 'Jogo terminado',
    home: 'Início',
    stats: 'Stats',
    undo: 'Desfazer',
  },

  history: {
    title: 'Histórico',
    search: 'Procurar jogador',
    periods: {
      '6m': '6 meses',
      '30d': '30 dias',
      '7d': '7 dias',
    },
    career: (name: string) => `Jogo de ${name}`,

    empty: 'Ainda não há jogos guardados. Joga um e aparecerá aqui.',
    emptyFiltered: 'Nenhum jogo com esses filtros.',

    points: (n: number) => `${n} pontos`,
    unfinished: 'por terminar',

    states: {
      finished: 'Terminados',
      unfinished: 'Por terminar',
    },

    deleteTitle: 'Apagar o jogo',
    deleteNote: 'Apaga-se para sempre, com todas as suas estatísticas.',
    delete: 'Apagar',
  },

  players: {
    title: 'Jogadores',
    search: 'Procurar jogador',
    empty: 'Ainda ninguém jogou. Regista um jogo e os jogadores aparecerão aqui.',
    emptyFiltered: 'Nenhum jogador com esse nome.',
    matches: (n: number) => (n === 1 ? '1 jogo' : `${n} jogos`),
    last: (date: string) => `último ${date}`,

    noMatches: 'Sem partidas',
    delete: 'Apagar jogador',
    deleteAsk: (name: string) => `Apagar ${name}?`,

    rename: 'Renomear',
    namePlaceholder: 'Nome',
    save: 'Guardar',
    cancel: 'Cancelar',

    emptyName: 'Escreve um nome.',

    mergeAsk: (existing: string, current: string) =>
      `Já existe ${existing}. É a mesma pessoa que ${current}?`,
    mergeNote: 'Os dois históricos juntam-se. Nenhum jogo é apagado.',
    merge: 'Juntar',

    playedTogether: (existing: string, current: string) =>
      `Já existe ${existing}, e jogou contra ${current}. Escolhe outro nome.`,
  },

  stats: {
    title: 'Estatísticas',
    empty: 'Ainda não se jogou nenhum ponto.',

    winners: 'Winners',
    forcedErrors: 'Erros forçados',
    unforcedErrors: 'Erros não forçados',
    forcedShort: 'E. forçados',
    unforcedShort: 'E. não forç.',
    unforcedLegend: 'E. não forçados',

    match: 'Jogo',
    playerByPlayer: 'Jogador a jogador',
    shots: 'Golpes',
    detail: 'Detalhe',
    myGame: 'O seu jogo',
    evolution: 'Evolução',
    evolutionSub: 'um jogo, uma barra',
    byShot: 'por golpe, jogo a jogo',

    pointsWon: 'Pontos ganhos',
    winnersPerError: 'Winners por erro',
    breakPoints: 'Break points',
    points: (n: number) => `${n} pontos`,
    pointsPlayed: (n: number) => `${n} pontos jogados`,

    serving: 'A SERVIR',
    returning: 'A RECEBER',
    firstServe: '1.º serviço',
    firstServeIn: '1.º serviço dentro',
    wonWithFirst: 'Ganha c/ 1.º',
    wonWithFirstLong: 'Ganha com 1.º serviço',
    wonWithSecond: 'Ganha c/ 2.º',
    aces: 'Aces',
    doubleFaults: 'Duplas faltas',
    wonReturning: 'Ganha a receber',
    acesConceded: 'Aces sofridos',
    doubleFaultsForced: 'Duplas provocadas',

    winnersOverErrors: 'W / ENF',

    matches: 'Jogos',
    won: 'Ganhos',
    lost: 'Perdidos',
    pointsShare: 'Pontos',
    unfinished: (n: number) => (n === 1 ? '1 por terminar' : `${n} por terminar`),
    allFinished: 'todos terminados',
    noMatches: 'Ainda não jogou nenhum jogo.',

    finished: 'Jogo terminado.',
    finishedEarly: 'Jogo terminado antes do tempo.',
    share: 'Partilhar',
    shareDialog: 'Partilhar o jogo',

    otherShots: 'Outros',
    noShots: 'Sem golpes registados.',
    noShotsCategory: 'Sem golpes registados nesta categoria.',
    oneMatch: 'Com um só jogo não há evolução para mostrar. Joga outro e isto enche-se.',
  },
};
