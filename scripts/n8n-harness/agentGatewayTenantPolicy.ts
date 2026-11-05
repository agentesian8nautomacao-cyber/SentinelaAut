/**
 * B16-B-R2 — agent payload fields that must never be trusted as tenant/identity authority.
 * Top-level strip only; nested keys are not removed (see tests).
 */

export const AGENT_UNTRUSTED_IDENTITY_KEYS = [
  'organization_id',
  'organizationId',
  'org_id',
  'orgId',
  'condominium_id',
  'condominiumId',
  'tenant_id',
  'tenantId',
  '_agentGatewayPassed'
] as const;

export type AgentUntrustedIdentityKey = (typeof AGENT_UNTRUSTED_IDENTITY_KEYS)[number];

/** Serialized for AUT-2F-001 Validate + Normalize TENANT_KEYS. */
export function tenantKeysForNormalizeJsArray(): string {
  return `[${AGENT_UNTRUSTED_IDENTITY_KEYS.map((k) => `'${k}'`).join(',')}]`;
}

export function stripUntrustedIdentityFields(body: Record<string, unknown>): void {
  for (const k of AGENT_UNTRUSTED_IDENTITY_KEYS) {
    delete body[k];
  }
}

/**
 * Policy summary (not enforced here — server-side creds bind tenant on AUT-* / API v1):
 * - Removed at gateway/normalize: top-level keys above.
 * - Nested same names: preserved in payload but not authoritative.
 * - Effective tenant: SENTINELA_N8N_* / operational credentials only.
 */
