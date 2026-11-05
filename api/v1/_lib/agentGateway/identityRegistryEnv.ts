/**
 * B16-D2 — Agent gateway identity registry (env bootstrap, server-side only).
 * Mirrors D1 model until migration 023 is applied in postgres mode.
 */

import crypto from 'node:crypto';
import { AGENT_KEY_ID_RE } from './allowedKeyIds';

export const ENV_IDENTITY_REGISTRY = 'SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY';
export const ENV_IDENTITY_REGISTRY_MODE = 'SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY_MODE';

export type IdentityStatus = 'active' | 'suspended' | 'revoked';
export type IdentityKeyStatus = 'active' | 'revoked';

export type ParsedIdentityRegistryEntry = {
  identity_id: string;
  status: IdentityStatus;
  /** SHA-256 hex of accepted internal tokens (computed at parse). */
  token_sha256: ReadonlySet<string>;
  key_ids: ReadonlySet<string>;
};

export type IdentityRegistryResolution =
  | { ok: true; entries: ReadonlyMap<string, ParsedIdentityRegistryEntry>; tokenIndex: ReadonlyMap<string, string> }
  | { ok: false; reason: 'missing' | 'invalid' | 'empty' | 'duplicate_token' | 'duplicate_identity' | 'malformed' };

function sha256HexUtf8(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function parseTokenHashes(row: Record<string, unknown>): string[] | null {
  const out: string[] = [];
  const shaList = row.internal_token_sha256;
  if (Array.isArray(shaList)) {
    for (const item of shaList) {
      if (typeof item !== 'string' || !/^[a-f0-9]{64}$/i.test(item.trim())) return null;
      out.push(item.trim().toLowerCase());
    }
  }
  const tokens = row.internal_tokens;
  if (Array.isArray(tokens)) {
    for (const item of tokens) {
      if (typeof item !== 'string' || !item.trim()) return null;
      out.push(sha256HexUtf8(item.trim()));
    }
  }
  return out;
}

function parseKeys(row: Record<string, unknown>): string[] | null {
  const raw = row.key_ids;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const kid = item.trim();
      if (!AGENT_KEY_ID_RE.test(kid)) return null;
      out.push(kid);
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = item as { key_id?: string; status?: string };
      if (obj.status === 'revoked') continue;
      const kid = String(obj.key_id || '').trim();
      if (!AGENT_KEY_ID_RE.test(kid)) return null;
      out.push(kid);
      continue;
    }
    return null;
  }
  if (out.length === 0) return null;
  return out;
}

export function resolveIdentityRegistryFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): IdentityRegistryResolution {
  const raw = String(env[ENV_IDENTITY_REGISTRY] ?? '').trim();
  if (!raw) return { ok: false, reason: 'missing' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { ok: false, reason: 'empty' };

  const entries = new Map<string, ParsedIdentityRegistryEntry>();
  const tokenIndex = new Map<string, string>();

  for (const row of parsed) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return { ok: false, reason: 'malformed' };
    const obj = row as Record<string, unknown>;
    const identityId = String(obj.identity_id || '').trim();
    if (!identityId || identityId.length > 128) return { ok: false, reason: 'malformed' };

    const statusRaw = String(obj.status || 'active').trim() as IdentityStatus;
    if (statusRaw !== 'active' && statusRaw !== 'suspended' && statusRaw !== 'revoked') {
      return { ok: false, reason: 'malformed' };
    }

    const hashes = parseTokenHashes(obj);
    if (hashes === null || hashes.length === 0) return { ok: false, reason: 'malformed' };

    const keys = parseKeys(obj);
    if (keys === null) return { ok: false, reason: 'malformed' };

    if (entries.has(identityId)) return { ok: false, reason: 'duplicate_identity' };

    const tokenSet = new Set<string>();
    for (const h of hashes) {
      if (tokenIndex.has(h)) return { ok: false, reason: 'duplicate_token' };
      tokenIndex.set(h, identityId);
      tokenSet.add(h);
    }

    entries.set(identityId, {
      identity_id: identityId,
      status: statusRaw,
      token_sha256: tokenSet,
      key_ids: new Set(keys)
    });
  }

  return { ok: true, entries, tokenIndex };
}

export function authenticateIdentityFromEnvRegistry(
  providedToken: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
):
  | { ok: true; identity_id: string; entry: ParsedIdentityRegistryEntry }
  | { ok: false; reason: 'registry_unconfigured' | 'unknown_credential' | 'identity_inactive' } {
  const resolved = resolveIdentityRegistryFromEnv(env);
  if (!resolved.ok) return { ok: false, reason: 'registry_unconfigured' };

  const trimmed = String(providedToken || '').trim();
  if (!trimmed) return { ok: false, reason: 'unknown_credential' };

  const hash = sha256HexUtf8(trimmed);
  const identityId = resolved.tokenIndex.get(hash);
  if (!identityId) return { ok: false, reason: 'unknown_credential' };

  const entry = resolved.entries.get(identityId);
  if (!entry) return { ok: false, reason: 'unknown_credential' };

  let matched = false;
  for (const expected of entry.token_sha256) {
    if (timingSafeHexEqual(expected, hash)) {
      matched = true;
      break;
    }
  }
  if (!matched) return { ok: false, reason: 'unknown_credential' };

  if (entry.status !== 'active') return { ok: false, reason: 'identity_inactive' };

  return { ok: true, identity_id: identityId, entry };
}

export function isKeyIdAuthorizedForIdentityEntry(
  entry: ParsedIdentityRegistryEntry,
  keyId: string
): boolean {
  const trimmed = String(keyId || '').trim();
  if (!AGENT_KEY_ID_RE.test(trimmed)) return false;
  return entry.key_ids.has(trimmed);
}

/** Test / provision helper — never log output in production. */
export function buildIdentityRegistryEnvJson(
  rows: Array<{
    identity_id: string;
    status?: IdentityStatus;
    internal_tokens?: string[];
    key_ids: string[] | Array<{ key_id: string; status?: IdentityKeyStatus }>;
  }>
): string {
  return JSON.stringify(rows);
}
