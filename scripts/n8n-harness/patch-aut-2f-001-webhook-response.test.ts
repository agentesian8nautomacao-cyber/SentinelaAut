import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FINAL_OUTPUT_NODE_ID,
  FINAL_OUTPUT_JS,
  patchAut2f001WebhookResponse,
  RESPOND_NODE_ID,
  WEBHOOK_NODE_ID
} from './patch-aut-2f-001-webhook-response.mjs';

describe('patch-aut-2f-001-webhook-response (B5)', () => {
  it('Final Output does not throw when Validate + Normalize absent', () => {
    expect(FINAL_OUTPUT_JS).not.toContain("$('Validate + Normalize').item.json.intent");
    expect(FINAL_OUTPUT_JS).toContain('safeValidateNormalize');
  });

  it('adds respond webhook and responseNode on webhook trigger', () => {
    const wf = {
      nodes: [
        { id: WEBHOOK_NODE_ID, type: 'n8n-nodes-base.webhook', parameters: { options: { rawBody: true } } },
        { id: FINAL_OUTPUT_NODE_ID, type: 'n8n-nodes-base.code', parameters: { jsCode: 'old' } }
      ],
      connections: { 'Final Output': { main: [[]] } }
    };
    patchAut2f001WebhookResponse(wf);
    const wh = wf.nodes.find((n) => n.id === WEBHOOK_NODE_ID);
    expect(wh?.parameters.responseMode).toBe('responseNode');
    expect(wf.nodes.some((n) => n.id === RESPOND_NODE_ID)).toBe(true);
    expect(wf.connections['Final Output'].main[0][0].node).toBe('Respond Webhook');
  });
});
