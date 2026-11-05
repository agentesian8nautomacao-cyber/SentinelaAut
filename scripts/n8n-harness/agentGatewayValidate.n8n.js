/**
 * n8n Code node — Validate Agent Gateway (agent-v1) — B16-B / B16-B-R1
 * Mirror: scripts/n8n-harness/agentGatewayV1.ts + agentGatewayNonceMode.ts
 *
 * Env:
 *   SENTINELA_AGENT_GATEWAY_ENABLED=1
 *   SENTINELA_AGENT_GATEWAY_SECRETS=[{key_id,secret,...}]
 *   SENTINELA_AGENT_GATEWAY_NONCE_STORE=unavailable|memory_test|persistent
 *   SENTINELA_AGENT_GATEWAY_ALLOW_MEMORY_TEST=1  (required with memory_test)
 *   SENTINELA_AGENT_GATEWAY_TEST_ENV=1           (required with memory_test)
 *   SENTINELA_AGENT_GATEWAY_HARNESS_RUNTIME=local_n8n|vitest  (third gate, B16-B-R2)
 *   SENTINELA_AGENT_GATEWAY_PRODUCTION=1         (blocks memory_test)
 *   B16-C persistent:
 *   SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL=https://.../api/v1/agent-gateway/nonce/consume
 *   SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN=...
 *
 * Requires webhook options.rawBody: true
 */

const crypto = require('crypto');

const PROTOCOL = 'agent-v1';
const METHOD = 'POST';
const CANONICAL_PATH = '/webhook/sentinelaaut/aut-2f-001';
const HDR_KEY = 'x-agent-key-id';
const HDR_TS = 'x-agent-timestamp';
const HDR_NONCE = 'x-agent-nonce';
const HDR_SIG = 'x-agent-signature';
const FORGED_BODY_KEYS = [
  '_agentGatewayPassed',
  'organization_id',
  'organizationId',
  'org_id',
  'orgId',
  'condominium_id',
  'condominiumId',
  'tenant_id',
  'tenantId'
];

function headerLookup(headers, name) {
  const lower = name.toLowerCase();
  const src = headers && typeof headers === 'object' ? headers : {};
  for (const k of Object.keys(src)) {
    if (String(k).toLowerCase() === lower) return String(src[k] || '').trim();
  }
  return '';
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function safeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a).toLowerCase(), 'utf8');
    const bb = Buffer.from(String(b).toLowerCase(), 'utf8');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function buildCanonical(timestamp, nonce, bodySha) {
  return [PROTOCOL, timestamp, nonce, METHOD, CANONICAL_PATH, bodySha].join('\n');
}

