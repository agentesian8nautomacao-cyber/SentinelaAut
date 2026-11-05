/**
 * B16-B — Agent Gateway agent-v1 tests (local secrets only).
 */

import { describe, expect, it } from 'vitest';
import { HARNESS_RUNTIME_VITEST } from './agentGatewayHarnessRuntime';
import {
  AGENT_GATEWAY_CANONICAL_PATH,
  AGENT_GATEWAY_METHOD,
  AGENT_HEADER_KEY_ID,
  AGENT_HEADER_NONCE,
  AGENT_HEADER_SIGNATURE,
  AGENT_HEADER_TIMESTAMP,
  AGENT_PUBLIC_AUTH_FAILED,
  AGENT_PUBLIC_UNAVAILABLE,
  agentGatewayFailureToRouterItem,
  buildAgentGatewayCanonical,
  createMemoryAgentNonceStore,
  parseAgentGatewaySecretsJson,
  shouldReachExecuteWorkflow,
  signAgentGatewayRequest,
  unavailableAgentNonceStore,
  validateAgentGatewayRequest,
  validateAgentGatewayWithNonceEnv
} from './agentGatewayV1';
import { sha256Hex } from '../../api/v1/_lib/auth/hmac';

const TEST_SECRET = 'b16-local-test-secret-not-production';
const TEST_KEY_ID = 'b16-test-key';
const NOW_MS = 1_700_000_000_000;
const TS = String(Math.floor(NOW_MS / 1000));

function headersFor(rawBody: string, nonce: string, secret = TEST_SECRET): Record<string, string> {
  const sig = signAgentGatewayRequest({
    timestamp: TS,
    nonce,
    rawBody,
    secret
  });
  return {
    [AGENT_HEADER_KEY_ID]: TEST_KEY_ID,
    [AGENT_HEADER_TIMESTAMP]: TS,
    [AGENT_HEADER_NONCE]: nonce,
    [AGENT_HEADER_SIGNATURE]: sig
  };
}

const secrets = parseAgentGatewaySecretsJson(
  JSON.stringify([{ key_id: TEST_KEY_ID, secret: TEST_SECRET, status: 'active' }])
);

