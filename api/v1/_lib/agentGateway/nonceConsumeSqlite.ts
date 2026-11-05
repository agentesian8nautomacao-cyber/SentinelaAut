/**
 * B16-C — SQLite backend for agent gateway nonces (Node node:sqlite).
 */

import { createRequire } from 'node:module';
import type { NonceConsumeEnv, NonceConsumeOutcome } from './nonceConsumeCore';
import { nonceRetentionMs } from './nonceConsumeCore';

const require = createRequire(import.meta.url);

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS agent_gateway_nonces (
  key_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  consumed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key_id, nonce)
);
CREATE INDEX IF NOT EXISTS idx_agent_gateway_nonces_expires ON agent_gateway_nonces(expires_at);
`;

function safeKeyId(keyId: string): boolean {
  return /^[A-Za-z0-9_.:-]{3,64}$/.test(keyId);
}

function safeNonce(nonce: string): boolean {
  return /^[A-Za-z0-9_.:-]{16,128}$/.test(nonce);
}

type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { run(...args: unknown[]): void };
};

function DatabaseSyncCtor(): new (path: string) => SqliteDb {
  const mod = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDb };
  return mod.DatabaseSync;
}

export function openAgentGatewayNonceSqlite(dbPath: string): SqliteDb {
  const DatabaseSync = DatabaseSyncCtor();
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec(SQLITE_SCHEMA);
  return db;
}

export function consumeNonceSqlite(
  db: SqliteDb,
  keyId: string,
  nonce: string,
  nowMs: number,
  env: NonceConsumeEnv
): NonceConsumeOutcome {
  if (!safeKeyId(keyId) || !safeNonce(nonce)) return 'unavailable';
  const consumedAt = Math.floor(nowMs);
  const expiresAt = consumedAt + nonceRetentionMs(env.timestampWindowSeconds);
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare('DELETE FROM agent_gateway_nonces WHERE expires_at < ?').run(consumedAt);
    const ins = db.prepare(
      'INSERT INTO agent_gateway_nonces (key_id, nonce, consumed_at, expires_at) VALUES (?, ?, ?, ?)'
    );
    try {
      ins.run(keyId, nonce, consumedAt, expiresAt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE') || msg.includes('constraint')) {
        db.exec('ROLLBACK');
        return 'replay';
      }
      db.exec('ROLLBACK');
      return 'unavailable';
    }
    db.exec('COMMIT');
    return 'ok';
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    return 'unavailable';
  }
}
