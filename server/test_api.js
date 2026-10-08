// Every test uses an isolated database. Never delete or modify the real database.
process.env.NODE_ENV = 'test';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cyber-security-'));
process.env.TEST_DB_FILE = path.join(temp, 'db.json');
const { OAuth2Client } = require('google-auth-library');
const googlePayloads = new Map();
OAuth2Client.prototype.verifyIdToken = async function ({ idToken }) {
  if (!googlePayloads.has(idToken)) throw new Error('Invalid signature');
  return { getPayload: () => googlePayloads.get(idToken) };
};
const { handleApiRequest, SYMBOLS } = require('./apiHandler');
const Database = require('./db');
let checks = 0;
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks++; }
async function call(route, token, body, method = body ? 'POST' : 'GET', extra = {}) {
  let status, headers, raw;
  await handleApiRequest({ url: route, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, socket: { remoteAddress: 'test' } }, {
    writeHead(s, h) { status = s; headers = h; }, end(b) { raw = b; }
  }, route.split('?')[0], method, body || {});
  let data; try { data = JSON.parse(raw); } catch { data = raw; }
  return { status, headers, data };
}
async function mutate(fn) { await Database.transaction(async () => { const db = await Database.get(); fn(db); await Database.save(db); }); }
async function register(username) {
  const r = await call('/api/auth/register', null, { username, password: 'test-password-123' });
  eq(r.status, 201, 'register ' + username); return r.data;
}
function googleToken(key, overrides = {}) {
  googlePayloads.set(key, { sub: key, email: key + '@gmail.com', email_verified: true, name: 'Google Player', picture: 'https://lh3.googleusercontent.com/test-photo', iss: 'https://accounts.google.com', aud: '701601557497-m4m4geq1p3oj242pnvqvg11eeld6jd1s.apps.googleusercontent.com', exp: Date.now() / 1000 + 3600, ...overrides });
  return { token: key };
}
async function run() {
  eq(SYMBOLS.reduce((sum, x) => sum + x.weight, 0), 100, 'game weights');
  const user = await register('player');
  const admin = await register('manager');
  const target = await register('target');
  const otherAdmin = await register('manager2');
  const founder = (await call('/api/auth/google', null, googleToken('owner', { email: '47131@raphaeldisanto.com.br', hd: 'raphaeldisanto.com.br' }))).data;
  eq(founder.user.role, 'founder', 'verified founder assigned');
  eq((await call('/api/auth/register', null, { username: 'evil', password: 'abcd', email: '47131@raphaeldisanto.com.br', role: 'founder' })).status, 403, 'founder email impersonation blocked');
  const forged = await call('/api/auth/register', null, { username: 'impostor', password: 'abcd', role: 'founder' });
  eq(forged.data.user.role, 'user', 'registration ignores supplied role');
  for (const person of [admin, otherAdmin]) eq((await call('/api/admin/admins/promote', founder.token, { targetId: person.user.id })).status, 200, 'promote');
  const routes = ['/api/admin/users', '/api/admin/stats', '/api/admin/logs', '/api/admin/page', '/api/admin/check'];
  for (const route of routes) {
    eq((await call(route)).status, 401, 'anonymous ' + route);
    eq((await call(route, 'invalid')).status, 401, 'invalid token ' + route);
    eq((await call(route, user.token)).status, 403, 'normal user ' + route);
    eq((await call(route, admin.token)).status, 200, 'admin ' + route);
  }
  for (const action of ['ban', 'unban', 'delete']) {
    const body = { targetId: founder.user.id, reason: 'test reason', amount: 50, mode: 'add', confirmUsername: founder.user.username };
    eq((await call('/api/admin/users/' + action, user.token, body)).status, 403, 'normal mutation denied');
    eq((await call('/api/admin/users/' + action, admin.token, body)).status, 403, 'founder protected from admin: ' + action);
    eq((await call('/api/admin/users/' + action, founder.token, body)).status, 403, 'founder immutable: ' + action);
  }
  // Balance: user e admin não podem alterar o saldo do founder, mas o founder pode alterar seu próprio saldo
  const balBody = { targetId: founder.user.id, reason: 'test reason', amount: 50, mode: 'add' };
  eq((await call('/api/admin/users/balance', user.token, balBody)).status, 403, 'normal mutation denied for balance');
  eq((await call('/api/admin/users/balance', admin.token, balBody)).status, 403, 'founder balance protected from admin');
  eq((await call('/api/admin/users/balance', founder.token, balBody)).status, 200, 'founder can change own balance');
  // Alterao direta de saldo via /api/user/founder-balance:
  eq((await call('/api/user/founder-balance', user.token, { amount: 5000 })).status, 403, 'user denied founder-balance');
  eq((await call('/api/user/founder-balance', admin.token, { amount: 5000 })).status, 403, 'admin denied founder-balance');
  const founderDirectBal = await call('/api/user/founder-balance', founder.token, { amount: 888888888 });
  eq(founderDirectBal.status, 200, 'founder direct balance update allowed');
  eq(founderDirectBal.data.balance, 888888888, 'founder balance changed directly without limits');
  for (const action of ['promote', 'demote']) {
    eq((await call('/api/admin/admins/' + action, admin.token, { targetId: user.user.id })).status, 403, 'only founder manages admins');
    eq((await call('/api/admin/admins/' + action, founder.token, { targetId: founder.user.id })).status, 403, 'founder role protected');
  }
  eq((await call('/api/admin/admins/promote', founder.token, { targetId: user.user.id, role: 'founder' })).status, 400, 'cannot create another founder');
  for (const amount of ['5x', '1000', 1.5, null, -100000001]) eq((await call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount, mode: 'set', reason: 'test' })).status, 400, 'strict balance ' + amount);
  // Sem limite superior de saldo:
  eq((await call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount: 100000001, mode: 'set', reason: 'unlimited balance test' })).status, 200, 'unlimited balance allowed');
  await call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount: 1000, mode: 'set', reason: 'reset for next tests' });
  eq((await call('/api/admin/users/balance', admin.token, { targetId: admin.user.id, amount: 5, mode: 'add', reason: 'test' })).status, 403, 'no self credit');
  eq((await call('/api/admin/users/ban', admin.token, { targetId: admin.user.id, reason: 'test' })).status, 403, 'no self ban');
  eq((await call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount: -1, mode: 'set', reason: 'test' })).status, 400, 'negative balance rejected');
  eq((await call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount: 5, mode: 'add', reason: '' })).status, 400, 'reason mandatory');
  const balance = await call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount: 500, mode: 'add', reason: 'compensation', expectedBalance: 1000 });
  eq(balance.data.user.balance, 1500, 'balance persisted');
  eq([balance.data.log.saldoAnterior, balance.data.log.saldoNovo, balance.data.log.diferenca, balance.data.log.adminId], [1000, 1500, 500, admin.user.id], 'audit balance details');
  eq((await call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount: 500, mode: 'add', reason: 'compensation', expectedBalance: 1000 })).status, 409, 'stale confirmation rejected');
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => call('/api/admin/users/balance', admin.token, { targetId: target.user.id, amount: 1, mode: 'add', reason: 'parallel' })));
  eq(concurrent.every(r => r.status === 200), true, 'parallel requests succeed');
  eq((await Database.get()).users.target.balance, 1510, 'no lost balances');
  eq((await call('/api/admin/users/ban', admin.token, { targetId: target.user.id, reason: 'abuse test' })).status, 200, 'ban');
  eq((await call('/api/spin', target.token, { bet: 5 })).status, 401, 'ban revokes session');
  eq((await call('/api/auth/login', null, { username: 'target', password: 'test-password-123' })).status, 403, 'ban prevents login');
  await mutate(db => { db.sessions.bannedToken = { username: 'target', userId: target.user.id, createdAt: Date.now() }; });
  for (const route of ['/api/admin/users', '/api/spin', '/api/profile', '/api/reset', '/api/auth/me']) eq((await call(route, 'bannedToken', route === '/api/spin' ? { bet: 5 } : route === '/api/profile' ? { displayName: 'changed' } : route === '/api/reset' ? { type: 'voluntary' } : undefined)).status, 403, 'banned account rejected ' + route);
  eq((await call('/api/admin/users/unban', admin.token, { targetId: target.user.id })).status, 200, 'unban');
  eq((await call('/api/auth/login', null, { username: 'target', password: 'test-password-123' })).status, 200, 'unban allows login');
  eq((await call('/api/admin/users/unban', admin.token, { targetId: otherAdmin.user.id })).status, 403, 'cannot demote via unban');
  eq((await call('/api/admin/users/delete', admin.token, { targetId: target.user.id, confirmUsername: 'wrong' })).status, 400, 'strong deletion confirmation');
  eq((await call('/api/admin/users/delete', admin.token, { targetId: target.user.id, confirmUsername: 'target' })).status, 200, 'delete');
  eq((await Database.get()).users.target, undefined, 'deleted record removed');
  eq((await call('/api/admin/admins/demote', founder.token, { targetId: otherAdmin.user.id })).status, 200, 'demote');
  eq((await call('/api/admin/users', otherAdmin.token)).status, 403, 'demotion effective immediately');
  eq((await call('/api/admin/logs', admin.token)).data.logs.every(l => l.adminId === admin.user.id), true, 'admin only sees own logs');
  eq((await call('/api/admin/logs', founder.token)).data.logs.some(l => l.action === 'admin_promoted'), true, 'founder sees all logs');
  await mutate(db => { db.sessions.expired = { username: user.user.username, userId: user.user.id, createdAt: Date.now() - 8 * 86400000 }; });
  eq((await call('/api/admin/users', 'expired')).status, 401, 'expired token');
  eq((await call('/api/auth/me', 'expired')).status, 401, 'expired game session');
  eq((await call('/api/auth/google', null, { token: 'bad-signature' })).status, 401, 'invalid Google signature');
  eq((await call('/api/auth/google', null, googleToken('expired-google', { exp: 1 }))).status, 401, 'expired Google');
  eq((await call('/api/auth/google', null, googleToken('wrong-audience', { aud: 'attacker' }))).status, 401, 'wrong Google audience');
  eq((await call('/api/auth/google', null, googleToken('unverified', { email_verified: false }))).status, 401, 'unverified email');
  const g = (await call('/api/auth/google', null, googleToken('google-player'))).data;
  eq(g.user.needsProfile, true, 'Google onboarding');
  eq((await call('/api/auth/login', null, { username: g.user.username, password: 'abcd' })).status, 401, 'password login for Google-only user safe');
  eq((await call('/api/profile', g.token, { displayName: 'My Chosen Name' })).data.user.displayName, 'My Chosen Name', 'custom Google name');
  eq((await call('/api/profile', g.token, { displayName: 'Hacker', role: 'founder' })).status, 400, 'profile mass assignment blocked');
  eq((await call('/api/spin', g.token, { bet: 5 })).status, 200, 'Google can play');
  const previous = (await Database.get()).users[g.user.username].balance;
  const again = await call('/api/auth/google', null, { token: 'google-player' });
  eq([again.data.user.id, again.data.user.balance, again.data.user.displayName], [g.user.id, previous, 'My Chosen Name'], 'Google relogin preserves account, money and name');
  const rank = (await call('/api/leaderboard')).data.leaderboard.find(p => p.id === g.user.id);
  eq([rank.name, rank.avatar], ['My Chosen Name', 'https://lh3.googleusercontent.com/test-photo'], 'public ranking name and photo');
  const uploadedPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
  eq((await call('/api/profile', null, { displayName: 'Guest', avatar: uploadedPhoto })).status, 401, 'photo upload requires login');
  for (const avatar of ['https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,aGVsbG8=', 'data:image/jpeg;base64,' + 'A'.repeat(120000)]) {
    eq((await call('/api/profile', g.token, { displayName: 'My Chosen Name', avatar })).status, 400, 'invalid photo rejected');
  }
  const photoUpdate = await call('/api/profile', g.token, { displayName: 'My Chosen Name', avatar: uploadedPhoto });
  eq(photoUpdate.status, 200, 'photo upload accepted');
  eq(photoUpdate.data.user.avatar, uploadedPhoto, 'photo returned to profile');
  eq((await call('/api/leaderboard')).data.leaderboard.find(p => p.id === g.user.id).avatar, uploadedPhoto, 'uploaded photo in ranking');
  eq((await call('/api/profile', g.token, { displayName: 'My Chosen Name' })).data.user.avatar, uploadedPhoto, 'name-only edit preserves photo');
  eq((await call('/api/auth/google', null, { token: 'google-player' })).data.user.avatar, uploadedPhoto, 'Google relogin preserves uploaded photo');
  eq((await call('/api/auth/me', g.token)).data.user.avatar, uploadedPhoto, 'photo persists in session');
  await mutate(db => { db.users[g.user.username].balance = 2503; });
  eq((await call('/api/spin', g.token, { bet: 2504 })).status, 400, 'cannot bet above current balance');
  for (const bet of [0, 4, 5.5, '2503', null]) {
    eq((await call('/api/spin', g.token, { bet })).status, 400, 'invalid bet rejected');
  }
  const allIn = await call('/api/spin', g.token, { bet: 2503 });
  eq(allIn.status, 200, 'can bet entire balance above 1000');
  eq(allIn.data.outcome.newBalance, allIn.data.outcome.winAmount, 'entire balance deducted exactly once');
  eq((await call('/api/reset', g.token, { type: 'voluntary' })).data.balance, 1000, 'reset remains functional');
  eq((await call('/api/admin/check', null, undefined, 'GET', { cookie: 'cns_session=' + founder.token })).status, 200, 'page cookie shares existing session');
  eq((await call('/api/admin/users/ban', founder.token, { targetId: user.user.id, reason: 'test' }, 'POST', { origin: 'https://evil.test', host: 'game.test' })).status, 403, 'cross-origin mutation rejected');
  await mutate(db => { db.rateLimits = {}; });
  for (let n = 0; n < 121; n++) { const r = await call('/api/admin/check', admin.token); if (n === 120) eq(r.status, 429, 'shared rate limit'); }
  eq((await call('/api/auth/logout', g.token, {})).status, 200, 'logout');
  eq((await call('/api/auth/me', g.token)).status, 401, 'logout invalidates token');
  await mutate(db => {
    for (let n = 0; n < 130; n++) db.admin_logs.unshift({ id: 'pagination-' + n, adminId: founder.user.id, action: 'test' });
  });
  const firstPage = (await call('/api/admin/logs', founder.token)).data;
  const nextPage = (await call('/api/admin/logs?before=' + firstPage.nextCursor, founder.token)).data;
  eq(firstPage.logs.length, 100, 'logs pagination first page');
  eq(new Set([...firstPage.logs, ...nextPage.logs].map(l => l.id)).size, (await Database.get()).admin_logs.length, 'all audit records reachable without duplicates');
  const server = require('./server');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/admin', '/admin/', '/admin.html', '/api/admin/page']) {
      eq((await fetch(base + route)).status, 401, 'HTTP protected page ' + route);
      eq((await fetch(base + route, { headers: { cookie: 'cns_session=' + user.token } })).status, 403, 'HTTP normal user ' + route);
      const page = await fetch(base + route, { headers: { cookie: 'cns_session=' + founder.token } });
      eq(page.status, 200, 'HTTP founder ' + route);
      eq((await page.text()).includes('<base href="/">'), true, 'admin assets resolve correctly');
    }
    for (const route of ['/server/data/db.json', '/server/apiHandler.js', '/server/admin.html', '/server/founder.json', '/.git/config', '/package.json']) eq((await fetch(base + route)).status, 404, 'private file blocked ' + route);
    eq((await fetch(base + '/')).status, 200, 'game page works');
    eq((await fetch(base + '/js/app.js')).status, 200, 'public script works');
    eq((await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400, 'HTTP malformed JSON');
  } finally { await new Promise(resolve => server.close(resolve)); }
  // A legacy role/email alone must not survive migration as founder.
  const configured = require('./founder.json').userId;
  await mutate(db => {
    delete db.founderId;
    db.users.pinned = { ...user.user, id: configured, username: 'pinned', role: 'user' };
    db.sessions.oldFounder = { username: 'pinned', userId: configured, createdAt: Date.now() };
  });
  await call('/api/health');
  const migrated = await Database.get();
  eq(migrated.founderId, configured, 'existing founder pinned by server ID');
  eq(migrated.users.pinned.role, 'founder', 'pinned account promoted');
  eq(Object.values(migrated.users).filter(u => u.role === 'founder').length, 1, 'only one founder after migration');
  eq(migrated.sessions.oldFounder, undefined, 'migration invalidates old sessions');
  console.log(`PASS: ${checks} assertions; isolated database; no real user data changed.`);
}
run().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => {
  for (const file of ['db.json', 'db.json.tmp']) { const target = path.join(temp, file); if (fs.existsSync(target)) fs.unlinkSync(target); }
  fs.rmdirSync(temp);
});
