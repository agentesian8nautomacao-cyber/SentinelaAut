/**
 * B16-D7 — full parity: workflow gateway jsCode vs agentGatewayValidate.n8n.js
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GATEWAY_NODE_ID, normalizeLineEndings } from './patch-aut-2f-001-agent-gateway.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const wfPath = join(__dir, '../../n8n/workflows/AUT-2F-001-INTENT-ROUTER.json');
const harnessPath = join(__dir, 'agentGatewayValidate.n8n.js');

describe('AUT-2F-001 gateway jsCode parity (B16-D7)', () => {
  it('JSON valid, single gateway node, full normalized content match', () => {
    const wfRaw = readFileSync(wfPath, 'utf8');
    const wf = JSON.parse(wfRaw) as {
      nodes: Array<{ id: string; parameters?: { jsCode?: string } }>;
    };

    const gateways = wf.nodes.filter((n) => n.id === GATEWAY_NODE_ID);
    expect(gateways).toHaveLength(1);

    const embedded = gateways[0].parameters?.jsCode ?? '';
    expect(embedded.trim().length).toBeGreaterThan(0);

    const harness = readFileSync(harnessPath, 'utf8');
    const normEmbedded = normalizeLineEndings(embedded);
    const normHarness = normalizeLineEndings(harness);

    if (normEmbedded !== normHarness) {
      const lenE = normEmbedded.length;
      const lenH = normHarness.length;
      let firstDiff = -1;
      const max = Math.max(lenE, lenH);
      for (let i = 0; i < max; i++) {
        if (normEmbedded[i] !== normHarness[i]) {
          firstDiff = i;
          break;
        }
      }
      const snippet = (s: string) =>
        JSON.stringify(s.slice(Math.max(0, firstDiff - 40), firstDiff + 40));
      expect.fail(
        `Gateway jsCode diverges from harness at index ${firstDiff} (embedded len=${lenE}, harness len=${lenH}). Context embedded=${snippet(normEmbedded)} harness=${snippet(normHarness)}`
      );
    }

    expect(normEmbedded).toBe(normHarness);
  });

  it('implements persistent consume and D3 status mapping (structural)', () => {
    const wf = JSON.parse(readFileSync(wfPath, 'utf8')) as {
      nodes: Array<{ id: string; parameters?: { jsCode?: string } }>;
    };
    const code = wf.nodes.find((n) => n.id === GATEWAY_NODE_ID)?.parameters?.jsCode ?? '';
    expect(code).toContain("mode === 'persistent'");
    expect(code).toContain('consumePersistentNonceViaApi');
    expect(code).toContain('mapNonceConsumeHttpStatus');
    expect(code).toContain('AGENT_GATEWAY_FORBIDDEN');
  });
});
