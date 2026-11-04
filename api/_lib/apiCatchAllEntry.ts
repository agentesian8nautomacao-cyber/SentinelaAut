/**
 * Catch-all /api/* (legacy + auto). Import estático para bundler Vercel.
 */

import { runSafeApiHandler } from './safeApiHandler';

export default async function handler(req: unknown, res?: unknown) {
  return runSafeApiHandler(req, res, 'auto');
}
