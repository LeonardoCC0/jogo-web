/**
 * CYBER NEON SLOTS - Manipulador de Rotas de API Autoritativo
 * Compatível tanto com servidor Node local (server.js) quanto Serverless da Vercel (api/index.js).
 */

const crypto = require('crypto');
const Database = require('./db');

const SYMBOLS = [
  { id: 'cherry', name: 'Cereja', icon: '🍒', weight: 26, mult3: 3, mult2: 1.0, color: '#ff3366', rarity: 'Comum' },
  { id: 'lemon', name: 'Limão', icon: '🍋', weight: 22, mult3: 5, mult2: 1.0, color: '#ffe600', rarity: 'Comum' },
  { id: 'orange', name: 'Laranja', icon: '🍊', weight: 18, mult3: 8, mult2: 1.5, color: '#ff8c00', rarity: 'Incomum' },
  { id: 'bell', name: 'Sino Dourado', icon: '🔔', weight: 14, mult3: 14, mult2: 2.0, color: '#ffd700', rarity: 'Incomum' },
  { id: 'star', name: 'Estrela Neon', icon: '⭐', weight: 10, mult3: 25, mult2: 3.0, color: '#00f0ff', rarity: 'Raro' },
  { id: 'diamond', name: 'Diamante Cyber', icon: '💎', weight: 6, mult3: 50, mult2: 5.0, color: '#00d2ff', rarity: 'Super Raro' },
  { id: 'seven', name: 'Lucky 7', icon: '7️⃣', weight: 3, mult3: 100, mult2: 8.0, color: '#ff0055', rarity: 'Épico' },
  { id: 'crown', name: 'Coroa Suprema', icon: '👑', weight: 1, mult3: 300, mult2: 15.0, color: '#ffd700', rarity: 'JACKPOT' }
];

