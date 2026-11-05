/**
 * D-P0-2B-4B-A4/A5 — PostgreSQL nonce consume (disposable DB only).
 * Requires: migration 022 applied; DATABASE_URL or SENTINELA_PG_NONCE_TEST_URL.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consumeNoncePg } from '../../api/v1/_lib/agentGateway/nonceConsumeCore';
import { endPgPoolForTests, resetPgPoolForTests, withPgTransaction } from '../../api/_lib/db/pgPool';
import defaultHandler, {
  resetAgentGatewayNonceSqliteForTests
} from '../../api/v1/_lib/handlers/agent-gateway/nonce-consume';
import {
  buildIdentityRegistryEnvJson,
  ENV_IDENTITY_REGISTRY
} from '../../api/v1/_lib/agentGateway/identityRegistryEnv';

const DB_URL =
  process.env.SENTINELA_PG_NONCE_TEST_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  '';

const TEST_KEY = 'dp04-pg-test-key-id';
const OTHER_KEY = 'dp04-pg-other-key-id';
const WINDOW = 300;
const NOW_MS = 1_700_000_000_000;
const TOKEN = 'dp04-pg-internal-token-not-production';

const env = { DATABASE_URL: DB_URL };

/** Only run against disposable A4 credentials (never Supabase prod). */
function skipIfNoDb(): boolean {
  if (!DB_URL) return true;
  const safe =
    DB_URL.includes('nonce_test_local_discard') &&
    (DB_URL.includes('127.0.0.1') || DB_URL.includes('localhost'));
  return !safe;
}

async function pgConsume(keyId: string, nonce: string, nowMs = NOW_MS) {
  resetPgPoolForTests();
  const tx = await withPgTransaction(env, (client) =>
    consumeNoncePg(client, keyId, nonce, nowMs, { timestampWindowSeconds: WINDOW })
  );
  return tx;
}

async function reapplyMigration022(): Promise<void> {
  resetPgPoolForTests();
  const sql = readFileSync(
    new URL('../../supabase/migrations/20261103180000_022_agent_gateway_nonces.sql', import.meta.url),
    'utf8'
  );
  const r = await withPgTransaction(env, async (client) => {
    await client.query(sql);
  });
  if (!r.ok) throw new Error('migration 022 reapply failed');
}

async function handlerConsume(
  keyId: string,
  nonce: string,
  consumedMs = NOW_MS
): Promise<Response> {
  process.env.DATABASE_URL = DB_URL;
  delete process.env.SENTINELA_AGENT_GATEWAY_NONCE_SQLITE_PATH;
  process.env.SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS = `${TEST_KEY},${OTHER_KEY}`;
  process.env[ENV_IDENTITY_REGISTRY] = buildIdentityRegistryEnvJson([
    {
      identity_id: 'dp04-pg-test-identity',
      internal_tokens: [TOKEN],
      key_ids: [TEST_KEY, OTHER_KEY]
    }
  ]);
  resetAgentGatewayNonceSqliteForTests();
  resetPgPoolForTests();

  const hdr = {
    'x-sentinela-agent-gateway-internal-token': TOKEN,
    'Content-Type': 'application/json'
  };
  const body = JSON.stringify({ key_id: keyId, nonce, consumed_ms: consumedMs });
  return defaultHandler.fetch(
    new Request('http://local/api/v1/agent-gateway/nonce/consume', {
      method: 'POST',
      headers: hdr,
      body
    })
  );
}

function dockerPg(cmd: 'stop' | 'start' | 'restart'): void {
  execSync(`docker ${cmd} sentinelaaut-pg-nonce-test-a4`, { stdio: 'ignore' });
}

async function waitPgReady(maxSec = 30): Promise<void> {
  for (let i = 0; i < maxSec; i++) {
    const r = await withPgTransaction(env, (c) => c.query('SELECT 1'));
    if (r.ok) return;
    await new Promise((res) => setTimeout(res, 1000));
    resetPgPoolForTests();
  }
  throw new Error('PG disposable not ready');
}

