import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  analyzeTenantKeysLine,
  applyPatchToFile,
  assertWorkflowGatewayWiring,
  DEFAULT_JS_PATH,
  DEFAULT_WF_PATH,
  patchAut2f001Workflow,
  patchTenantKeysInValidateJs,
  WEBHOOK_NODE_ID
} from './patch-aut-2f-001-agent-gateway.mjs';

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('patch-aut-2f-001-agent-gateway', () => {
  it('28 — merges webhook options preserving existing keys', () => {
    const wf = {
      nodes: [
        {
          id: WEBHOOK_NODE_ID,
          type: 'n8n-nodes-base.webhook',
          parameters: { options: { foo: 'bar' } }
        },
        { id: 'aut-2f-001-invalid', parameters: { jsCode: '' } },
        { id: 'aut-2f-001-validate', parameters: { jsCode: "const TENANT_KEYS = ['organization_id','organizationId','condominium_id','condominiumId','tenant_id','tenantId'];" } }
      ],
      connections: {
        'Manual Trigger': { main: [[{ node: 'Validate + Normalize' }]] },
        'Form Trigger': { main: [[{ node: 'Validate + Normalize' }]] }
      }
    };
    patchAut2f001Workflow(wf, '// gateway');
    const wh = wf.nodes.find((n) => n.id === WEBHOOK_NODE_ID);
    expect(wh.parameters.options).toEqual({ foo: 'bar', rawBody: true });
    assertWorkflowGatewayWiring(wf);
  });

  it('29 — throws when webhook missing', () => {
    expect(() => patchAut2f001Workflow({ nodes: [], connections: {} }, '')).toThrow(
      /Webhook node missing/
    );
  });

  it('30 — output JSON valid via round-trip file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aut2f-patch-'));
    const wfPath = path.join(dir, 'wf.json');
    const minimal = {
      nodes: [
        {
          id: WEBHOOK_NODE_ID,
          type: 'n8n-nodes-base.webhook',
          parameters: { options: { keep: 1 } }
        },
        { id: 'aut-2f-001-invalid', parameters: { jsCode: 'x' } },
        {
          id: 'aut-2f-001-validate',
          parameters: {
            jsCode:
              "const TENANT_KEYS = ['organization_id','organizationId','condominium_id','condominiumId','tenant_id','tenantId'];"
          }
        }
      ],
      connections: {}
    };
    fs.writeFileSync(wfPath, JSON.stringify(minimal));
    const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
    patchAut2f001Workflow(wf, '// js');
    const out = JSON.stringify(wf, null, 2);
    expect(() => JSON.parse(out)).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('D7 — TENANT_KEYS already normalized is idempotent', () => {
    const js =
      "const TENANT_KEYS = ['organization_id','organizationId','org_id','orgId','condominium_id','condominiumId','tenant_id','tenantId','_agentGatewayPassed'];";
    expect(analyzeTenantKeysLine(js).status).toBe('ok');
    const r = patchTenantKeysInValidateJs(js);
    expect(r.changed).toBe(false);
    expect(r.code).toBe(js);
  });

  it('D7 — divergent TENANT_KEYS rejected', () => {
    const js = "const TENANT_KEYS = ['agent-evil-key'];";
    expect(analyzeTenantKeysLine(js).status).toBe('divergent');
    expect(() => patchTenantKeysInValidateJs(js)).toThrow(/unexpected state/);
  });

  it('D7 — second patch on repo workflow copy keeps hash stable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aut2f-d7-'));
    const wfPath = path.join(dir, 'wf.json');
    fs.copyFileSync(DEFAULT_WF_PATH, wfPath);

    const r1 = applyPatchToFile(wfPath, DEFAULT_JS_PATH, path.join(dir, 'backup'));
    const h1 = sha256(fs.readFileSync(wfPath, 'utf8'));
    expect(r1.changed).toBe(false);

    const r2 = applyPatchToFile(wfPath, DEFAULT_JS_PATH);
    const h2 = sha256(fs.readFileSync(wfPath, 'utf8'));
    expect(r2.changed).toBe(false);
    expect(r2.messages.some((m) => m.includes('no changes'))).toBe(true);
    expect(h2).toBe(h1);

    const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
    assertWorkflowGatewayWiring(wf);
    expect(wf.nodes.find((n) => n.id === 'aut-2f-001-validate').parameters.jsCode).toContain(
      '_agentGatewayPassed'
    );
    expect(
      (wf.nodes.find((n) => n.id === 'aut-2f-001-agent-gateway').parameters.jsCode.match(/\n/g) ||
        []).length
    ).toBeGreaterThan(10);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('D7 — backup dir refuses overwrite', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aut2f-d7-bak-'));
    const wfPath = path.join(dir, 'wf.json');
    const legacy = {
      nodes: [
        {
          id: WEBHOOK_NODE_ID,
          type: 'n8n-nodes-base.webhook',
          parameters: { options: {} }
        },
        {
          id: 'aut-2f-001-validate',
          parameters: {
            jsCode:
              "const TENANT_KEYS = ['organization_id','organizationId','condominium_id','condominiumId','tenant_id','tenantId'];"
          }
        },
        { id: 'aut-2f-001-agent-gateway', parameters: { jsCode: '// old' } }
      ],
      connections: {}
    };
    fs.writeFileSync(wfPath, JSON.stringify(legacy));
    const backupDir = path.join(dir, 'b');
    const first = applyPatchToFile(wfPath, DEFAULT_JS_PATH, backupDir);
    expect(first.changed).toBe(true);
    const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
    wf.nodes.find((n) => n.id === 'aut-2f-001-agent-gateway').parameters.jsCode = '// tampered';
    fs.writeFileSync(wfPath, JSON.stringify(wf));
    expect(() => applyPatchToFile(wfPath, DEFAULT_JS_PATH, backupDir)).toThrow(/Backup already exists/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('D7 — validation failure leaves file unchanged', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aut2f-d7-fail-'));
    const wfPath = path.join(dir, 'wf.json');
    const bad = { nodes: [{ id: 'wrong', type: 'n8n-nodes-base.webhook', parameters: {} }], connections: {} };
    fs.writeFileSync(wfPath, JSON.stringify(bad));
    const before = fs.readFileSync(wfPath, 'utf8');
    expect(() => applyPatchToFile(wfPath, DEFAULT_JS_PATH)).toThrow(/Webhook node missing/);
    expect(fs.readFileSync(wfPath, 'utf8')).toBe(before);
    expect(fs.existsSync(wfPath + '.tmp')).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
