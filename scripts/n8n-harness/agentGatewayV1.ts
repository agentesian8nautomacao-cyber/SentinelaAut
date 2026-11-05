/**
 * Agent Gateway HMAC agent-v1 — shared contract (B16-B).
 * Used by Vitest; mirror logic in agentGatewayValidate.n8n.js for n8n Code node.
 */

import { sha256Hex, signCanonical, verifySignature } from '../../api/v1/_lib/auth/hmac';
import { checkTimestamp, getTimestampWindowSeconds } from '../../api/v1/_lib/auth/timestamp';
import { stripAgentUntrustedBodyFields } from './agentGatewayRawBody';
import {
  AGENT_NONCE_MODE_MEMORY_TEST,
  AGENT_NONCE_MODE_PERSISTENT,
  resolveAgentNonceStoreMode,
  type AgentNonceModeEnv
} from './agentGatewayNonceMode';
import { createHttpAgentNonceStore } from './agentGatewayHttpNonceStore';
import {
  createPersistentAgentNonceStoreFromEnv,
  hasPersistentNonceBackend
} from './agentGatewayPersistentNonceStore';
import type { NonceConsumeHttpOutcome } from '../../api/v1/_lib/agentGateway/nonceConsumeHttpOutcome';

export const AGENT_GATEWAY_PROTOCOL = 'agent-v1';
export const AGENT_GATEWAY_METHOD = 'POST';
export const AGENT_GATEWAY_CANONICAL_PATH = '/webhook/sentinelaaut/aut-2f-001';

export const AGENT_HEADER_KEY_ID = 'X-Agent-Key-Id';
export const AGENT_HEADER_TIMESTAMP = 'X-Agent-Timestamp';
export const AGENT_HEADER_NONCE = 'X-Agent-Nonce';
export const AGENT_HEADER_SIGNATURE = 'X-Agent-Signature';

/** External-facing auth failure (no hint which check failed). */
export const AGENT_PUBLIC_AUTH_FAILED = 'AGENT_AUTH_FAILED';
export const AGENT_PUBLIC_UNAVAILABLE = 'AGENT_GATEWAY_UNAVAILABLE';
/** B16-D3 — identity/key binding or allowlist denial at consume API (not store outage). */
export const AGENT_PUBLIC_FORBIDDEN = 'AGENT_GATEWAY_FORBIDDEN';

export type AgentGatewaySecret = {
  key_id: string;
  secret: string;
  secret_previous?: string;
  status?: 'active' | 'revoked';
};

export type AgentNonceConsumeResult = NonceConsumeHttpOutcome;

export interface AgentNonceStore {
  consume(keyId: string, nonce: string, nowMs: number): Promise<AgentNonceConsumeResult>;
}

export const unavailableAgentNonceStore: AgentNonceStore = {
  async consume() {
    return 'unavailable';
  }
};

export function createMemoryAgentNonceStore(): AgentNonceStore {
  const seen = new Set<string>();
  return {
    async consume(keyId: string, nonce: string) {
      const k = `${keyId}:${nonce}`;
      if (seen.has(k)) return 'replay';
      seen.add(k);
      return 'ok';
    }
  };
}

export function buildAgentGatewayCanonical(input: {
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  bodySha256Hex: string;
}): string {
  const method = input.method.toUpperCase();
  const path = input.path.startsWith('/') ? input.path : `/${input.path}`;
  return [
    AGENT_GATEWAY_PROTOCOL,
    input.timestamp.trim(),
    input.nonce.trim(),
    method,
    path,
    input.bodySha256Hex.toLowerCase().trim()
  ].join('\n');
}

export function signAgentGatewayRequest(opts: {
  timestamp: string;
  nonce: string;
  method?: string;
  path?: string;
  rawBody: string;
  secret: string;
}): string {
  const canonical = buildAgentGatewayCanonical({
    timestamp: opts.timestamp,
    nonce: opts.nonce,
    method: opts.method ?? AGENT_GATEWAY_METHOD,
    path: opts.path ?? AGENT_GATEWAY_CANONICAL_PATH,
    bodySha256Hex: sha256Hex(opts.rawBody || '')
  });
  return signCanonical(opts.secret, canonical);
}

function headerLookup(headers: Record<string, string | undefined>, name: string): string {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return (v || '').trim();
  }
  return '';
}

const KEY_ID_RE = /^[A-Za-z0-9_.:-]{3,64}$/;
const NONCE_RE = /^[A-Za-z0-9_.:-]{16,128}$/;

