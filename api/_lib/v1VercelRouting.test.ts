/**
 * Regressão: roteamento Vercel /api/v1 (rewrite + bootstrap estático).
 * Não substitui deploy real; valida contrato local.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { routeV1Request } from '../v1/_lib/router';
import v1Dispatch from '../v1-dispatch';
import v1Entry from './v1ApiEntry';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../..');

function readRepo(rel: string): string {
  return readFileSync(join(repoRoot, rel), 'utf8');
}

describe('vercel.json — rewrite /api/v1', () => {
  it('encaminha caminhos profundos do piloto para v1-dispatch', () => {
    const cfg = JSON.parse(readRepo('vercel.json')) as {
      rewrites: Array<{ source: string; destination: string }>;
    };
    const v1Rewrite = cfg.rewrites.find((r) => r.destination === '/api/v1-dispatch');
    expect(v1Rewrite).toBeDefined();
    expect(v1Rewrite!.source).toBe('/api/v1/:path*');

    const pilotPaths = [
      '/api/v1/health',
      '/api/v1/residents/identify',
      '/api/v1/operations/packages',
      '/api/v1/no/such/deep/route'
    ];
    for (const p of pilotPaths) {
      expect(p.startsWith('/api/v1/')).toBe(true);
    }
  });

  it('mantém SPA rewrite excluindo /api/', () => {
    const cfg = JSON.parse(readRepo('vercel.json')) as {
      rewrites: Array<{ source: string; destination: string }>;
    };
    const spa = cfg.rewrites.find((r) => r.destination === '/index.html');
    expect(spa?.source).toContain('(?!api/)');
  });
});

describe('bootstrap v1 — sem dynamic import no entry', () => {
  it('v1ApiEntry.ts usa import estático de safeApiHandler', () => {
    const src = readRepo('api/_lib/v1ApiEntry.ts');
    expect(src).toMatch(/import \{ runSafeApiHandler \} from '\.\/safeApiHandler'/);
    expect(src).not.toMatch(/await import\(/);
  });

  it('api/v1-dispatch.ts importa safeApiHandler diretamente (sem reexport-only)', () => {
    const src = readRepo('api/v1-dispatch.ts');
    expect(src).toMatch(/import \{ runSafeApiHandler \} from '\.\/_lib\/safeApiHandler'/);
    expect(src).not.toMatch(/export \{ default \} from '\.\/_lib\/v1ApiEntry'/);
    expect(src).not.toMatch(/await import\(/);
  });

  it('v1ApiEntry default export é invocável', () => {
    expect(typeof v1Entry).toBe('function');
  });
});

describe('router v1 — caminhos do piloto (sem 404 de rota inexistente)', () => {
  it('GET /api/v1/health → 200 JSON aplicacional', async () => {
    const res = await routeV1Request(new Request('http://localhost/api/v1/health', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean; data?: { service?: string } };
    expect(body.success).toBe(true);
    expect(body.data?.service).toBe('sentinela-api');
  });

  it('GET /api/v1/residents/identify sem HMAC → 401 (não NOT_FOUND de router)', async () => {
    const res = await routeV1Request(
      new Request('http://localhost/api/v1/residents/identify?unit=101', { method: 'GET' })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('UNAUTHENTICATED');
  });

  it('POST /api/v1/operations/packages sem auth → 401', async () => {
    const res = await routeV1Request(
      new Request('http://localhost/api/v1/operations/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: 'x' })
      })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('UNAUTHENTICATED');
  });

  it('rota v1 inexistente → 404 JSON do router (NOT_FOUND)', async () => {
    const res = await routeV1Request(
      new Request('http://localhost/api/v1/rota/inexistente/xyz', { method: 'GET' })
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success?: boolean; error?: { code?: string; path?: string } };
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
    expect(body.error?.path).toContain('/api/v1/rota/inexistente/xyz');
  });
});

describe('v1ApiEntry — integração Node (req, res) como Vercel', () => {
  it('GET health via entry → 200', async () => {
    const res = {
      statusCode: 0,
      body: '',
      setHeader() {},
      end(b?: string) {
        this.body = typeof b === 'string' ? b : '';
      }
    };
    await v1Entry(
      {
        method: 'GET',
        url: 'https://sentinelaaut.vercel.app/api/v1/health',
        headers: { host: 'sentinelaaut.vercel.app' }
      },
      res
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success?: boolean; data?: { service?: string } };
    expect(body.success).toBe(true);
    expect(body.data?.service).toBe('sentinela-api');
  });

  it('GET residents/identify via entry → 401 aplicacional', async () => {
    const res = {
      statusCode: 0,
      body: '',
      setHeader() {},
      end(b?: string) {
        this.body = typeof b === 'string' ? b : '';
      }
    };
    await v1Entry(
      {
        method: 'GET',
        url: 'https://sentinelaaut.vercel.app/api/v1/residents/identify?unit=01/002',
        headers: { host: 'sentinelaaut.vercel.app' }
      },
      res
    );
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { error?: { code?: string } };
    expect(body.error?.code).toBe('UNAUTHENTICATED');
  });
});

describe('v1-dispatch — integração Node (req, res) como Vercel', () => {
  it('GET health via v1-dispatch default export → 200', async () => {
    const res = {
      statusCode: 0,
      body: '',
      setHeader() {},
      end(b?: string) {
        this.body = typeof b === 'string' ? b : '';
      }
    };
    await v1Dispatch(
      {
        method: 'GET',
        url: '/api/v1/health',
        headers: { host: 'sentinelaaut.vercel.app' }
      },
      res
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { success?: boolean; data?: { service?: string } };
    expect(body.success).toBe(true);
    expect(body.data?.service).toBe('sentinela-api');
  });
});

describe('Master API — inalterada (smoke)', () => {
  it('session.ts continua sem imports relativos de _lib/router v1', async () => {
    const src = readRepo('api/master/session.ts');
    expect(src).not.toMatch(/await import\(/);
    expect(src).not.toMatch(/v1\/_lib\/router/);
  });

  it('GET /api/master/session sem Bearer → 401', async () => {
    const mod = await import('../master/session');
    const res = {
      statusCode: 0,
      body: '',
      setHeader() {},
      end(b?: string) {
        this.body = typeof b === 'string' ? b : '';
      }
    };
    await mod.default(
      { method: 'GET', url: '/api/master/session', headers: { host: 'localhost' } },
      res
    );
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { code?: string };
    expect(body.code).toBe('UNAUTHENTICATED');
  });
});