function signCanonical(secret, canonical) {
  return crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

function verifySignature(secrets, canonical, provided) {
  const p = String(provided || '').trim().toLowerCase();
  if (!p || !/^[0-9a-f]+$/.test(p)) return false;
  for (const s of secrets) {
    if (!s) continue;
    const exp = signCanonical(s, canonical);
    if (safeEqualHex(exp, p)) return true;
  }
  return false;
}

function checkTimestamp(tsRaw, nowMs, windowSec) {
  const raw = String(tsRaw || '').trim();
  if (!raw || !/^\d+$/.test(raw)) return false;
  if (raw.length >= 13) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const nowSec = Math.floor(nowMs / 1000);
  const skew = ts - nowSec;
  if (skew < -windowSec || skew > windowSec) return false;
  return true;
}

function parseSecrets(raw) {
  if (!raw || !String(raw).trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const key_id = String(row.key_id || '').trim();
    const secret = String(row.secret || '').trim();
    if (!key_id || !secret) continue;
    out.push({
      key_id,
      secret,
      secret_previous:
        typeof row.secret_previous === 'string' && row.secret_previous.trim()
          ? row.secret_previous.trim()
          : undefined,
      status: row.status === 'revoked' ? 'revoked' : row.status === 'active' ? 'active' : undefined
    });
  }
  return out;
}

function isProductionRuntime(signals) {
  if (String(signals.productionLock || '').trim() === '1') return true;
  if (String(signals.nodeEnv || '').trim().toLowerCase() === 'production') return true;
  if (String(signals.vercelEnv || '').trim().toLowerCase() === 'production') return true;
  return false;
}

function resolveHarnessRuntime(signals) {
  if (isProductionRuntime(signals)) return { ok: false };
  const vitestOn = String(signals.vitest || '').trim().toLowerCase() === 'true';
  const hr = String(signals.harnessRuntime || '').trim().toLowerCase();
  if (vitestOn) return { ok: true };
  if (hr === 'vitest' || hr === 'local_n8n') return { ok: true };
  return { ok: false };
}

function hasPersistentNonceConfig(env) {
  const url = String(env.nonceConsumeUrl || '').trim();
  const tok = String(env.internalToken || '').trim();
  return Boolean(url && tok);
}

function resolveNonceMode(env) {
  const mode = String(env.nonceStore || 'unavailable').trim().toLowerCase();
  if (!mode || mode === 'unavailable') return { ok: false };
  if (mode === 'persistent') {
    if (!hasPersistentNonceConfig(env)) return { ok: false };
    return { ok: true, mode: 'persistent' };
  }
  if (mode === 'memory_test') {
    const allow = String(env.allowMemoryTest || '').trim() === '1';
    const testEnv = String(env.testEnv || '').trim() === '1';
    if (!allow || !testEnv) return { ok: false };
    if (!resolveHarnessRuntime(env).ok) return { ok: false };
    return { ok: true, mode: 'memory_test' };
  }
  return { ok: false };
}

function fail(httpStatus, publicCode) {
  return [
    {
      json: {
        skip_http: true,
        error_code: publicCode,
        httpStatus,
        agent_gateway_blocked: true,
        user_safe: { success: false, httpStatus, error_code: publicCode }
      }
    }
  ];
}

function extractRawBody(item) {
  if (typeof item.rawBody === 'string') return item.rawBody;
  if (typeof item.body === 'string') return item.body;
  const binFromItem =
    item.binary && item.binary.data && item.binary.data.data ? item.binary : null;
  const binRoot =
    typeof $binary !== 'undefined' && $binary && $binary.data && $binary.data.data ? $binary : null;
  const bin = binFromItem || binRoot;
  if (bin && bin.data && bin.data.data) {
    return Buffer.from(bin.data.data, 'base64').toString('utf8');
  }
  return '';
}

const KEY_ID_RE = /^[A-Za-z0-9_.:-]{3,64}$/;
const NONCE_RE = /^[A-Za-z0-9_.:-]{16,128}$/;
const HDR_INTERNAL = 'x-sentinela-agent-gateway-internal-token';
const PUBLIC_FORBIDDEN = 'AGENT_GATEWAY_FORBIDDEN';

function mapNonceConsumeHttpStatus(statusCode) {
  const s = Number(statusCode) || 0;
  if (s === 200) return 'ok';
  if (s === 409) return 'replay';
  if (s === 401) return 'unauthorized';
  if (s === 403) return 'forbidden';
  if (s === 400) return 'bad_request';
  return 'unavailable';
}

function resolveHttpRequestFn() {
  if (typeof helpers !== 'undefined' && helpers && typeof helpers.httpRequest === 'function') {
    return helpers.httpRequest.bind(helpers);
  }
  if (typeof $helpers !== 'undefined' && $helpers && typeof $helpers.httpRequest === 'function') {
    return $helpers.httpRequest.bind($helpers);
  }
  return undefined;
}

async function consumePersistentNonceViaApi(keyId, nonce, nowMs, env, httpRequest) {
  const url = String(env.nonceConsumeUrl || '').trim();
  const tok = String(env.internalToken || '').trim();
  if (!url || !tok) return 'unavailable';
  try {
    let statusCode;
    if (typeof httpRequest === 'function') {
      const resp = await httpRequest({
        method: 'POST',
        url,
        headers: {
          [HDR_INTERNAL]: tok,
          'Content-Type': 'application/json'
        },
        body: { key_id: keyId, nonce, consumed_ms: nowMs },
        json: true,
        returnFullResponse: true,
        ignoreHttpStatusErrors: true
      });
      statusCode =
        resp.statusCode ||
        resp.status ||
        (resp.response && resp.response.statusCode) ||
        0;
      if (!statusCode && resp.body && typeof resp.body === 'object' && resp.body.success === true) {
        statusCode = 200;
      }
    } else if (typeof fetch === 'function') {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          [HDR_INTERNAL]: tok,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key_id: keyId, nonce, consumed_ms: nowMs })
      });
      statusCode = resp.status;
    } else {
      return 'unavailable';
    }
    return mapNonceConsumeHttpStatus(statusCode);
  } catch {
    return 'unavailable';
  }
}

