import { describe, expect, it } from 'vitest';
import {
  extractAgentGatewayRawBody,
  stripAgentUntrustedBodyFields
} from './agentGatewayRawBody';
import { signAgentGatewayRequest } from './agentGatewayV1';

describe('extractAgentGatewayRawBody', () => {
  it('prefers rawBody string', () => {
    expect(extractAgentGatewayRawBody({ rawBody: '{"a":1}', body: '{"b":2}' })).toBe('{"a":1}');
  });

  it('falls back to body string', () => {
    expect(extractAgentGatewayRawBody({ body: '{"x":1}' })).toBe('{"x":1}');
  });

  it('reads binary base64', () => {
    const raw = '{"intent":"X"}';
    const b64 = Buffer.from(raw, 'utf8').toString('base64');
    expect(
      extractAgentGatewayRawBody({
        binary: { data: { data: b64 } }
      })
    ).toBe(raw);
  });

  it('empty when object body only', () => {
    expect(extractAgentGatewayRawBody({ body: { intent: 'X' } })).toBe('');
  });

  it('hash diverges when bytes differ', () => {
    const signed = '{"a":1}';
    const other = '{"a":2}';
    expect(signAgentGatewayRequest({
      timestamp: '1700000000',
      nonce: 'nonce-raw-body-test-01',
      rawBody: signed,
      secret: 'local-test-secret-only'
    })).not.toBe(
      signAgentGatewayRequest({
        timestamp: '1700000000',
        nonce: 'nonce-raw-body-test-01',
        rawBody: other,
        secret: 'local-test-secret-only'
      })
    );
  });
});

describe('stripAgentUntrustedBodyFields', () => {
  it('removes top-level tenant and forged gateway flag', () => {
    const body = {
      intent: 'LIST_PACKAGES',
      organization_id: 'evil',
      orgId: 'evil-alias',
      _agentGatewayPassed: true
    };
    stripAgentUntrustedBodyFields(body);
    expect(body.organization_id).toBeUndefined();
    expect(body.orgId).toBeUndefined();
    expect(body._agentGatewayPassed).toBeUndefined();
    expect(body.intent).toBe('LIST_PACKAGES');
  });

  it('does not remove nested tenant keys', () => {
    const body = { metadata: { condominium_id: 'nested' } };
    stripAgentUntrustedBodyFields(body);
    expect((body.metadata as { condominium_id: string }).condominium_id).toBe('nested');
  });
});
