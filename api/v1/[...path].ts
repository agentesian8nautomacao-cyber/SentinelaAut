/**

 * Fallback /api/v1/:segmento (1 nível). Rotas profundas usam rewrite → api/v1-dispatch.ts.

 */

import { runSafeApiHandler } from '../_lib/safeApiHandler';



export default async function handler(req: unknown, res?: unknown) {

  return runSafeApiHandler(req, res, 'v1');

}

