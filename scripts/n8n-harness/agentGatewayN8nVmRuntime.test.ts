/**
 * B16-B-R2 — executes n8n gateway helper functions in Node VM (not full n8n UI).
 * Validates fail-closed nonce/harness logic wired in agentGatewayValidate.n8n.js.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const n8nPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agentGatewayValidate.n8n.js');

function loadN8nHelpers() {
  const src = fs.readFileSync(n8nPath, 'utf8');
  const cut = src.indexOf('return (async () => {');
  if (cut < 0) throw new Error('n8n gateway script shape changed');
  const fnSrc = src
    .slice(0, cut)
    .replace(/const crypto = require\('crypto'\);\s*/g, '');
  const sandbox: Record<string, unknown> = {
    crypto,
    Buffer
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${fnSrc}
    globalThis.__resolveNonceMode = resolveNonceMode;
    globalThis.__resolveHarnessRuntime = resolveHarnessRuntime;
    globalThis.__extractRawBody = extractRawBody;
    globalThis.__consumePersistentNonceViaApi = consumePersistentNonceViaApi;
  `,
    sandbox
  );
  return sandbox as {
    __resolveNonceMode: (env: Record<string, string | undefined>) => { ok: boolean; mode?: string };
    __resolveHarnessRuntime: (env: Record<string, string | undefined>) => { ok: boolean };
    __extractRawBody: (item: Record<string, unknown>) => string;
    __consumePersistentNonceViaApi: (
      keyId: string,
      nonce: string,
      nowMs: number,
      env: Record<string, string | undefined>,
      httpRequest?: (opts: Record<string, unknown>) => Promise<{ statusCode: number }>
    ) => Promise<string>;
  };
}

describe('agentGatewayN8nVmRuntime', () => {
  const helpers = loadN8nHelpers();

  it('memory_test blocked without HARNESS_RUNTIME on n8n JS', () => {
    expect(
      helpers.__resolveNonceMode({
        nonceStore: 'memory_test',
        allowMemoryTest: '1',
        testEnv: '1'
      }).ok
    ).toBe(false);
  });

  it('memory_test blocked when NODE_ENV=production on n8n JS', () => {
    expect(
      helpers.__resolveNonceMode({
        nonceStore: 'memory_test',
        allowMemoryTest: '1',
        testEnv: '1',
        harnessRuntime: 'local_n8n',
        nodeEnv: 'production'
      }).ok
    ).toBe(false);
  });

  it('memory_test allowed with local_n8n harness profile', () => {
    expect(
      helpers.__resolveNonceMode({
        nonceStore: 'memory_test',
        allowMemoryTest: '1',
        testEnv: '1',
        harnessRuntime: 'local_n8n',
        nodeEnv: 'development'
      }).ok
    ).toBe(true);
  });

  it('extractRawBody prefers rawBody string in VM', () => {
    const raw = '{"a":1}';
    expect(helpers.__extractRawBody({ rawBody: raw, body: '{"b":2}' })).toBe(raw);
  });

  it('persistent blocked without consume URL on n8n JS', () => {
    expect(helpers.__resolveNonceMode({ nonceStore: 'persistent' }).ok).toBe(false);
  });

  it('persistent allowed with consume URL + token on n8n JS', () => {
    expect(
      helpers.__resolveNonceMode({
        nonceStore: 'persistent',
        nonceConsumeUrl: 'http://127.0.0.1/api/v1/agent-gateway/nonce/consume',
        internalToken: 'tok'
      }).ok
    ).toBe(true);
  });

  it('consumePersistentNonceViaApi maps 409 to replay', async () => {
    const outcome = await helpers.__consumePersistentNonceViaApi(
      'key-a',
      'nonce-parity-test-abcdef1',
      Date.now(),
      {
        nonceConsumeUrl: 'http://example/consume',
        internalToken: 'tok'
      },
      async () => ({ statusCode: 409 })
    );
    expect(outcome).toBe('replay');
  });

  it('consumePersistentNonceViaApi maps returnFullResponse 200 to ok', async () => {
    const outcome = await helpers.__consumePersistentNonceViaApi(
      'key-a',
      'nonce-parity-test-abcdef2',
      Date.now(),
      {
        nonceConsumeUrl: 'http://example/consume',
        internalToken: 'tok'
      },
      async () => ({ statusCode: 200, body: { success: true, consumed: true } })
    );
    expect(outcome).toBe('ok');
  });
});
