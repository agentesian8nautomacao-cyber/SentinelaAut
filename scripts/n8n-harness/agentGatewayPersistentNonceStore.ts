/**
 * B16-C — AgentNonceStore backed by SQLite file or Postgres (via env).
 */

import type { AgentNonceStore } from './agentGatewayV1';
import { consumeNoncePg, type NonceConsumeOutcome } from '../../api/v1/_lib/agentGateway/nonceConsumeCore';
import {
  consumeNonceSqlite,
  openAgentGatewayNonceSqlite
} from '../../api/v1/_lib/agentGateway/nonceConsumeSqlite';
import { getTimestampWindowSeconds } from '../../api/v1/_lib/auth/timestamp';
import { withPgTransaction } from '../../api/_lib/db/pgPool';

export type PersistentNonceStoreEnv = {
  nonceSqlitePath?: string | null;
  databaseUrl?: string | null;
  timestampWindowSeconds?: number;
};

export function hasPersistentNonceBackend(env: PersistentNonceStoreEnv): boolean {
  const sqlite = String(env.nonceSqlitePath ?? '').trim();
  const pg = String(env.databaseUrl ?? '').trim();
  return Boolean(sqlite || pg);
}

type SqliteDb = ReturnType<typeof openAgentGatewayNonceSqlite>;

export function createSqliteAgentNonceStore(
  dbPath: string,
  windowSeconds?: number
): { ok: true; store: AgentNonceStore; db: SqliteDb } | { ok: false } {
  const path = String(dbPath || '').trim();
  if (!path) return { ok: false };
  const w = windowSeconds ?? getTimestampWindowSeconds();
  try {
    const db = openAgentGatewayNonceSqlite(path);
    const store: AgentNonceStore = {
      async consume(keyId, nonce, nowMs) {
        try {
          return consumeNonceSqlite(db, keyId, nonce, nowMs, { timestampWindowSeconds: w });
        } catch {
          return 'unavailable';
        }
      }
    };
    return { ok: true, store, db };
  } catch {
    return { ok: false };
  }
}

export function createPersistentAgentNonceStoreFromEnv(
  env: PersistentNonceStoreEnv
): { ok: true; store: AgentNonceStore } | { ok: false } {
  const sqlitePath = String(env.nonceSqlitePath ?? '').trim();
  const w = env.timestampWindowSeconds ?? getTimestampWindowSeconds();

  if (sqlitePath) {
    const created = createSqliteAgentNonceStore(sqlitePath, w);
    if (!created.ok) return { ok: false };
    return { ok: true, store: created.store };
  }

  const dbUrl = String(env.databaseUrl ?? '').trim();
  if (!dbUrl) return { ok: false };

  const store: AgentNonceStore = {
    async consume(keyId, nonce, nowMs): Promise<NonceConsumeOutcome> {
      const tx = await withPgTransaction({ DATABASE_URL: dbUrl }, async (client) =>
        consumeNoncePg(client, keyId, nonce, nowMs, { timestampWindowSeconds: w })
      );
      if (!tx.ok) return 'unavailable';
      return tx.value;
    }
  };
  return { ok: true, store };
}

export { nonceRetentionMs } from '../../api/v1/_lib/agentGateway/nonceConsumeCore';
