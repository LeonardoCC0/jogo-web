/**
 * CYBER NEON SLOTS - Configurações Gerais do Jogo
 * Símbolos, pesos de probabilidade (RNG), multiplicadores e dados iniciais
 */

const CONFIG = {
  GAME_NAME: 'CYBER NEON SLOTS',
  VERSION: '1.0.0',
  
  // Moedas e Apostas Virtuais
  INITIAL_BALANCE: 1000,
  REFILL_AMOUNT: 1000,
  MIN_BET: 5,
  MAX_BET: 1000,
  DEFAULT_BET: 25,
  BET_PRESETS: [10, 25, 50, 100, 250, 500],
  
  // Timing dos Rolos (em milissegundos)
  REEL_DELAY_NORMAL: [1000, 1500, 2000],
  REEL_DELAY_TURBO: [400, 750, 1100],

  // Símbolos do Jogo
  // weight: probabilidade relativa no RNG (quanto maior, mais frequente)
  // mult3: multiplicador para 3 símbolos idênticos
  // mult2: multiplicador para 2 símbolos idênticos
  SYMBOLS: [
    {
      id: 'cherry',
      name: 'Cereja',
      icon: '🍒',
      weight: 26,
      mult3: 3,
      mult2: 1.0,
      color: '#ff3366',
      rarity: 'Comum'
    },
    {
      id: 'lemon',
      name: 'Limão',
      icon: '🍋',
      weight: 22,
      mult3: 5,
      mult2: 1.0,
      color: '#ffe600',
      rarity: 'Comum'
    },
    {
      id: 'orange',
      name: 'Laranja',
      icon: '🍊',
      weight: 18,
      mult3: 8,
      mult2: 1.5,
      color: '#ff8c00',
      rarity: 'Incomum'
    },
    {
      id: 'bell',
      name: 'Sino Dourado',
      icon: '🔔',
      weight: 14,
      mult3: 14,
      mult2: 2.0,
      color: '#ffd700',
      rarity: 'Incomum'
    },
    {
      id: 'star',
      name: 'Estrela Neon',
      icon: '⭐',
      weight: 10,
      mult3: 25,
      mult2: 3.0,
      color: '#00f0ff',
      rarity: 'Raro'
    },
    {
      id: 'diamond',
      name: 'Diamante Cyber',
      icon: '💎',
      weight: 6,
      mult3: 50,
      mult2: 5.0,
      color: '#00d2ff',
      rarity: 'Super Raro'
    },
    {
      id: 'seven',
      name: 'Lucky 7',
      icon: '7️⃣',
      weight: 3,
      mult3: 100,
      mult2: 8.0,
      color: '#ff0055',
      rarity: 'Épico'
    },
    {
      id: 'crown',
      name: 'Coroa Suprema',
      icon: '👑',
      weight: 1,
      mult3: 300,
      mult2: 15.0,
      color: '#ffd700',
      rarity: 'JACKPOT'
    }
  ],

  // Jogadores fictícios iniciais para o Ranking Global
  INITIAL_LEADERBOARD: [
    { name: 'Shadow', balance: 38450, highestWin: 5000, isCurrentPlayer: false, avatar: '🥷' },
    { name: 'Ghost', balance: 27900, highestWin: 3750, isCurrentPlayer: false, avatar: '👻' },
    { name: 'LuckyStrike', balance: 19400, highestWin: 2500, isCurrentPlayer: false, avatar: '🎲' },
    { name: 'CyberAce', balance: 14850, highestWin: 2000, isCurrentPlayer: false, avatar: '🤖' },
    { name: 'NeonValkyrie', balance: 10200, highestWin: 1500, isCurrentPlayer: false, avatar: '⚡' },
    { name: 'QuantumGambler', balance: 7600, highestWin: 1250, isCurrentPlayer: false, avatar: '🔮' },
    { name: 'PixelKing', balance: 5100, highestWin: 800, isCurrentPlayer: false, avatar: '👾' },
    { name: 'RetroRacer', balance: 3200, highestWin: 500, isCurrentPlayer: false, avatar: '🏎️' }
  ]
};

window.CONFIG = CONFIG;
