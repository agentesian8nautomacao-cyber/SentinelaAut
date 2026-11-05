/**
 * B16-B / B16-B-R1 — AUT-2F-001 wiring checks (static JSON).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dir = dirname(fileURLToPath(import.meta.url));
const wfPath = join(__dir, '../../n8n/workflows/AUT-2F-001-INTENT-ROUTER.json');

describe('AUT-2F-001 agent gateway wiring', () => {
  const wf = JSON.parse(readFileSync(wfPath, 'utf8')) as {
    nodes: Array<{ id: string; name: string; parameters?: { options?: { rawBody?: boolean } } }>;
    connections: Record<string, { main: Array<Array<{ node: string }>> }>;
  };

  it('webhook uses rawBody and routes Gateway → Agent Gateway Approved? → Normalize', () => {
    const webhook = wf.nodes.find((n) => n.id === 'aut-2f-001-webhook');
    expect(webhook?.parameters?.options?.rawBody).toBe(true);
    const chain = wf.connections['Webhook Trigger']?.main?.[0]?.map((x) => x.node) || [];
    expect(chain[0]).toBe('Validate Agent Gateway');
    expect(wf.connections['Validate Agent Gateway']?.main?.[0]?.[0]?.node).toBe(
      'Agent Gateway Approved?'
    );
    expect(wf.connections['Agent Gateway Approved?']?.main?.[0]?.[0]?.node).toBe(
      'Validate + Normalize'
    );
    expect(wf.connections['Agent Gateway Approved?']?.main?.[1]?.[0]?.node).toBe(
      'Invalid Input Output'
    );
  });

  it('Agent Gateway Approved? requires _agentGatewayPassed === true', () => {
    const ifNode = wf.nodes.find((n) => n.id === 'aut-2f-001-agent-approved');
    expect(ifNode?.name).toBe('Agent Gateway Approved?');
    const cond = ifNode?.parameters as {
      conditions?: { boolean?: Array<{ value1?: string }> };
    };
    expect(cond?.conditions?.boolean?.[0]?.value1).toContain('_agentGatewayPassed');
  });

  it('manual and form still bypass gateway', () => {
    expect(wf.connections['Manual Trigger']?.main?.[0]?.[0]?.node).toBe('Validate + Normalize');
    expect(wf.connections['Form Trigger']?.main?.[0]?.[0]?.node).toBe('Validate + Normalize');
  });

  it('gateway node exists', () => {
    expect(wf.nodes.some((n) => n.id === 'aut-2f-001-agent-gateway')).toBe(true);
  });
});
