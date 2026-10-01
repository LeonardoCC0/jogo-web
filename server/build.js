const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dest = path.join(root, 'dist');
fs.mkdirSync(dest, { recursive: true });
// Somente recursos públicos. Banco, painel protegido e código servidor não são publicados.
for (const name of ['index.html', 'css', 'js']) fs.cpSync(path.join(root, name), path.join(dest, name), { recursive: true });
