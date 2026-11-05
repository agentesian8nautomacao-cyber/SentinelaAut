/**

 * Patch AUT-2F-001 — Agent Gateway (B16-B / B16-B-R1 / B16-D7 idempotent).

 * Exportable for unit tests; run directly to apply to repo workflow.

 */

import fs from 'node:fs';

import path from 'node:path';

import { fileURLToPath } from 'node:url';



const __dir = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_WF_PATH = path.join(__dir, '../../n8n/workflows/AUT-2F-001-INTENT-ROUTER.json');

export const DEFAULT_JS_PATH = path.join(__dir, 'agentGatewayValidate.n8n.js');

export const WEBHOOK_NODE_ID = 'aut-2f-001-webhook';

export const GATEWAY_NODE_ID = 'aut-2f-001-agent-gateway';

export const APPROVED_IF_ID = 'aut-2f-001-agent-approved';



export const TENANT_KEYS_NORMALIZE =

  "['organization_id','organizationId','org_id','orgId','condominium_id','condominiumId','tenant_id','tenantId','_agentGatewayPassed']";



/** @type {readonly string[]} */

export const TENANT_KEYS_REQUIRED = [

  'organization_id',

  'organizationId',

  'org_id',

  'orgId',

  'condominium_id',

  'condominiumId',

  'tenant_id',

  'tenantId',

  '_agentGatewayPassed'

];



const INVALID_OUTPUT_JS =

  "const status = $json.httpStatus || 400;\nconst code = $json.error_code || 'WORKFLOW_INVALID_INPUT';\nreturn [{ json: {\n  aut: 'AUT-2F-001', ok: false, httpStatus: status, error_code: code,\n  request_id: $json.requestId || null, correlation_id: $json.correlationId || null, retry_action: 'no_retry',\n  retry_attempts: 0, dispatched_aut: null,\n  user_safe: { success: false, httpStatus: status, error_code: code },\n  sql_access: 0, financeiro: 0, master_api: 0\n}}];";



const TENANT_KEYS_LINE_RE = /const TENANT_KEYS = \[[^\]]*\];/;



export function normalizeLineEndings(text) {

  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

}



/**

 * @returns {{ status: 'ok' | 'missing' | 'upgradable' | 'partial' | 'divergent' | 'duplicate'; keys?: string[] }}

 */

export function analyzeTenantKeysLine(jsCode) {

  const m = String(jsCode || '').match(TENANT_KEYS_LINE_RE);

  if (!m) return { status: 'missing' };

  const inner = m[0];

  const keys = [...inner.matchAll(/'([^']+)'/g)].map((x) => x[1]);

  if (keys.length !== new Set(keys).size) return { status: 'duplicate', keys };



  const required = TENANT_KEYS_REQUIRED;

  const hasAll = required.every((k) => keys.includes(k));

  const onlyExpected = keys.every((k) => required.includes(k));



  if (hasAll && onlyExpected && keys.length === required.length) {

    return { status: 'ok', keys };

  }



  const legacyWithoutGateway = [

    'organization_id',

    'organizationId',

    'condominium_id',

    'condominiumId',

    'tenant_id',

    'tenantId'

  ];

  const isLegacy =

    keys.length === legacyWithoutGateway.length &&

    legacyWithoutGateway.every((k) => keys.includes(k)) &&

    keys.every((k) => legacyWithoutGateway.includes(k));



  if (isLegacy) return { status: 'upgradable', keys };



  if (!onlyExpected) return { status: 'divergent', keys };

  return { status: 'partial', keys };

}



/**

 * @param {string} jsCode

 * @returns {{ code: string; changed: boolean }}

 */

export function patchTenantKeysInValidateJs(jsCode) {

  const analysis = analyzeTenantKeysLine(jsCode);

  if (analysis.status === 'ok') {

    return { code: jsCode, changed: false };

  }

  if (analysis.status === 'upgradable') {

    const next = jsCode.replace(TENANT_KEYS_LINE_RE, `const TENANT_KEYS = ${TENANT_KEYS_NORMALIZE};`);

    if (next === jsCode) {

      throw new Error('Validate + Normalize TENANT_KEYS upgrade failed');

    }

    const verify = analyzeTenantKeysLine(next);

    if (verify.status !== 'ok') {

      throw new Error('Validate + Normalize TENANT_KEYS post-upgrade invalid');

    }

    return { code: next, changed: true };

  }

  if (analysis.status === 'missing') {

    throw new Error('Validate + Normalize TENANT_KEYS patch failed — pattern not found');

  }

  throw new Error(

    `Validate + Normalize TENANT_KEYS in unexpected state: ${analysis.status}`

  );

}



