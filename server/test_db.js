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
async function run() {
  const a = instance(), b = instance();
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
}
run().catch(err => { console.error(err); process.exitCode = 1; });
