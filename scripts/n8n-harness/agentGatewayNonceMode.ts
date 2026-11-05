/**
 * B16-B-R1 / B16-B-R2 / B16-C — strict allowlist for SENTINELA_AGENT_GATEWAY_NONCE_STORE (n8n parity).
 */

import {
  resolveHarnessRuntimeProfile,
  type HarnessRuntimeSignals
} from './agentGatewayHarnessRuntime';
import { hasPersistentNonceBackend } from './agentGatewayPersistentNonceStore';

export const AGENT_NONCE_MODE_UNAVAILABLE = 'unavailable';
export const AGENT_NONCE_MODE_MEMORY_TEST = 'memory_test';
export const AGENT_NONCE_MODE_PERSISTENT = 'persistent';

export const AGENT_PUBLIC_UNAVAILABLE = 'AGENT_GATEWAY_UNAVAILABLE';

export type AgentNonceModeResolution =
  | { ok: true; mode: typeof AGENT_NONCE_MODE_MEMORY_TEST | typeof AGENT_NONCE_MODE_PERSISTENT }
  | { ok: false; httpStatus: 503; public_code: typeof AGENT_PUBLIC_UNAVAILABLE };

export type AgentNonceModeEnv = {
  nonceStore?: string | null;
  allowMemoryTest?: string | null;
  testEnv?: string | null;
  /** B16-C — SQLite file path for atomic nonce store */
  nonceSqlitePath?: string | null;
  /** B16-C — Postgres DATABASE_URL (server-side) */
  databaseUrl?: string | null;
  /** B16-C — n8n calls internal consume API */
  nonceConsumeUrl?: string | null;
  internalToken?: string | null;
} & HarnessRuntimeSignals;

export function hasPersistentNonceModeConfig(env: AgentNonceModeEnv): boolean {
  if (
    hasPersistentNonceBackend({
      nonceSqlitePath: env.nonceSqlitePath,
      databaseUrl: env.databaseUrl
    })
  ) {
    return true;
  }
  const url = String(env.nonceConsumeUrl ?? '').trim();
  const tok = String(env.internalToken ?? '').trim();
  return Boolean(url && tok);
}

/**
 * Fail-closed: unknown modes → 503.
 * memory_test requires ALLOW + TEST_ENV + authorized harness runtime (not production).
 * persistent requires configured backend (SQLite path, DATABASE_URL, or consume URL + token).
 */
export function resolveAgentNonceStoreMode(env: AgentNonceModeEnv): AgentNonceModeResolution {
  const mode = String(env.nonceStore ?? AGENT_NONCE_MODE_UNAVAILABLE)
    .trim()
    .toLowerCase();

  if (!mode || mode === AGENT_NONCE_MODE_UNAVAILABLE) {
    return { ok: false, httpStatus: 503, public_code: AGENT_PUBLIC_UNAVAILABLE };
  }

  if (mode === AGENT_NONCE_MODE_PERSISTENT) {
    if (!hasPersistentNonceModeConfig(env)) {
      return { ok: false, httpStatus: 503, public_code: AGENT_PUBLIC_UNAVAILABLE };
    }
    return { ok: true, mode: AGENT_NONCE_MODE_PERSISTENT };
  }

  if (mode === AGENT_NONCE_MODE_MEMORY_TEST) {
    const allow = String(env.allowMemoryTest ?? '').trim() === '1';
    const testEnv = String(env.testEnv ?? '').trim() === '1';
    if (!allow || !testEnv) {
      return { ok: false, httpStatus: 503, public_code: AGENT_PUBLIC_UNAVAILABLE };
    }
    const harness = resolveHarnessRuntimeProfile(env);
    if (!harness.ok) {
      return { ok: false, httpStatus: 503, public_code: AGENT_PUBLIC_UNAVAILABLE };
    }
    return { ok: true, mode: AGENT_NONCE_MODE_MEMORY_TEST };
  }

  return { ok: false, httpStatus: 503, public_code: AGENT_PUBLIC_UNAVAILABLE };
}
