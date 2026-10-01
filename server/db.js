const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const scope = new AsyncLocalStorage();

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

    // Mantido porque o apiHandler utiliza essa função.
    // O projeto agora NÃO utiliza Redis/KV.
    isCloudMode() {
        return false;
    },

    async get() {
        const transaction = scope.getStore();

        if (transaction) {
            return transaction.data;
        }

        return readDatabase();
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