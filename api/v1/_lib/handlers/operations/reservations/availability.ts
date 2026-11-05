export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../../../withCoreExecution';

export function createAvailabilityHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === 'GET') {
        return withCoreExecution(request, ['GET'], 'check_availability', deps);
      }
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'Only GET is supported for /operations/reservations/availability'
          }
        }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

export default createAvailabilityHandler();
