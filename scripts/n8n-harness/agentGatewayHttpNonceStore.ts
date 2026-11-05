/**

 * B16-C / B16-D3 — consume nonce via internal API (n8n / edge parity).

 */



import { mapNonceConsumeHttpStatus } from '../../api/v1/_lib/agentGateway/nonceConsumeHttpOutcome';

import type { AgentNonceStore } from './agentGatewayV1';



const HDR_INTERNAL = 'x-sentinela-agent-gateway-internal-token';



export function createHttpAgentNonceStore(opts: {

  consumeUrl: string;

  internalToken: string;

  fetchImpl?: typeof fetch;

  /** Optional timeout ms; breach → unavailable (fail-closed). */

  timeoutMs?: number;

}): AgentNonceStore {

  const url = String(opts.consumeUrl || '').trim();

  const token = String(opts.internalToken || '').trim();

  const fetchFn = opts.fetchImpl ?? globalThis.fetch;

  const timeoutMs =

    typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : undefined;



  return {

    async consume(keyId, nonce, nowMs) {

      if (!url || !token || typeof fetchFn !== 'function') return 'unavailable';

      try {

        const controller = timeoutMs ? new AbortController() : undefined;

        const timer =

          controller &&

          setTimeout(() => {

            controller.abort();

          }, timeoutMs);



        const res = await fetchFn(url, {

          method: 'POST',

          headers: {

            [HDR_INTERNAL]: token,

            'Content-Type': 'application/json'

          },

          body: JSON.stringify({ key_id: keyId, nonce, consumed_ms: nowMs }),

          signal: controller?.signal

        });



        if (timer) clearTimeout(timer);

        return mapNonceConsumeHttpStatus(res.status);

      } catch {

        return 'unavailable';

      }

    }

  };

}
