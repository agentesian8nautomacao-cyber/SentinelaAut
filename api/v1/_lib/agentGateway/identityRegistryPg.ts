/**
 * B16-D2 — Identity registry backed by PostgreSQL (migration 023).
 * Not applied on hosted DB until operator authorizes — fail-closed on errors.
 */

import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { getPgPool } from '../../../_lib/db/pgPool';
import { AGENT_KEY_ID_RE } from './allowedKeyIds';
import { ENV_IDENTITY_REGISTRY_MODE } from './identityRegistryEnv';

export type PgIdentityAuthResult =
  | { ok: true; identity_id: string }
  | { ok: false; reason: 'registry_unavailable' | 'unknown_credential' | 'identity_inactive' };

function sha256HexUtf8(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function isPostgresIdentityRegistryMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return String(env[ENV_IDENTITY_REGISTRY_MODE] || '').trim().toLowerCase() === 'postgres';
}

export async function authenticateIdentityFromPostgres(
  providedToken: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): Promise<PgIdentityAuthResult> {
  const trimmed = String(providedToken || '').trim();
  if (!trimmed) return { ok: false, reason: 'unknown_credential' };

  const pool = await getPgPool(env);
  if (!pool) return { ok: false, reason: 'registry_unavailable' };

  const tokenHash = sha256HexUtf8(trimmed);
  try {
    const res = await pool.query<{ identity_id: string; identity_status: string; cred_status: string }>(
      `SELECT i.id AS identity_id, i.status AS identity_status, c.status AS cred_status
       FROM agent_gateway_internal_credentials c
       INNER JOIN agent_gateway_identities i ON i.id = c.identity_id
       WHERE c.token_hash = $1
         AND c.status = 'active'
         AND (c.expires_at IS NULL OR c.expires_at > now())
       LIMIT 1`,
      [tokenHash]
    );
    if (res.rowCount === 0) return { ok: false, reason: 'unknown_credential' };
    const row = res.rows[0];
    if (row.identity_status !== 'active') return { ok: false, reason: 'identity_inactive' };
    if (row.cred_status !== 'active') return { ok: false, reason: 'unknown_credential' };
    return { ok: true, identity_id: row.identity_id };
  } catch {
    return { ok: false, reason: 'registry_unavailable' };
  }
}

export async function isKeyIdAuthorizedForIdentityPostgres(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  identityId: string,
  keyId: string
): Promise<boolean | 'unavailable'> {
  const trimmed = String(keyId || '').trim();
  if (!AGENT_KEY_ID_RE.test(trimmed)) return false;

  const pool = await getPgPool(env);
  if (!pool) return 'unavailable';

  try {
    const res = await pool.query(
      `SELECT 1 FROM agent_gateway_identity_keys
       WHERE identity_id = $1 AND key_id = $2 AND status = 'active'
       LIMIT 1`,
      [identityId, trimmed]
    );
    return res.rowCount !== null && res.rowCount > 0;
  } catch {
    return 'unavailable';
  }
}

/** Optional: update last_used_at (best-effort, non-blocking for consume path). */
export async function touchCredentialLastUsed(
  client: PoolClient,
  tokenHash: string
): Promise<void> {
  try {
    await client.query(
      `UPDATE agent_gateway_internal_credentials SET last_used_at = now() WHERE token_hash = $1`,
      [tokenHash]
    );
  } catch {
    /* ignore */
  }
}
