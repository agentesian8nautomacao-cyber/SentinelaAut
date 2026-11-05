/**
 * B16-D2 — Authenticate internal caller and authorize key_id for identity (A+B+D).
 */

import {
  authenticateIdentityFromEnvRegistry,
  isKeyIdAuthorizedForIdentityEntry,
  resolveIdentityRegistryFromEnv,
  ENV_IDENTITY_REGISTRY
} from './identityRegistryEnv';
import {
  authenticateIdentityFromPostgres,
  isKeyIdAuthorizedForIdentityPostgres,
  isPostgresIdentityRegistryMode
} from './identityRegistryPg';

const HDR_INTERNAL = 'x-sentinela-agent-gateway-internal-token';

export type IdentityAuthFailureCode =
  | 'IDENTITY_REGISTRY_NOT_CONFIGURED'
  | 'IDENTITY_UNAUTHORIZED'
  | 'KEY_ID_NOT_AUTHORIZED';

export function extractInternalBearerToken(request: Request): string {
  const auth = String(request.headers.get('authorization') || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return String(request.headers.get(HDR_INTERNAL) || '').trim();
}

export async function authenticateAgentGatewayIdentity(
  request: Request,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
):
  | { ok: true; identity_id: string }
  | { ok: false; httpStatus: 401 | 503; code: IdentityAuthFailureCode | 'UNAUTHORIZED' } {
  const token = extractInternalBearerToken(request);
  if (!token) {
    return { ok: false, httpStatus: 401, code: 'UNAUTHORIZED' };
  }

  if (isPostgresIdentityRegistryMode(env)) {
    const pg = await authenticateIdentityFromPostgres(token, env);
    if (pg.ok) return { ok: true, identity_id: pg.identity_id };
    if (pg.reason === 'registry_unavailable') {
      return { ok: false, httpStatus: 503, code: 'IDENTITY_REGISTRY_NOT_CONFIGURED' };
    }
    return { ok: false, httpStatus: 401, code: 'IDENTITY_UNAUTHORIZED' };
  }

  const envResolved = resolveIdentityRegistryFromEnv(env);
  if (!envResolved.ok) {
    const hasLegacyOnly =
      String(env.SENTINELA_AGENT_GATEWAY_INTERNAL_TOKEN || '').trim() &&
      !String(env[ENV_IDENTITY_REGISTRY] || '').trim();
    if (hasLegacyOnly) {
      return { ok: false, httpStatus: 503, code: 'IDENTITY_REGISTRY_NOT_CONFIGURED' };
    }
    return { ok: false, httpStatus: 503, code: 'IDENTITY_REGISTRY_NOT_CONFIGURED' };
  }

  const auth = authenticateIdentityFromEnvRegistry(token, env);
  if (!auth.ok) {
    if (auth.reason === 'registry_unconfigured') {
      return { ok: false, httpStatus: 503, code: 'IDENTITY_REGISTRY_NOT_CONFIGURED' };
    }
    return { ok: false, httpStatus: 401, code: 'IDENTITY_UNAUTHORIZED' };
  }

  return { ok: true, identity_id: auth.identity_id };
}

export async function authorizeKeyIdForIdentity(
  identityId: string,
  keyId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): Promise<{ ok: true } | { ok: false; httpStatus: 403 | 503; code: IdentityAuthFailureCode }> {
  if (isPostgresIdentityRegistryMode(env)) {
    const allowed = await isKeyIdAuthorizedForIdentityPostgres(env, identityId, keyId);
    if (allowed === 'unavailable') {
      return { ok: false, httpStatus: 503, code: 'IDENTITY_REGISTRY_NOT_CONFIGURED' };
    }
    if (!allowed) {
      return { ok: false, httpStatus: 403, code: 'KEY_ID_NOT_AUTHORIZED' };
    }
    return { ok: true };
  }

  const resolved = resolveIdentityRegistryFromEnv(env);
  if (!resolved.ok) {
    return { ok: false, httpStatus: 503, code: 'IDENTITY_REGISTRY_NOT_CONFIGURED' };
  }

  const entry = resolved.entries.get(identityId);
  if (!entry || entry.status !== 'active') {
    return { ok: false, httpStatus: 401, code: 'IDENTITY_UNAUTHORIZED' };
  }

  if (!isKeyIdAuthorizedForIdentityEntry(entry, keyId)) {
    return { ok: false, httpStatus: 403, code: 'KEY_ID_NOT_AUTHORIZED' };
  }

  return { ok: true };
}