function deepEqual(a, b) {

  return JSON.stringify(a) === JSON.stringify(b);

}



/**

 * @param {object} wf

 * @param {string} jsCode

 * @returns {{ changed: boolean; messages: string[] }}

 */

export function patchAut2f001Workflow(wf, jsCode) {

  const messages = [];

  let changed = false;



  const webhook = wf.nodes.find((n) => n.id === WEBHOOK_NODE_ID);

  if (!webhook) {

    throw new Error(`Webhook node missing: ${WEBHOOK_NODE_ID}`);

  }

  if (webhook.type !== 'n8n-nodes-base.webhook') {

    throw new Error(`Unexpected node type for webhook: ${webhook.type}`);

  }



  const prevOptions = webhook.parameters.options ?? {};

  const nextOptions = { ...prevOptions, rawBody: true };

  if (!deepEqual(prevOptions, nextOptions)) {

    webhook.parameters.options = nextOptions;

    changed = true;

    messages.push('webhook.rawBody enabled');

  } else if (webhook.parameters.options.rawBody !== true) {

    throw new Error('Failed to set rawBody: true on webhook');

  }



  const invalid = wf.nodes.find((n) => n.id === 'aut-2f-001-invalid');

  if (invalid) {

    if (invalid.parameters.jsCode !== INVALID_OUTPUT_JS) {

      invalid.parameters.jsCode = INVALID_OUTPUT_JS;

      changed = true;

      messages.push('invalid-output jsCode updated');

    }

  }



  const validateNode = wf.nodes.find((n) => n.id === 'aut-2f-001-validate');

  if (validateNode?.parameters?.jsCode) {

    const tk = patchTenantKeysInValidateJs(validateNode.parameters.jsCode);

    if (tk.changed) {

      validateNode.parameters.jsCode = tk.code;

      changed = true;

      messages.push('TENANT_KEYS normalized');

    } else {

      messages.push('TENANT_KEYS already normalized');

    }

  }



  const harnessNorm = normalizeLineEndings(jsCode);

  let gateway = wf.nodes.find((n) => n.id === GATEWAY_NODE_ID);

  if (!gateway) {

    wf.nodes.push({

      parameters: { jsCode },

      id: GATEWAY_NODE_ID,

      name: 'Validate Agent Gateway',

      type: 'n8n-nodes-base.code',

      typeVersion: 2,

      notes: 'B16-B agent-v1 HMAC. B16-B-R1 strict nonce modes. No secrets in output.',

      position: [600, 180]

    });

    changed = true;

    messages.push('gateway node created');

    gateway = wf.nodes.find((n) => n.id === GATEWAY_NODE_ID);

  } else {

    const current = normalizeLineEndings(gateway.parameters.jsCode || '');

    if (current !== harnessNorm) {

      gateway.parameters.jsCode = jsCode;

      changed = true;

      messages.push('gateway jsCode synced from harness');

    } else {

      messages.push('gateway jsCode already in parity with harness');

    }

  }



  let approvedIf = wf.nodes.find((n) => n.id === APPROVED_IF_ID);

  if (!approvedIf) {

    approvedIf = {

      parameters: {

        conditions: {

          boolean: [

            {

              value1: '={{ $json._agentGatewayPassed === true }}',

              value2: true

            }

          ]

        }

      },

      id: APPROVED_IF_ID,

      name: 'Agent Gateway Approved?',

      type: 'n8n-nodes-base.if',

      typeVersion: 1,

      position: [700, 180]

    };

    wf.nodes.push(approvedIf);

    changed = true;

    messages.push('Agent Gateway Approved? IF created');

  }



  const wiring = {

    webhook: {

      main: [[{ node: 'Validate Agent Gateway', type: 'main', index: 0 }]]

    },

    gateway: {

      main: [[{ node: 'Agent Gateway Approved?', type: 'main', index: 0 }]]

    },

    approved: {

      main: [

        [{ node: 'Validate + Normalize', type: 'main', index: 0 }],

        [{ node: 'Invalid Input Output', type: 'main', index: 0 }]

      ]

    }

  };



  if (!deepEqual(wf.connections['Webhook Trigger'], wiring.webhook)) {

    wf.connections['Webhook Trigger'] = wiring.webhook;

    changed = true;

    messages.push('Webhook Trigger wiring set');

  }

  if (!deepEqual(wf.connections['Validate Agent Gateway'], wiring.gateway)) {

    wf.connections['Validate Agent Gateway'] = wiring.gateway;

    changed = true;

    messages.push('Validate Agent Gateway wiring set');

  }

  if (!deepEqual(wf.connections['Agent Gateway Approved?'], wiring.approved)) {

    wf.connections['Agent Gateway Approved?'] = wiring.approved;

    changed = true;

    messages.push('Agent Gateway Approved? wiring set');

  }



  const manualTarget = wf.connections['Manual Trigger']?.main?.[0]?.[0]?.node;

  if (!manualTarget?.includes('Validate + Normalize')) {

    wf.connections['Manual Trigger'] = {

      main: [[{ node: 'Validate + Normalize', type: 'main', index: 0 }]]

    };

    changed = true;

    messages.push('Manual Trigger wiring set');

  }

  const formTarget = wf.connections['Form Trigger']?.main?.[0]?.[0]?.node;

  if (!formTarget?.includes('Validate + Normalize')) {

    wf.connections['Form Trigger'] = {

      main: [[{ node: 'Validate + Normalize', type: 'main', index: 0 }]]

    };

    changed = true;

    messages.push('Form Trigger wiring set');

  }



  if (!changed) {

    messages.push('no changes necessary');

  }



  return { changed, messages };

}



