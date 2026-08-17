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
    vibora: 'Víbora',
    rulo: 'Gancho',
    volea: 'Voleio',
    chiquita: 'Chiquita',
    /** El portugues tiene el suyo, y no es el castellano: se dice "saída", no "salida". */
    salida_de_pared: 'Saída de parede',
    /** "S." de saida: "Parede" sozinha e a parede, nao o golpe que sai dela. */
    salida_pared_ofensiva: 'S. Parede ofensiva',
    salida_pared_defensiva: 'S. Parede defensiva',
    fondo: 'Fundo',
    globo: 'Globo',
    dejada: 'Dejada',
    recuperacion: 'Recuperação',
    saque: 'Saque',
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

    remembered: 'O app guarda isso para o próximo jogo.',
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

    returnRow: 'Resto',
    returnFail: 'FALHA',

    forcedByTitle: 'Quem forçou?',
    forcedByShotTitle: (name: string) => `Com que golpe é que ${name} forçou?`,
    erredByShotTitle: (name: string) => `Com que golpe é que ${name} errou?`,

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
    search: 'Procurar por jogador',
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

    backup: 'Cópia de segurança',
    export: 'Exportar',
    import: 'Importar',
    exportNote: 'Seus jogos ficam neste celular. Guarde esta cópia onde quiser.',
    imported: (n: number) => (n === 1 ? 'Adicionou-se 1 jogo.' : `Adicionaram-se ${n} jogos.`),
    importedNone: 'Não se adicionou nenhum: já os tinhas todos.',
    importedSkipped: (n: number) => (n === 1 ? '1 já estava.' : `${n} já estavam.`),
    importBad: 'Esse arquivo não é uma cópia do Vigía.',
    importFailed: 'Não foi possível ler o arquivo.',
    ok: 'Pronto',
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
    myGame: 'Jogo',
    evolution: 'Evolução',
    evolutionSub: 'um jogo, uma barra',
    blockRange: (from: number, to: number, total: number) => `Jogos ${from}-${to} de ${total}`,
    beforeAfter: 'Antes e agora',
    beforeAfterSub: (n: number) => `primeiros ${n} contra últimos ${n}`,
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
    doubleFaultsForced: 'Duplas do rival',
    returnErrorPct: 'Falha no resto',
    forcedErrorsCaused: 'Erros provocados',
    causedAgainst: 'Contra quem',
    causedWith: 'Com o quê',

    winnersOverErrors: 'W / ENF',

    matches: 'Jogos',
    won: 'Ganhos',
    lost: 'Perdidos',
    pointsShare: 'Pontos',
    unfinished: (n: number) => (n === 1 ? '1 por terminar' : `${n} por terminar`),
    allFinished: 'todos terminados',
    noMatches: 'Ainda não jogou nenhum jogo.',

    finished: 'Jogo terminado.',
    finishedEarly: 'Jogo por terminar.',
    share: 'Compartilhar',
    shareDialog: 'Compartilhar o jogo',

    otherShots: 'Outros',
    noShots: 'Dados insuficientes.',
    noShotsCategory: 'Dados insuficientes.',
    oneMatch: 'Dados insuficientes.',
    noPoints: 'Dados insuficientes.',
  },

  welcome: {
    title: 'Bem-vindo ao Vigía',
    text: 'Para saber como usar o app, entre em Ajuda.',
    help: 'Ajuda',
    close: 'Fechar',
  },

  help: {
    title: 'Ajuda',
    openLabel: 'Ajuda e ajustes',
    close: 'Fechar',

    steps: [
      {
        title: 'Você vê. O app anota.',
        text: 'É usado por alguém que está fora da quadra: o treinador, alguém do banco, um amigo.',
      },
      {
        title: 'Os quatro, na quadra',
        text: 'Cada um aparece no lugar que ocupa: quem joga de direita e quem de esquerda em cada dupla.',
      },
      {
        title: 'Quem saca primeiro',
        text: 'É sorteado, e você pode corrigir na mão. Começa sacando o de direita, no início de cada set dá para mudar.',
      },
      {
        title: 'Toca no que aconteceu no ponto',
        text: 'Winner, erro forçado ou erro não forçado. Mais nada.',
      },
      {
        title: 'E com que batida foi',
        text: 'Abre-se a folha de batidas: smash, bandeja, víbora, voleio. Configurável nesta secção.',
      },
      {
        title: 'O placar faz-se sozinho',
        text: 'Os serviços, as trocas de lado e os tie-breaks saem do regulamento.',
      },
      {
        title: 'Estatísticas de nível profissional',
        text: 'Winners, erros, aces e break points, como numa transmissão. Cada jogo fica guardado.',
      },
      {
        title: 'A evolução de cada jogador',
        text: 'Cada pessoa acumula seus jogos, e você acompanha como progride com o tempo.',
      },
      {
        title: 'Um cartão para o grupo',
        text: 'O jogo todo em uma imagem, pronta para compartilhar no WhatsApp.',
      },
    ],

    settings: 'Ajustes',
    theme: 'Tema',
    themes: { oscuro: 'Escuro', claro: 'Claro' },
    themeHints: {
      oscuro: 'Para a quadra à noite, com luz artificial.',
      claro: 'Para olhar com o sol de frente.',
    },
    privacy: 'Política de privacidade',
    contact: 'Escreve-nos',
    rate: 'Avaliar o app',
    version: 'Vigía {v}',

    startHint:
      'Para começar, toque em {icon} Jogo novo. Se deixar um jogo por terminar, você segue depois pelo Histórico.',
  },
};
