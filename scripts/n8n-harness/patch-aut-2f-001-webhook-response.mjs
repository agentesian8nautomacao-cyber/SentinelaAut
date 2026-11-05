/**
 * B5 — Final Output safe refs + webhook HTTP status via respondToWebhook (clone/repo workflow JSON).
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchAut2f001Workflow, DEFAULT_JS_PATH } from './patch-aut-2f-001-agent-gateway.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WF_PATH = path.join(__dir, '../../n8n/workflows/AUT-2F-001-INTENT-ROUTER.json');
export const FINAL_OUTPUT_NODE_ID = 'aut-2f-001-out';
export const WEBHOOK_NODE_ID = 'aut-2f-001-webhook';
export const RESPOND_NODE_ID = 'aut-2f-001-respond-webhook';

export const FINAL_OUTPUT_JS = `function safeValidateNormalize(field) {
  try {
    const j = $('Validate + Normalize').item.json;
    if (j && j[field] != null && j[field] !== '') return j[field];
  } catch (_) {
    /* gateway reject path: Validate + Normalize not executed */
  }
  return null;
}
const result = $json && typeof $json === 'object' ? $json : {};
const httpStatus =
  typeof result.httpStatus === 'number'
    ? result.httpStatus
    : typeof result.user_safe?.httpStatus === 'number'
      ? result.user_safe.httpStatus
      : result.ok === false
        ? 400
        : 200;
const envelope = {
  aut: 'AUT-2F-001',
  workflow: 'SENTINELAAUT — AUT-2F-001 — Intent Router',
  intent: result.intent ?? safeValidateNormalize('intent') ?? safeValidateNormalize('router_intent'),
  dispatched_aut:
    result.dispatched_aut ?? safeValidateNormalize('aut') ?? safeValidateNormalize('dispatched_aut'),
  result,
  sql_access: 0,
  supabase_direct: 0,
  master_api: 0,
  financeiro: 0,
  payment_gateway: 0
};
return [{ json: Object.assign({}, envelope, { http_status: httpStatus }) }];`;

export function patchAut2f001FinalOutputOnly(workflow) {
  const finalNode = workflow.nodes.find((n) => n.id === FINAL_OUTPUT_NODE_ID);
  if (!finalNode) throw new Error('Final Output node missing');
  finalNode.parameters.jsCode = FINAL_OUTPUT_JS;
  return workflow;
}

export function patchAut2f001WebhookResponse(workflow) {
  const wf = workflow;
  const finalNode = wf.nodes.find((n) => n.id === FINAL_OUTPUT_NODE_ID);
  if (!finalNode) throw new Error('Final Output node missing');
  finalNode.parameters.jsCode = FINAL_OUTPUT_JS;

  const webhook = wf.nodes.find((n) => n.id === WEBHOOK_NODE_ID);
  if (!webhook) throw new Error('Webhook node missing');
  webhook.parameters.responseMode = 'responseNode';
  webhook.parameters.options = Object.assign({}, webhook.parameters.options || {}, { rawBody: true });

  let respond = wf.nodes.find((n) => n.id === RESPOND_NODE_ID);
  if (!respond) {
    respond = {
      parameters: {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify($json) }}',
        options: {
          responseCode: '={{ $json.http_status || 200 }}'
        }
      },
      id: RESPOND_NODE_ID,
      name: 'Respond Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [800, 1030]
    };
    wf.nodes.push(respond);
  } else {
    respond.parameters = {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify($json) }}',
      options: {
        responseCode: '={{ $json.http_status || 200 }}'
      }
    };
  }

  wf.connections['Final Output'] = {
    main: [[{ node: 'Respond Webhook', type: 'main', index: 0 }]]
  };
  return wf;
}

/** B5 — keep rawBody (lastNode) while still emitting HTTP status via Respond on webhook ingress only. */
export function patchAut2f001WebhookResponseLastNodeRawBody(workflow) {
  patchAut2f001WebhookResponse(workflow);
  const webhook = workflow.nodes.find((n) => n.id === WEBHOOK_NODE_ID);
  if (webhook) webhook.parameters.responseMode = 'lastNode';
  return workflow;
}

export function loadWorkflowJson(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new Error('empty workflow export');
    return { workflow: parsed[0], exportArray: true };
  }
  return { workflow: parsed, exportArray: false };
}

export function applyB5HardeningPatch(workflow) {
  const jsCode = fs.readFileSync(DEFAULT_JS_PATH, 'utf8');
  patchAut2f001Workflow(workflow, jsCode);
  patchAut2f001WebhookResponse(workflow);
  return workflow;
}

export function applyPatchToFile(wfPath = DEFAULT_WF_PATH) {
  const raw = fs.readFileSync(wfPath, 'utf8');
  const { workflow, exportArray } = loadWorkflowJson(raw);
  applyB5HardeningPatch(workflow);
  const out = exportArray ? [workflow] : workflow;
  fs.writeFileSync(wfPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return wfPath;
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] || DEFAULT_WF_PATH;
  applyPatchToFile(target);
  console.log('patched', target);
}