export function assertWorkflowGatewayWiring(wf) {

  const wh = wf.nodes.find((n) => n.id === WEBHOOK_NODE_ID);

  if (!wh?.parameters?.options?.rawBody) throw new Error('webhook rawBody missing');

  const chain = wf.connections['Webhook Trigger']?.main?.[0]?.map((x) => x.node) || [];

  if (chain[0] !== 'Validate Agent Gateway') throw new Error('webhook chain broken');

  const afterGw = wf.connections['Validate Agent Gateway']?.main?.[0]?.[0]?.node;

  if (afterGw !== 'Agent Gateway Approved?') throw new Error('gateway must feed IF');

  const ifTrue = wf.connections['Agent Gateway Approved?']?.main?.[0]?.[0]?.node;

  const ifFalse = wf.connections['Agent Gateway Approved?']?.main?.[1]?.[0]?.node;

  if (ifTrue !== 'Validate + Normalize' || ifFalse !== 'Invalid Input Output') {

    throw new Error('Agent Gateway Approved? branches incorrect');

  }

}



/**

 * @param {string} wfPath

 * @param {string} jsPath

 * @param {string} [backupDir]

 * @returns {{ wfPath: string; changed: boolean; messages: string[] }}

 */

export function applyPatchToFile(wfPath, jsPath, backupDir) {

  const raw = fs.readFileSync(wfPath, 'utf8');

  const wf = JSON.parse(raw);

  const jsCode = fs.readFileSync(jsPath, 'utf8');

  const { changed, messages } = patchAut2f001Workflow(wf, jsCode);

  assertWorkflowGatewayWiring(wf);

  const out = JSON.stringify(wf, null, 2) + '\n';

  JSON.parse(out);



  if (!changed) {

    return { wfPath, changed: false, messages };

  }



  if (backupDir) {

    fs.mkdirSync(backupDir, { recursive: true });

    const base = path.basename(wfPath);

    const dest = path.join(backupDir, base);

    if (fs.existsSync(dest)) {

      throw new Error(`Backup already exists (refusing overwrite): ${dest}`);

    }

    fs.copyFileSync(wfPath, dest);

  }



  const tmp = wfPath + '.tmp';

  try {

    fs.writeFileSync(tmp, out, 'utf8');

    fs.renameSync(tmp, wfPath);

  } catch (err) {

    try {

      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);

    } catch {

      /* ignore */

    }

    throw err;

  }



  return { wfPath, changed: true, messages };

}



const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {

  const result = applyPatchToFile(DEFAULT_WF_PATH, DEFAULT_JS_PATH);

  if (result.changed) {

    console.log('Patched', result.wfPath, result.messages.join('; '));

  } else {

    console.log('No changes needed', result.wfPath, result.messages.join('; '));

  }

}
