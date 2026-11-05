/**
 * D-P0-2B-4B-A3 — Minimal HTTP server for POST /api/v1/agent-gateway/nonce/consume (SQLite).
 * Clone isolated network only — NOT production.
 */
import { createServer } from 'node:http';
import nonceConsume from '../../api/v1/_lib/handlers/agent-gateway/nonce-consume';

const PORT = Number(process.env.SENTINELA_NONCE_SIDECAR_PORT || 3098);
const HOST = String(process.env.SENTINELA_NONCE_SIDECAR_HOST || '0.0.0.0');

function notFound(): Response {
  return new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleFetch(req: import('node:http').IncomingMessage, body: Buffer): Promise<Response> {
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET' && url.pathname === '/api/v1/health') {
    const sqlite = String(process.env.SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH || '').trim();
    return Response.json({
      success: true,
      service: 'agent-gateway-nonce-sidecar',
      nonce_store: sqlite ? 'sqlite' : 'not_configured'
    });
  }

  if (method === 'POST' && url.pathname === '/api/v1/agent-gateway/nonce/consume') {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      headers.set(k, Array.isArray(v) ? v.join(',') : v);
    }
    return nonceConsume.fetch(
      new Request(url.toString(), {
        method: 'POST',
        headers,
        body: body.length ? body : undefined
      })
    );
  }

  return notFound();
}

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    void (async () => {
      try {
        const body = Buffer.concat(chunks);
        const response = await handleFetch(req, body);
        const text = await response.text();
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });
        res.end(text);
      } catch {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: { code: 'SIDEcar_INTERNAL' } }));
      }
    })();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[nonce-sidecar] listening http://${HOST}:${PORT}`);
});
