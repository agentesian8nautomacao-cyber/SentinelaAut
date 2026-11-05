/**
 * Postgres pool for server-side transactions (service DATABASE_URL only).
 * NEVER import from frontend bundles.
 */

import type { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

export type PgEnv = {
  DATABASE_URL?: string;
};

function pgSslOption(url: string): { rejectUnauthorized: false } | undefined {
  if (/sslmode=disable/i.test(url)) return undefined;
  if (url.includes('localhost') || url.includes('127.0.0.1')) return undefined;
  return { rejectUnauthorized: false };
}

export async function getPgPool(env: PgEnv | NodeJS.ProcessEnv = process.env): Promise<Pool | null> {
  const url = String(env.DATABASE_URL || '').trim();
  if (!url) return null;
  if (pool) return pool;
  const pg = await import('pg');
  const created = new pg.Pool({
    connectionString: url,
    ssl: pgSslOption(url),
    max: 3
  });
  created.on('error', (err) => logPgUnavailable('connect', err));
  pool = created;
  return pool;
}

const PG_CONNECT_UNAVAILABLE = 'Postgres indisponível (ligação).';

function pgErrCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    return String((err as { code: unknown }).code);
  }
  return 'UNKNOWN';
}

/** Server-side diagnostic only — never log connection strings or passwords. */
function logPgUnavailable(phase: 'connect' | 'transaction', err: unknown): void {
  console.error('[pgPool] store unavailable', { phase, code: pgErrCode(err) });
}

export async function withPgTransaction<T>(
  env: PgEnv | NodeJS.ProcessEnv,
  fn: (client: PoolClient) => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const p = await getPgPool(env);
  if (!p) {
    return { ok: false, error: 'DATABASE_URL não configurada no servidor.' };
  }
  let client: PoolClient | null = null;
  try {
    client = await p.connect();
  } catch (err: unknown) {
    logPgUnavailable('connect', err);
    return { ok: false, error: PG_CONNECT_UNAVAILABLE };
  }
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return { ok: true, value };
  } catch (err: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    logPgUnavailable('transaction', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    client.release();
  }
}

/** Test-only: drop cached pool (does not close idle connections). */
export function resetPgPoolForTests(): void {
  pool = null;
}

/** Test-only: close pool before simulating PG outage (avoids idle client crashes). */
export async function endPgPoolForTests(): Promise<void> {
  const p = pool;
  pool = null;
  if (p) {
    await p.end().catch(() => undefined);
  }
}
