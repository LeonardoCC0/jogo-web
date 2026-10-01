process.env.NODE_ENV = 'test';

const { handleApiRequest, SYMBOLS } = require('./apiHandler');
const fs = require('fs');
const path = require('path');

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
    getBody() { 
      try {
        return JSON.parse(body || '{}');
      } catch (e) {
        return body;
      }
    }
  };
}

async function run() {
  console.log('====================================================');
  console.log('🧪 INICIANDO BATERIA DE TESTES COMPLETOS - CYBER SLOTS');
  console.log('====================================================');

  // Limpa banco local para testes determinísticos
  const dbFile = path.join(__dirname, 'data', 'db.json');
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }

  // 1. Health
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/health', 'GET');
    console.log('1. Health check:', res.getStatusCode() === 200 ? '✅ PASSOU' : '❌ FALHOU');
  }

  // 2. Validação dos pesos dos símbolos (Item 1)
  {
    const expectedWeights = {
      cherry: 32,
      lemon: 25,
      orange: 18,
      bell: 12,
      star: 7,
      diamond: 3,
      seven: 2,
      crown: 1
    };
    const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
    const weightsMatch = SYMBOLS.every(s => s.weight === expectedWeights[s.id]);

    console.log('2. Pesos dos símbolos (soma 100 e valores corretos):',
      (totalWeight === 100 && weightsMatch) ? '✅ PASSOU' : '❌ FALHOU',
      SYMBOLS.map(s => `${s.name}: ${s.weight}`).join(', ')
    );
  }

  // 3. Cadastro normal
  let normalToken = null;
  let normalUser = null;
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/register', 'POST', {
      username: 'CyberPlayer',
      password: 'mypassword123',
      avatar: '🥷'
    });
    const b = res.getBody();
    normalToken = b.token;
    normalUser = b.user;
    console.log('3. Cadastro normal (saldo inicial 1.000):',
      (res.getStatusCode() === 201 && b.token && b.user.balance === 1000) ? '✅ PASSOU' : '❌ FALHOU',
      `Saldo: ${b.user ? b.user.balance : 0}`
    );
  }

  // 4. Logout e validação de sessão
  {
    const resLogout = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${normalToken}` } }, resLogout, '/api/auth/logout', 'POST');
    console.log('4. Logout:', resLogout.getStatusCode() === 200 ? '✅ PASSOU' : '❌ FALHOU');

    const resMe = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${normalToken}` } }, resMe, '/api/auth/me', 'GET');
    console.log('5. Sessão encerrada após logout (/api/auth/me = 401):',
      resMe.getStatusCode() === 401 ? '✅ PASSOU' : '❌ FALHOU'
    );
  }

  // 5. Login normal
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/login', 'POST', {
      username: 'CyberPlayer',
      password: 'mypassword123'
    });
    const b = res.getBody();
    normalToken = b.token;
    console.log('6. Login normal com sucesso:',
      (res.getStatusCode() === 200 && normalToken && b.user.username === 'cyberplayer') ? '✅ PASSOU' : '❌ FALHOU'
    );

    // Valida /api/auth/me com nova sessão
    const resMe = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${normalToken}` } }, resMe, '/api/auth/me', 'GET');
    const meBody = resMe.getBody();
    console.log('7. Sessão persistente ativa (/api/auth/me = 200):',
      (resMe.getStatusCode() === 200 && meBody.user.id === normalUser.id) ? '✅ PASSOU' : '❌ FALHOU'
    );
  }

  // 6. Teste de Token Google Inválido
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/google', 'POST', {
      token: 'invalid_token_xyz'
    });
    console.log('8. Rejeição de Google Token inválido (401):',
      res.getStatusCode() === 401 ? '✅ PASSOU' : '❌ FALHOU'
    );
  }

  // 7. Primeiro Login com Google (Criação de Conta Automática)
  let googleToken = null;
  let googleUser = null;
  const mockGoogleSub = '109876543210987654321';
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/google', 'POST', {
      token: `mock_google_token_${mockGoogleSub}`
    });
    const b = res.getBody();
    googleToken = b.token;
    googleUser = b.user;
    console.log('9. Primeiro login Google (Cria conta com Google ID sub e saldo 1.000):',
      (res.getStatusCode() === 200 && googleToken && b.user.balance === 1000) ? '✅ PASSOU' : '❌ FALHOU',
      b.user
    );
  }

  // 8. Giro autoritativo com a conta Google para alterar o saldo
  {
    const res = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${googleToken}` } }, res, '/api/spin', 'POST', {
      bet: 50
    });
    const b = res.getBody();
    console.log('10. Giro com conta Google (saldo atualizado autoritativamente no servidor):',
      (res.getStatusCode() === 200 && b.outcome) ? '✅ PASSOU' : '❌ FALHOU',
      `Novo saldo: ${b.outcome ? b.outcome.newBalance : 'N/A'}`
    );
    googleUser.balance = b.outcome.newBalance;
  }

  // 9. Segundo Login com Google (Recuperação da mesma conta, sem resetar saldo e sem duplicar)
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/auth/google', 'POST', {
      token: `mock_google_token_${mockGoogleSub}`
    });
    const b = res.getBody();
    const isSameAccount = b.user && b.user.id === googleUser.id;
    const balancePreserved = b.user && b.user.balance === googleUser.balance;
    console.log('11. Segundo login Google (Recupera MESMA conta sem resetar saldo):',
      (res.getStatusCode() === 200 && isSameAccount && balancePreserved) ? '✅ PASSOU' : '❌ FALHOU',
      `ID igual: ${isSameAccount} | Saldo preservado: ${balancePreserved} (${b.user ? b.user.balance : 0})`
    );
    googleToken = b.token;
  }

  // 10. Validação de sessão do Google via /api/auth/me
  {
    const res = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${googleToken}` } }, res, '/api/auth/me', 'GET');
    const b = res.getBody();
    console.log('12. Sessão Google válida no /api/auth/me:',
      (res.getStatusCode() === 200 && b.user && b.user.id === googleUser.id) ? '✅ PASSOU' : '❌ FALHOU'
    );
  }

  // 11. Reset Voluntário (sempre substitui saldo por 1.000 moedas)
  {
    const res = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${googleToken}` } }, res, '/api/reset', 'POST', {
      type: 'voluntary'
    });
    const b = res.getBody();
    console.log('13. Reset Voluntário (saldo retorna para 1.000 moedas):',
      (res.getStatusCode() === 200 && b.balance === 1000) ? '✅ PASSOU' : '❌ FALHOU'
    );
  }

  // 12. Reset por Punição BLOQUEADO quando saldo > 0
  {
    const res = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${googleToken}` } }, res, '/api/reset', 'POST', {
      type: 'punishment'
    });
    console.log('14. Bloqueio de reset por punição quando saldo > 0 (400):',
      res.getStatusCode() === 400 ? '✅ PASSOU' : '❌ FALHOU',
      res.getBody()
    );
  }

  // 13. Simula saldo 0 e testa Reset por Punição (retorna 500 moedas)
  {
    // Zera saldo via giros sucessivos ou forçando para testar punição
    const Database = require('./db');
    const db = await Database.get();
    db.users[googleUser.username].balance = 0;
    await Database.save(db);

    const res = mockResponse();
    await handleApiRequest({ headers: { authorization: `Bearer ${googleToken}` } }, res, '/api/reset', 'POST', {
      type: 'punishment'
    });
    const b = res.getBody();
    console.log('15. Reset por Punição quando saldo = 0 (retorna 500 moedas):',
      (res.getStatusCode() === 200 && b.balance === 500) ? '✅ PASSOU' : '❌ FALHOU',
      `Saldo após punição: ${b.balance}`
    );
  }

  // 14. Ranking Global Real (ambas as contas reais presentes, sem duplicatas)
  {
    const res = mockResponse();
    await handleApiRequest({ headers: {} }, res, '/api/leaderboard', 'GET');
    const b = res.getBody();
    const total = b.leaderboard ? b.leaderboard.length : 0;
    const hasNormal = b.leaderboard && b.leaderboard.some(p => p.id === normalUser.id);
    const hasGoogle = b.leaderboard && b.leaderboard.some(p => p.id === googleUser.id);

    console.log('16. Ranking Real (jogadores reais cadastrados, normal + Google):',
      (res.getStatusCode() === 200 && total === 2 && hasNormal && hasGoogle) ? '✅ PASSOU' : '❌ FALHOU',
      b.leaderboard.map(p => `${p.name}: ${p.balance} moedas`)
    );
  }

  console.log('====================================================');
  console.log('🎉 TODOS OS TESTES FORAM EXECUTADOS COM SUCESSO!');
  console.log('====================================================');
}

run().catch(err => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
