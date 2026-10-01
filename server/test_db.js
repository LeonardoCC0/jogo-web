// Simula o protocolo Redis, incluindo duas instâncias concorrentes e falhas.
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
let raw = JSON.stringify(JSON.stringify({ users: {}, sessions: {}, admin_logs: [], total_spins: 0 }));
let failures = false;
let conflicts = 0;
async function fakeFetch(url, options) {
  if (failures) throw new Error('Redis offline');
  const command = JSON.parse(options.body);
  let result;
  if (command[0] === 'GET') result = raw;
  else {
    assert.equal(command[0], 'EVAL');
    if ((raw || '') !== command[4]) { conflicts++; result = 0; }
    else { raw = command[5]; result = 1; }
  }
  return { ok: true, json: async () => ({ result }) };
}
function instance(env = { KV_REST_API_URL: 'https://redis.test', KV_REST_API_TOKEN: 'test' }, fetch = fakeFetch) {
  const readonlyFs = { ...fs, existsSync: () => false, mkdirSync() { throw new Error('EROFS'); }, writeFileSync() { throw new Error('EROFS'); }, renameSync() { throw new Error('EROFS'); } };
  const sandbox = { require: name => name === 'fs' ? readonlyFs : require(name), __dirname, module: { exports: {} }, process: { env: { VERCEL: '1', ...env } }, fetch, AbortSignal };
  vm.runInNewContext(fs.readFileSync(require('path').join(__dirname, 'db.js'), 'utf8'), sandbox);
  return sandbox.module.exports;
}
async function run() {
  const a = instance(), b = instance();
  assert.equal(a.isCloudMode(), true);
  assert.equal(instance({ UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'test' }).isCloudMode(), true);
  await assert.rejects(() => instance({}).get(), /Configure SUPABASE_URL/);
  async function increment(db) {
    return db.transaction(async () => {
      const state = await db.get();
      state.total_spins++;
      state.admin_logs.push({ action: 'increment' });
      await db.save(state);
    });
  }
  await Promise.all([increment(a), increment(b)]);
  const state = await a.get();
  assert.equal(state.total_spins, 2);
  assert.equal(state.admin_logs.length, 2);
  assert.ok(conflicts > 0, 'CAS conflict retried');
  failures = true;
  await assert.rejects(() => a.get(), /Redis offline/);
  await assert.rejects(() => increment(b), /Redis offline/);
  failures = false;
  assert.equal((await a.get()).total_spins, 2, 'No empty fallback or data loss');
  console.log('PASS: Redis legacy format, concurrent instances, CAS retry and storage failure.');
  let row, offline = false, supabaseConflicts = 0;
  async function supabaseFetch(url, options) {
    assert.ok(url.startsWith('https://supabase.test/rest/v1/cyber_slots_state'));
    assert.equal(options.headers.apikey, 'sb_secret_test');
    assert.equal(options.headers.Authorization, undefined, 'secret key is not a JWT');
    if (offline) return { ok: false, status: 503 };
    const body = options.body && JSON.parse(options.body);
    let result;
    if (options.method === 'GET') result = row ? [row] : [];
    else if (options.method === 'POST') {
      if (row) return { ok: false, status: 409 };
      row = body; result = [row];
    } else {
      assert.equal(options.method, 'PATCH');
      if (new URL(url).searchParams.get('version') !== 'eq.' + row.version) {
        supabaseConflicts++; result = [];
      } else { row = { ...row, ...body }; result = [row]; }
    }
    const snapshot = JSON.stringify(result);
    return { ok: true, json: async () => JSON.parse(snapshot) };
  }
  const env = { SUPABASE_URL: 'https://supabase.test', SUPABASE_SECRET_KEY: 'sb_secret_test' };
  const s1 = instance(env, supabaseFetch), s2 = instance(env, supabaseFetch);
  assert.equal(s1.isCloudMode(), true);
  await Promise.all([increment(s1), increment(s2)]);
  assert.equal((await s1.get()).total_spins, 2);
  assert.equal((await s2.get()).admin_logs.length, 2);
  assert.ok(supabaseConflicts > 0, 'Supabase concurrent update retried');
  offline = true;
  await assert.rejects(() => s1.get(), /HTTP 503/);
  await assert.rejects(() => increment(s2), /HTTP 503/);
  offline = false;
  assert.equal((await s1.get()).total_spins, 2);
  const legacy = instance({ SUPABASE_URL: 'https://supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'legacy-test' }, async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer legacy-test');
    assert.equal(options.headers.apikey, 'legacy-test');
    return { ok: true, json: async () => [row] };
  });
  assert.equal((await legacy.get()).total_spins, 2);
  console.log('PASS: Supabase initialization, concurrent writes, secret/legacy keys and storage failure.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
