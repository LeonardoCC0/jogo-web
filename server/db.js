/**
 * CYBER NEON SLOTS - Camada de Persistência Híbrida
 * Suporta:
 * 1. Arquivo local db.json (para desenvolvimento e execução local via Node.js)
 * 2. Vercel KV / Upstash Redis via REST API (para deploy 100% gratuito e persistente na Vercel)
 * 3. Fallback em memória
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Configurações para Vercel KV / Upstash Redis REST
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_KEY = 'cyber_slots_db_v1';

let inMemoryDb = null;

// Estrutura inicial limpa (sem bots)
function getInitialData() {
  return {
    users: {},       // key: lowercase username -> { id, username, displayName, passwordHash, salt, avatar, balance, highestWin, score, createdAt, updatedAt }
    sessions: {},    // key: token -> { userId, username, expiresAt }
    history: []
  };
}

// Carrega dados locais do db.json
function loadLocalDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed.users) parsed.users = {};
      if (!parsed.sessions) parsed.sessions = {};
      return parsed;
    }
  } catch (e) {
    console.warn('Aviso: Não foi possível ler db.json local:', e.message);
  }
  const initial = getInitialData();
  saveLocalDb(initial);
  return initial;
}

// Salva dados locais no db.json
function saveLocalDb(data) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Aviso: Não foi possível gravar db.json local:', e.message);
  }
}

// Operações assíncronas no Vercel KV
async function loadFromKv() {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const res = await fetch(`${KV_URL}/get/${KV_KEY}`, {
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.result) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    }
  } catch (e) {
    console.error('Erro ao conectar ao Vercel KV:', e.message);
  }
  return null;
}

async function saveToKv(data) {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const res = await fetch(`${KV_URL}/set/${KV_KEY}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(JSON.stringify(data))
    });
    return res.ok;
  } catch (e) {
    console.error('Erro ao salvar no Vercel KV:', e.message);
    return false;
  }
}

const Database = {
  async get() {
    if (KV_URL && KV_TOKEN) {
      if (!inMemoryDb) {
        const remote = await loadFromKv();
        inMemoryDb = remote || getInitialData();
      }
      return inMemoryDb;
    }

    if (!inMemoryDb) {
      inMemoryDb = loadLocalDb();
    }
    return inMemoryDb;
  },

  async save(data) {
    inMemoryDb = data;
    if (KV_URL && KV_TOKEN) {
      await saveToKv(data);
    } else {
      saveLocalDb(data);
    }
    return true;
  },

  isCloudMode() {
    return !!(KV_URL && KV_TOKEN);
  }
};

module.exports = Database;
