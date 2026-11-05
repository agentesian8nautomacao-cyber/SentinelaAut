/**
 * B7-C — Router read coverage + pilot readonly client (isolated Docker network).
 * No loopback guard — runs via: docker run --network sentinelaaut-n8n-dp02b3-isolated ...
 */
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const N8N = (process.env.B4_N8N_BASE || 'http://sentinelaaut-n8n-dp02b3-import:5678').replace(/\/$/, '');
const PILOT = (process.env.B7_PILOT_BASE || 'http://sentinelaaut-api-pilot-dp02b3:3099').replace(/\/$/, '');
const PATH = '/webhook/sentinelaaut/aut-2f-001';
const KEY_ID = process.env.B4_KEY_ID || 'b4-e2e-clone-key-id';
const AGENT_SECRET = process.env.B4_HMAC_SECRET || 'b4-e2e-hmac-secret-not-production';
const API_SECRET = process.env.SENTINELA_HARNESS_SECRET || 'test-secret-do-not-use-in-prod';
const ORG = process.env.SENTINELA_HARNESS_ORG || '0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928';
const CONDO = process.env.SENTINELA_HARNESS_CONDO || '3f383313-5ec0-4d21-97c7-1b2500c933be';
const FULL_CLIENT = process.env.SENTINELA_HARNESS_CLIENT_ID || 'n8n-pilot-test';
const READONLY_CLIENT = 'n8n-pilot-readonly';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function signAgent(rawBody, timestamp, nonce) {
  const canonical = ['agent-v1', timestamp, nonce, 'POST', PATH, sha256Hex(rawBody)].join('\n');
  return crypto.createHmac('sha256', AGENT_SECRET).update(canonical, 'utf8').digest('hex');
}

function signApiV1({ method, pathWithQuery, body, timestamp, clientId, org, condo, idempotencyKey = '' }) {
  const canonical = [
    'v1',
    timestamp,
    method.toUpperCase(),
    pathWithQuery,
    sha256Hex(body || ''),
    org,
    condo,
    idempotencyKey
  ].join('\n');
  return crypto.createHmac('sha256', API_SECRET).update(canonical, 'utf8').digest('hex');
}

function summarizeEnvelope(text) {
  try {
    const j = JSON.parse(text);
    const r = j.result || {};
    return {
      ok: r.ok ?? j.ok,
      httpStatus: r.httpStatus ?? r.http_status ?? j.http_status,
      error_code: r.error_code ?? j.error_code,
      intent: j.intent ?? r.intent,
      dispatched_aut: j.dispatched_aut ?? r.dispatched_aut ?? r.aut
    };
  } catch {
    return { raw: String(text).slice(0, 160) };
  }
}

async function webhookIntent(intent, payloadExtra = {}) {
  const rawBody = JSON.stringify({ intent, ...payloadExtra });
  const nonce = `b7c-${intent}-${Date.now()}-abcdef01`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${N8N}${PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-key-id': KEY_ID,
      'x-agent-timestamp': timestamp,
      'x-agent-nonce': nonce,
      'x-agent-signature': signAgent(rawBody, timestamp, nonce)
    },
    body: rawBody
  });
  const text = await res.text();
  return { case: `gateway_${intent}`, status: res.status, summary: summarizeEnvelope(text) };
}

async function pilotCall(scenario, opts) {
  const method = opts.method || 'GET';
  const pathWithQuery = opts.path;
  const body = opts.body ? JSON.stringify(opts.body) : '';
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const clientId = opts.clientId ?? FULL_CLIENT;
  const headers = {
    'X-Request-Id': `b7c-${scenario}-${Date.now()}`,
    'X-Sentinela-Client-Id': clientId,
    'X-Sentinela-Timestamp': timestamp,
    'X-Organization-Id': ORG,
    'X-Condominium-Id': CONDO,
    'X-Sentinela-Signature': signApiV1({
      method,
      pathWithQuery,
      body,
      timestamp,
      clientId,
      org: ORG,
      condo: CONDO,
      idempotencyKey: opts.idempotencyKey || ''
    }),
    ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {})
  };
  if (opts.omitSignature) delete headers['X-Sentinela-Signature'];
  const res = await fetch(`${PILOT}${pathWithQuery}`, { method, headers, body: body || undefined });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 120) };
  }
  return {
    case: scenario,
    http: res.status,
    success: json.success,
    error_code: json.error?.code ?? null
  };
}

async function waitReady() {
  for (let i = 0; i < 45; i++) {
    const p = await fetch(`${PILOT}/api/v1/health`).then((r) => r.status).catch(() => 0);
    const w = await fetch(`${N8N}${PATH}`, { method: 'POST', body: '{}' }).then((r) => r.status).catch(() => 404);
    if (p === 200 && w !== 404) return true;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

const READ_CASES = [
  ['LIST_EVENTS', { limit: 5 }],
  ['LIST_PACKAGES', { status: 'pendente' }],
  ['LIST_OCCURRENCES', { status: 'aberta' }],
  ['LIST_RESERVATIONS', { unit: '101' }],
  ['LIST_AREAS', {}],
  ['CHECK_AVAILABILITY', { area_id: 'area-pilot', date: '2026-08-21', start_time: '10:00', end_time: '12:00' }],
  ['QUERY_BOLETO', { unit: '101' }]
];

const out = { phase: 'B7-C', pilot: PILOT, n8n: N8N, results: [] };

if (!(await waitReady())) {
  out.results.push({ case: 'infra_not_ready' });
  console.log(JSON.stringify(out, null, 2));
  process.exit(2);
}

out.results.push({ case: 'pilot_health', http: await fetch(`${PILOT}/api/v1/health`).then((r) => r.status) });

for (const [intent, payload] of READ_CASES) {
  out.results.push(await webhookIntent(intent, payload));
}

out.results.push(
  await pilotCall('readonly_residents_view_ok', {
    path: '/api/v1/residents/identify?phone=5511999990001'
  })
);
out.results.push(
  await pilotCall('readonly_packages_denied', {
    path: '/api/v1/operations/packages?status=pendente',
    clientId: READONLY_CLIENT
  })
);
out.results.push(
  await pilotCall('readonly_events_denied', {
    path: '/api/v1/events?limit=1',
    clientId: READONLY_CLIENT
  })
);
out.results.push(
  await pilotCall('readonly_invalid_signature', {
    path: '/api/v1/residents/identify?phone=5511999990001',
    omitSignature: true
  })
);

const pkgBody = {
  recipient_name: 'B7C Test',
  unit: '101',
  type: 'Caixa',
  received_by_name: 'Porteiro'
};
out.results.push(
  await pilotCall('write_readonly_create_package_403', {
    method: 'POST',
    path: '/api/v1/operations/packages',
    body: pkgBody,
    clientId: READONLY_CLIENT,
    idempotencyKey: `b7c-ro-${Date.now()}`
  })
);

out.results.push(
  await pilotCall('write_full_client_create_package', {
    method: 'POST',
    path: '/api/v1/operations/packages',
    body: pkgBody,
    idempotencyKey: `b7c-w-${Date.now()}`
  })
);

const outPath = process.env.B7C_MATRIX_OUT || resolve(__dirname, 'b7c-matrix-output.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(out, null, 2));
console.log(`[b7c] wrote ${outPath}`);
