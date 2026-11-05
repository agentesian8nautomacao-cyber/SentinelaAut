import { describe, expect, it } from 'vitest';
import {
  AGENT_UNTRUSTED_IDENTITY_KEYS,
  stripUntrustedIdentityFields
} from './agentGatewayTenantPolicy';
import {
  AGENT_GATEWAY_CANONICAL_PATH,
  AGENT_GATEWAY_METHOD,
  AGENT_HEADER_KEY_ID,
  AGENT_HEADER_NONCE,
  AGENT_HEADER_SIGNATURE,
  AGENT_HEADER_TIMESTAMP,
  createMemoryAgentNonceStore,
  parseAgentGatewaySecretsJson,
  signAgentGatewayRequest,
  validateAgentGatewayRequest
} from './agentGatewayV1';

const TEST_SECRET = 'b16-r2-local-test-secret-not-prod';
const TEST_KEY_ID = 'b16-r2-test-key';
const NOW_MS = 1_700_000_000_000;
const TS = String(Math.floor(NOW_MS / 1000));

function headersFor(rawBody: string, nonce: string): Record<string, string> {
  const sig = signAgentGatewayRequest({ timestamp: TS, nonce, rawBody, secret: TEST_SECRET });
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

describe('agentGatewayTenantPolicy (B16-B-R2)', () => {
  for (const key of ['orgId', 'org_id', 'organization_id', 'tenant_id', 'condominium_id']) {
    it(`strips top-level ${key} after gateway parse`, async () => {
      const raw = JSON.stringify({ intent: 'LIST_PACKAGES', [key]: 'agent-forged' });
      const res = await validateAgentGatewayRequest({
        method: AGENT_GATEWAY_METHOD,
        path: AGENT_GATEWAY_CANONICAL_PATH,
        headers: headersFor(raw, `nonce-tenant-strip-${key}-x`),
        rawBody: raw,
        secrets,
        nowMs: NOW_MS,
        nonceStore: createMemoryAgentNonceStore()
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.parsedBody[key]).toBeUndefined();
    });
  }

  it('preserves nested tenant-like keys (no authority)', () => {
    const body = { metadata: { orgId: 'nested', tenant_id: 'n2' } };
    stripUntrustedIdentityFields(body);
    expect((body.metadata as { orgId: string }).orgId).toBe('nested');
  });

  it('conflicting top-level tenant fields all removed', () => {
    const body: Record<string, unknown> = {
      orgId: 'a',
      organization_id: 'b',
      tenant_id: 'c'
    };
    stripUntrustedIdentityFields(body);
    for (const k of AGENT_UNTRUSTED_IDENTITY_KEYS) {
      if (k === '_agentGatewayPassed') continue;
      expect(body[k]).toBeUndefined();
    }
  });
});
