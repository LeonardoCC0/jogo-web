/**
 * CYBER NEON SLOTS - Vercel Serverless Function Handler
 * Roteia todas as requisições /api/* na Vercel para o apiHandler central.
 */

const { handleApiRequest } = require('../server/apiHandler');

module.exports = async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  } else if (!body) {
    body = {};
  }

  try {
    await handleApiRequest(req, res, pathname, req.method, body);
  } catch (err) {
    console.error('Erro na Vercel Serverless Function:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno no servidor Vercel.' });
    }
  }
};
