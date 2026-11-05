import { describe, expect, it } from 'vitest';
import {
  HARNESS_RUNTIME_LOCAL_N8N,
  HARNESS_RUNTIME_VITEST,
  isProductionRuntime,
  resolveHarnessRuntimeProfile
} from './agentGatewayHarnessRuntime';

describe('agentGatewayHarnessRuntime (B16-B-R2)', () => {
  it('blocks production NODE_ENV', () => {
    expect(isProductionRuntime({ nodeEnv: 'production' })).toBe(true);
    expect(
      resolveHarnessRuntimeProfile({
        nodeEnv: 'production',
        harnessRuntime: HARNESS_RUNTIME_VITEST
      }).ok
    ).toBe(false);
  });

  it('blocks VERCEL_ENV=production', () => {
    expect(
      resolveHarnessRuntimeProfile({
        vercelEnv: 'production',
        harnessRuntime: HARNESS_RUNTIME_LOCAL_N8N
      }).ok
    ).toBe(false);
  });

  it('blocks explicit production lock', () => {
    expect(
      resolveHarnessRuntimeProfile({
        productionLock: '1',
        harnessRuntime: HARNESS_RUNTIME_VITEST
      }).ok
    ).toBe(false);
  });

  it('allows vitest via VITEST=true without HARNESS_RUNTIME', () => {
    expect(resolveHarnessRuntimeProfile({ vitest: 'true' }).ok).toBe(true);
  });

  it('requires HARNESS_RUNTIME when not in vitest process', () => {
    expect(resolveHarnessRuntimeProfile({}).ok).toBe(false);
    expect(
      resolveHarnessRuntimeProfile({ harnessRuntime: HARNESS_RUNTIME_LOCAL_N8N }).ok
    ).toBe(true);
  });

  it('rejects invalid harness runtime profile', () => {
    expect(resolveHarnessRuntimeProfile({ harnessRuntime: 'production' }).ok).toBe(false);
  });
});
