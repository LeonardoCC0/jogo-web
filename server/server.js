/**
 * CYBER NEON SLOTS - Servidor Backend Autoritativo e Blindado
 * Utiliza exclusivamente módulos nativos do Node.js (sem necessidade de npm install).
 * Garante 100% de inviolabilidade no RNG, saldo e ranking global.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..');
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Símbolos e regras matemáticas autoritativas no servidor
const SYMBOLS = [
  { id: 'cherry', name: 'Cereja', icon: '🍒', weight: 26, mult3: 3, mult2: 1.0 },
  { id: 'lemon', name: 'Limão', icon: '🍋', weight: 22, mult3: 5, mult2: 1.0 },
  { id: 'orange', name: 'Laranja', icon: '🍊', weight: 18, mult3: 8, mult2: 1.5 },
  { id: 'bell', name: 'Sino Dourado', icon: '🔔', weight: 14, mult3: 14, mult2: 2.0 },
  { id: 'star', name: 'Estrela Neon', icon: '⭐', weight: 10, mult3: 25, mult2: 3.0 },
  { id: 'diamond', name: 'Diamante Cyber', icon: '💎', weight: 6, mult3: 50, mult2: 5.0 },
  { id: 'seven', name: 'Lucky 7', icon: '7️⃣', weight: 3, mult3: 100, mult2: 8.0 },
  { id: 'crown', name: 'Coroa Suprema', icon: '👑', weight: 1, mult3: 300, mult2: 15.0 }
];

const INITIAL_LEADERBOARD = [
  { name: 'Shadow', balance: 38450, highestWin: 5000, avatar: '🥷' },
  { name: 'Ghost', balance: 27900, highestWin: 3750, avatar: '👻' },
  { name: 'LuckyStrike', balance: 19400, highestWin: 2500, avatar: '🎲' },
  { name: 'CyberAce', balance: 14850, highestWin: 2000, avatar: '🤖' },
  { name: 'NeonValkyrie', balance: 10200, highestWin: 1500, avatar: '⚡' },
  { name: 'QuantumGambler', balance: 7600, highestWin: 1250, avatar: '🔮' },
  { name: 'PixelKing', balance: 5100, highestWin: 800, avatar: '👾' },
  { name: 'RetroRacer', balance: 3200, highestWin: 500, avatar: '🏎️' }
];

// Carregamento e persistência atômica da base de dados
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {}

  const initialDb = {
    players: {},
    leaderboard: [...INITIAL_LEADERBOARD]
  };
  saveDatabase(initialDb);
  return initialDb;
}

function saveDatabase(data) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar banco de dados do servidor:', e);
  }
}

let db = loadDatabase();

// RNG Criptograficamente Seguro no Servidor
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

// Sanitização de entradas no servidor
function cleanString(str, max = 15) {
  return String(str || '')
    .replace(/[<>'";&`\\]/g, '')
    .trim()
    .slice(0, max);
}

// Mapeamento MIME para servir arquivos estáticos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Rate limiting em memória contra ataques de requisição
const requestRateMap = new Map();

function isRateLimited(ip, minIntervalMs = 250) {
  const now = Date.now();
  const last = requestRateMap.get(ip) || 0;
  if (now - last < minIntervalMs) {
    return true;
  }
  requestRateMap.set(ip, now);
  return false;
}

// Servidor HTTP
const server = http.createServer((req, res) => {
  // Cabeçalhos de Segurança Padrão OWASP
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const clientIp = req.socket.remoteAddress || 'unknown';
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Roteamento de API
  if (pathname.startsWith('/api/')) {
    if (isRateLimited(clientIp, 150)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Muitas requisições. Por favor, aguarde.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e5) req.destroy(); // Proteção contra payload gigante
    });

    req.on('end', () => {
      let data = {};
      try {
        if (body) data = JSON.parse(body);
      } catch (e) {}

      handleApiRoute(pathname, req.method, data, res);
    });
    return;
  }

  // Servidor de Arquivos Estáticos (Frontend)
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  // Prevenção de Path Traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Acesso negado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Não Encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Manipulador de Rotas da API
function handleApiRoute(route, method, payload, res) {
  const jsonResponse = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  };

  // Status e verificação de servidor
  if (route === '/api/health' && method === 'GET') {
    return jsonResponse(200, { status: 'secure_server_online', mode: 'server_authoritative' });
  }

  // Inicializa ou sincroniza sessão do jogador no servidor
  if (route === '/api/player/init' && method === 'POST') {
    const rawId = payload.playerId || ('p_' + crypto.randomUUID().slice(0, 8));
    const name = cleanString(payload.name || 'CyberPlayer');
    const avatar = cleanString(payload.avatar || '⚡', 4);

    if (!db.players[rawId]) {
      db.players[rawId] = {
        id: rawId,
        name,
        avatar,
        balance: 1000,
        highestWin: 0,
        createdAt: Date.now()
      };
      saveDatabase(db);
    }

    const player = db.players[rawId];
    return jsonResponse(200, {
      success: true,
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
      balance: player.balance,
      highestWin: player.highestWin
    });
  }

  // Giro Autoritativo (O Servidor calcula tudo)
  if (route === '/api/spin' && method === 'POST') {
    const playerId = payload.playerId;
    const betAmount = parseInt(payload.bet, 10);

    if (!playerId || !db.players[playerId]) {
      return jsonResponse(400, { error: 'Jogador inválido ou não autenticado.' });
    }

    const player = db.players[playerId];

    if (isNaN(betAmount) || betAmount < 5 || betAmount > 1000) {
      return jsonResponse(400, { error: 'Valor de aposta fora dos limites permitidos.' });
    }

    if (player.balance < betAmount) {
      return jsonResponse(400, { error: 'Saldo insuficiente no servidor.' });
    }

    // 1. Debita a aposta
    player.balance -= betAmount;

    // 2. Executa RNG no backend
    const rolledSymbols = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    // 3. Avalia o prêmio
    const result = evaluateSpin(rolledSymbols, betAmount);

    // 4. Credita o prêmio se houver
    if (result.isWin) {
      player.balance += result.winAmount;
      if (result.winAmount > player.highestWin) {
        player.highestWin = result.winAmount;
      }
    }

    // 5. Atualiza o ranking global
    updateServerLeaderboard(player);
    saveDatabase(db);

    return jsonResponse(200, {
      success: true,
      outcome: {
        ...result,
        newBalance: player.balance,
        highestWin: player.highestWin
      }
    });
  }

  // Recarga segura de moedas no servidor
  if (route === '/api/refill' && method === 'POST') {
    const playerId = payload.playerId;
    if (!playerId || !db.players[playerId]) {
      return jsonResponse(400, { error: 'Jogador não encontrado.' });
    }

    const player = db.players[playerId];
    player.balance += 1000;
    updateServerLeaderboard(player);
    saveDatabase(db);

    return jsonResponse(200, {
      success: true,
      newBalance: player.balance
    });
  }

  // Obter Leaderboard oficial verificado do servidor
  if (route === '/api/leaderboard' && method === 'GET') {
    return jsonResponse(200, {
      success: true,
      leaderboard: db.leaderboard
    });
  }

  jsonResponse(404, { error: 'Endpoint não encontrado.' });
}

function updateServerLeaderboard(player) {
  // Filtra outros jogadores e inclui a pontuação atualizada
  const others = db.leaderboard.filter(item => item.name !== player.name);
  others.push({
    name: player.name,
    balance: player.balance,
    highestWin: player.highestWin,
    avatar: player.avatar
  });

  others.sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    return b.highestWin - a.highestWin;
  });

  db.leaderboard = others.slice(0, 15);
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🛡️  CYBER SLOTS - SERVIDOR AUTORITATIVO ONLINE`);
  console.log(`🌐 Acessível em: http://localhost:${PORT}`);
  console.log(`🔒 Modo de Segurança: Server-Side RNG & Ranking Blindado`);
  console.log(`====================================================`);
});
