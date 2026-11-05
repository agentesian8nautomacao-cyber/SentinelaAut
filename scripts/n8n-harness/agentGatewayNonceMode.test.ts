import { describe, expect, it } from 'vitest';
import { HARNESS_RUNTIME_VITEST } from './agentGatewayHarnessRuntime';
import { resolveAgentNonceStoreMode } from './agentGatewayNonceMode';

const memoryBase = {
  nonceStore: 'memory_test',
  allowMemoryTest: '1',
  testEnv: '1',
  harnessRuntime: HARNESS_RUNTIME_VITEST
};

describe('resolveAgentNonceStoreMode (B16-B-R1/R2)', () => {
  it('unavailable → 503', () => {
    expect(resolveAgentNonceStoreMode({ nonceStore: 'unavailable' }).ok).toBe(false);
    expect(resolveAgentNonceStoreMode({}).ok).toBe(false);
  });

  it('persistent without backend → 503', () => {
    expect(resolveAgentNonceStoreMode({ nonceStore: 'persistent' }).ok).toBe(false);
  });

  it('persistent with sqlite path → ok', () => {
    const r = resolveAgentNonceStoreMode({
      nonceStore: 'persistent',
      nonceSqlitePath: '/tmp/sentinela-nonce-test.sqlite'
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe('persistent');
  });

  it('persistent with consume URL + token → ok', () => {
    const r = resolveAgentNonceStoreMode({
      nonceStore: 'persistent',
      nonceConsumeUrl: 'http://127.0.0.1/api/v1/agent-gateway/nonce/consume',
      internalToken: 'internal'
    });
    expect(r.ok).toBe(true);
  });

  for (const bad of ['redis', 'supabase', 'production', 'memory', 'test', 'typo-mode', '']) {
    it(`rejects unknown mode: ${bad || '(empty)'}`, () => {
      expect(resolveAgentNonceStoreMode({ nonceStore: bad }).ok).toBe(false);
    });
  }

  it('memory_test blocked without ALLOW + TEST_ENV', () => {
    expect(
      resolveAgentNonceStoreMode({
        nonceStore: 'memory_test',
        allowMemoryTest: '1',
        harnessRuntime: HARNESS_RUNTIME_VITEST
      }).ok
    ).toBe(false);
  });

  it('memory_test blocked with flags but production runtime', () => {
    expect(
      resolveAgentNonceStoreMode({
        ...memoryBase,
        nodeEnv: 'production'
      }).ok
    ).toBe(false);
  });

  it('memory_test blocked with flags on production lock', () => {
    expect(
      resolveAgentNonceStoreMode({
        ...memoryBase,
        productionLock: '1'
      }).ok
    ).toBe(false);
  });

  it('memory_test blocked without harness runtime profile', () => {
    expect(
      resolveAgentNonceStoreMode({
        nonceStore: 'memory_test',
        allowMemoryTest: '1',
        testEnv: '1'
      }).ok
    ).toBe(false);
  });

  it('memory_test allowed in vitest harness context', () => {
    const r = resolveAgentNonceStoreMode({
      ...memoryBase,
      vitest: 'true'
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mode).toBe('memory_test');
  });

  it('same ALLOW/TEST flags fail under simulated production', () => {
    expect(
      resolveAgentNonceStoreMode({
        ...memoryBase,
        vercelEnv: 'production'
      }).ok
    ).toBe(false);
  });
});
