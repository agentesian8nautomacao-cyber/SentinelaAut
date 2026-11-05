/**
 * D-P0-1 — Matriz obrigatória de testes (agent-v1, dados fictícios, sem LIVE).
 */

import { describe, expect, it } from 'vitest';
import { resolveRouterIntent } from '../../n8n/runtime/fase2f';
import { prepareWorkflowRequest } from '../../n8n/runtime/orchestrator';
import {
  AGENT_GATEWAY_CANONICAL_PATH,
  AGENT_GATEWAY_METHOD,
  AGENT_HEADER_KEY_ID,
  AGENT_HEADER_NONCE,
  AGENT_HEADER_SIGNATURE,
  AGENT_HEADER_TIMESTAMP,
  AGENT_PUBLIC_AUTH_FAILED,
  createMemoryAgentNonceStore,
  parseAgentGatewaySecretsJson,
  signAgentGatewayRequest,
  validateAgentGatewayRequest
} from './agentGatewayV1';
import { stripAgentUntrustedBodyFields } from './agentGatewayRawBody';
import { createSqliteAgentNonceStore } from './agentGatewayPersistentNonceStore';
import { shouldReachDispatchSwitch } from './agentGatewayWorkflowPolicy';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_SECRET = 'dp01-local-test-secret-not-production';
const TEST_KEY_ID = 'dp01-test-key';
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

describe('D-P0-1 — matriz agent gateway (15 cenários)', () => {
  it('01 — assinatura válida', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES', unit: '101' });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'dp01-nonce-valid-abcdef01'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(true);
  });

  it('02 — assinatura inválida', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const h = headersFor(raw, 'dp01-nonce-bad-sig-abcdef01');
    h[AGENT_HEADER_SIGNATURE] = 'cafebabe'.repeat(8);
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
    if (!res.ok) expect(res.public_code).toBe(AGENT_PUBLIC_AUTH_FAILED);
  });

  it('03 — assinatura ausente', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const h = headersFor(raw, 'dp01-nonce-no-sig-abcdef01');
    delete h[AGENT_HEADER_SIGNATURE];
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

  it('04 — timestamp expirado', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const oldTs = String(Math.floor(NOW_MS / 1000) - 7200);
    const nonce = 'dp01-nonce-expired-abcdef01';
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
  });

  it('05 — timestamp futuro fora da janela', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const futureTs = String(Math.floor(NOW_MS / 1000) + 7200);
    const nonce = 'dp01-nonce-future-abcdef01';
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

  it('06 — nonce reutilizado', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const nonce = 'dp01-nonce-replay-abcdef01';
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
    expect((await validateAgentGatewayRequest(base)).ok).toBe(false);
  });

  it('07 — requisições concorrentes com mesmo nonce (store persistente)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dp01-nonce-'));
    const dbPath = join(dir, 'nonces.sqlite');
    try {
      const created = createSqliteAgentNonceStore(dbPath);
      if (!created.ok) throw new Error('sqlite store expected');
      const n = 'dp01-nonce-concurrent-abcdef01';
      const results = await Promise.all(
        Array.from({ length: 16 }, () => created.store.consume(TEST_KEY_ID, n, NOW_MS))
      );
      expect(results.filter((r) => r === 'ok')).toHaveLength(1);
      expect(results.filter((r) => r === 'replay')).toHaveLength(15);
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it('08 — idempotência duplicada (WRITE deriva mesma Idempotency-Key)', () => {
    const input = {
      intent: 'CREATE_PACKAGE',
      recipient: 'Pilot Box',
      unit: '101',
      external_message_id: 'ext-dp01-same'
    };
    const creds = {
      clientId: 'dp01-client',
      secret: 'x',
      organizationId: 'org-a',
      condominiumId: 'condo-a',
      baseUrl: 'http://127.0.0.1:3099'
    };
    const a = prepareWorkflowRequest('AUT-003', input, creds, { executionId: 'exec-dp01-a' });
    const b = prepareWorkflowRequest('AUT-003', input, creds, { executionId: 'exec-dp01-b' });
    expect(a.idempotencyKey).toBeTruthy();
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    const pickup = prepareWorkflowRequest(
      'AUT-004',
      { intent: 'PICKUP_PACKAGE', package_id: 'pkg-1' },
      creds,
      { executionId: 'exec-dp01-c' }
    );
    expect(pickup.idempotencyKey).toBe('');
  });

  it('09 — tenant adulterado removido no gateway', async () => {
    const raw = JSON.stringify({
      intent: 'LIST_PACKAGES',
      organization_id: 'forged-org-dp01',
      tenant_id: 'forged-tenant'
    });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'dp01-nonce-tenant-abcdef01'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.parsedBody.organization_id).toBeUndefined();
      expect(res.parsedBody.tenant_id).toBeUndefined();
    }
  });

  it('10 — agente não autorizado (key_id desconhecido)', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const h = headersFor(raw, 'dp01-nonce-unknown-key-abc01');
    h[AGENT_HEADER_KEY_ID] = 'unknown-agent-key-dp01';
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

  it('11 — operação não permitida (intent fora da allowlist)', () => {
    const r = resolveRouterIntent({ intent: 'DELETE_ALL_PACKAGES' });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe('WORKFLOW_UNSUPPORTED_INTENT');
  });

  it('12 — tentativa de contornar HITL (pickup sensível com confirmação → 2F-002)', () => {
    const bypassDirect = resolveRouterIntent({
      intent: 'PICKUP_PACKAGE',
      package_id: 'pkg-dp01',
      confirmation_id: 'conf-1',
      requester_identity: '5511999990001'
    });
    expect(bypassDirect.ok).toBe(true);
    if (bypassDirect.ok) {
      expect(bypassDirect.aut).toBe('AUT-2F-002');
      expect(bypassDirect.aut).not.toBe('AUT-004');
    }
    expect(
      shouldReachDispatchSwitch({ _ingress: 'webhook', _agentGatewayPassed: false })
    ).toBe(false);
  });

  it('13 — payload malformado (JSON inválido)', async () => {
    const raw = '{intent: NOT_JSON}';
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'dp01-nonce-malformed-abcdef1'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
  });

  it('14 — segredo ausente (lista de credenciais vazia)', async () => {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const res = await validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'dp01-nonce-no-secret-abcdef1'),
      rawBody: raw,
      secrets: [],
      nowMs: NOW_MS,
      nonceStore: createMemoryAgentNonceStore()
    });
    expect(res.ok).toBe(false);
  });

  it('15 — injeção de parâmetros não confiáveis (path/url + _agentGatewayPassed)', () => {
    const body: Record<string, unknown> = {
      intent: 'LIST_PACKAGES',
      path: '/api/v1/admin',
      url: 'https://evil.example/api',
      _agentGatewayPassed: true
    };
    stripAgentUntrustedBodyFields(body);
    expect(body._agentGatewayPassed).toBeUndefined();
    const r = resolveRouterIntent({
      intent: 'LIST_PACKAGES',
      path: '/api/v1/admin'
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe('WORKFLOW_INVALID_INPUT');
  });
});
