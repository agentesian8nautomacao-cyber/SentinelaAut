#!/usr/bin/env node
const base = (process.env.SMOKE_BASE_URL || 'http://sentinelaaut-agent-nonce-sidecar-dp02b3:3098').replace(/\/$/, '');
const token = process.env.SMOKE_INTERNAL_TOKEN || 'dp03-clone-internal-token-not-production';
const keyId = process.env.SMOKE_KEY_ID || 'dp03-clone-test-key';
const nonce = process.env.SMOKE_FIXED_NONCE || 'smoke-persist-restart-abcdef01';

async function consume() {
  const res = await fetch(`${base}/api/v1/agent-gateway/nonce/consume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sentinela-agent-gateway-internal-token': token
    },
    body: JSON.stringify({ key_id: keyId, nonce, consumed_ms: 1_700_000_000_000 })
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const mode = process.argv[2] || 'consume';
if (mode === 'consume') {
  const r = await consume();
  console.log('[restart-smoke] consume', r.status, r.json?.success);
  process.exit(r.status === 200 ? 0 : 1);
}
if (mode === 'replay') {
  const r = await consume();
  console.log('[restart-smoke] replay', r.status, r.json?.error?.code);
  process.exit(r.status === 409 ? 0 : 1);
}
process.exit(1);
