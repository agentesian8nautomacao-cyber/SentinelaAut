/**
 * B7 — Real agent-v1 + real API pilot + n8n clone (isolated network).
 */
import crypto from 'node:crypto';

const N8N = (process.env.B4_N8N_BASE || 'http://sentinelaaut-n8n-dp02b3-import:5678').replace(/\/$/, '');
const CONSUME = (process.env.B4_CONSUME_BASE || 'http://sentinelaaut-agent-nonce-sidecar-dp02b3:3098').replace(/\/$/, '');
const PILOT = (process.env.B7_PILOT_BASE || 'http://sentinelaaut-api-pilot-dp02b3:3099').replace(/\/$/, '');
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

function summarize(text) {
  try {
    const j = JSON.parse(text);
    const r = j.result || {};
    return {
      ok: r.ok ?? j.ok,
      httpStatus: r.httpStatus ?? j.http_status,
      error_code: r.error_code ?? j.error_code,
      intent: j.intent ?? r.intent,
      dispatched_aut: j.dispatched_aut ?? r.dispatched_aut
    };
  } catch {
    return { raw: String(text).slice(0, 120) };
  }
}

async function webhook(rawBody, opts = {}) {
  const nonce = opts.nonce || `b7-nonce-${Date.now()}-abcdef01`;
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = opts.signature ?? sign(rawBody, timestamp, nonce);
  const res = await fetch(`${N8N}${PATH}`, {
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
  return { status: res.status, summary: summarize(text), nonce };
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    const p = await fetch(`${PILOT}/api/v1/health`).then((r) => r.status).catch(() => 0);
    const w = await fetch(`${N8N}${PATH}`, { method: 'POST', body: '{}' }).then((r) => r.status).catch(() => 404);
    if (p === 200 && w !== 404) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

const listBody = JSON.stringify({ intent: 'LIST_EVENTS', limit: 5 });
const out = [];

if (!(await waitReady())) {
  console.log(JSON.stringify([{ case: 'infra_not_ready', pilot: PILOT, n8n: N8N }], null, 2));
  process.exit(2);
}

out.push({ case: 'pilot_health', status: await fetch(`${PILOT}/api/v1/health`).then((r) => r.status) });

out.push({ case: 'agent_hmac_valid_list_events', ...(await webhook(listBody)) });

{
  const n = `b7-badsig-${Date.now()}-abcdef01`;
  out.push({ case: 'agent_hmac_invalid', ...(await webhook(listBody, { nonce: n, signature: '0'.repeat(64) })) });
}

{
  const n = `b7-unknown-${Date.now()}-abcdef01`;
  out.push({ case: 'agent_unknown_key_id', ...(await webhook(listBody, { nonce: n, keyId: 'unknown-b7-key' })) });
}

{
  const n = `b7-stale-${Date.now()}-abcdef01`;
  out.push({
    case: 'agent_stale_timestamp',
    ...(await webhook(listBody, { nonce: n, timestamp: String(Math.floor(Date.now() / 1000) - 9999) }))
  });
}

{
  const n = `b7-replay-${Date.now()}-abcdef01`;
  out.push({ case: 'agent_nonce_replay', first: await webhook(listBody, { nonce: n }), second: await webhook(listBody, { nonce: n }) });
}

{
  const n = `b7-tenant-${Date.now()}-abcdef01`;
  const body = JSON.stringify({
    intent: 'LIST_EVENTS',
    organization_id: '11111111-1111-1111-1111-111111111111',
    condominium_id: '22222222-2222-2222-2222-222222222222'
  });
  out.push({ case: 'agent_tenant_body_override_stripped', ...(await webhook(body, { nonce: n })) });
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

{
  const n = `b7-conc-${Date.now()}-abcdef01`;
  const results = await Promise.all(Array.from({ length: 8 }, () => consume(n)));
  const ok = results.filter((r) => r.status === 200).length;
  const replay = results.filter((r) => r.status === 409).length;
  out.push({ case: 'nonce_consume_concurrent', nonce: n, ok, replay, total: results.length });
}

console.log(JSON.stringify(out, null, 2));
