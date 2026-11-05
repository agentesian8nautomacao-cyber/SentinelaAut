/**

 * B16-B-R1 / B16-B-R2 — raw HTTP body extraction for Agent Gateway (n8n webhook item shape).

 */



import {

  AGENT_UNTRUSTED_IDENTITY_KEYS,

  stripUntrustedIdentityFields

} from './agentGatewayTenantPolicy';



export type N8nWebhookItem = {

  rawBody?: unknown;

  body?: unknown;

  binary?: {

    data?: {

      data?: string;

    };

  };

};



export { AGENT_UNTRUSTED_IDENTITY_KEYS as AGENT_FORGED_BODY_KEYS };



export function extractAgentGatewayRawBody(item: N8nWebhookItem): string {

  if (typeof item.rawBody === 'string') return item.rawBody;

  if (typeof item.body === 'string') return item.body;

  if (item.binary?.data?.data) {

    return Buffer.from(item.binary.data.data, 'base64').toString('utf8');

  }

  return '';

}



export function stripAgentUntrustedBodyFields(body: Record<string, unknown>): void {

  stripUntrustedIdentityFields(body);

}
