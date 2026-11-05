/**
 * B16-C Etapa 5 — server-side allowlist for agent gateway key_id (nonce consume).
 * Fail-closed: missing or invalid configuration → no keys authorized.
 */

export const AGENT_KEY_ID_RE = /^[A-Za-z0-9_.:-]{3,64}$/;

export const ENV_ALLOWED_KEY_IDS = 'SENTINELA_AGENT_GATEWAY_ALLOWED_KEY_IDS';

export type AllowedKeyIdsResolution =
  | { ok: true; allowed: ReadonlySet<string> }
  | { ok: false; reason: 'missing' | 'empty' | 'invalid' | 'duplicate' | 'malformed_entry' };

function parseCsvOrJsonArray(raw: string): string[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return null;
      const out: string[] = [];
      for (const item of parsed) {
        if (typeof item === 'string') {
          out.push(item.trim());
        } else if (item && typeof item === 'object' && !Array.isArray(item)) {
          const kid = String((item as { key_id?: string }).key_id || '').trim();
          const status = (item as { status?: string }).status;
          if (status === 'revoked') continue;
          if (kid) out.push(kid);
        } else {
          return null;
        }
      }
      return out;
    } catch {
      return null;
    }
  }
  return trimmed.split(',').map((s) => s.trim());
}

/**
 * Resolves allowlist from env. Independent of PG/SQLite store selection.
 */
export function resolveAllowedKeyIds(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): AllowedKeyIdsResolution {
  const raw = String(env[ENV_ALLOWED_KEY_IDS] ?? '').trim();
  if (!raw) return { ok: false, reason: 'missing' };

  const entries = parseCsvOrJsonArray(raw);
  if (entries === null) return { ok: false, reason: 'invalid' };
  if (entries.length === 0) return { ok: false, reason: 'empty' };

  const allowed = new Set<string>();
  for (const entry of entries) {
    if (!entry) return { ok: false, reason: 'malformed_entry' };
    if (!AGENT_KEY_ID_RE.test(entry)) return { ok: false, reason: 'malformed_entry' };
    if (allowed.has(entry)) return { ok: false, reason: 'duplicate' };
    allowed.add(entry);
  }
  return { ok: true, allowed };
}

export function isKeyIdAllowed(
  keyId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): { allowed: true } | { allowed: false; reason: 'allowlist_unconfigured' | 'key_id_not_allowed' | 'key_id_invalid' } {
  const trimmed = String(keyId || '').trim();
  if (!trimmed) return { allowed: false, reason: 'key_id_invalid' };
  if (!AGENT_KEY_ID_RE.test(trimmed)) return { allowed: false, reason: 'key_id_invalid' };

  const resolved = resolveAllowedKeyIds(env);
  if (!resolved.ok) return { allowed: false, reason: 'allowlist_unconfigured' };
  if (!resolved.allowed.has(trimmed)) return { allowed: false, reason: 'key_id_not_allowed' };
  return { allowed: true };
}
