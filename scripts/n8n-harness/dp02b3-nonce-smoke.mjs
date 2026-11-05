#!/usr/bin/env node
/**
 * D-P0-2B-4B-A3 — smoke against sidecar (run inside curl/network container or host if attached).
 */
const base = (process.env.SMOKE_BASE_URL || 'http://sentinelaaut-agent-nonce-sidecar-dp02b3:3098').replace(
  /\/$/,
  ''
);
const token = process.env.SMOKE_INTERNAL_TOKEN || 'dp03-clone-internal-token-not-production';
const keyId = process.env.SMOKE_KEY_ID || 'dp03-clone-test-key';

async function consume(nonce, ms = 1_700_000_000_000) {
  const res = await fetch(`${base}/api/v1/agent-gateway/nonce/consume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sentinela-agent-gateway-internal-token': token
    },
    body: JSON.stringify({ key_id: keyId, nonce, consumed_ms: ms })
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function health() {
  const res = await fetch(`${base}/api/v1/health`);
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const nonce = `smoke-a3-${Date.now()}-abcdef01`;

console.log('[smoke] base', base);
const h = await health();
console.log('[smoke] health', h.status, h.json?.service);
if (h.status !== 200) process.exit(1);

const n1 = await consume(nonce);
console.log('[smoke] first consume', n1.status);
if (n1.status !== 200) process.exit(1);

const n2 = await consume(nonce);
console.log('[smoke] replay', n2.status, n2.json?.error?.code);
if (n2.status !== 409) process.exit(1);

const concurrentNonce = `smoke-concurrent-${Date.now()}-abcdef01`;
const concurrent = await Promise.all(
  Array.from({ length: 8 }, () => consume(concurrentNonce))
);
const oks = concurrent.filter((r) => r.status === 200).length;
const replays = concurrent.filter((r) => r.status === 409).length;
console.log('[smoke] concurrent ok=', oks, 'replay=', replays);
if (oks !== 1 || oks + replays !== 8) process.exit(1);

console.log('[smoke] PASS');
