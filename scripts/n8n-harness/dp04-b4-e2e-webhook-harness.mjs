/**
 * D-P0-2B-4B-B4 — E2E webhook probe (isolated network). Synthetic credentials via env only.
 */
import crypto from 'node:crypto';

const BASE = (process.env.B4_N8N_BASE || 'http://sentinelaaut-n8n-dp02b3-import:5678').replace(/\/$/, '');
const CONSUME_BASE = (process.env.B4_CONSUME_BASE || 'http://sentinelaaut-agent-nonce-sidecar-dp02b3:3098').replace(/\/$/, '');
const PATH = '/webhook/sentinelaaut/aut-2f-001';
const KEY_ID = process.env.B4_KEY_ID || 'b4-e2e-clone-key-id';
const SECRET = process.env.B4_HMAC_SECRET || 'b4-e2e-hmac-secret-not-production';
const INTERNAL = process.env.B4_INTERNAL_TOKEN || 'b4-e2e-internal-token-not-production';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function sign(rawBody, timestamp, nonce) {
  const canonical = ['agent-v1', timestamp, nonce, 'POST', PATH, sha256Hex(rawBody)].join('\n');
  return crypto.createHmac('sha256', SECRET).update(canonical, 'utf8').digest('hex');
}

async function webhook(rawBody, nonce, timestamp = String(Math.floor(Date.now() / 1000))) {
  const res = await fetch(`${BASE}${PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-key-id': KEY_ID,
      'x-agent-timestamp': timestamp,
      'x-agent-nonce': nonce,
      'x-agent-signature': sign(rawBody, timestamp, nonce)
    },
    body: rawBody
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 500) };
}

async function consume(nonce, ms = Date.now()) {
  const res = await fetch(`${CONSUME_BASE}/api/v1/agent-gateway/nonce/consume`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-sentinela-agent-gateway-internal-token': INTERNAL
    },
    body: JSON.stringify({ key_id: KEY_ID, nonce, consumed_ms: ms })
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const intentBody = JSON.stringify({ intent: 'UNSUPPORTED_INTENT_B4_PROBE' });
const nonceOk = `b4-e2e-nonce-${Date.now()}-abcdef01`;

const results = [];
results.push({ step: 'health_sidecar', ...(await fetch(`${CONSUME_BASE}/api/v1/health`).then(async (r) => ({ status: r.status, json: await r.json() }))) });
results.push({ step: 'webhook_valid', nonce: nonceOk, ...(await webhook(intentBody, nonceOk)) });
results.push({ step: 'webhook_replay', ...(await webhook(intentBody, nonceOk)) });
results.push({ step: 'consume_replay_direct', ...(await consume(nonceOk)) });
{
  const n = `b4-e2e-bad-${Date.now()}-abcdef01`;
  const ts = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${BASE}${PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-key-id': KEY_ID,
      'x-agent-timestamp': ts,
      'x-agent-nonce': n,
      'x-agent-signature': '0'.repeat(64)
    },
    body: intentBody
  });
  results.push({ step: 'webhook_bad_sig', status: res.status, body: (await res.text()).slice(0, 200) });
}

console.log(JSON.stringify(results, null, 2));
