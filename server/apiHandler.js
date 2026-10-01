/**
 * CYBER NEON SLOTS - Manipulador de Rotas de API Autoritativo
 * Compatível tanto com servidor Node local (server.js) quanto Serverless da Vercel (api/index.js).
 */

const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const Database = require('./db');

const GOOGLE_CLIENT_ID = '701601557497-m4m4geq1p3oj242pnvqvg11eeld6jd1s.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const SYMBOLS = [
  { id: 'cherry', name: 'Cereja', icon: '🍒', weight: 32, mult3: 3, mult2: 1.0, color: '#ff3366', rarity: 'Comum' },
  { id: 'lemon', name: 'Limão', icon: '🍋', weight: 25, mult3: 5, mult2: 1.0, color: '#ffe600', rarity: 'Comum' },
  { id: 'orange', name: 'Laranja', icon: '🍊', weight: 18, mult3: 8, mult2: 1.5, color: '#ff8c00', rarity: 'Incomum' },
  { id: 'bell', name: 'Sino Dourado', icon: '🔔', weight: 12, mult3: 14, mult2: 2.0, color: '#ffd700', rarity: 'Incomum' },
  { id: 'star', name: 'Estrela Neon', icon: '⭐', weight: 7, mult3: 25, mult2: 3.0, color: '#00f0ff', rarity: 'Raro' },
  { id: 'diamond', name: 'Diamante Cyber', icon: '💎', weight: 3, mult3: 50, mult2: 5.0, color: '#00d2ff', rarity: 'Super Raro' },
  { id: 'seven', name: 'Lucky 7', icon: '7️⃣', weight: 2, mult3: 100, mult2: 8.0, color: '#ff0055', rarity: 'Épico' },
  { id: 'crown', name: 'Coroa Suprema', icon: '👑', weight: 1, mult3: 300, mult2: 15.0, color: '#ffd700', rarity: 'JACKPOT' }
];

async function verifyGoogleIdToken(token) {
  // Suporte a mock controlado apenas em ambiente de teste automatizado
  if (process.env.NODE_ENV === 'test' && token && token.startsWith('mock_google_token_')) {
    const sub = token.replace('mock_google_token_', '');
    return {
      sub,
      email: `user_${sub}@gmail.com`,
      name: `Google User ${sub}`,
      picture: '⚡',
      email_verified: true,
      iss: 'https://accounts.google.com',
      aud: GOOGLE_CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 3600
    };
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error('Payload do Google não contém o identificador do usuário (sub).');
  }

  // Validação de emissor (issuer)
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    throw new Error('Emissor (issuer) do token do Google inválido.');
  }

  // Validação de audience (Client ID)
  if (payload.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Audience do token do Google não corresponde ao Client ID da aplicação.');
  }

  // Validação de expiração
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('Token do Google expirado.');
  }

  return payload;
}

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

const FOUNDER_EMAIL = '47131@raphaeldisanto.com.br';

function isFounderUser(user) {
  if (!user) return false;
  if (user.role === 'founder') return true;
  if (user.email && user.email.toLowerCase() === FOUNDER_EMAIL) return true;
  if (user.username && user.username.toLowerCase() === FOUNDER_EMAIL) return true;
  return false;
}

function ensureFounderRole(user) {
  if (user && isFounderUser(user)) {
    user.role = 'founder';
    user.isBanned = false;
  }
}

function getAuthenticatedUser(req, payload, db) {
  const token = extractToken(req, payload);
  if (!token || !db.sessions || !db.sessions[token]) return null;
  const session = db.sessions[token];
  const user = db.users && db.users[session.username];
  if (!user) {
    delete db.sessions[token];
    return null;
  }
  ensureFounderRole(user);
  return { user, token };
}

