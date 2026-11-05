/**
 * Entrypoint único da API v1 para Serverless (Vercel).
 * Import estático — dynamic import no catch-all quebrava cold start (stage entry).
 */

import { runSafeApiHandler } from './safeApiHandler';

export default async function handler(req: unknown, res?: unknown) {
  return runSafeApiHandler(req, res, 'v1');
}