export function parseAgentGatewaySecretsJson(raw: string): AgentGatewaySecret[] {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) return [];
  const out: AgentGatewaySecret[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const key_id = String(r.key_id || '').trim();
    const secret = String(r.secret || '').trim();
    if (!key_id || !secret) continue;
    const secret_previous =
      typeof r.secret_previous === 'string' && r.secret_previous.trim()
        ? r.secret_previous.trim()
        : undefined;
    const status =
      r.status === 'revoked' || r.status === 'active' ? r.status : undefined;
    out.push({ key_id, secret, secret_previous, status });
  }
  return out;
}

export type ValidateAgentGatewayInput = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  rawBody: string | null | undefined;
  secrets: AgentGatewaySecret[];
  windowSeconds?: number;
  nowMs?: number;
  nonceStore: AgentNonceStore;
  /** When true (default), nonce store must return ok after crypto checks. */
  requirePersistentNonce?: boolean;
};

export type ValidateAgentGatewaySuccess = {
  ok: true;
  key_id: string;
  parsedBody: Record<string, unknown>;
};

export type ValidateAgentGatewayFailure = {
  ok: false;
  httpStatus: 401 | 403 | 503;
  /** Internal diagnostic for logs/tests — not for external callers. */
  internal_code: string;
  public_code:
    | typeof AGENT_PUBLIC_AUTH_FAILED
    | typeof AGENT_PUBLIC_UNAVAILABLE
    | typeof AGENT_PUBLIC_FORBIDDEN;
};

export type ValidateAgentGatewayResult =
  | ValidateAgentGatewaySuccess
  | ValidateAgentGatewayFailure;

function authFail(internal_code: string): ValidateAgentGatewayFailure {
  return {
    ok: false,
    httpStatus: 401,
    internal_code,
    public_code: AGENT_PUBLIC_AUTH_FAILED
  };
}

function unavailableFail(internal_code: string): ValidateAgentGatewayFailure {
  return {
    ok: false,
    httpStatus: 503,
    internal_code,
    public_code: AGENT_PUBLIC_UNAVAILABLE
  };
}

function forbiddenFail(internal_code: string): ValidateAgentGatewayFailure {
  return {
    ok: false,
    httpStatus: 403,
    internal_code,
    public_code: AGENT_PUBLIC_FORBIDDEN
  };
}

export type AgentNonceStoreResolution =
  | { ok: true; nonceStore: AgentNonceStore }
  | ValidateAgentGatewayFailure;

/** Maps SENTINELA_AGENT_GATEWAY_NONCE_STORE env to a store (B16-B-R1 allowlist). */
export function agentNonceStoreForMode(env: AgentNonceModeEnv): AgentNonceStoreResolution {
  const resolved = resolveAgentNonceStoreMode(env);
  if (!resolved.ok) {
    return unavailableFail('AGENT_NONCE_STORE_MODE_REJECTED');
  }
  if (resolved.mode === AGENT_NONCE_MODE_MEMORY_TEST) {
    return { ok: true, nonceStore: createMemoryAgentNonceStore() };
  }
  if (resolved.mode === AGENT_NONCE_MODE_PERSISTENT) {
    if (
      hasPersistentNonceBackend({
        nonceSqlitePath: env.nonceSqlitePath,
        databaseUrl: env.databaseUrl
      })
    ) {
      const created = createPersistentAgentNonceStoreFromEnv({
        nonceSqlitePath: env.nonceSqlitePath,
        databaseUrl: env.databaseUrl
      });
      if (!created.ok) {
        return unavailableFail('AGENT_NONCE_STORE_UNAVAILABLE');
      }
      return { ok: true, nonceStore: created.store };
    }
    const consumeUrl = String(env.nonceConsumeUrl ?? '').trim();
    const internalToken = String(env.internalToken ?? '').trim();
    if (consumeUrl && internalToken) {
      return {
        ok: true,
        nonceStore: createHttpAgentNonceStore({ consumeUrl, internalToken })
      };
    }
    return unavailableFail('AGENT_NONCE_STORE_UNAVAILABLE');
  }
  return unavailableFail('AGENT_NONCE_STORE_MODE_REJECTED');
}