return (async () => {
  const enabled = String($env.SENTINELA_AGENT_GATEWAY_ENABLED || '').trim() === '1';
  if (!enabled) {
    return fail(503, 'AGENT_GATEWAY_UNAVAILABLE');
  }

  const windowRaw = String($env.SENTINELA_AGENT_GATEWAY_TIMESTAMP_WINDOW_SECONDS || '').trim();
  let windowSec = windowRaw ? Number(windowRaw) : 300;
  if (!Number.isFinite(windowSec) || windowSec < 30 || windowSec > 3600) windowSec = 300;

  const headers = ($json.headers && typeof $json.headers === 'object' ? $json.headers : {}) || {};
  let webhookItem = $json;
  try {
    const wh = $('Webhook Trigger').first();
    if (wh && wh.json) {
      webhookItem = Object.assign({}, wh.json, wh.binary ? { binary: wh.binary } : {});
    }
  } catch (_) {
    /* manual / form ingress */
  }
  const rawBody = extractRawBody(webhookItem);
  if (!rawBody) {
    return fail(401, 'AGENT_AUTH_FAILED');
  }

  const keyId = headerLookup(headers, HDR_KEY);
  const timestamp = headerLookup(headers, HDR_TS);
  const nonce = headerLookup(headers, HDR_NONCE);
  const signature = headerLookup(headers, HDR_SIG);

  if (!keyId || !KEY_ID_RE.test(keyId)) return fail(401, 'AGENT_AUTH_FAILED');
  if (!nonce || !NONCE_RE.test(nonce)) return fail(401, 'AGENT_AUTH_FAILED');
  if (!signature) return fail(401, 'AGENT_AUTH_FAILED');
  if (!checkTimestamp(timestamp, Date.now(), windowSec)) return fail(401, 'AGENT_AUTH_FAILED');

  const secrets = parseSecrets($env.SENTINELA_AGENT_GATEWAY_SECRETS);
  const cred = secrets.find((s) => s.key_id === keyId);
  if (!cred || cred.status === 'revoked') return fail(401, 'AGENT_AUTH_FAILED');

  const bodySha = sha256Hex(rawBody);
  const canonical = buildCanonical(timestamp, nonce, bodySha);
  const secList = [cred.secret, cred.secret_previous].filter(Boolean);
  if (!verifySignature(secList, canonical, signature)) return fail(401, 'AGENT_AUTH_FAILED');

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fail(401, 'AGENT_AUTH_FAILED');
    }
  } catch {
    return fail(401, 'AGENT_AUTH_FAILED');
  }

  for (const k of FORGED_BODY_KEYS) delete parsed[k];

  const modeRes = resolveNonceMode({
    nonceStore: $env.SENTINELA_AGENT_GATEWAY_NONCE_STORE,
    allowMemoryTest: $env.SENTINELA_AGENT_GATEWAY_ALLOW_MEMORY_TEST,
    testEnv: $env.SENTINELA_AGENT_GATEWAY_TEST_ENV,
    harnessRuntime: $env.SENTINELA_AGENT_GATEWAY_HARNESS_RUNTIME,
    productionLock: $env.SENTINELA_AGENT_GATEWAY_PRODUCTION,
    nodeEnv: $env.NODE_ENV,
    vercelEnv: $env.VERCEL_ENV,
    vitest: $env.VITEST,
    nonceConsumeUrl: $env.SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL,
    internalToken: $env.SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN
  });
  if (!modeRes.ok) {
    return fail(503, 'AGENT_GATEWAY_UNAVAILABLE');
  }

  if (modeRes.mode === 'memory_test') {
    const g = $getWorkflowStaticData('global');
    if (!g._agentNonces) g._agentNonces = {};
    const nk = keyId + ':' + nonce;
    if (g._agentNonces[nk]) return fail(401, 'AGENT_AUTH_FAILED');
    g._agentNonces[nk] = Date.now();
  }

  if (modeRes.mode === 'persistent') {
    const httpFn = resolveHttpRequestFn();
    const consumed = await consumePersistentNonceViaApi(
      keyId,
      nonce,
      Date.now(),
      {
        nonceConsumeUrl: $env.SENTINELA_AGENT_GATEWAY_NONCE_CONSUME_URL,
        internalToken: $env.SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN
      },
      httpFn
    );
    if (consumed === 'replay') return fail(401, 'AGENT_AUTH_FAILED');
    if (consumed === 'forbidden') return fail(403, PUBLIC_FORBIDDEN);
    if (consumed === 'unauthorized') return fail(503, 'AGENT_GATEWAY_UNAVAILABLE');
    if (consumed === 'bad_request') return fail(503, 'AGENT_GATEWAY_UNAVAILABLE');
    if (consumed !== 'ok') return fail(503, 'AGENT_GATEWAY_UNAVAILABLE');
  }

  const out = Object.assign({}, $json);
  out.body = parsed;
  out._agentGatewayPassed = true;
  out._ingress = 'webhook';
  delete out.rawBody;
  return [{ json: out }];
})();
