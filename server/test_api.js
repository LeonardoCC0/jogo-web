const { handleApiRequest } = require('../server/apiHandler');

function mockResponse() {
  let statusCode = 200;
  let headers = {};
  let body = '';

  return {
    writeHead(code, h) {
      statusCode = code;
      headers = { ...headers, ...h };
    },
    end(str) {
      body = str;
    },
    getStatusCode() { return statusCode; },
    getBody() { return JSON.parse(body || '{}'); }
  };
}

async function run() {
  console.log('🧪 INICIANDO TESTES DO BACKEND...');

  // 1. Health
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/health', 'GET');
    console.log('1. Health check:', res.getStatusCode() === 200 ? '✅ PASSOU' : '❌ FALHOU', res.getBody());
  }

  // 2. Registro de Jogador 1
  let token1 = null;
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/register', 'POST', {
      username: 'NeoPlayer',
      password: 'password123',
      avatar: '🥷'
    });
    const b = res.getBody();
    token1 = b.token;
    console.log('2. Registro NeoPlayer:', res.getStatusCode() === 201 && token1 ? '✅ PASSOU' : '❌ FALHOU', b.user);
  }

  // 3. Registro duplicado
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/register', 'POST', {
      username: 'neoplayer',
      password: 'password123'
    });
    console.log('3. Bloqueio de usuário duplicado:', res.getStatusCode() === 409 ? '✅ PASSOU' : '❌ FALHOU');
  }

  // 4. Registro de Jogador 2
  let token2 = null;
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/register', 'POST', {
      username: 'CyberQueen',
      password: 'password456',
      avatar: '👑'
    });
    const b = res.getBody();
    token2 = b.token;
    console.log('4. Registro CyberQueen:', res.getStatusCode() === 201 && token2 ? '✅ PASSOU' : '❌ FALHOU', b.user);
  }

  // 5. Login com senha errada
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/login', 'POST', {
      username: 'NeoPlayer',
      password: 'wrongpassword'
    });
    console.log('5. Bloqueio senha incorreta:', res.getStatusCode() === 401 ? '✅ PASSOU' : '❌ FALHOU');
  }

  // 6. Login com senha certa
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/login', 'POST', {
      username: 'NeoPlayer',
      password: 'password123'
    });
    const b = res.getBody();
    console.log('6. Login NeoPlayer com sucesso:', res.getStatusCode() === 200 && b.token ? '✅ PASSOU' : '❌ FALHOU');
  }

  // 7. Teste de Giro com persistência
  {
    const res = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${token1}` } }, res, '/api/spin', 'POST', {
      bet: 50
    });
    const b = res.getBody();
    console.log('7. Giro NeoPlayer:', res.getStatusCode() === 200 && b.outcome ? '✅ PASSOU' : '❌ FALHOU', {
      win: b.outcome.isWin,
      newBalance: b.outcome.newBalance,
      symbols: b.outcome.symbols.map(s => s.icon)
    });
  }

  // 8. Teste de Recarga Bloqueada
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/refill', 'POST');
    console.log('8. Bloqueio definitivo de recarga:', res.getStatusCode() === 403 ? '✅ PASSOU' : '❌ FALHOU');
  }

  // 9. Ranking Real (Sem Bots)
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/leaderboard', 'GET');
    const b = res.getBody();
    const hasBots = b.leaderboard.some(p => p.name === 'Shadow' || p.name === 'Ghost');
    console.log('9. Ranking 100% real (apenas jogadores cadastrados):',
      (res.getStatusCode() === 200 && !hasBots && b.leaderboard.length === 2) ? '✅ PASSOU' : '❌ FALHOU',
      b.leaderboard.map(p => ({ name: p.name, balance: p.balance, avatar: p.avatar }))
    );
  }

  console.log('🏁 TESTES CONCLUÍDOS!');
}

run().catch(console.error);
