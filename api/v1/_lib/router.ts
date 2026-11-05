/**
 * Vercel Hobby — single serverless entry for all /api/v1/* routes.
 * Handlers live under _lib/handlers/ (not counted as separate Functions).
 */

type RouteHandler = { fetch: (request: Request) => Promise<Response> };

function normalizePathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p.startsWith('/api/v1') ? p.slice('/api/v1'.length) || '/' : p;
}

const ROUTES: Record<string, () => Promise<{ default: RouteHandler }>> = {
  '/health': () => import('./handlers/health'),
  '/events': () => import('./handlers/events'),
  '/boletos': () => import('./handlers/boletos'),
  '/authz-probe': () => import('./handlers/authz-probe'),
  '/confirmation-probe': () => import('./handlers/confirmation-probe'),
  '/protected-probe': () => import('./handlers/protected-probe'),
  '/residents/identify': () => import('./handlers/residents/identify'),
  '/units/identify': () => import('./handlers/units/identify'),
  '/operations/occurrences': () => import('./handlers/operations/occurrences/index'),
  '/operations/occurrences/update': () => import('./handlers/operations/occurrences/update'),
  '/operations/packages': () => import('./handlers/operations/packages/index'),
  '/operations/packages/pickup': () => import('./handlers/operations/packages/pickup'),
  '/operations/reservations': () => import('./handlers/operations/reservations/index'),
  '/operations/reservations/cancel': () => import('./handlers/operations/reservations/cancel'),
  '/operations/reservations/availability': () =>
    import('./handlers/operations/reservations/availability'),
  '/operations/areas': () => import('./handlers/operations/areas/index'),
  '/agent-gateway/nonce/consume': () => import('./handlers/agent-gateway/nonce-consume')
};

export async function routeV1Request(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const subpath = normalizePathname(url.pathname);
  const loader = ROUTES[subpath];

  if (!loader) {
    return Response.json(
      {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found', path: `/api/v1${subpath}` }
      },
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const mod = await loader();
  return mod.default.fetch(request);
}
