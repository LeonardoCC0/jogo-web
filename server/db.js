/**
 * CYBER NEON SLOTS - Persistência no Supabase PostgreSQL
 *
 * Mantém a interface de dados usada pelo apiHandler, mas o armazenamento
 * fica no Supabase. Os tokens de sessão são armazenados apenas como hash.
 */

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar configuradas no backend.');
  }
}

async function supabaseFetch(path, options = {}) {
  assertConfigured();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = text; }
  }

  if (!response.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }

  return data;
}

function emptyDb() {
  return {
    users: {},
    sessions: {}, // mantido apenas por compatibilidade; sessões reais ficam no Supabase
    history: [],
    admin_logs: [],
    total_spins: 0
  };
}

function userFromRow(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email || '',
    passwordHash: row.password_hash || undefined,
    salt: row.salt || undefined,
    googleId: row.google_id || undefined,
    avatar: row.avatar || '⚡',
    balance: Number(row.balance || 0),
    highestWin: Number(row.highest_win || 0),
    score: Number(row.score || 0),
    role: row.role || 'user',
    isBanned: !!row.is_banned,
    banReason: row.ban_reason || undefined,
    bannedAt: row.banned_at ? new Date(row.banned_at).getTime() : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
  };
}

function historyFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id || undefined,
    username: row.username || '',
    betAmount: Number(row.bet_amount || 0),
    winAmount: Number(row.win_amount || 0),
    multiplier: Number(row.multiplier || 0),
    resultType: row.result_type || undefined,
    symbols: row.symbols || undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

function logFromRow(row) {
  const details = row.details && typeof row.details === 'object' ? row.details : {};
  return {
    ...details,
    id: row.id,
    adminId: row.admin_id || details.adminId,
    adminEmail: row.admin_email || details.adminEmail,
    adminUsername: row.admin_username || details.adminUsername,
    action: row.action,
    targetUserId: row.target_user_id || details.targetUserId,
    targetUsername: row.target_username || details.targetUsername,
    timestamp: row.timestamp ? new Date(row.timestamp).getTime() : Date.now()
  };
}

async function loadFromSupabase() {
  const [users, history, logs, stats] = await Promise.all([
    supabaseFetch('users?select=*'),
    supabaseFetch('history?select=*'),
    supabaseFetch('admin_logs?select=*'),
    supabaseFetch('game_stats?select=*')
  ]);

  const db = emptyDb();

  for (const row of users || []) {
    const user = userFromRow(row);
    db.users[String(user.username).toLowerCase()] = user;
  }

  db.history = (history || []).map(historyFromRow);
  db.admin_logs = (logs || []).map(logFromRow);
  db.total_spins = Number(stats?.[0]?.total_spins || 0);

  return db;
}

function isoFromMillis(value) {
  return new Date(Number(value || Date.now())).toISOString();
}

function userToRow(user) {
  return {
    id: user.id,
    username: String(user.username || '').toLowerCase(),
    display_name: user.displayName || user.username || '',
    email: user.email || null,
    password_hash: user.passwordHash || null,
    salt: user.salt || null,
    google_id: user.googleId || null,
    avatar: user.avatar || '⚡',
    balance: Number(user.balance || 0),
    highest_win: Number(user.highestWin || 0),
    score: Number(user.score || 0),
    role: user.role || 'user',
    is_banned: !!user.isBanned,
    ban_reason: user.banReason || null,
    banned_at: user.bannedAt ? isoFromMillis(user.bannedAt) : null,
    created_at: isoFromMillis(user.createdAt),
    updated_at: isoFromMillis(user.updatedAt)
  };
}

function historyToRow(item) {
  return {
    id: item.id || crypto.randomUUID(),
    user_id: item.userId || null,
    username: item.username || null,
    bet_amount: Number(item.betAmount || 0),
    win_amount: Number(item.winAmount || 0),
    multiplier: Number(item.multiplier || 0),
    result_type: item.resultType || null,
    symbols: item.symbols || null,
    created_at: isoFromMillis(item.createdAt)
  };
}

function logToRow(log) {
  const details = { ...log };
  for (const key of ['id','adminId','adminEmail','adminUsername','action','targetUserId','targetUsername','timestamp']) {
    delete details[key];
  }

  return {
    id: log.id || `log_${crypto.randomUUID().slice(0, 8)}`,
    admin_id: log.adminId || null,
    admin_email: log.adminEmail || null,
    admin_username: log.adminUsername || null,
    action: log.action || 'unknown',
    target_user_id: log.targetUserId || null,
    target_username: log.targetUsername || null,
    details,
    timestamp: isoFromMillis(log.timestamp)
  };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

const Database = {
  async get() {
    // Sempre lê a versão atual do banco. Isso é importante na Vercel porque
    // várias instâncias podem existir ao mesmo tempo.
    return loadFromSupabase();
  },

  async save(db) {
    const users = Object.values(db.users || {}).map(userToRow);
    if (users.length) {
      await supabaseFetch('users?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(users)
      });
    }

    const history = (db.history || []).map(historyToRow);
    if (history.length) {
      await supabaseFetch('history?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(history)
      });
    }

    const logs = (db.admin_logs || []).map(logToRow);
    if (logs.length) {
      await supabaseFetch('admin_logs?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(logs)
      });
    }

    await supabaseFetch('game_stats?id=eq.1', {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ total_spins: Number(db.total_spins || 0) })
    });

    return true;
  },

  async getSession(token) {
    if (!token) return null;
    const rows = await supabaseFetch(
      `sessions?token_hash=eq.${encodeURIComponent(hashToken(token))}&select=user_id,username,created_at&limit=1`
    );
    if (!rows || !rows[0]) return null;
    return {
      userId: rows[0].user_id,
      username: rows[0].username,
      createdAt: new Date(rows[0].created_at).getTime()
    };
  },

  async createSession(token, session) {
    await supabaseFetch('sessions?on_conflict=token_hash', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{
        token_hash: hashToken(token),
        user_id: session.userId,
        username: session.username,
        created_at: isoFromMillis(session.createdAt),
        expires_at: null
      }])
    });
    return true;
  },

  async deleteSession(token) {
    if (!token) return true;
    await supabaseFetch(`sessions?token_hash=eq.${encodeURIComponent(hashToken(token))}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    });
    return true;
  },

  async deleteSessionsForUser(userId, username) {
    if (userId) {
      await supabaseFetch(`sessions?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
    } else if (username) {
      await supabaseFetch(`sessions?username=eq.${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
    }
    return true;
  },

  isCloudMode() {
    return !!(SUPABASE_URL && SUPABASE_SECRET_KEY);
  }
};

module.exports = Database;
