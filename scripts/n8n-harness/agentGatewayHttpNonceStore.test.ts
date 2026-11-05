/**
 * B16-D3 — HTTP nonce store fail-closed and status mapping.
 */

import { describe, expect, it } from 'vitest';
import { createHttpAgentNonceStore } from './agentGatewayHttpNonceStore';
import {
  AGENT_GATEWAY_CANONICAL_PATH,
  AGENT_GATEWAY_METHOD,
  AGENT_HEADER_KEY_ID,
  AGENT_HEADER_NONCE,
  AGENT_HEADER_SIGNATURE,
  AGENT_HEADER_TIMESTAMP,
  AGENT_PUBLIC_AUTH_FAILED,
  AGENT_PUBLIC_FORBIDDEN,
  AGENT_PUBLIC_UNAVAILABLE,
  parseAgentGatewaySecretsJson,
  shouldReachExecuteWorkflow,
  signAgentGatewayRequest,
  validateAgentGatewayRequest
} from './agentGatewayV1';

const TEST_SECRET = 'b16-d3-http-store-secret-local';
const TEST_KEY_ID = 'b16-d3-key-id';
const NOW_MS = 1_700_000_100_000;
const TS = String(Math.floor(NOW_MS / 1000));

function headersFor(rawBody: string, nonce: string): Record<string, string> {
  const sig = signAgentGatewayRequest({
    timestamp: TS,
    nonce,
    rawBody,
    secret: TEST_SECRET
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

function mockFetch(status: number): typeof fetch {
  return async () =>
    ({
      status,
      ok: status >= 200 && status < 300
    }) as Response;
}

describe('createHttpAgentNonceStore status mapping', () => {
  it.each([
    [200, 'ok'],
    [400, 'bad_request'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'replay'],
    [500, 'unavailable'],
    [503, 'unavailable']
  ] as const)('HTTP %i → %s', async (status, outcome) => {
    const store = createHttpAgentNonceStore({
      consumeUrl: 'http://127.0.0.1/consume',
      internalToken: 'tok',
      fetchImpl: mockFetch(status)
    });
    expect(await store.consume(TEST_KEY_ID, 'nonce-http-map-abcdef01', NOW_MS)).toBe(outcome);
  });

  it('connection error → unavailable', async () => {
    const store = createHttpAgentNonceStore({
      consumeUrl: 'http://127.0.0.1/consume',
      internalToken: 'tok',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      }
    });
    expect(await store.consume(TEST_KEY_ID, 'nonce-conn-refused-abc01', NOW_MS)).toBe('unavailable');
  });

  it('timeout → unavailable', async () => {
    const store = createHttpAgentNonceStore({
      consumeUrl: 'http://127.0.0.1/consume',
      internalToken: 'tok',
      timeoutMs: 20,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }
        }) as Promise<Response>
    });
    expect(await store.consume(TEST_KEY_ID, 'nonce-timeout-test-abc01', NOW_MS)).toBe('unavailable');
  });

  it('missing url/token → unavailable without fetch', async () => {
    const store = createHttpAgentNonceStore({ consumeUrl: '', internalToken: '' });
    expect(await store.consume(TEST_KEY_ID, 'nonce-no-config-abcdef01', NOW_MS)).toBe('unavailable');
  });
});

describe('gateway fail-closed on HTTP consume outcomes', () => {
  async function validateWithHttpStatus(status: number) {
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const nonce = `nonce-gw-${status}-abcdef01`;
    return validateAgentGatewayRequest({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, nonce),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceStore: createHttpAgentNonceStore({
        consumeUrl: 'http://127.0.0.1/consume',
        internalToken: 'tok',
        fetchImpl: mockFetch(status)
      }),
      requirePersistentNonce: true
    });
  }

  it('200 → ok and may reach execute workflow', async () => {
    const res = await validateWithHttpStatus(200);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(shouldReachExecuteWorkflow({ skip_http: false, _agentGatewayPassed: true })).toBe(true);
    }
  });

  it('409 → 401 replay, blocked', async () => {
    const res = await validateWithHttpStatus(409);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(401);
      expect(res.public_code).toBe(AGENT_PUBLIC_AUTH_FAILED);
      expect(res.internal_code).toBe('AGENT_NONCE_REPLAY');
      expect(shouldReachExecuteWorkflow({ skip_http: true })).toBe(false);
    }
  });

  it('403 → 403 forbidden (not 503 unavailable)', async () => {
    const res = await validateWithHttpStatus(403);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(403);
      expect(res.public_code).toBe(AGENT_PUBLIC_FORBIDDEN);
      expect(res.internal_code).toBe('AGENT_NONCE_CONSUME_FORBIDDEN');
      expect(res.public_code).not.toBe(AGENT_PUBLIC_UNAVAILABLE);
    }
  });

  it('401 API → 503 unavailable (internal credential), blocked', async () => {
    const res = await validateWithHttpStatus(401);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(503);
      expect(res.internal_code).toBe('AGENT_NONCE_CONSUME_UNAUTHORIZED');
    }
  });

  it('503 API → 503 store unavailable', async () => {
    const res = await validateWithHttpStatus(503);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(503);
      expect(res.internal_code).toBe('AGENT_NONCE_STORE_UNAVAILABLE');
    }
  });

  it('500 → 503 unavailable', async () => {
    const res = await validateWithHttpStatus(500);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.httpStatus).toBe(503);
  });
});
