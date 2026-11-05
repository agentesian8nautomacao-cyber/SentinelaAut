/**
 * B16-D2 — per-identity authorization on nonce consume (SQLite store, no external DB).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIdentityRegistryEnvJson, ENV_IDENTITY_REGISTRY } from '../../agentGateway/identityRegistryEnv';
import defaultHandler, { resetAgentGatewayNonceSqliteForTests } from './nonce-consume';

const TEST_KEY_ID = 'b16-persist-key';
const OTHER_KEY = 'b16-other-key-id';
const TOKEN_A = 'identity-a-token-d2-test';
const TOKEN_B = 'identity-b-token-d2-test';
const ID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOW_MS = 1_700_000_000_000;

function tempDbPath(): string {
  return path.join(os.tmpdir(), `sentinela-d2-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

describe('nonce-consume B16-D2 identity isolation', () => {
  const paths: string[] = [];
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    resetAgentGatewayNonceSqliteForTests();
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    for (const p of paths) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  });

  function setEnv(key: string, value: string | undefined) {
    if (!(key in prev)) prev[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  function setupTwoIdentities() {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    setEnv('SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH', dbPath);
    setEnv('SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS', `${TEST_KEY_ID},${OTHER_KEY}`);
    setEnv(
      ENV_IDENTITY_REGISTRY,
      buildIdentityRegistryEnvJson([
        { identity_id: ID_A, internal_tokens: [TOKEN_A], key_ids: [TEST_KEY_ID] },
        { identity_id: ID_B, internal_tokens: [TOKEN_B], key_ids: [OTHER_KEY] }
      ])
    );
  }

  async function post(
    token: string | undefined,
    body: Record<string, unknown>,
    useBearer = false
  ): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token !== undefined) {
      if (useBearer) headers.authorization = `Bearer ${token}`;
      else headers['x-sentinela-agent-gateway-internal-token'] = token;
    }
    return defaultHandler.fetch(
      new Request('http://local/api/v1/agent-gateway/nonce/consume', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })
    );
  }

  it('identity A + key_id A → 200', async () => {
    setupTwoIdentities();
    const nonce = 'nonce-d2-a-ok-abcdef01';
    expect((await post(TOKEN_A, { key_id: TEST_KEY_ID, nonce, consumed_ms: NOW_MS })).status).toBe(
      200
    );
  });

  it('identity B + key_id B → 200', async () => {
    setupTwoIdentities();
    const nonce = 'nonce-d2-b-ok-abcdef01';
    expect((await post(TOKEN_B, { key_id: OTHER_KEY, nonce, consumed_ms: NOW_MS })).status).toBe(
      200
    );
  });

  it('identity A + key_id B → 403 KEY_ID_NOT_AUTHORIZED', async () => {
    setupTwoIdentities();
    const nonce = 'nonce-d2-cross-ab-abcdef1';
    const r = await post(TOKEN_A, { key_id: OTHER_KEY, nonce, consumed_ms: NOW_MS });
    expect(r.status).toBe(403);
    const j = (await r.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe('KEY_ID_NOT_AUTHORIZED');
    expect((await post(TOKEN_B, { key_id: OTHER_KEY, nonce, consumed_ms: NOW_MS })).status).toBe(
      200
    );
  });

  it('identity B + key_id A → 403', async () => {
    setupTwoIdentities();
    const nonce = 'nonce-d2-cross-ba-abcdef1';
    expect((await post(TOKEN_B, { key_id: TEST_KEY_ID, nonce, consumed_ms: NOW_MS })).status).toBe(
      403
    );
    expect((await post(TOKEN_A, { key_id: TEST_KEY_ID, nonce, consumed_ms: NOW_MS })).status).toBe(
      200
    );
  });

  it('unknown credential → 401', async () => {
    setupTwoIdentities();
    const r = await post('unknown-token-xx', {
      key_id: TEST_KEY_ID,
      nonce: 'nonce-d2-unknown-abcdef1'
    });
    expect(r.status).toBe(401);
    const j = (await r.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe('IDENTITY_UNAUTHORIZED');
  });

  it('credential absent → 401 UNAUTHORIZED', async () => {
    setupTwoIdentities();
    const r = await post(undefined, { key_id: TEST_KEY_ID, nonce: 'nonce-d2-no-cred-abc01' });
    expect(r.status).toBe(401);
  });

  it('revoked identity → 401', async () => {
    setupTwoIdentities();
    setEnv(
      ENV_IDENTITY_REGISTRY,
      buildIdentityRegistryEnvJson([
        {
          identity_id: ID_A,
          status: 'revoked',
          internal_tokens: [TOKEN_A],
          key_ids: [TEST_KEY_ID]
        }
      ])
    );
    const r = await post(TOKEN_A, { key_id: TEST_KEY_ID, nonce: 'nonce-d2-revoked-abc01' });
    expect(r.status).toBe(401);
  });

  it('malformed key_id → 400', async () => {
    setupTwoIdentities();
    expect(
      (await post(TOKEN_A, { key_id: 'bad!', nonce: 'nonce-d2-malformed-abc01' })).status
    ).toBe(400);
  });

  it('Bearer token auth → 200', async () => {
    setupTwoIdentities();
    const r = await post(
      TOKEN_A,
      { key_id: TEST_KEY_ID, nonce: 'nonce-d2-bearer-abcdef01', consumed_ms: NOW_MS },
      true
    );
    expect(r.status).toBe(200);
  });

  it('replay → 409', async () => {
    setupTwoIdentities();
    const nonce = 'nonce-d2-replay-abcdef01';
    expect((await post(TOKEN_A, { key_id: TEST_KEY_ID, nonce, consumed_ms: NOW_MS })).status).toBe(
      200
    );
    expect((await post(TOKEN_A, { key_id: TEST_KEY_ID, nonce, consumed_ms: NOW_MS })).status).toBe(
      409
    );
  });

  it('legacy shared token without registry → 503 fail-closed', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    setEnv('SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH', dbPath);
    setEnv('SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS', TEST_KEY_ID);
    setEnv('SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN', 'legacy-only-token');
    delete process.env[ENV_IDENTITY_REGISTRY];
    const r = await post('legacy-only-token', {
      key_id: TEST_KEY_ID,
      nonce: 'nonce-d2-legacy-abcdef01'
    });
    expect(r.status).toBe(503);
    const j = (await r.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe('IDENTITY_REGISTRY_NOT_CONFIGURED');
  });

  it('store unavailable → 503 after auth ok', async () => {
    setEnv('SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS', TEST_KEY_ID);
    setEnv(
      ENV_IDENTITY_REGISTRY,
      buildIdentityRegistryEnvJson([
        { identity_id: ID_A, internal_tokens: [TOKEN_A], key_ids: [TEST_KEY_ID] }
      ])
    );
    setEnv('SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH', '/nonexistent/nonce.sqlite');
    delete process.env.DATABASE_URL;
    const r = await post(TOKEN_A, { key_id: TEST_KEY_ID, nonce: 'nonce-d2-store-down-abc1' });
    expect(r.status).toBe(503);
  });
});
