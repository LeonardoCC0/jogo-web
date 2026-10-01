const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const scope = new AsyncLocalStorage();
const DB_FILE = process.env.NODE_ENV === 'test' ? process.env.TEST_DB_FILE : path.join(__dirname, 'data', 'db.json');
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'cyber_slots_db_v1';
let queue = Promise.resolve();
function initial() { return { users: {}, sessions: {}, history: [], admin_logs: [], total_spins: 0 }; }
async function redis(command) {
  const res = await fetch(KV_URL, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Persistência indisponível');
  const data = await res.json();
  if (data.error) throw new Error('Persistência indisponível');
  return data.result;
}
function parse(raw) {
  let data = raw ? JSON.parse(raw) : initial();
  if (typeof data === 'string') data = JSON.parse(data);
  return Object.assign(initial(), data);
}
const Database = {
  isCloudMode: () => !!(KV_URL && KV_TOKEN),
  async get() {
    if (scope.getStore()) return scope.getStore().data;
    if (this.isCloudMode()) return parse(await redis(['GET', KEY]));
    if (process.env.VERCEL) throw new Error('Configure Redis para persistência em produção');
    if (!DB_FILE) throw new Error('TEST_DB_FILE obrigatório em testes');
    return parse(fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE, 'utf8') : null);
  },
  async save(data) {
    const tx = scope.getStore();
    if (!tx) throw new Error('Escritas exigem transação');
    tx.data = data;
    tx.dirty = true;
  },
  async transaction(work) {
    const run = async () => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const cloud = this.isCloudMode();
        const raw = cloud ? await redis(['GET', KEY]) : null;
        const tx = { data: cloud ? parse(raw) : await this.get(), dirty: false };
        const result = await scope.run(tx, work);
        if (!tx.dirty) return result;
        const serialized = JSON.stringify(tx.data);
        if (cloud) {
          const ok = await redis(['EVAL', "local v=redis.call('GET',KEYS[1]); if (v or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1", 1, KEY, raw || '', serialized]);
          if (!ok) continue;
        } else {
          fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
          fs.writeFileSync(DB_FILE + '.tmp', serialized, { mode: 0o600 });
          fs.renameSync(DB_FILE + '.tmp', DB_FILE);
        }
        return result;
      }
      throw new Error('Conflito de gravação; tente novamente');
    };
    const pending = queue.then(run, run);
    queue = pending.catch(() => {});
    return pending;
  }
};
module.exports = Database;
