import { describe, expect, it } from 'vitest';
import {
  authenticateIdentityFromEnvRegistry,
  buildIdentityRegistryEnvJson,
  resolveIdentityRegistryFromEnv
} from './identityRegistryEnv';

describe('identityRegistryEnv', () => {
  it('missing registry → fail closed', () => {
    expect(resolveIdentityRegistryFromEnv({}).ok).toBe(false);
  });

  it('rejects duplicate token across identities', () => {
    const json = buildIdentityRegistryEnvJson([
      { identity_id: 'a', internal_tokens: ['same-token'], key_ids: ['key-a-001'] },
      { identity_id: 'b', internal_tokens: ['same-token'], key_ids: ['key-b-001'] }
    ]);
    expect(resolveIdentityRegistryFromEnv({ SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY: json }).ok).toBe(
      false
    );
  });

  it('authenticates active identity', () => {
    const json = buildIdentityRegistryEnvJson([
      {
        identity_id: '11111111-1111-1111-1111-111111111111',
        internal_tokens: ['secret-token-a'],
        key_ids: ['agent-key-a-001']
      }
    ]);
    const env = { SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY: json };
    const auth = authenticateIdentityFromEnvRegistry('secret-token-a', env);
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.identity_id).toContain('11111111');
  });

  it('revoked identity → inactive', () => {
    const json = buildIdentityRegistryEnvJson([
      {
        identity_id: 'rev-id',
        status: 'revoked',
        internal_tokens: ['rev-token'],
        key_ids: ['agent-key-rev-01']
      }
    ]);
    const auth = authenticateIdentityFromEnvRegistry('rev-token', {
      SENTINELA_AGENT_GATEWAY_IDENTITY_REGISTRY: json
    });
    expect(auth.ok).toBe(false);
    if (!auth.ok) expect(auth.reason).toBe('identity_inactive');
  });
});
