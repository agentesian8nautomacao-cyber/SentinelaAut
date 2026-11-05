/**
 * B16-C — persistent nonce store (SQLite file): unit, concurrency, restart parity.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AGENT_GATEWAY_CANONICAL_PATH,
  AGENT_GATEWAY_METHOD,
  AGENT_HEADER_KEY_ID,
  AGENT_HEADER_NONCE,
  AGENT_HEADER_SIGNATURE,
  AGENT_HEADER_TIMESTAMP,
  AGENT_PUBLIC_UNAVAILABLE,
  signAgentGatewayRequest,
  validateAgentGatewayWithNonceEnv,
  parseAgentGatewaySecretsJson
} from './agentGatewayV1';
import {
  consumeNonceSqlite,
  openAgentGatewayNonceSqlite
} from '../../api/v1/_lib/agentGateway/nonceConsumeSqlite';
import {
  createSqliteAgentNonceStore,
  createPersistentAgentNonceStoreFromEnv
} from './agentGatewayPersistentNonceStore';
import {
  buildIdentityRegistryEnvJson,
  ENV_IDENTITY_REGISTRY
} from '../../api/v1/_lib/agentGateway/identityRegistryEnv';
import defaultHandler, {
  resetAgentGatewayNonceSqliteForTests
} from '../../api/v1/_lib/handlers/agent-gateway/nonce-consume';

const TEST_SECRET = 'b16c-persist-secret-local-only';
const TEST_KEY_ID = 'b16-persist-key';
const OTHER_KEY = 'b16-other-key-id';
const NOW_MS = 1_700_000_000_000;
const TS = String(Math.floor(NOW_MS / 1000));

function tempDbPath(): string {
  return path.join(os.tmpdir(), `sentinela-nonce-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

function headersFor(rawBody: string, nonce: string, keyId = TEST_KEY_ID): Record<string, string> {
  const sig = signAgentGatewayRequest({
    timestamp: TS,
    nonce,
    rawBody,
    secret: TEST_SECRET
  });
  return {
    [AGENT_HEADER_KEY_ID]: keyId,
    [AGENT_HEADER_TIMESTAMP]: TS,
    [AGENT_HEADER_NONCE]: nonce,
    [AGENT_HEADER_SIGNATURE]: sig
  };
}

const secrets = parseAgentGatewaySecretsJson(
  JSON.stringify([
    { key_id: TEST_KEY_ID, secret: TEST_SECRET, status: 'active' },
    { key_id: OTHER_KEY, secret: TEST_SECRET, status: 'active' }
  ])
);

describe('agentGatewayPersistentNonceStore (SQLite)', () => {
  const paths: string[] = [];
  afterEach(() => {
    for (const p of paths) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  });

  it('1. first nonce accepted', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const created = createSqliteAgentNonceStore(dbPath);
    if (!created.ok) throw new Error('sqlite store expected');
    const { store } = created;
    expect(await store.consume(TEST_KEY_ID, 'nonce-first-use-abcdef01', NOW_MS)).toBe('ok');
  });

  it('2. replay rejected', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const created = createSqliteAgentNonceStore(dbPath);
    if (!created.ok) throw new Error('sqlite store expected');
    const { store } = created;
    const n = 'nonce-replay-test-abcdef01';
    expect(await store.consume(TEST_KEY_ID, n, NOW_MS)).toBe('ok');
    expect(await store.consume(TEST_KEY_ID, n, NOW_MS)).toBe('replay');
  });

  it('3. concurrent same nonce — exactly one ok', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const created = createSqliteAgentNonceStore(dbPath);
    if (!created.ok) throw new Error('sqlite store expected');
    const { store } = created;
    const n = 'nonce-concurrent-abcdef01';
    const results = await Promise.all(
      Array.from({ length: 20 }, () => store.consume(TEST_KEY_ID, n, NOW_MS))
    );
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results.filter((r) => r === 'replay')).toHaveLength(19);
  });

  it('4. different nonces accepted', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const created = createSqliteAgentNonceStore(dbPath);
    if (!created.ok) throw new Error('sqlite store expected');
    const { store } = created;
    expect(await store.consume(TEST_KEY_ID, 'nonce-diff-a-abcdef01', NOW_MS)).toBe('ok');
    expect(await store.consume(TEST_KEY_ID, 'nonce-diff-b-abcdef01', NOW_MS)).toBe('ok');
  });

  it('5. expired nonce row pruned — new insert ok after expiry', () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const db = openAgentGatewayNonceSqlite(dbPath);
    const n = 'nonce-expired-test-abcdef1';
    const oldMs = 1_000_000_000_000;
    expect(consumeNonceSqlite(db, TEST_KEY_ID, n, oldMs, { timestampWindowSeconds: 300 })).toBe('ok');
    const futureMs = oldMs + 7200 * 1000;
    expect(consumeNonceSqlite(db, TEST_KEY_ID, n, futureMs, { timestampWindowSeconds: 300 })).toBe('ok');
  });

  it('6. invalid path → unavailable via env factory', async () => {
    const created = createPersistentAgentNonceStoreFromEnv({ nonceSqlitePath: '' });
    expect(created.ok).toBe(false);
  });

  it('8. process restart — replay still rejected', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const n = 'nonce-restart-test-abcdef1';
    {
      const first = createSqliteAgentNonceStore(dbPath);
      if (!first.ok) throw new Error('sqlite store expected');
      expect(await first.store.consume(TEST_KEY_ID, n, NOW_MS)).toBe('ok');
    }
    {
      const second = createSqliteAgentNonceStore(dbPath);
      if (!second.ok) throw new Error('sqlite store expected');
      expect(await second.store.consume(TEST_KEY_ID, n, NOW_MS)).toBe('replay');
    }
  });

  it('9. separation by key_id', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const created = createSqliteAgentNonceStore(dbPath);
    if (!created.ok) throw new Error('sqlite store expected');
    const { store } = created;
    const n = 'nonce-shared-value-abcdef1';
    expect(await store.consume(TEST_KEY_ID, n, NOW_MS)).toBe('ok');
    expect(await store.consume(OTHER_KEY, n, NOW_MS)).toBe('ok');
    expect(await store.consume(TEST_KEY_ID, n, NOW_MS)).toBe('replay');
  });
});

describe('validateAgentGatewayWithNonceEnv persistent', () => {
  const paths: string[] = [];
  afterEach(() => {
    for (const p of paths) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  });

  it('10. no memory fallback when persistent configured', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    const raw = JSON.stringify({ intent: 'LIST_PACKAGES' });
    const nonce = 'nonce-persist-env-abcdef01';
    const res1 = await validateAgentGatewayWithNonceEnv({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, nonce),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceEnv: { nonceStore: 'persistent', nonceSqlitePath: dbPath }
    });
    expect(res1.ok).toBe(true);
    const res2 = await validateAgentGatewayWithNonceEnv({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, nonce),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceEnv: { nonceStore: 'persistent', nonceSqlitePath: dbPath }
    });
    expect(res2.ok).toBe(false);
  });

  it('7. persistent without backend → 503', async () => {
    const raw = JSON.stringify({ intent: 'X' });
    const res = await validateAgentGatewayWithNonceEnv({
      method: AGENT_GATEWAY_METHOD,
      path: AGENT_GATEWAY_CANONICAL_PATH,
      headers: headersFor(raw, 'nonce-no-backend-abcdef1'),
      rawBody: raw,
      secrets,
      nowMs: NOW_MS,
      nonceEnv: { nonceStore: 'persistent' }
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(503);
      expect(res.public_code).toBe(AGENT_PUBLIC_UNAVAILABLE);
    }
  });
});

describe('agent-gateway nonce consume handler (SQLite)', () => {
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

  function setEnv(key: string, value: string) {
    if (!(key in prev)) prev[key] = process.env[key];
    process.env[key] = value;
  }

  function setEnvAllowlist(keyIds: string[]) {
    setEnv('SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS', keyIds.join(','));
  }

  function setEnvIdentityRegistryForToken(token: string, keyIds: string[]) {
    setEnv(
      ENV_IDENTITY_REGISTRY,
      buildIdentityRegistryEnvJson([
        {
          identity_id: 'b16c-test-single-identity',
          internal_tokens: [token],
          key_ids: keyIds
        }
      ])
    );
  }

  it('11. handler consume + replay via HTTP', async () => {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    setEnv('SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH', dbPath);
    setEnvAllowlist([TEST_KEY_ID, OTHER_KEY]);
    setEnvIdentityRegistryForToken('test-internal-token-b16c', [TEST_KEY_ID, OTHER_KEY]);

    const hdr = { 'x-sentinela-agent-gateway-internal-token': 'test-internal-token-b16c' };
    const body = JSON.stringify({ key_id: TEST_KEY_ID, nonce: 'nonce-http-api-abcdef01', consumed_ms: NOW_MS });

    const r1 = await defaultHandler.fetch(
      new Request('http://local/api/v1/agent-gateway/nonce/consume', {
        method: 'POST',
        headers: { ...hdr, 'Content-Type': 'application/json' },
        body
      })
    );
    expect(r1.status).toBe(200);

    const r2 = await defaultHandler.fetch(
      new Request('http://local/api/v1/agent-gateway/nonce/consume', {
        method: 'POST',
        headers: { ...hdr, 'Content-Type': 'application/json' },
        body
      })
    );
    expect(r2.status).toBe(409);
  });

  it('6b. handler without store config → 503', async () => {
    setEnvAllowlist([TEST_KEY_ID]);
    setEnvIdentityRegistryForToken('tok', [TEST_KEY_ID]);
    delete process.env.SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH;
    delete process.env.DATABASE_URL;
    const r = await defaultHandler.fetch(
      new Request('http://local/api/v1/agent-gateway/nonce/consume', {
        method: 'POST',
        headers: {
          'x-sentinela-agent-gateway-internal-token': 'tok',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key_id: TEST_KEY_ID, nonce: 'nonce-no-store-abcdef01' })
      })
    );
    expect(r.status).toBe(503);
  });
});

describe('agent-gateway nonce consume — key_id allowlist (Etapa 5)', () => {
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

  function authHeaders(token = 'test-internal-token-b16c') {
    return {
      'x-sentinela-agent-gateway-internal-token': token,
      'Content-Type': 'application/json'
    };
  }

  function setupStore() {
    const dbPath = tempDbPath();
    paths.push(dbPath);
    setEnv('SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH', dbPath);
    setEnv('SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS', `${TEST_KEY_ID},${OTHER_KEY}`);
    setEnvIdentityRegistryForToken('test-internal-token-b16c', [TEST_KEY_ID, OTHER_KEY]);
    return dbPath;
  }

  function setEnvIdentityRegistryForToken(token: string, keyIds: string[]) {
    setEnv(
      ENV_IDENTITY_REGISTRY,
      buildIdentityRegistryEnvJson([
        {
          identity_id: 'b16c-test-single-identity',
          internal_tokens: [token],
          key_ids: keyIds
        }
      ])
    );
  }

  async function postConsume(body: Record<string, unknown>, token?: string) {
    return defaultHandler.fetch(
      new Request('http://local/api/v1/agent-gateway/nonce/consume', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(body)
      })
    );
  }

  it('token interno ausente → 401', async () => {
    setupStore();
    const r = await defaultHandler.fetch(
      new Request('http://local/api/v1/agent-gateway/nonce/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: TEST_KEY_ID, nonce: 'nonce-no-token-abcdef01' })
      })
    );
    expect(r.status).toBe(401);
  });

  it('token interno inválido → 401', async () => {
    setupStore();
    const r = await postConsume({ key_id: TEST_KEY_ID, nonce: 'nonce-bad-token-abcdef1' }, 'wrong');
    expect(r.status).toBe(401);
    const j = (await r.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe('IDENTITY_UNAUTHORIZED');
  });

  it('allowlist ausente → 503 fail closed', async () => {
    setupStore();
    delete process.env.SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS;
    const r = await postConsume({ key_id: TEST_KEY_ID, nonce: 'nonce-no-allowlist-abc01' });
    expect(r.status).toBe(503);
    const j = (await r.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe('KEY_ID_ALLOWLIST_NOT_CONFIGURED');
  });

  it('allowlist inválida → 503 fail closed', async () => {
    setupStore();
    setEnv('SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS', 'not-json-[broken');
    const r = await postConsume({ key_id: TEST_KEY_ID, nonce: 'nonce-bad-allowlist-abc1' });
    expect(r.status).toBe(503);
  });

  it('key_id não autorizado → 403 e nonce não consumido', async () => {
    setupStore();
    const nonce = 'nonce-forbidden-key-abcdef1';
    const forbidden = await postConsume({ key_id: 'forbidden-key-id-xx', nonce });
    expect(forbidden.status).toBe(403);
    const allowed = await postConsume({ key_id: TEST_KEY_ID, nonce });
    expect(allowed.status).toBe(200);
  });

  it('key_id ausente / vazio → 400', async () => {
    setupStore();
    expect((await postConsume({ nonce: 'nonce-missing-key-abcdef1' })).status).toBe(400);
    expect((await postConsume({ key_id: '   ', nonce: 'nonce-empty-key-abcdef01' })).status).toBe(
      400
    );
  });

  it('key_id malformado → 400', async () => {
    setupStore();
    const r = await postConsume({ key_id: 'bad!', nonce: 'nonce-malformed-key-abc01' });
    expect(r.status).toBe(400);
  });

  it('key_id autorizado → consumo e replay 409', async () => {
    setupStore();
    const nonce = 'nonce-allowlist-ok-abcdef01';
    expect((await postConsume({ key_id: TEST_KEY_ID, nonce })).status).toBe(200);
    expect((await postConsume({ key_id: TEST_KEY_ID, nonce })).status).toBe(409);
  });

  it('store indisponível → 503 após allowlist ok', async () => {
    setEnv('SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS', TEST_KEY_ID);
    setEnvIdentityRegistryForToken('test-internal-token-b16c', [TEST_KEY_ID]);
    setEnv('SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH', '/nonexistent/path/nonce.sqlite');
    delete process.env.DATABASE_URL;
    const r = await postConsume({ key_id: TEST_KEY_ID, nonce: 'nonce-store-down-abcdef1' });
    expect(r.status).toBe(503);
  });
});