describe.skipIf(skipIfNoDb())('agentGatewayPgNonce (disposable PostgreSQL)', () => {
  beforeAll(async () => {
    resetPgPoolForTests();
    await withPgTransaction(env, async (client) => {
      await client.query('TRUNCATE agent_gateway_nonces');
    });
  });

  afterAll(async () => {
    await endPgPoolForTests();
    resetAgentGatewayNonceSqliteForTests();
  });

  it('1. first nonce accepted', async () => {
    const r = await pgConsume(TEST_KEY, 'dp04-pg-first-nonce-abcdef01');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('ok');
  });

  it('2. replay rejected', async () => {
    const n = 'dp04-pg-replay-nonce-abcdef01';
    const first = await pgConsume(TEST_KEY, n);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value).toBe('ok');
    const second = await pgConsume(TEST_KEY, n);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value).toBe('replay');
  });

  it('3. concurrent — exactly one ok', async () => {
    const n = 'dp04-pg-concurrent-abcdef01';
    const results = await Promise.all(
      Array.from({ length: 12 }, () => pgConsume(TEST_KEY, n))
    );
    const values = results.filter((r) => r.ok).map((r) => (r as { ok: true; value: string }).value);
    expect(values.filter((v) => v === 'ok')).toHaveLength(1);
    expect(values.filter((v) => v === 'replay')).toHaveLength(11);
  });

  it('4. separation by key_id', async () => {
    const n = 'dp04-pg-shared-nonce-abcdef01';
    expect((await pgConsume(TEST_KEY, n)).ok).toBe(true);
    expect((await pgConsume(OTHER_KEY, n)).ok).toBe(true);
    const replay = await pgConsume(TEST_KEY, n);
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.value).toBe('replay');
  });

  it('5. expired row pruned — reuse after expiry window', async () => {
    const n = 'dp04-pg-expired-nonce-abcdef1';
    const oldMs = 1_000_000_000_000;
    expect((await pgConsume(TEST_KEY, n, oldMs)).ok).toBe(true);
    const futureMs = oldMs + 7200 * 1000;
    const again = await pgConsume(TEST_KEY, n, futureMs);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value).toBe('ok');
  });

  it('6. malformed key_id → unavailable', async () => {
    const r = await pgConsume('bad!', 'dp04-pg-malformed-key-abc01');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('unavailable');
  });

  it('7. handler HTTP via DATABASE_URL consume + replay', async () => {
    const nonce = 'dp04-pg-http-handler-abcdef01';
    const r1 = await handlerConsume(TEST_KEY, nonce);
    expect(r1.status).toBe(200);
    const j1 = await r1.json();
    expect(j1.success).toBe(true);
    expect(JSON.stringify(j1)).not.toMatch(/password|postgres:\/\//i);

    const r2 = await handlerConsume(TEST_KEY, nonce);
    expect(r2.status).toBe(409);
    const j2 = await r2.json();
    expect(j2.error?.code).toBe('NONCE_REPLAY');
  });

  it('8. withPgTransaction without DATABASE_URL → fail-closed', async () => {
    resetPgPoolForTests();
    const r = await withPgTransaction({}, async (client) =>
      consumeNoncePg(client, TEST_KEY, 'dp04-pg-no-db-00000001', NOW_MS, {
        timestampWindowSeconds: WINDOW
      })
    );
    expect(r.ok).toBe(false);
  });

  it('9. PostgreSQL stopped → HTTP 503 fail-closed (no consume)', async () => {
    const nonce = 'dp04-a5-pg-down-nonce-abcdef01';
    await endPgPoolForTests();
    dockerPg('stop');
    await new Promise((r) => setTimeout(r, 1500));

    const core = await pgConsume(TEST_KEY, nonce);
    expect(core.ok).toBe(false);

    const h1 = await handlerConsume(TEST_KEY, nonce);
    expect(h1.status).toBe(503);
    const body1 = await h1.json();
    expect(body1.error?.code).toBe('STORE_UNAVAILABLE');
    expect(JSON.stringify(body1)).not.toMatch(/ECONNREFUSED|password|nonce_test_local/i);

    const h2 = await handlerConsume(TEST_KEY, nonce);
    expect(h2.status).toBe(503);

    dockerPg('start');
    await waitPgReady(45);
    resetPgPoolForTests();
    await withPgTransaction(env, async (client) => {
      await client.query('TRUNCATE agent_gateway_nonces');
    });

    const afterUp = await handlerConsume(TEST_KEY, nonce);
    expect(afterUp.status).toBe(200);
  }, 60_000);

  it('10. SQL error during consume → HTTP 503', async () => {
    await withPgTransaction(env, (c) => c.query('DROP TABLE IF EXISTS agent_gateway_nonces CASCADE'));
    resetPgPoolForTests();

    const nonce = 'dp04-a5-sql-error-nonce-abc01';
    const r = await handlerConsume(TEST_KEY, nonce);
    expect(r.status).toBe(503);
    const j = await r.json();
    expect(j.error?.code).toBe('STORE_UNAVAILABLE');
    expect(JSON.stringify(j)).not.toMatch(/relation does not exist/i);

    await reapplyMigration022();
    await waitPgReady();
    await withPgTransaction(env, async (client) => {
      await client.query('TRUNCATE agent_gateway_nonces');
    });
  });

  it('11. persist after PG restart → replay 409', async () => {
    const nonce = 'dp04-a5-persist-restart-abc01';
    expect((await handlerConsume(TEST_KEY, nonce)).status).toBe(200);
    await endPgPoolForTests();
    dockerPg('restart');
    await waitPgReady(45);
    resetPgPoolForTests();
    expect((await handlerConsume(TEST_KEY, nonce)).status).toBe(409);
  }, 60_000);
});
