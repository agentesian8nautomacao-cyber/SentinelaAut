/**

 * Destino do rewrite vercel.json para /api/v1/:path*

 * Preserva URL original; delega ao router v1 via safeApiHandler.

 * Import direto no entry (reexport-only omitia api/_lib no artefato Vercel).

 */

import { runSafeApiHandler } from './_lib/safeApiHandler';



export default async function handler(req: unknown, res?: unknown) {

  return runSafeApiHandler(req, res, 'v1');

}