function sanitizeUser(user) {
  ensureFounderRole(user);
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email || '',
    avatar: user.avatar,
    balance: user.balance,
    highestWin: user.highestWin,
    score: user.score,
    role: user.role || 'user',
    isBanned: !!user.isBanned,
    banReason: user.banReason || '',
    bannedAt: user.bannedAt || null,
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
    const rawUsername = cleanString(payload.username, 32);
    const password = String(payload.password || '');
    const avatar = cleanString(payload.avatar || '⚡', 4);
    const email = cleanString(payload.email || '', 60).toLowerCase();

    if (!rawUsername || rawUsername.length < 3) {
      return json(400, { error: 'O nome de usuário deve ter pelo menos 3 caracteres.' });
    }
    if (!/^[a-zA-Z0-9_@.-]+$/.test(rawUsername)) {
      return json(400, { error: 'O nome de usuário contém caracteres inválidos.' });
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

    const isFounder = (key === FOUNDER_EMAIL || email === FOUNDER_EMAIL);

    const newUser = {
      id: userId,
      username: key,
      displayName: rawUsername,
      email: isFounder ? FOUNDER_EMAIL : email,
      role: isFounder ? 'founder' : 'user',
      isBanned: false,
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
    const rawUsername = cleanString(payload.username, 32);
    const password = String(payload.password || '');

    if (!rawUsername || !password) {
      return json(400, { error: 'Informe o usuário e a senha.' });
    }

    const key = rawUsername.toLowerCase();
    const user = db.users[key];

    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      return json(401, { error: 'Usuário ou senha incorretos.' });
    }

    ensureFounderRole(user);

    if (user.isBanned || user.role === 'banned') {
      return json(403, { 
        error: `Sua conta foi banida. Motivo: ${user.banReason || 'Violação das diretrizes do jogo.'}` 
      });
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

  // 3.5 AUTENTICAÇÃO COM GOOGLE (/api/auth/google)
  if (pathname === '/api/auth/google' && method === 'POST') {
    const token = payload && payload.token ? String(payload.token).trim() : '';

    if (!token) {
      return json(400, { error: 'Token de autenticação do Google não fornecido.' });
    }

    let gPayload;
    try {
      gPayload = await verifyGoogleIdToken(token);
    } catch (err) {
      console.warn('Falha na validação do Google ID Token:', err.message);
      return json(401, { error: 'Token do Google inválido ou expirado: ' + err.message });
    }

    if (!gPayload || !gPayload.sub) {
      return json(401, { error: 'Dados do Google inválidos (sub ausente).' });
    }

    const googleSub = String(gPayload.sub);
    const googleEmail = String(gPayload.email || '').toLowerCase().trim();
    const googleName = String(gPayload.name || gPayload.given_name || '').trim();
    const googleAvatar = gPayload.picture || '⚡';

    // 1. Identificar usuário pelo Google sub (ID único do Google)
    let user = Object.values(db.users).find(u => u.googleId === googleSub);

    // 2. Se não encontrou por googleId, verificar se já existe conta pelo email para vincular
    if (!user && googleEmail) {
      user = Object.values(db.users).find(u => u.email && u.email.toLowerCase() === googleEmail);
      if (user) {
        user.googleId = googleSub;
        if (googleAvatar && googleAvatar.startsWith('http')) {
    user.avatar = googleAvatar;
        }
      }
      if (googleAvatar && googleAvatar.startsWith('http')) {
    user.avatar = googleAvatar;
      }
    }

    // 3. Se ainda não existir, criar a conta automaticamente
    if (!user) {
      const userId = 'u_g_' + crypto.randomUUID().slice(0, 8);
      let baseUsername = (gPayload.given_name || googleName || (googleEmail ? googleEmail.split('@')[0] : ''))
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 12);
      if (!baseUsername || baseUsername.length < 3) {
        baseUsername = 'player';
      }

      let candidateKey = baseUsername.toLowerCase();
      let counter = 1;
      while (db.users[candidateKey]) {
        candidateKey = `${baseUsername.toLowerCase().slice(0, 8)}_${counter}`;
        counter++;
      }

      const isFounder = (googleEmail === FOUNDER_EMAIL);

      user = {
        id: userId,
        googleId: googleSub,
        email: googleEmail,
        username: candidateKey,
        displayName: cleanString(googleName, 16) || candidateKey,
        avatar: googleAvatar,
        role: isFounder ? 'founder' : 'user',
        isBanned: false,
        balance: 1000, // Saldo inicial concedido uma única vez
        highestWin: 0,
        score: 1000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      db.users[candidateKey] = user;
    } else {
      // Usuário existente:
      // NÃO resetar saldo, NÃO criar 2ª conta, manter highestWin e score
      ensureFounderRole(user);
      if (googleEmail === FOUNDER_EMAIL) {
        user.role = 'founder';
        user.isBanned = false;
      }
      user.updatedAt = Date.now();
      if (googleName && (!user.displayName || user.displayName === user.username)) {
        user.displayName = cleanString(googleName, 16);
      }
    }

    if (user.isBanned || user.role === 'banned') {
      return json(403, { 
        error: `Sua conta foi banida. Motivo: ${user.banReason || 'Violação das regras do jogo.'}` 
      });
    }

    // Gera token de sessão unificado (idêntico ao login por senha)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    db.sessions[sessionToken] = {
      userId: user.id,
      username: user.username,
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
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) {
      return json(401, { error: 'Sessão inválida ou expirada.' });
    }

    const { user, token } = auth;
    if (user.isBanned || user.role === 'banned') {
      delete db.sessions[token];
      await Database.save(db);
      return json(403, { 
        error: `Sua conta foi banida. Motivo: ${user.banReason || 'Violação das regras do jogo.'}` 
      });
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
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) {
      return json(401, { error: 'Você precisa estar logado para jogar.' });
    }

    const { user } = auth;
    if (user.isBanned || user.role === 'banned') {
      return json(403, { error: 'Sua conta está banida e não pode realizar apostas.' });
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

    if (typeof db.total_spins !== 'number') db.total_spins = 0;
    db.total_spins += 1;

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

  // 6.5 RESET DE SALDO
  // type "punishment" (500 moedas): só é permitido quando o saldo já chegou a zero.
  // type "voluntary" (1000 moedas): o jogador pode reiniciar o progresso quando quiser.
  if (pathname === '/api/reset' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) {
      return json(401, { error: 'Você precisa estar logado para resetar o saldo.' });
    }

    const { user } = auth;
    if (user.isBanned || user.role === 'banned') {
      return json(403, { error: 'Sua conta está banida.' });
    }

    const resetType = payload.type === 'voluntary' ? 'voluntary' : 'punishment';

    if (resetType === 'punishment') {
      if (user.balance > 0) {
        return json(400, { error: 'O reset por punição só é permitido quando o saldo chega a zero.' });
      }
      user.balance = 500;
    } else {
      user.balance = 1000;
    }

    user.score = user.balance;
    user.updatedAt = Date.now();

    await Database.save(db);

    return json(200, {
      success: true,
      balance: user.balance
    });
  }

  // 7. RANKING GLOBAL 100% REAL (SEM BOTS)
  if (pathname === '/api/leaderboard' && method === 'GET') {
    const usersList = Object.values(db.users || {});

    const leaderboard = usersList.map(u => ({
        id: u.id,
        name: u.displayName || u.username,
        avatar: u.avatar || '⚡',
        balance: u.balance,
        highestWin: u.highestWin,
        score: u.score || u.balance
    }));

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

  // 9. ROTAS ADMINISTRATIVAS PROTEGIDAS NO BACKEND (/api/admin/*)
  if (pathname.startsWith('/api/admin/')) {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) {
      return json(401, { error: 'Acesso não autorizado: sessão inválida ou token ausente.' });
    }

    const { user: adminUser } = auth;
    if (adminUser.isBanned || adminUser.role === 'banned') {
      return json(403, { error: 'Acesso negado: sua conta foi banida.' });
    }

    const isFounder = adminUser.role === 'founder' || isFounderUser(adminUser);
    const isAdmin = isFounder || adminUser.role === 'admin';

    if (!isAdmin) {
      return json(403, { error: 'Acesso negado: privilégios administrativos insuficientes.' });
    }

    // 9.1 Validação de Sessão Administrativa (/api/admin/check)
    if (pathname === '/api/admin/check' && method === 'GET') {
      return json(200, {
        success: true,
        role: isFounder ? 'founder' : 'admin',
        isFounder,
        user: sanitizeUser(adminUser)
      });
    }

    // 9.2 Métricas do Dashboard (/api/admin/stats)
    if (pathname === '/api/admin/stats' && method === 'GET') {
      const allUsers = Object.values(db.users || {});
      const totalBalance = allUsers.reduce((sum, u) => sum + (parseInt(u.balance, 10) || 0), 0);
      const totalAdmins = allUsers.filter(u => u.role === 'admin' || isFounderUser(u)).length;
      const totalBanned = allUsers.filter(u => u.isBanned || u.role === 'banned').length;

      return json(200, {
        success: true,
        stats: {
          totalUsers: allUsers.length,
          totalAdmins,
          totalBanned,
          totalBalance,
          totalSpins: db.total_spins || 0,
          serverStatus: 'online',
          cloudMode: Database.isCloudMode()
        }
      });
    }

    // 9.3 Listagem de Jogadores (/api/admin/users)
    if (pathname === '/api/admin/users' && method === 'GET') {
      const search = cleanString(payload.search || req.headers['x-search'] || '', 50).toLowerCase();
      let users = Object.values(db.users || {});

      if (search) {
        users = users.filter(u =>
          (u.username && u.username.toLowerCase().includes(search)) ||
          (u.displayName && u.displayName.toLowerCase().includes(search)) ||
          (u.email && u.email.toLowerCase().includes(search)) ||
          (u.id && u.id.toLowerCase().includes(search))
        );
      }

      // Ordenação: Fundador primeiro, depois Admins, depois por saldo decrescente
      users.sort((a, b) => {
        if (isFounderUser(a)) return -1;
        if (isFounderUser(b)) return 1;
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (b.role === 'admin' && a.role !== 'admin') return 1;
        return (b.balance || 0) - (a.balance || 0);
      });

      return json(200, {
        success: true,
        total: users.length,
        users: users.map(u => sanitizeUser(u))
      });
    }

    // 9.4 Alterar Saldo de Jogador (/api/admin/users/balance)
    if (pathname === '/api/admin/users/balance' && method === 'POST') {
      const targetId = String(payload.targetId || '').trim();
      const mode = payload.mode === 'set' ? 'set' : 'add';
      const amount = parseInt(payload.amount, 10);
      const reason = cleanString(payload.reason, 120);

      if (!targetId) {
        return json(400, { error: 'Identificador do jogador não informado.' });
      }
      if (isNaN(amount)) {
        return json(400, { error: 'Valor de saldo inválido.' });
      }
      if (!reason || reason.length < 3) {
        return json(400, { error: 'O motivo da alteração de saldo é obrigatório (mínimo 3 caracteres).' });
      }

      const target = Object.values(db.users || {}).find(u => u.id === targetId || u.username === targetId.toLowerCase());
      if (!target) {
        return json(404, { error: 'Jogador não encontrado.' });
      }

      // Proteção: Fundador não pode ter saldo alterado por outros administradores
      if (isFounderUser(target) && !isFounder) {
        return json(403, { error: 'A conta fundadora é protegida e seu saldo não pode ser alterado por outros administradores.' });
      }

      // Proteção: Ninguém (incluindo o founder) pode alterar o próprio saldo via API admin
      if (target.id === adminUser.id) {
        return json(403, { error: 'Você não pode alterar o próprio saldo pela API administrativa.' });
      }

      const prevBalance = target.balance || 0;
      let newBalance = mode === 'set' ? amount : prevBalance + amount;

      if (newBalance < 0) {
        return json(400, { error: 'O saldo resultante não pode ser negativo.' });
      }
      if (newBalance > 100000000) {
        return json(400, { error: 'O saldo resultante não pode ultrapassar o limite seguro de 100.000.000 moedas.' });
      }

      target.balance = newBalance;
      target.score = newBalance;
      target.updatedAt = Date.now();

      // Registro de Auditoria Obrigatório
      if (!db.admin_logs) db.admin_logs = [];
      const logEntry = {
        id: 'log_' + crypto.randomUUID().slice(0, 8),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'balance_change',
        targetUserId: target.id,
        targetUsername: target.displayName || target.username,
        saldoAnterior: prevBalance,
        saldoNovo: newBalance,
        diferenca: newBalance - prevBalance,
        motivo: reason,
        timestamp: Date.now()
      };
      db.admin_logs.unshift(logEntry);

      await Database.save(db);

      return json(200, {
        success: true,
        user: sanitizeUser(target),
        log: logEntry
      });
    }

    // 9.5 Banir Jogador (/api/admin/users/ban)
    if (pathname === '/api/admin/users/ban' && method === 'POST') {
      const targetId = String(payload.targetId || '').trim();
      const reason = cleanString(payload.reason, 120);

      if (!targetId) {
        return json(400, { error: 'Identificador do jogador não informado.' });
      }
      if (!reason || reason.length < 3) {
        return json(400, { error: 'Informe o motivo do banimento (mínimo 3 caracteres).' });
      }

      const target = Object.values(db.users || {}).find(u => u.id === targetId || u.username === targetId.toLowerCase());
      if (!target) {
        return json(404, { error: 'Jogador não encontrado.' });
      }

      // Proteção absoluta da conta fundadora
      if (isFounderUser(target)) {
        return json(403, { error: 'A conta fundadora é protegida e NUNCA pode ser banida.' });
      }

      // Não banir a si próprio
      if (target.id === adminUser.id) {
        return json(400, { error: 'Você não pode banir a sua própria conta.' });
      }

      // Apenas o Fundador pode banir outro administrador
      if (target.role === 'admin' && !isFounder) {
        return json(403, { error: 'Apenas o Fundador possui permissão para banir administradores.' });
      }

      target.isBanned = true;
      target.role = 'banned';
      target.banReason = reason;
      target.bannedAt = Date.now();
      target.updatedAt = Date.now();

      // Invalidação imediata de todas as sessões ativas do usuário banido
      for (const [sToken, sData] of Object.entries(db.sessions || {})) {
        if (sData.username === target.username || sData.userId === target.id) {
          delete db.sessions[sToken];
        }
      }

      // Registro de Auditoria
      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID().slice(0, 8),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'user_banned',
        targetUserId: target.id,
        targetUsername: target.displayName || target.username,
        motivo: reason,
        timestamp: Date.now()
      });

      await Database.save(db);

      return json(200, {
        success: true,
        message: `Jogador ${target.displayName || target.username} foi banido com sucesso.`,
        user: sanitizeUser(target)
      });
    }

    // 9.6 Desbanir Jogador (/api/admin/users/unban)
    if (pathname === '/api/admin/users/unban' && method === 'POST') {
      const targetId = String(payload.targetId || '').trim();
      const target = Object.values(db.users || {}).find(u => u.id === targetId || u.username === targetId.toLowerCase());
      if (!target) {
        return json(404, { error: 'Jogador não encontrado.' });
      }

      target.isBanned = false;
      target.role = 'user';
      delete target.banReason;
      delete target.bannedAt;
      target.updatedAt = Date.now();

      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID().slice(0, 8),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'user_unbanned',
        targetUserId: target.id,
        targetUsername: target.displayName || target.username,
        motivo: 'Desbanimento administrativo',
        timestamp: Date.now()
      });

      await Database.save(db);

      return json(200, {
        success: true,
        message: `Jogador ${target.displayName || target.username} foi desbanido.`,
        user: sanitizeUser(target)
      });
    }

    // 9.7 Remover Conta de Jogador com Confirmação Forte (/api/admin/users/delete)
    if (pathname === '/api/admin/users/delete' && method === 'POST') {
      const targetId = String(payload.targetId || '').trim();
      const confirmUsername = String(payload.confirmUsername || '').trim();

      const target = Object.values(db.users || {}).find(u => u.id === targetId || u.username === targetId.toLowerCase());
      if (!target) {
        return json(404, { error: 'Jogador não encontrado.' });
      }

      if (isFounderUser(target)) {
        return json(403, { error: 'A conta fundadora é protegida e NUNCA pode ser removida.' });
      }

      if (target.id === adminUser.id) {
        return json(400, { error: 'Você não pode excluir sua própria conta pelo painel.' });
      }

      if (target.role === 'admin' && !isFounder) {
        return json(403, { error: 'Apenas o Fundador pode remover contas de administradores.' });
      }

      if (confirmUsername.toLowerCase() !== target.username.toLowerCase()) {
        return json(400, { error: `Confirmação incorreta. Digite exatamente o username "${target.username}" para confirmar a exclusão.` });
      }

      // Limpeza de sessões e dados do usuário
      for (const [sToken, sData] of Object.entries(db.sessions || {})) {
        if (sData.username === target.username || sData.userId === target.id) {
          delete db.sessions[sToken];
        }
      }
      delete db.users[target.username];

      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID().slice(0, 8),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'user_deleted',
        targetUserId: target.id,
        targetUsername: target.displayName || target.username,
        motivo: cleanString(payload.reason || 'Remoção permanente de conta', 120),
        timestamp: Date.now()
      });

      await Database.save(db);

      return json(200, {
        success: true,
        message: `A conta de ${target.displayName || target.username} foi removida permanentemente.`
      });
    }

    // 9.8 Promover a Administrador (EXCLUSIVO FOUNDER) (/api/admin/admins/promote)
    if (pathname === '/api/admin/admins/promote' && method === 'POST') {
      if (!isFounder) {
        return json(403, { error: 'Apenas o Fundador possui permissão para promover novos administradores.' });
      }

      const targetId = String(payload.targetId || '').trim();
      const target = Object.values(db.users || {}).find(u => u.id === targetId || u.username === targetId.toLowerCase());
      if (!target) {
        return json(404, { error: 'Jogador não encontrado.' });
      }

      if (target.isBanned) {
        return json(400, { error: 'Não é possível promover um jogador banido.' });
      }

      if (isFounderUser(target)) {
        return json(400, { error: 'Este usuário já é o Fundador.' });
      }

      target.role = 'admin';
      target.updatedAt = Date.now();

      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID().slice(0, 8),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'admin_promoted',
        targetUserId: target.id,
        targetUsername: target.displayName || target.username,
        motivo: 'Promovido a Administrador pelo Fundador',
        timestamp: Date.now()
      });

      await Database.save(db);

      return json(200, {
        success: true,
        message: `${target.displayName || target.username} agora é Administrador.`,
        user: sanitizeUser(target)
      });
    }

    // 9.9 Revogar Administrador (EXCLUSIVO FOUNDER) (/api/admin/admins/demote)
    if (pathname === '/api/admin/admins/demote' && method === 'POST') {
      if (!isFounder) {
        return json(403, { error: 'Apenas o Fundador possui permissão para gerenciar administradores.' });
      }

      const targetId = String(payload.targetId || '').trim();
      const target = Object.values(db.users || {}).find(u => u.id === targetId || u.username === targetId.toLowerCase());
      if (!target) {
        return json(404, { error: 'Jogador não encontrado.' });
      }

      if (isFounderUser(target)) {
        return json(403, { error: 'O Fundador não pode revogar seus próprios privilégios.' });
      }

      target.role = 'user';
      target.updatedAt = Date.now();

      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID().slice(0, 8),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'admin_demoted',
        targetUserId: target.id,
        targetUsername: target.displayName || target.username,
        motivo: 'Privilégio de Administrador revogado pelo Fundador',
        timestamp: Date.now()
      });

      await Database.save(db);

      return json(200, {
        success: true,
        message: `Privilégio de Administrador revogado de ${target.displayName || target.username}.`,
        user: sanitizeUser(target)
      });
    }

    // 9.10 Logs de Auditoria (/api/admin/logs)
    if (pathname === '/api/admin/logs' && method === 'GET') {
      const logs = db.admin_logs || [];
      const filtered = isFounder ? logs : logs.filter(l => l.action !== 'admin_promoted' && l.action !== 'admin_demoted');

      return json(200, {
        success: true,
        logs: filtered.slice(0, 100)
      });
    }

    return json(404, { error: 'Rota administrativa não encontrada.' });
  }

  return json(404, { error: 'Rota não encontrada.' });
}

module.exports = {
  handleApiRequest,
  SYMBOLS
};