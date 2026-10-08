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

// =========================================================================
// MOTOR DE BLACKJACK AUTORITATIVO (COSTA BLACKJACK 21)
// =========================================================================
const BJ_SUITS = ['♠', '♥', '♦', '♣'];
const BJ_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createBlackjackShoe(deckCount = 6) {
  const shoe = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of BJ_SUITS) {
      for (const value of BJ_VALUES) {
        shoe.push({
          suit,
          value,
          color: ['♥', '♦'].includes(suit) ? 'red' : 'black'
        });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

function calculateHandValue(cards) {
  if (!cards || !cards.length) return { total: 0, isSoft: false, isBust: false, isBlackjack: false };
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.hidden) continue;
    if (card.value === 'A') {
      aces++;
      total += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      total += 10;
    } else {
      total += parseInt(card.value, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return {
    total,
    isSoft: aces > 0,
    isBust: total > 21,
    isBlackjack: cards.length === 2 && total === 21
  };
}

function drawBlackjackCard(db) {
  if (!db.bj_shoe || !Array.isArray(db.bj_shoe) || db.bj_shoe.length < 15) {
    db.bj_shoe = createBlackjackShoe(6);
  }
  return db.bj_shoe.pop();
}

function formatBlackjackState(session, revealDealer = false) {
  const dealerCards = session.dealerCards.map((c, idx) => {
    if (idx === 1 && !revealDealer) return { hidden: true, suit: '?', value: '?' };
    return c;
  });
  const dealerValue = calculateHandValue(dealerCards);

  const formattedHands = session.playerHands.map((h, idx) => {
    const val = calculateHandValue(h.cards);
    return {
      cards: h.cards,
      bet: h.bet,
      doubled: !!h.doubled,
      status: h.status,
      value: val.total,
      isSoft: val.isSoft,
      isBust: val.isBust,
      isBlackjack: val.isBlackjack,
      isActive: session.status === 'playing' && session.activeHandIndex === idx,
      result: h.result || null,
      payout: h.payout || 0
    };
  });

  const activeHand = session.playerHands[session.activeHandIndex] || session.playerHands[0];
  const activeVal = calculateHandValue(activeHand ? activeHand.cards : []);

  return {
    id: session.id,
    status: session.status,
    activeHandIndex: session.activeHandIndex,
    playerHands: formattedHands,
    dealerCards,
    dealerValue: dealerValue.total,
    dealerIsSoft: dealerValue.isSoft,
    dealerIsBust: dealerValue.isBust,
    dealerIsBlackjack: dealerValue.isBlackjack,
    canHit: session.status === 'playing' && !activeVal.isBust && activeVal.total < 21,
    canStand: session.status === 'playing',
    canDouble: session.status === 'playing' && activeHand && activeHand.cards.length === 2 && !activeHand.doubled,
    canSplit: session.status === 'playing' && session.playerHands.length === 1 && activeHand && activeHand.cards.length === 2 && (activeHand.cards[0].value === activeHand.cards[1].value || (['10','J','Q','K'].includes(activeHand.cards[0].value) && ['10','J','Q','K'].includes(activeHand.cards[1].value))),
    canInsurance: session.status === 'playing' && !session.insuranceBet && session.dealerCards[0] && session.dealerCards[0].value === 'A',
    insuranceBet: session.insuranceBet || 0,
    insuranceWon: session.insuranceWon || false,
    insurancePayout: session.insurancePayout || 0,
    totalPayout: session.totalPayout || 0,
    message: session.message || ''
  };
}

function resolveBlackjackDealer(session, db, user) {
  let dVal = calculateHandValue(session.dealerCards);
  const allBusted = session.playerHands.every(h => calculateHandValue(h.cards).isBust);
  if (!allBusted) {
    while (dVal.total < 17) {
      session.dealerCards.push(drawBlackjackCard(db));
      dVal = calculateHandValue(session.dealerCards);
    }
  }

  session.status = 'resolved';
  let totalPayout = 0;

  if (session.insuranceBet > 0 && dVal.isBlackjack) {
    const insWin = session.insuranceBet * 3;
    totalPayout += insWin;
    session.insuranceWon = true;
    session.insurancePayout = insWin;
  }

  for (const hand of session.playerHands) {
    const pVal = calculateHandValue(hand.cards);
    if (pVal.isBust) {
      hand.status = 'bust';
      hand.result = 'bust';
      hand.payout = 0;
    } else if (dVal.isBust) {
      hand.status = 'win';
      hand.result = 'dealer_bust';
      hand.payout = hand.bet * 2;
      totalPayout += hand.payout;
    } else if (pVal.total > dVal.total) {
      hand.status = 'win';
      hand.result = 'win';
      hand.payout = hand.bet * 2;
      totalPayout += hand.payout;
    } else if (pVal.total === dVal.total) {
      hand.status = 'push';
      hand.result = 'push';
      hand.payout = hand.bet;
      totalPayout += hand.payout;
    } else {
      hand.status = 'loss';
      hand.result = 'loss';
      hand.payout = 0;
    }
  }

  session.totalPayout = totalPayout;
  if (totalPayout > 0) {
    user.balance += totalPayout;
    if (totalPayout > user.highestWin) user.highestWin = totalPayout;
  }
  user.score = user.balance;
  user.updatedAt = Date.now();

  const wins = session.playerHands.filter(h => ['win', 'dealer_bust'].includes(h.result)).length;
  const pushes = session.playerHands.filter(h => h.result === 'push').length;

  if (dVal.isBust) {
    session.message = `Dealer estourou com ${dVal.total}! Você venceu!`;
  } else if (wins > 0 && pushes === 0 && session.playerHands.length === 1) {
    session.message = `Vitória! ${calculateHandValue(session.playerHands[0].cards).total} vs ${dVal.total} do dealer.`;
  } else if (pushes > 0 && wins === 0) {
    session.message = `Empate (Push)! Moedas devolvidas.`;
  } else if (wins > 0) {
    session.message = `Fim da rodada com lucro!`;
  } else {
    session.message = `Dealer vence com ${dVal.total}. Boa sorte na próxima!`;
  }

  if (db.bj_sessions) delete db.bj_sessions[user.id];
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
  const cookie = (req.headers?.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('cns_session='));
  return cookie ? cookie.slice(12) : null;
}

const FOUNDER_EMAIL = '47131@raphaeldisanto.com.br';
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const { AsyncLocalStorage } = require('async_hooks');
const founderContext = new AsyncLocalStorage();

function isFounderUser(user) {
  return !!user && user.id === founderContext.getStore()?.founderId;
}

function ensureFounderRole(user) {
  if (user && isFounderUser(user)) {
    user.role = 'founder';
    user.isBanned = false;
  } else if (user?.role === 'founder') user.role = 'user';
}

function getAuthenticatedUser(req, payload, db) {
  const token = extractToken(req, payload);
  if (!token || !db.sessions || !db.sessions[token]) return null;
  const session = db.sessions[token];
  const user = db.users && db.users[session.username];
  if (!user || session.userId !== user.id || !Number.isFinite(session.createdAt) || session.createdAt + SESSION_TTL <= Date.now()) {
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
    needsProfile: !!user.needsProfile,
    createdAt: user.createdAt
  };
}

function sessionCookie(req, token) {
  const secure = process.env.VERCEL || req.socket?.encrypted || process.env.COOKIE_SECURE === 'true';
  return `cns_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? SESSION_TTL / 1000 : 0}${secure ? '; Secure' : ''}`;
}

function requireAuth(req, payload, db) {
  const auth = getAuthenticatedUser(req, payload, db);
  if (!auth) return { status: 401, error: 'Sessão inválida ou expirada.' };
  if (auth.user.isBanned || auth.user.role === 'banned') return { status: 403, error: `Conta banida. Motivo: ${auth.user.banReason || 'Violação das regras.'}` };
  return auth;
}

function requireAdmin(req, payload, db) {
  const auth = requireAuth(req, payload, db);
  if (auth.error) return auth;
  if (!['admin', 'founder'].includes(auth.user.role)) return { status: 403, error: 'Acesso negado.' };
  return auth;
}

async function routeRequest(req, res, pathname, method, payload = {}) {
  const json = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(data.token ? { 'Set-Cookie': sessionCookie(req, data.token) } : {}),
      ...(pathname === '/api/auth/logout' ? { 'Set-Cookie': sessionCookie(req, '') } : {}),
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end(JSON.stringify(data));
  };

  if (method === 'OPTIONS') {
    return json(204, {});
  }

  const db = await Database.get();
  // Garante a estrutura mínima do banco antes de qualquer rota.
  db.users ||= {};
  db.sessions ||= {};
  db.history ||= [];
  db.admin_logs ||= [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json(400, { error: 'Corpo inválido.' });
  if (method !== 'GET' && req.headers?.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return json(403, { error: 'Origem não autorizada.' }); }
    catch { return json(403, { error: 'Origem inválida.' }); }
  }
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/auth/')) {
    const token = extractToken(req, payload);
    const session = token && db.sessions[token];
    const identity = session?.userId || req.socket?.remoteAddress || 'anonymous';
    const key = crypto.createHash('sha256').update(identity + (pathname.startsWith('/api/admin') ? ':admin' : ':auth')).digest('hex');
    db.rateLimits ||= {};
    for (const [k, entry] of Object.entries(db.rateLimits)) if (entry.until <= Date.now()) delete db.rateLimits[k];
    const limit = db.rateLimits[key] ||= { count: 0, until: Date.now() + 60000 };
    if (++limit.count > (session ? 120 : 30)) { await Database.save(db); return json(429, { error: 'Muitas tentativas. Aguarde um minuto.' }); }
    await Database.save(db);
  }

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
    const userId = 'u_' + crypto.randomUUID();

    if (key === FOUNDER_EMAIL || email === FOUNDER_EMAIL) return json(403, { error: 'A conta fundadora exige identidade verificada. Utilize Google ou a conta configurada no servidor.' });
    const isFounder = false;

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

    if (!user || !user.salt || !user.passwordHash || !verifyPassword(password, user.salt, user.passwordHash)) {
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
      return json(401, { error: 'Token do Google inválido ou expirado.' });
    }

    if (!gPayload || !gPayload.sub || gPayload.email_verified !== true) {
      return json(401, { error: 'Dados do Google inválidos (sub ausente).' });
    }

    const googleSub = String(gPayload.sub);
    const googleEmail = String(gPayload.email || '').toLowerCase().trim();
    const googleName = String(gPayload.name || gPayload.given_name || '').trim();
    const googleAvatar = typeof gPayload.picture === 'string' && /^https:\/\//.test(gPayload.picture)
      ? gPayload.picture
      : '⚡';

    // 1. Identificar usuário pelo Google sub (ID único do Google).
    // Filtra entradas inválidas para impedir que um registro quebrado do db.json
    // interrompa o login de uma conta nova.
    let user = Object.values(db.users).find(u =>
      u && typeof u === 'object' && String(u.googleId || '') === googleSub
    );

    // 2. Se não encontrou por googleId, verificar se já existe conta pelo email.
    if (!user && googleEmail) {
      const existing = Object.values(db.users).find(u =>
        u && typeof u === 'object' && String(u.email || '').toLowerCase() === googleEmail
      );

      if (existing) {
        // Se a conta já existe por senha, não sobrescreva nem crie outra conta.
        // Só vincula automaticamente quando ela já estiver autenticada.
        const auth = requireAuth(req, {}, db);
        if (auth.error || auth.user.id !== existing.id) {
          return json(409, {
            error: 'Este e-mail já possui uma conta. Entre nela primeiro para vincular o Google.'
          });
        }
        if (existing.googleId && existing.googleId !== googleSub) {
          return json(409, { error: 'Esta conta já está vinculada a outro Google.' });
        }
        user = existing;
        user.googleId = googleSub;
      }
    }

    // 3. Se ainda não existir, criar a conta automaticamente.
    if (!user) {
      const userId = 'u_g_' + crypto.randomUUID();
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

      const isFounder = false;

      user = {
        id: userId,
        googleId: googleSub,
        needsProfile: true,
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
      // Usuário existente: preservar saldo, score e maior vitória.
      ensureFounderRole(user);
      user.updatedAt = Date.now();
    }

    // Defesa final: o fluxo acima sempre deve produzir um usuário.
    // Se o db.json estiver inconsistente, retorne um erro explicativo em vez
    // de gerar TypeError em user.avatar.
    if (!user || typeof user !== 'object' || !user.id || !user.username) {
      console.error('Google login: usuário não pôde ser localizado/criado.', {
        googleSub,
        googleEmail
      });
      return json(500, { error: 'Não foi possível criar ou localizar sua conta.' });
    }

    if (user.isBanned || user.role === 'banned') {
      return json(403, {
        error: `Sua conta foi banida. Motivo: ${user.banReason || 'Violação das regras do jogo.'}`
      });
    }

    if (user.avatarSource !== 'upload') user.avatar = googleAvatar;

    // Para domínio externo, Google só é autoridade quando há Workspace (hd).
    if (!db.founderId && googleEmail === FOUNDER_EMAIL && gPayload.hd === 'raphaeldisanto.com.br') {
      db.founderId = user.id;
      const context = founderContext.getStore();
      if (context) context.founderId = user.id;
      for (const [key, session] of Object.entries(db.sessions)) if (session.userId === user.id) delete db.sessions[key];
    }
    ensureFounderRole(user);

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
      token,
      user: sanitizeUser(user)
    });
  }

  if (pathname === '/api/profile' && method === 'POST') {
    const auth = requireAuth(req, payload, db);
    if (auth.error) return json(auth.status, { error: auth.error });
    if (Object.keys(payload).some(k => !['displayName', 'avatar'].includes(k))) return json(400, { error: 'Somente o apelido e a foto podem ser alterados.' });
    const displayName = cleanString(payload.displayName, 24);
    if (typeof payload.displayName !== 'string' || displayName.length < 3 || payload.displayName.trim().length > 24) return json(400, { error: 'Escolha um apelido de 3 a 24 caracteres.' });
    if (Object.hasOwn(payload, 'avatar')) {
      if (typeof payload.avatar !== 'string' || payload.avatar.length > 120000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(payload.avatar)) {
        return json(400, { error: 'Foto inválida ou muito grande. Escolha outro arquivo.' });
      }
      const photo = Buffer.from(payload.avatar.split(',')[1], 'base64');
      if (photo.length < 4 || photo[0] !== 0xff || photo[1] !== 0xd8 || photo[2] !== 0xff || photo[photo.length - 2] !== 0xff || photo[photo.length - 1] !== 0xd9) {
        return json(400, { error: 'Formato de foto inválido.' });
      }
      auth.user.avatar = payload.avatar;
      auth.user.avatarSource = 'upload';
    }
    auth.user.displayName = displayName;
    auth.user.needsProfile = false;
    auth.user.updatedAt = Date.now();
    await Database.save(db);
    return json(200, { success: true, user: sanitizeUser(auth.user) });
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

    const betAmount = payload.bet;
    if (!Number.isSafeInteger(betAmount) || betAmount < 5) {
      return json(400, { error: 'Valor de aposta inválido (mínimo 5 moedas).' });
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

  // =========================================================================
  // 6.2 ROTAS AUTORITATIVAS DE BLACKJACK (COSTA BLACKJACK 21)
  // =========================================================================
  if (pathname === '/api/blackjack/state' && method === 'GET') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado.' });
    const { user } = auth;
    const session = db.bj_sessions ? db.bj_sessions[user.id] : null;
    if (!session) return json(200, { active: false, balance: user.balance });
    return json(200, { active: true, balance: user.balance, round: formatBlackjackState(session, session.status === 'resolved') });
  }

  if (pathname === '/api/blackjack/deal' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado para jogar.' });
    const { user } = auth;
    if (user.isBanned || user.role === 'banned') return json(403, { error: 'Sua conta está banida.' });

    const betAmount = payload.bet;
    if (!Number.isSafeInteger(betAmount) || betAmount < 5) return json(400, { error: 'Aposta mínima de 5 moedas.' });
    if (user.balance < betAmount) return json(400, { error: 'Saldo insuficiente para esta aposta.' });

    if (db.bj_sessions && db.bj_sessions[user.id] && db.bj_sessions[user.id].status === 'playing') {
      return json(400, { error: 'Já existe uma rodada em andamento.', round: formatBlackjackState(db.bj_sessions[user.id], false) });
    }

    user.balance -= betAmount;

    const c1 = drawBlackjackCard(db);
    const d1 = drawBlackjackCard(db);
    const c2 = drawBlackjackCard(db);
    const d2 = drawBlackjackCard(db);

    const playerHand = {
      cards: [c1, c2],
      bet: betAmount,
      doubled: false,
      status: 'playing',
      result: null,
      payout: 0
    };

    const session = {
      id: 'bj_' + crypto.randomUUID(),
      userId: user.id,
      playerHands: [playerHand],
      dealerCards: [d1, d2],
      activeHandIndex: 0,
      status: 'playing',
      insuranceBet: 0,
      insuranceWon: false,
      insurancePayout: 0,
      totalPayout: 0,
      message: ''
    };

    const pVal = calculateHandValue(playerHand.cards);
    const dVal = calculateHandValue(session.dealerCards);

    if (pVal.isBlackjack || dVal.isBlackjack) {
      session.status = 'resolved';
      let totalPayout = 0;
      if (pVal.isBlackjack && dVal.isBlackjack) {
        playerHand.status = 'push';
        playerHand.result = 'push';
        playerHand.payout = betAmount;
        totalPayout = betAmount;
        session.message = 'Blackjack mútuo! Empate (Push).';
      } else if (pVal.isBlackjack) {
        playerHand.status = 'blackjack';
        playerHand.result = 'blackjack';
        const win = betAmount + Math.round(betAmount * 1.5);
        playerHand.payout = win;
        totalPayout = win;
        session.message = '👑 NATURAL BLACKJACK! Pagamento 3:2!';
      } else {
        playerHand.status = 'loss';
        playerHand.result = 'loss';
        playerHand.payout = 0;
        session.message = 'Dealer possui Blackjack natural!';
      }

      session.totalPayout = totalPayout;
      if (totalPayout > 0) {
        user.balance += totalPayout;
        if (totalPayout > user.highestWin) user.highestWin = totalPayout;
      }
      user.score = user.balance;
      user.updatedAt = Date.now();
      if (db.bj_sessions) delete db.bj_sessions[user.id];
    } else {
      db.bj_sessions ||= {};
      db.bj_sessions[user.id] = session;
    }

    if (typeof db.total_spins !== 'number') db.total_spins = 0;
    db.total_spins += 1;

    await Database.save(db);

    return json(200, {
      success: true,
      balance: user.balance,
      round: formatBlackjackState(session, session.status === 'resolved')
    });
  }

  if (pathname === '/api/blackjack/hit' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado.' });
    const { user } = auth;
    const session = db.bj_sessions ? db.bj_sessions[user.id] : null;
    if (!session || session.status !== 'playing') return json(400, { error: 'Nenhuma rodada ativa para pedir carta.' });

    const activeHand = session.playerHands[session.activeHandIndex];
    if (!activeHand || activeHand.status !== 'playing') return json(400, { error: 'Mão inativa.' });

    const newCard = drawBlackjackCard(db);
    activeHand.cards.push(newCard);

    const val = calculateHandValue(activeHand.cards);
    if (val.isBust) {
      activeHand.status = 'bust';
      activeHand.result = 'bust';
      if (session.activeHandIndex < session.playerHands.length - 1) {
        session.activeHandIndex++;
      } else {
        resolveBlackjackDealer(session, db, user);
      }
    } else if (val.total === 21) {
      activeHand.status = 'stand';
      if (session.activeHandIndex < session.playerHands.length - 1) {
        session.activeHandIndex++;
      } else {
        resolveBlackjackDealer(session, db, user);
      }
    }

    await Database.save(db);

    return json(200, {
      success: true,
      balance: user.balance,
      round: formatBlackjackState(session, session.status === 'resolved')
    });
  }

  if (pathname === '/api/blackjack/stand' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado.' });
    const { user } = auth;
    const session = db.bj_sessions ? db.bj_sessions[user.id] : null;
    if (!session || session.status !== 'playing') return json(400, { error: 'Nenhuma rodada ativa para parar.' });

    const activeHand = session.playerHands[session.activeHandIndex];
    if (activeHand) activeHand.status = 'stand';

    if (session.activeHandIndex < session.playerHands.length - 1) {
      session.activeHandIndex++;
    } else {
      resolveBlackjackDealer(session, db, user);
    }

    await Database.save(db);

    return json(200, {
      success: true,
      balance: user.balance,
      round: formatBlackjackState(session, session.status === 'resolved')
    });
  }

  if (pathname === '/api/blackjack/double' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado.' });
    const { user } = auth;
    const session = db.bj_sessions ? db.bj_sessions[user.id] : null;
    if (!session || session.status !== 'playing') return json(400, { error: 'Nenhuma rodada ativa para dobrar.' });

    const activeHand = session.playerHands[session.activeHandIndex];
    if (!activeHand || activeHand.cards.length !== 2 || activeHand.doubled) {
      return json(400, { error: 'Não é permitido dobrar nesta mão.' });
    }
    if (user.balance < activeHand.bet) {
      return json(400, { error: 'Saldo insuficiente para dobrar a aposta.' });
    }

    user.balance -= activeHand.bet;
    activeHand.bet *= 2;
    activeHand.doubled = true;

    const newCard = drawBlackjackCard(db);
    activeHand.cards.push(newCard);

    const val = calculateHandValue(activeHand.cards);
    activeHand.status = val.isBust ? 'bust' : 'stand';
    if (val.isBust) activeHand.result = 'bust';

    if (session.activeHandIndex < session.playerHands.length - 1) {
      session.activeHandIndex++;
    } else {
      resolveBlackjackDealer(session, db, user);
    }

    await Database.save(db);

    return json(200, {
      success: true,
      balance: user.balance,
      round: formatBlackjackState(session, session.status === 'resolved')
    });
  }

  if (pathname === '/api/blackjack/split' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado.' });
    const { user } = auth;
    const session = db.bj_sessions ? db.bj_sessions[user.id] : null;
    if (!session || session.status !== 'playing') return json(400, { error: 'Nenhuma rodada ativa.' });

    if (session.playerHands.length !== 1) return json(400, { error: 'Apenas uma divisão é permitida.' });
    const hand = session.playerHands[0];
    if (hand.cards.length !== 2) return json(400, { error: 'Apenas a mão inicial pode ser dividida.' });

    const c1 = hand.cards[0];
    const c2 = hand.cards[1];
    const isPair = c1.value === c2.value || (['10','J','Q','K'].includes(c1.value) && ['10','J','Q','K'].includes(c2.value));
    if (!isPair) return json(400, { error: 'Cartas não formam um par.' });
    if (user.balance < hand.bet) return json(400, { error: 'Saldo insuficiente para dividir a aposta.' });

    user.balance -= hand.bet;

    const newCard1 = drawBlackjackCard(db);
    const newCard2 = drawBlackjackCard(db);

    const hand1 = { cards: [c1, newCard1], bet: hand.bet, doubled: false, status: 'playing', result: null, payout: 0 };
    const hand2 = { cards: [c2, newCard2], bet: hand.bet, doubled: false, status: 'playing', result: null, payout: 0 };

    session.playerHands = [hand1, hand2];
    session.activeHandIndex = 0;

    await Database.save(db);

    return json(200, {
      success: true,
      balance: user.balance,
      round: formatBlackjackState(session, false)
    });
  }

  if (pathname === '/api/blackjack/insurance' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado.' });
    const { user } = auth;
    const session = db.bj_sessions ? db.bj_sessions[user.id] : null;
    if (!session || session.status !== 'playing') return json(400, { error: 'Nenhuma rodada ativa.' });

    if (session.insuranceBet > 0 || session.dealerCards[0].value !== 'A') {
      return json(400, { error: 'Seguro indisponível.' });
    }

    const insCost = Math.floor(session.playerHands[0].bet / 2);
    if (user.balance < insCost) return json(400, { error: 'Saldo insuficiente para seguro.' });

    user.balance -= insCost;
    session.insuranceBet = insCost;

    await Database.save(db);

    return json(200, {
      success: true,
      balance: user.balance,
      round: formatBlackjackState(session, false)
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

  // 6.7 ALTERAÇÃO DIRETA DE SALDO PELO FUNDADOR (/api/user/founder-balance)
  if (pathname === '/api/user/founder-balance' && method === 'POST') {
    const auth = getAuthenticatedUser(req, payload, db);
    if (!auth) return json(401, { error: 'Você precisa estar logado.' });
    const { user } = auth;
    const isFounder = isFounderUser(user) || user.role === 'founder';
    if (!isFounder) {
      return json(403, { error: 'Apenas a conta fundadora pode alterar seu próprio saldo diretamente.' });
    }
    const amount = Number(payload.amount);
    if (!Number.isSafeInteger(amount) || amount < 0) {
      return json(400, { error: 'Valor de saldo inválido.' });
    }
    const prevBalance = user.balance || 0;
    user.balance = amount;
    user.score = amount;
    user.updatedAt = Date.now();

    if (!db.admin_logs) db.admin_logs = [];
    db.admin_logs.unshift({
      id: 'log_' + crypto.randomUUID(),
      adminId: user.id,
      adminEmail: user.email || user.username,
      adminUsername: user.displayName || user.username,
      action: 'balance_change',
      targetUserId: user.id,
      targetUsername: user.username,
      saldoAnterior: prevBalance,
      saldoNovo: amount,
      diferenca: amount - prevBalance,
      motivo: cleanString(payload.reason || 'Ajuste direto do Fundador', 120),
      timestamp: Date.now()
    });

    await Database.save(db);
    return json(200, { success: true, balance: user.balance, user: sanitizeUser(user) });
  }

  // 7. RANKING GLOBAL 100% REAL (SEM BOTS)
  if (pathname === '/api/leaderboard' && method === 'GET') {
    const usersList = Object.values(db.users || {}).filter(u => !u.isBanned && u.role !== 'banned');

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

  // 9. ROTAS ADMINISTRATIVAS PROTEGIDAS NO BACKEND (/api/admin/*)
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
    const auth = requireAdmin(req, payload, db);
    if (auth.error) return json(auth.status, { error: auth.error });
    if (Object.hasOwn(payload, 'role')) return json(400, { error: 'Role não pode ser enviada nesta API.' });

    const { user: adminUser } = auth;
    if (adminUser.isBanned || adminUser.role === 'banned') {
      return json(403, { error: 'Acesso negado: sua conta foi banida.' });
    }

    const isFounder = isFounderUser(adminUser);
    const isAdmin = isFounder || adminUser.role === 'admin';

    if (!isAdmin) {
      return json(403, { error: 'Acesso negado: privilégios administrativos insuficientes.' });
    }

    if (pathname === '/api/admin/page' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' });
      res.end(require('fs').readFileSync(require('path').join(__dirname, 'admin.html'), 'utf8'));
      return;
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
      const query = new URL(req.url || pathname, 'http://localhost').searchParams;
      const search = cleanString(query.get('search') || payload.search || req.headers['x-search'] || '', 80).toLowerCase();
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
      const mode = payload.mode;
      const amount = payload.amount;
      if (!['set', 'add'].includes(mode)) return json(400, { error: 'Operação inválida.' });
      const reason = cleanString(payload.reason, 120);

      if (!targetId) {
        return json(400, { error: 'Identificador do jogador não informado.' });
      }
      if (!Number.isSafeInteger(amount) || amount < 0) {
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

      // Proteção: Outros administradores (não fundador) não podem alterar o próprio saldo
      if (target.id === adminUser.id && !isFounder) {
        return json(403, { error: 'Você não pode alterar o próprio saldo pela API administrativa.' });
      }

      const prevBalance = target.balance || 0;
      if (payload.expectedBalance !== undefined && payload.expectedBalance !== prevBalance) return json(409, { error: 'Saldo mudou. Atualize os jogadores e confirme novamente.' });
      let newBalance = mode === 'set' ? amount : prevBalance + amount;

      if (newBalance < 0 || !Number.isSafeInteger(newBalance)) {
        return json(400, { error: 'O saldo resultante é inválido.' });
      }

      target.balance = newBalance;
      target.score = newBalance;
      target.updatedAt = Date.now();

      // Registro de Auditoria Obrigatório
      if (!db.admin_logs) db.admin_logs = [];
      const logEntry = {
        id: 'log_' + crypto.randomUUID(),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'balance_change',
        targetUserId: target.id,
        targetUsername: target.username,
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
        return json(403, { error: 'Você não pode banir a sua própria conta.' });
      }

      // Apenas o Fundador pode banir outro administrador
      if ((target.role === 'admin' || target.roleBeforeBan === 'admin') && !isFounder) {
        return json(403, { error: 'Apenas o Fundador possui permissão para banir administradores.' });
      }

      target.roleBeforeBan = target.roleBeforeBan || target.role;
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
        id: 'log_' + crypto.randomUUID(),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'user_banned',
        targetUserId: target.id,
        targetUsername: target.username,
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

      if (isFounderUser(target) || target.id === adminUser.id || (!isFounder && (target.role === 'admin' || target.roleBeforeBan === 'admin'))) return json(403, { error: 'Conta protegida.' });
      if (!target.isBanned && target.role !== 'banned') return json(400, { error: 'Conta não está banida.' });
      target.isBanned = false;
      target.role = 'user';
      delete target.roleBeforeBan;
      delete target.banReason;
      delete target.bannedAt;
      target.updatedAt = Date.now();

      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID(),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'user_unbanned',
        targetUserId: target.id,
        targetUsername: target.username,
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

      if ((target.role === 'admin' || target.roleBeforeBan === 'admin') && !isFounder) {
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
        id: 'log_' + crypto.randomUUID(),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'user_deleted',
        targetUserId: target.id,
        targetUsername: target.username,
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
        return json(403, { error: 'Este usuário já é o Fundador.' });
      }

      target.role = 'admin';
      target.updatedAt = Date.now();

      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID(),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'admin_promoted',
        targetUserId: target.id,
        targetUsername: target.username,
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

      if (target.isBanned || target.role !== 'admin') return json(400, { error: 'Conta não é um administrador ativo.' });
      target.role = 'user';
      target.updatedAt = Date.now();

      if (!db.admin_logs) db.admin_logs = [];
      db.admin_logs.unshift({
        id: 'log_' + crypto.randomUUID(),
        adminId: adminUser.id,
        adminEmail: adminUser.email || adminUser.username,
        adminUsername: adminUser.displayName || adminUser.username,
        action: 'admin_demoted',
        targetUserId: target.id,
        targetUsername: target.username,
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
      const filtered = isFounder ? logs : logs.filter(l => l.adminId === adminUser.id);
      const before = new URL(req.url || pathname, 'http://localhost').searchParams.get('before');
      const cursorIndex = before ? filtered.findIndex(l => l.id === before) : -1;
      if (before && cursorIndex < 0) return json(400, { error: 'Página de logs inválida.' });
      const start = cursorIndex + 1;
      const page = filtered.slice(start, start + 100);

      return json(200, {
        success: true,
        logs: page,
        nextCursor: start + page.length < filtered.length ? page[page.length - 1].id : null
      });
    }

    return json(404, { error: 'Rota administrativa não encontrada.' });
  }

  return json(404, { error: 'Rota não encontrada.' });
}

async function handleApiRequest(req, res, pathname, method, payload = {}) {
  const result = await Database.transaction(async () => {
    const db = await Database.get();
    // Migração somente por ID definido pelo operador, nunca pelo navegador.
    const configuredId = process.env.FOUNDER_USER_ID || require('./founder.json').userId;
    if (!db.founderId && configuredId) {
      const candidate = Object.values(db.users).find(u => u.id === configuredId);
      if (!candidate && process.env.FOUNDER_USER_ID) throw new Error('FOUNDER_USER_ID inexistente');
      if (candidate) {
        db.founderId = candidate.id;
        for (const [token, session] of Object.entries(db.sessions)) if (session.userId === candidate.id) delete db.sessions[token];
        await Database.save(db);
      }
    }
    return founderContext.run({ founderId: db.founderId }, async () => {
      for (const user of Object.values(db.users)) {
        const previous = user.role;
        ensureFounderRole(user);
        if (previous !== user.role) {
          for (const [token, session] of Object.entries(db.sessions)) if (session.userId === user.id) delete db.sessions[token];
          await Database.save(db);
        }
      }
      const response = { status: 500, headers: {}, body: '' };
      const buffered = { writeHead(status, headers) { response.status = status; response.headers = headers; }, end(body) { response.body = body; } };
      await routeRequest(req, buffered, pathname, method, payload);
      return response;
    });
  });
  res.writeHead(result.status, result.headers);
  res.end(result.body);
}

module.exports = { handleApiRequest, SYMBOLS };
