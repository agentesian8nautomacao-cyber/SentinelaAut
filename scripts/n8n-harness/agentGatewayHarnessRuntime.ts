/**
 * B16-B-R2 — independent harness runtime gate for memory_test (fail-closed).
 * Not a substitute for B16-C persistent nonce store.
 */

export const HARNESS_RUNTIME_VITEST = 'vitest';
export const HARNESS_RUNTIME_LOCAL_N8N = 'local_n8n';

export type HarnessRuntimeSignals = {
  nodeEnv?: string | null;
  vercelEnv?: string | null;
  /** When '1', memory_test is always blocked (explicit production lock). */
  productionLock?: string | null;
  /**
   * Third gate — must be `vitest` or `local_n8n` (SENTINELA_AGENT_GATEWAY_HARNESS_RUNTIME).
   * Independent from ALLOW_MEMORY_TEST / TEST_ENV.
   */
  harnessRuntime?: string | null;
  /** Set automatically by Vitest (VITEST=true). Counts as authorized harness runtime. */
  vitest?: string | null;
};

export type HarnessRuntimeResolution =
  | { ok: true }
  | { ok: false; reason: 'production_runtime' | 'harness_runtime_missing' | 'harness_runtime_invalid' | 'harness_contradiction' };

export function isProductionRuntime(signals: HarnessRuntimeSignals): boolean {
  if (String(signals.productionLock ?? '').trim() === '1') return true;
  const node = String(signals.nodeEnv ?? '').trim().toLowerCase();
  if (node === 'production') return true;
  const vercel = String(signals.vercelEnv ?? '').trim().toLowerCase();
  if (vercel === 'production') return true;
  return false;
}

export function resolveHarnessRuntimeProfile(signals: HarnessRuntimeSignals): HarnessRuntimeResolution {
  if (isProductionRuntime(signals)) {
    return { ok: false, reason: 'production_runtime' };
  }

  const vitestOn = String(signals.vitest ?? '').trim().toLowerCase() === 'true';
  const hrRaw = String(signals.harnessRuntime ?? '').trim().toLowerCase();

  if (vitestOn && hrRaw && hrRaw !== HARNESS_RUNTIME_VITEST && hrRaw !== HARNESS_RUNTIME_LOCAL_N8N) {
    return { ok: false, reason: 'harness_contradiction' };
  }

  if (vitestOn) return { ok: true };

  if (!hrRaw) return { ok: false, reason: 'harness_runtime_missing' };
  if (hrRaw === HARNESS_RUNTIME_VITEST || hrRaw === HARNESS_RUNTIME_LOCAL_N8N) {
    return { ok: true };
  }
  return { ok: false, reason: 'harness_runtime_invalid' };
}

/** Build signals from Node/process env (Vitest or harness scripts). */
export function harnessSignalsFromProcessEnv(
  env: Record<string, string | undefined> = process.env
): HarnessRuntimeSignals {
  return {
    nodeEnv: env.NODE_ENV,
    vercelEnv: env.VERCEL_ENV,
    productionLock: env.SENTINELA_AGENT_GATEWAY_PRODUCTION,
    harnessRuntime: env.SENTINELA_AGENT_GATEWAY_HARNESS_RUNTIME,
    vitest: env.VITEST
  };
}
