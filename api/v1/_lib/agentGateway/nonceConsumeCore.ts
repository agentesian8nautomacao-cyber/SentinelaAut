/**
 * B16-C — atomic persistent nonce consume (Postgres + shared helpers).
 * SQLite lives in nonceConsumeSqlite.ts (dynamic node:sqlite load).
 */

import type { PoolClient } from 'pg';

export type NonceConsumeOutcome = 'ok' | 'replay' | 'unavailable';

export type NonceConsumeEnv = {
  timestampWindowSeconds: number;
};

export function nonceRetentionMs(windowSeconds: number): number {
  const w = Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : 300;
  return (w * 2 + 60) * 1000;
}

function safeKeyId(keyId: string): boolean {
  return /^[A-Za-z0-9_.:-]{3,64}$/.test(keyId);
}

function safeNonce(nonce: string): boolean {
  return /^[A-Za-z0-9_.:-]{16,128}$/.test(nonce);
}

export async function consumeNoncePg(
  client: PoolClient,
  keyId: string,
  nonce: string,
  nowMs: number,
  env: NonceConsumeEnv
): Promise<NonceConsumeOutcome> {
  if (!safeKeyId(keyId) || !safeNonce(nonce)) return 'unavailable';
  const consumedAt = new Date(nowMs);
  const expiresAt = new Date(nowMs + nonceRetentionMs(env.timestampWindowSeconds));
  try {
    await client.query('DELETE FROM agent_gateway_nonces WHERE expires_at < $1', [consumedAt]);
    const ins = await client.query(
      `INSERT INTO agent_gateway_nonces (key_id, nonce, consumed_at, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key_id, nonce) DO NOTHING
       RETURNING key_id`,
      [keyId, nonce, consumedAt, expiresAt]
    );
    if (ins.rowCount && ins.rowCount > 0) return 'ok';
    return 'replay';
  } catch {
    return 'unavailable';
  }
}