export async function validateAgentGatewayWithNonceEnv(
  input: Omit<ValidateAgentGatewayInput, 'nonceStore' | 'requirePersistentNonce'> & {
    nonceEnv: AgentNonceModeEnv;
  }
): Promise<ValidateAgentGatewayResult> {
  const storeRes = agentNonceStoreForMode(input.nonceEnv);
  if (!storeRes.ok) return storeRes;
  const { nonceEnv: _nonceEnv, ...rest } = input;
  return validateAgentGatewayRequest({
    ...rest,
    nonceStore: storeRes.nonceStore,
    requirePersistentNonce: true
  });
}

export async function validateAgentGatewayRequest(
  input: ValidateAgentGatewayInput
): Promise<ValidateAgentGatewayResult> {
  const requirePersistentNonce = input.requirePersistentNonce !== false;
  const nowMs = input.nowMs ?? Date.now();
  const windowSeconds = input.windowSeconds ?? getTimestampWindowSeconds();

  if (input.method.toUpperCase() !== AGENT_GATEWAY_METHOD) {
    return authFail('AGENT_METHOD_INVALID');
  }
  if (input.path !== AGENT_GATEWAY_CANONICAL_PATH) {
    return authFail('AGENT_PATH_INVALID');
  }

  if (input.rawBody === null || input.rawBody === undefined) {
    return authFail('AGENT_RAW_BODY_MISSING');
  }
  const rawBody = typeof input.rawBody === 'string' ? input.rawBody : String(input.rawBody);

  const keyId = headerLookup(input.headers, AGENT_HEADER_KEY_ID);
  const timestamp = headerLookup(input.headers, AGENT_HEADER_TIMESTAMP);
  const nonce = headerLookup(input.headers, AGENT_HEADER_NONCE);
  const signature = headerLookup(input.headers, AGENT_HEADER_SIGNATURE);

  if (!keyId || !KEY_ID_RE.test(keyId)) return authFail('AGENT_KEY_ID_INVALID');
  if (!nonce || !NONCE_RE.test(nonce)) return authFail('AGENT_NONCE_INVALID');
  if (!signature) return authFail('AGENT_SIGNATURE_MISSING');

  const tsCheck = checkTimestamp(timestamp, nowMs, windowSeconds);
  if (tsCheck.ok === false) return authFail('AGENT_TIMESTAMP_INVALID');

  const cred = input.secrets.find((s) => s.key_id === keyId);
  if (!cred || cred.status === 'revoked') return authFail('AGENT_KEY_UNKNOWN_OR_REVOKED');

  const bodySha = sha256Hex(rawBody);
  const canonical = buildAgentGatewayCanonical({
    timestamp,
    nonce,
    method: AGENT_GATEWAY_METHOD,
    path: AGENT_GATEWAY_CANONICAL_PATH,
    bodySha256Hex: bodySha
  });
  const secrets = [cred.secret, cred.secret_previous].filter(Boolean) as string[];
  if (!verifySignature(secrets, canonical, signature)) {
    return authFail('AGENT_SIGNATURE_INVALID');
  }

  let parsedBody: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return authFail('AGENT_BODY_NOT_OBJECT');
    }
    parsedBody = parsed as Record<string, unknown>;
    stripAgentUntrustedBodyFields(parsedBody);
  } catch {
    return authFail('AGENT_BODY_INVALID_JSON');
  }

  const nonceResult = await input.nonceStore.consume(keyId, nonce, nowMs);
  if (nonceResult === 'replay') return authFail('AGENT_NONCE_REPLAY');
  if (nonceResult === 'forbidden') {
    return forbiddenFail('AGENT_NONCE_CONSUME_FORBIDDEN');
  }
  if (nonceResult === 'unauthorized') {
    return unavailableFail('AGENT_NONCE_CONSUME_UNAUTHORIZED');
  }
  if (nonceResult === 'bad_request') {
    return unavailableFail('AGENT_NONCE_CONSUME_BAD_REQUEST');
  }
  if (nonceResult === 'unavailable') {
    if (requirePersistentNonce) {
      return unavailableFail('AGENT_NONCE_STORE_UNAVAILABLE');
    }
  }

  return { ok: true, key_id: keyId, parsedBody };
}

/** Workflow routing: auth failure must not reach Execute Workflow (skip_http). */
export function agentGatewayFailureToRouterItem(fail: ValidateAgentGatewayFailure): {
  skip_http: true;
  error_code: string;
  httpStatus: number;
  agent_gateway_blocked: true;
} {
  return {
    skip_http: true,
    error_code: fail.public_code,
    httpStatus: fail.httpStatus,
    agent_gateway_blocked: true
  };
}

export function shouldReachExecuteWorkflow(item: { skip_http?: boolean }): boolean {
  return item.skip_http !== true;
}
