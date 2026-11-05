/**
 * B4 E2E matrix — isolated Docker network only. Synthetic creds via defaults.
 */
import crypto from 'node:crypto';

const BASE = (process.env.B4_N8N_BASE || 'http://sentinelaaut-n8n-dp02b3-import:5678').replace(/\/$/, '');
const CONSUME = (process.env.B4_CONSUME_BASE || 'http://sentinelaaut-agent-nonce-sidecar-dp02b3:3098').replace(/\/$/, '');
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

async function webhook(rawBody, opts = {}) {
  const nonce = opts.nonce || `b4-e2e-nonce-${Date.now()}-abcdef01`;
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = opts.signature ?? sign(rawBody, timestamp, nonce);
  const res = await fetch(`${BASE}${PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-key-id': opts.keyId ?? KEY_ID,
      'x-agent-timestamp': timestamp,
      'x-agent-nonce': nonce,
      'x-agent-signature': signature
    },
    body: rawBody
  });
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 600), nonce, timestamp };
}

async function consume(nonce) {
  const res = await fetch(`${CONSUME}/api/v1/agent-gateway/nonce/consume`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-sentinela-agent-gateway-internal-token': INTERNAL
    },
    body: JSON.stringify({ key_id: KEY_ID, nonce, consumed_ms: Date.now() })
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const out = [];
const listBody = JSON.stringify({ intent: 'LIST_EVENTS' });
const unsupportedBody = JSON.stringify({ intent: 'UNSUPPORTED_INTENT_B4_PROBE' });

out.push({ case: 'consume_health', ...(await fetch(`${CONSUME}/api/v1/health`).then(async (r) => ({ status: r.status }))) });

{
  const n = `b4-e2e-fresh-${Date.now()}-abcdef01`;
  out.push({ case: 'consume_new_nonce', nonce: n, ...(await consume(n)) });
  out.push({ case: 'consume_replay', ...(await consume(n)) });
}

{
  const r = await webhook(listBody);
  out.push({ case: 'webhook_valid_list_events', ...r });
}

{
  const n = `b4-e2e-replay-${Date.now()}-abcdef01`;
  const r1 = await webhook(unsupportedBody, { nonce: n });
  const r2 = await webhook(unsupportedBody, { nonce: n });
  out.push({ case: 'webhook_replay_same_nonce', first: r1, second: r2 });
}

{
  const n = `b4-e2e-badsig-${Date.now()}-abcdef01`;
  out.push({
    case: 'webhook_bad_signature',
    ...(await webhook(listBody, { nonce: n, signature: '0'.repeat(64) }))
  });
}

{
  const n = `b4-e2e-oldts-${Date.now()}-abcdef01`;
  const oldTs = String(Math.floor(Date.now() / 1000) - 9999);
  out.push({ case: 'webhook_stale_timestamp', ...(await webhook(listBody, { nonce: n, timestamp: oldTs })) });
}

console.log(JSON.stringify(out, null, 2));
