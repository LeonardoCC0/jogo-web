const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const scope = new AsyncLocalStorage();
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = process.env.NODE_ENV !== 'test' && !!(SUPABASE_URL && SUPABASE_KEY);
const cloud = supabase || (process.env.NODE_ENV !== 'test' && !!(KV_URL && KV_TOKEN));
const KV_KEY = 'cyber_slots_db_v1';
const compareAndSave = "if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end redis.call('SET', KEYS[1], ARGV[2]) return 1";

async function redis(command) {
    const response = await fetch(KV_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Banco remoto indisponível (HTTP ${response.status}).`);
    const data = await response.json();
    if (data.error) throw new Error(`Erro no banco remoto: ${data.error}`);
    return data.result;
}

async function supabaseRequest(query, method = 'GET', body) {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/cyber_slots_state${query}`, {
        method,
        headers: {
            apikey: SUPABASE_KEY,
            ...(!SUPABASE_KEY.startsWith('sb_secret_') ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000)
    });
    if (method === 'POST' && response.status === 409) return [];
    if (!response.ok) throw new Error(`Supabase indisponível (HTTP ${response.status}). Confira as variáveis e execute server/supabase.sql.`);
    return response.json();
}

async function readRemote() {
    if (!supabase) {
        const raw = await redis(['GET', KV_KEY]);
        return { raw, data: parse(raw) };
    }
    const rows = await supabaseRequest('?id=eq.1&select=data,version');
    if (rows.length) return { raw: rows[0].version, data: parse(JSON.stringify(rows[0].data)) };
    // Importa o banco existente somente ao inicializar uma tabela vazia.
    const data = fs.existsSync(DB_FILE) ? parse(fs.readFileSync(DB_FILE, 'utf8')) : initial();
    await supabaseRequest('', 'POST', { id: 1, version: require('crypto').randomUUID(), data });
    const initialized = await supabaseRequest('?id=eq.1&select=data,version');
    if (!initialized.length) throw new Error('Não foi possível inicializar o banco Supabase.');
    return { raw: initialized[0].version, data: parse(JSON.stringify(initialized[0].data)) };
}

async function saveRemote(raw, data) {
    if (!supabase) return (await redis(['EVAL', compareAndSave, 1, KV_KEY, raw || '', JSON.stringify(data)])) === 1;
    const rows = await supabaseRequest(`?id=eq.1&version=eq.${encodeURIComponent(raw)}`, 'PATCH', {
        version: require('crypto').randomUUID(), data
    });
    return rows.length === 1;
}

const DB_FILE =
    process.env.NODE_ENV === 'test' && process.env.TEST_DB_FILE
        ? process.env.TEST_DB_FILE
        : path.join(__dirname, 'data', 'db.json');

let queue = Promise.resolve();

function initial() {
    return {
        users: {},
        sessions: {},
        history: [],
        admin_logs: [],
        total_spins: 0
    };
}

function parse(raw) {
    let data = raw ? JSON.parse(raw) : initial();

    if (typeof data === 'string') {
        data = JSON.parse(data);
    }

    return Object.assign(initial(), data);
}

function ensureDirectory() {
    fs.mkdirSync(path.dirname(DB_FILE), {
        recursive: true
    });
}

function readDatabase() {
    if (process.env.VERCEL && process.env.NODE_ENV !== 'test') {
        throw new Error('Configure SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) na Vercel, ou configure KV_REST_API_URL e KV_REST_API_TOKEN.');
    }
    ensureDirectory();

    if (!fs.existsSync(DB_FILE)) {
        const data = initial();

        fs.writeFileSync(
            DB_FILE,
            JSON.stringify(data, null, 2),
            {
                encoding: 'utf8',
                mode: 0o600
            }
        );

        return data;
    }

    return parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDatabase(data) {
    ensureDirectory();

    const tempFile = `${DB_FILE}.tmp`;

    fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2),
        {
            encoding: 'utf8',
            mode: 0o600
        }
    );

    fs.renameSync(tempFile, DB_FILE);
}

const Database = {

    isCloudMode() {
        return cloud;
    },

    async get() {
        const transaction = scope.getStore();

        if (transaction) {
            return transaction.data;
        }

        return cloud ? (await readRemote()).data : readDatabase();
    },

    async save(data) {
        const transaction = scope.getStore();

        // Se estiver dentro de uma transaction,
        // apenas marca os dados para serem gravados no final.
        if (transaction) {
            transaction.data = data;
            transaction.dirty = true;
            return true;
        }
        if (cloud) throw new Error('Escritas no banco remoto exigem transação.');

        // Compatibilidade com as rotas antigas do apiHandler
        // que fazem Database.get() + Database.save().
        const pending = queue.then(
            async () => {
                writeDatabase(data);
                return true;
            },
            async () => {
                writeDatabase(data);
                return true;
            }
        );

        queue = pending.catch(() => {});

        return pending;
    },

    async transaction(work) {
        const run = async () => {
            if (cloud) {
                for (let attempt = 0; attempt < 8; attempt++) {
                    const { raw, data } = await readRemote();
                    const transaction = { data, dirty: false };
                    const result = await scope.run(transaction, work);
                    if (!transaction.dirty) return result;
                    if (await saveRemote(raw, transaction.data)) return result;
                }
                throw new Error('Banco ocupado. Tente novamente.');
            }
            const transaction = {
                data: readDatabase(),
                dirty: false
            };

            const result = await scope.run(
                transaction,
                work
            );

            if (transaction.dirty) {
                writeDatabase(transaction.data);
            }

            return result;
        };

        const pending = queue.then(
            run,
            run
        );

        queue = pending.catch(() => {});

        return pending;
    }
};

module.exports = Database;