function cleanString(str, max = 20) {
  return String(str || '')
    .replace(/[<>'";&`\\]/g, '')
    .trim()
    .slice(0, max);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, storedHash) {
  const hash = hashPassword(password, salt);
  const hashBuffer = Buffer.from(hash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (hashBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}

function getRandomSymbol() {
  const totalWeight = SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
  let rand = crypto.randomInt(0, totalWeight);

  for (const sym of SYMBOLS) {
    if (rand < sym.weight) {
      return sym;
    }
    rand -= sym.weight;
  }
  return SYMBOLS[0];
}

function evaluateSpin(symbols, betAmount) {
  const [s1, s2, s3] = symbols;

  if (s1.id === s2.id && s2.id === s3.id) {
    const multiplier = s1.mult3;
    return {
      isWin: true,
      type: s1.id === 'crown' ? 'jackpot' : (multiplier >= 15 ? 'big_win' : 'triple'),
      symbols,
      winningSymbol: s1,
      multiplier,
      winAmount: Math.round(betAmount * multiplier),
      message: s1.id === 'crown' ? '👑 JACKPOT SUPREMO! 👑' : `VITÓRIA TRIPLA: ${s1.name.toUpperCase()}!`
    };
  }

  let matchedSymbol = null;
  if (s1.id === s2.id || s1.id === s3.id) matchedSymbol = s1;
  else if (s2.id === s3.id) matchedSymbol = s2;

  if (matchedSymbol && matchedSymbol.mult2 > 0) {
    const multiplier = matchedSymbol.mult2;
    return {
      isWin: true,
      type: 'double',
      symbols,
      winningSymbol: matchedSymbol,
      multiplier,
      winAmount: Math.round(betAmount * multiplier),
      message: `PAR DE ${matchedSymbol.name.toUpperCase()}!`
    };
  }

  return {
    isWin: false,
    type: 'loss',
    symbols,
    multiplier: 0,
    winAmount: 0,
    message: 'Não foi dessa vez. Tente novamente!'
  };
}

function extractToken(req, payload) {
  const authHeader = req.headers && (req.headers['authorization'] || req.headers['Authorization']);
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers && (req.headers['x-session-token'] || req.headers['X-Session-Token']);
  if (customHeader) {
    return String(customHeader).trim();
  }
  if (payload && payload.token) {
    return String(payload.token).trim();
  }
  return null;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    balance: user.balance,
    highestWin: user.highestWin,
    score: user.score,
    createdAt: user.createdAt
  };
}

async function handleApiRequest(req, res, pathname, method, payload = {}) {
  const json = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end(JSON.stringify(data));
  };

  if (method === 'OPTIONS') {
    return json(204, {});
  }

  const db = await Database.get();

  // 1. Status / Health
  if (pathname === '/api/health' && method === 'GET') {
    return json(200, {
      status: 'online',
      cloud: Database.isCloudMode(),
      totalUsers: Object.keys(db.users || {}).length
    });
  }

  // 2. CADASTRO DE JOGADOR
  if (pathname === '/api/auth/register' && method === 'POST') {
    const rawUsername = cleanString(payload.username, 16);
    const password = String(payload.password || '');
    const avatar = cleanString(payload.avatar || '⚡', 4);

    if (!rawUsername || rawUsername.length < 3) {
      return json(400, { error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(rawUsername)) {
      return json(400, { error: 'O nome de usuário só pode conter letras, números e sublinhados.' });
    }
    if (!password || password.length < 4) {
      return json(400, { error: 'A senha deve conter pelo menos 4 caracteres.' });
    }

    const key = rawUsername.toLowerCase();
    if (db.users[key]) {
      return json(409, { error: 'Este nome de usuário já está em uso.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const userId = 'u_' + crypto.randomUUID().slice(0, 8);

    const newUser = {
      id: userId,
      username: key,
      displayName: rawUsername,
      passwordHash,
      salt,
      avatar,
      balance: 1000, // Saldo inicial concedido uma única vez no cadastro
      highestWin: 0,
      score: 1000,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    db.users[key] = newUser;

    // Gera token de sessão
    const sessionToken = crypto.randomBytes(32).toString('hex');
    db.sessions[sessionToken] = {
      userId: newUser.id,
      username: key,
      createdAt: Date.now()
    };

    await Database.save(db);

    return json(201, {
      success: true,
      token: sessionToken,
      user: sanitizeUser(newUser),
      message: 'Conta criada com sucesso! Saldo inicial de 1.000 moedas.'
    });
  }

  // 3. LOGIN DE JOGADOR
  if (pathname === '/api/auth/login' && method === 'POST') {
    const rawUsername = cleanString(payload.username, 16);
    const password = String(payload.password || '');

    if (!rawUsername || !password) {
      return json(400, { error: 'Informe o usuário e a senha.' });
    }

    const key = rawUsername.toLowerCase();
    const user = db.users[key];

    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      return json(401, { error: 'Usuário ou senha incorretos.' });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    db.sessions[sessionToken] = {
      userId: user.id,
      username: key,
      createdAt: Date.now()
    };

    await Database.save(db);

    return json(200, {
      success: true,
      token: sessionToken,
      user: sanitizeUser(user)
    });
  }

  // 4. VERIFICAÇÃO DE SESSÃO ATIVA (/api/auth/me)
  if (pathname === '/api/auth/me' && method === 'GET') {
    const token = extractToken(req, payload);
    if (!token || !db.sessions[token]) {
      return json(401, { error: 'Sessão inválida ou expirada.' });
    }

    const session = db.sessions[token];
    const user = db.users[session.username];
    if (!user) {
      delete db.sessions[token];
      await Database.save(db);
      return json(401, { error: 'Usuário não encontrado.' });
    }

    return json(200, {
      success: true,
      user: sanitizeUser(user)
    });
  }

  // 5. LOGOUT (/api/auth/logout)
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const token = extractToken(req, payload);
    if (token && db.sessions[token]) {
      delete db.sessions[token];
      await Database.save(db);
    }
    return json(200, { success: true });
  }

  // 6. GIRO AUTORITATIVO NO SERVIDOR (COM PERSISTÊNCIA REAL DE SCORE)
  if (pathname === '/api/spin' && method === 'POST') {
    const token = extractToken(req, payload);
    if (!token || !db.sessions[token]) {
      return json(401, { error: 'Você precisa estar logado para jogar.' });
    }

    const session = db.sessions[token];
    const user = db.users[session.username];
    if (!user) {
      return json(401, { error: 'Usuário não encontrado.' });
    }

    const betAmount = parseInt(payload.bet, 10);
    if (isNaN(betAmount) || betAmount < 5 || betAmount > 1000) {
      return json(400, { error: 'Valor de aposta inválido (mínimo 5, máximo 1.000).' });
    }

    if (user.balance < betAmount) {
      return json(400, { error: 'Saldo insuficiente. Você não possui moedas suficientes para esta aposta!' });
    }

    // Debita a aposta
    user.balance -= betAmount;

    // Sorteia os rolos
    const rolledSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    // Avalia o resultado
    const result = evaluateSpin(rolledSymbols, betAmount);

    // Credita ganho se houver
    if (result.isWin) {
      user.balance += result.winAmount;
      if (result.winAmount > user.highestWin) {
        user.highestWin = result.winAmount;
      }
    }

    user.score = user.balance;
    user.updatedAt = Date.now();

    await Database.save(db);

    return json(200, {
      success: true,
      outcome: {
        ...result,
        newBalance: user.balance,
        highestWin: user.highestWin,
        score: user.score
      }
    });
  }

  // 7. RANKING GLOBAL 100% REAL (SEM BOTS)
  if (pathname === '/api/leaderboard' && method === 'GET') {
    const usersList = Object.values(db.users || {});

    // Converte apenas jogadores reais cadastrados
    const leaderboard = usersList.map(u => ({
      id: u.id,
      name: u.displayName || u.username,
      avatar: u.avatar || '⚡',
      balance: u.balance,
      highestWin: u.highestWin,
      score: u.score || u.balance
    }));

    // Ordenação estritamente por pontuação / saldo e melhor vitória
    leaderboard.sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return b.highestWin - a.highestWin;
    });

    return json(200, {
      success: true,
      totalPlayers: leaderboard.length,
      leaderboard: leaderboard.slice(0, 15)
    });
  }

  // 8. BLOQUEIO DEFINITIVO DE RECARGA DE MOEDAS
  if (pathname === '/api/refill') {
    return json(403, {
      error: 'Recarga de moedas desabilitada. O jogo opera com saldo inicial estrito de 1.000 moedas por conta.'
    });
  }

  return json(404, { error: 'Rota não encontrada.' });
}

module.exports = {
  handleApiRequest,
  SYMBOLS
};
