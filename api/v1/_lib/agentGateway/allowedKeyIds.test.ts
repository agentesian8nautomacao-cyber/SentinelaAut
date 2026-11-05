import { describe, expect, it } from 'vitest';
import { ENV_ALLOWED_KEY_IDS, isKeyIdAllowed, resolveAllowedKeyIds } from './allowedKeyIds';

describe('allowedKeyIds', () => {
  it('missing env → fail closed', () => {
    expect(resolveAllowedKeyIds({}).ok).toBe(false);
    expect(isKeyIdAllowed('agent-key-001', {}).allowed).toBe(false);
  });

  it('parses CSV', () => {
    const r = resolveAllowedKeyIds({
      [ENV_ALLOWED_KEY_IDS]: 'key-a,key-b,agent-demo-01'
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.allowed.has('key-a')).toBe(true);
      expect(r.allowed.size).toBe(3);
    }
  });

  it('rejects duplicate', () => {
    expect(
      resolveAllowedKeyIds({ [ENV_ALLOWED_KEY_IDS]: 'same-id,same-id' }).ok
    ).toBe(false);
  });

  it('rejects malformed entry', () => {
    expect(resolveAllowedKeyIds({ [ENV_ALLOWED_KEY_IDS]: 'bad!' }).ok).toBe(false);
  });

  it('JSON array of key_id objects skips revoked', () => {
    const r = resolveAllowedKeyIds({
      [ENV_ALLOWED_KEY_IDS]: JSON.stringify([
        { key_id: 'active-key-001', status: 'active' },
        { key_id: 'revoked-key-001', status: 'revoked' }
      ])
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.allowed.has('active-key-001')).toBe(true);
      expect(r.allowed.has('revoked-key-001')).toBe(false);
    }
  });
});
