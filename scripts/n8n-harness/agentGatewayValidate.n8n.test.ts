/**
 * B16-B-R1 — behavioral parity tests for logic embedded in agentGatewayValidate.n8n.js
 * (extractRawBody / resolveNonceMode mirror agentGatewayRawBody + agentGatewayNonceMode).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveAgentNonceStoreMode } from './agentGatewayNonceMode';
import { extractAgentGatewayRawBody } from './agentGatewayRawBody';

const n8nJsPath = join(dirname(fileURLToPath(import.meta.url)), 'agentGatewayValidate.n8n.js');

describe('agentGatewayValidate.n8n.js parity', () => {
  it('source documents rawBody dependency (runtime n8n not proven here)', () => {
    const src = readFileSync(n8nJsPath, 'utf8');
    expect(src).toContain('rawBody: true');
    expect(src).toContain('resolveNonceMode');
    expect(src).toContain('_agentGatewayPassed');
    expect(src).toContain('mapNonceConsumeHttpStatus');
    expect(src).toContain('AGENT_GATEWAY_FORBIDDEN');
  });

  it('25–27 — raw body fixtures (same extract as n8n)', () => {
    const payload = '{"intent":"LIST_PACKAGES"}';
    expect(extractAgentGatewayRawBody({ rawBody: payload })).toBe(payload);
    expect(extractAgentGatewayRawBody({})).toBe('');
    expect(extractAgentGatewayRawBody({ body: { intent: 'X' } })).toBe('');
  });

  for (const mode of ['redis', 'supabase', 'production']) {
    it(`11–14 n8n nonce mode ${mode} → fail-closed`, () => {
      expect(resolveAgentNonceStoreMode({ nonceStore: mode }).ok).toBe(false);
    });
  }
});
