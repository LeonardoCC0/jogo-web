/**
 * CYBER NEON SLOTS - Servidor Local Node.js
 * Executa estáticos do frontend e redireciona rotas /api/* para o apiHandler.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApiRequest } = require('./apiHandler');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Cabeçalhos de Segurança Padrão
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;
  if (['/admin', '/admin/', '/admin.html'].includes(pathname)) pathname = '/api/admin/page';

  // Roteamento de API
  if (pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });

    req.on('end', () => {
      let data = {};
      try {
        if (body) data = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON inválido.' }));
        return;
      }

      handleApiRequest(req, res, pathname, req.method, data).catch(err => {
        console.error('Erro na API:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro interno no servidor.' }));
      });
    });
    return;
  }

  // Servidor de Arquivos Estáticos (Frontend)
  if (pathname !== '/' && pathname !== '/index.html' && !/^\/(css|js)\/[a-zA-Z0-9_-]+\.(css|js)$/.test(pathname)) {
    res.writeHead(404);
    res.end('Não encontrado');
    return;
  }
  let targetPath = pathname;
  if (pathname === '/' || pathname === '') {
    targetPath = 'index.html';
  } else if (pathname === '/admin' || pathname === '/admin/') {
    targetPath = 'admin.html';
  }

  let filePath = path.join(PUBLIC_DIR, targetPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Acesso negado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Não Encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

if (require.main === module) server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🎰 CYBER NEON SLOTS - SERVIDOR ATIVO`);
  console.log(`🌐 Acessível em: http://localhost:${PORT}`);
  console.log(`🔒 Sistema de Login, Score Persistente e Ranking Real`);
  console.log(`====================================================`);
});

module.exports = server;