describe('agentGatewayV1', () => {
  it('1. assinatura válida com nonce store em memória', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES', unit: '101' });
    const nonce = 'nonce-valid-001-abcdef';
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, nonce),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore(),
      requirePersistentNonce: true
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.parsedBody.intent).toBe('LIST_PACKAGES');
  });

  it('2. assinatura inválida', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const h = headersFor(raw, 'nonce-invalid-sig-0001');
    h[AGENT_HEADER_SIGNATURE] = 'deadbeef'.repeat(8);
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: h,
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.public_code).toBe(AGENT_PUBLIC_AUTH_FAILED);
      expect(res.internal_code).toBe('AGENT_SIGNATURE_INVALID');
    }
  });

  it('3. corpo alterado após assinatura', async () => {
    const signed = JSON.stringify({ intent: 'LIST_PACKAGES', unit: '101' });
    const tampered = JSON.stringify({ intent: 'LIST_PACKAGES', unit: '999' });
    const nonce = 'nonce-tamper-body-0012';
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(signed, nonce),
      rawBody: tampered,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
  });

  it('4. hash do corpo bruto difere do JSON re-serializado', () => {
    const raw = '{"intent":"X","n":1,"extra":"y"}';
    const pretty = JSON.stringify({ intent: 'X', n: 1 });
    expect(sha256Hex(raw)).not.toBe(sha256Hex(pretty));
    const sigRaw = signAgentGatewayRequest({
      timestamp: TS,
      nonce: 'nonce-raw-vs-reserial1',
      rawBody: raw,
      secret: TEST_SECRET
    });
    const sigPretty = signAgentGatewayRequest({
      timestamp: TS,
      nonce: 'nonce-raw-vs-reserial1',
      rawBody: pretty,
      secret: TEST_SECRET
    });
    expect(sigRaw).not.toBe(sigPretty);
  });

  it('5. método HTTP incorreto', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const res = await validateAgentGatewayRequest({
      method: 'GET',
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'nonce-wrong-method-001'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.internal_code).toBe('AGENT_METHOD_INVALID');
  });

  it('6. caminho incorreto', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: '/webhook/sentinelaaut/aut-003',
      headers: headersFor(raw, 'nonce-wrong-path-00001'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.internal_code).toBe('AGENT_PATH_INVALID');
  });

  it('7. timestamp expirado', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const oldTs = String(Math.floor(NOW_MS / 1000) - 400);
    const nonce = 'nonce-expired-ts-000001';
    const sig = signAgentGatewayRequest({ timestamp: oldTs, nonce, rawBody: raw, secret: TEST_SECRET });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: {
        [AGENT_HEADER_KEY_ID]: TEST_KEY_ID,
        [AGENT_HEADER_TIMESTAMP]: oldTs,
        [AGENT_HEADER_NONCE]: nonce,
        [AGENT_HEADER_SIGNATURE]: sig
      },
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.internal_code).toBe('AGENT_TIMESTAMP_INVALID');
  });

  it('8. timestamp futuro fora da tolerância', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const futureTs = String(Math.floor(NOW_MS / 1000) + 400);
    const nonce = 'nonce-future-ts-0000001';
    const sig = signAgentGatewayRequest({ timestamp: futureTs, nonce, rawBody: raw, secret: TEST_SECRET });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: {
        [AGENT_HEADER_KEY_ID]: TEST_KEY_ID,
        [AGENT_HEADER_TIMESTAMP]: futureTs,
        [AGENT_HEADER_NONCE]: nonce,
        [AGENT_HEADER_SIGNATURE]: sig
      },
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
  });

  it('9. nonce ausente ou malformado', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const h = headersFor(raw, 'nonce-valid-format-001');
    delete h[AGENT_HEADER_NONCE];
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: h,
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
  });

  it('10. key id ausente ou desconhecido', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const h = headersFor(raw, 'nonce-unknown-key-00001');
    h[AGENT_HEADER_KEY_ID] = 'unknown-key-id';
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: h,
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.internal_code).toBe('AGENT_KEY_UNKNOWN_OR_REVOKED');
  });

  it('11. credencial revogada', async () => {
    const revoked = parseAgentGatewaySecretsJson(
      JSON.stringify([{ key_id: TEST_KEY_ID, secret: TEST_SECRET, status: 'revoked' }])
    );
    const raw = JSON.stringify({ intent: 'X' });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'nonce-revoked-key-000001'),
      rawBody: raw,
      secrets: revoked,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
  });

  it('12. falha leitura corpo bruto', async () => {
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor('{}', 'nonce-missing-rawbody1'),
      rawBody: undefined,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.internal_code).toBe('AGENT_RAW_BODY_MISSING');
  });

  it('13. falha interna — nonce store indisponível (fail-closed)', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'nonce-store-unavail001'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: unavailableAgentNonceStore,
      requirePersistentNonce: true
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(503);
      expect(res.public_code).toBe(AGENT_PUBLIC_UNAVAILABLE);
    }
  });

  it('14. falha de autenticação não alcança Execute Workflow', () => {
    const fail = agentGatewayFailureToRouterItem({
      ok: false,
      httpStatus: 401,
      internal_code: 'AGENT_SIGNATURE_INVALID',
      public_code: AGENT_PUBLIC_AUTH_FAILED
    });
    expect(shouldReachExecuteWorkflow(fail)).toBe(false);
    expect(fail.skip_http).toBe(true);
  });

  it('15. regressão — caminho válido após gateway', async () => {
    const raw = JSON.stringify({ intent: 'IDENTIFY_RESIDENT', phone: '5511999990001' });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'nonce-regression-valid01'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(true);
    expect(shouldReachExecuteWorkflow({ skip_http: false })).toBe(true);
  });

  it('nonce repetido (replay)', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const nonce = 'nonce-replay-test-000001';
    const store = createMemoryAgentNonceStore();
    const base = {
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, nonce),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: store
    };
    expect((await validateAgentGatewayRequest(base)).ok).toBe(true);
    const again = await validateAgentGatewayRequest(base);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.internal_code).toBe('AGENT_NONCE_REPLAY');
  });

  describe('B16-B-R1 nonce env modes (fail-closed)', () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const nonceFor = (n: string) => n;

    async function withMode(store: string, extra: Record<string, string> = {}) {
      return validateAgentGatewayWithNonceEnv({
        method: AGENT_GATEWAY_METHOD,
        path: AGENT_GATEWAY_CANONICAL_PATH,
        headers: headersFor(raw, nonceFor('nonce-env-mode-test01')),
        rawBody: raw,
        secrets,
        nowMs: NOW_MS,
        nonceEnv: { nonceStore: store, ...extra }
      });
    }

    async function withMemoryTestEnv(extra: Record<string, string> = {}) {
      return withMode('memory_test', {
        allowMemoryTest: '1',
        testEnv: '1',
        harnessRuntime: HARNESS_RUNTIME_VITEST,
        vitest: 'true',
        ...extra
      });
    }

    for (const bad of ['redis', 'supabase', 'production', 'typo']) {
      it(`rejects nonce store mode: ${bad}`, async () => {
        const res = await withMode(bad);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.httpStatus).toBe(503);
          expect(res.public_code).toBe(AGENT_PUBLIC_UNAVAILABLE);
        }
      });
    }

    it('persistent without backend → 503', async () => {
      const res = await withMode('persistent');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.httpStatus).toBe(503);
    });

    it('memory_test without harness flags → 503', async () => {
      const res = await withMode('memory_test', { allowMemoryTest: '1', testEnv: '1' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.httpStatus).toBe(503);
    });

    it('memory_test with full harness context → ok', async () => {
      const res = await validateAgentGatewayWithNonceEnv({
        method: AGENT_GATEWAY_METHOD,
        path: AGENT_GATEWAY_CANONICAL_PATH,
        headers: headersFor(raw, 'nonce-memory-test-ok001'),
        rawBody: raw,
        secrets,
        nowMs: NOW_MS,
        nonceEnv: {
          nonceStore: 'memory_test',
          allowMemoryTest: '1',
          testEnv: '1',
          harnessRuntime: HARNESS_RUNTIME_VITEST,
          vitest: 'true'
        }
      });
      expect(res.ok).toBe(true);
    });

    it('memory_test blocked in production even with all env flags', async () => {
      const res = await withMemoryTestEnv({ nodeEnv: 'production' });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.httpStatus).toBe(503);
    });
  });

  it('31. tenant id no payload não sobrevive ao gateway', async () => {
    const raw = JSON.stringify({
      intent: 'LIST_PACKAGES',
      organization_id: 'agent-forged-org'
    });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'nonce-tenant-strip-0001'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.parsedBody.organization_id).toBeUndefined();
  });

  it('canonical string matches contract', () => {
    const body = '{"intent":"X"}';
    const c = buildAgentGatewayCanonical({
      timestamp: '1700000000',
      nonce: 'nonce-canonical-test01',
      method: 'POST',
      path: AGENT_GATEWAY_CANONICAL_PATH,
      bodySha256Hex: sha256Hex(body)
    });
    expect(c).toBe(
      `agent-v1\n1700000000\nnonce-canonical-test01\nPOST\n${AGENT_GATEWAY_CANONICAL_PATH}\n${sha256Hex(body)}`
    );
  });
});
