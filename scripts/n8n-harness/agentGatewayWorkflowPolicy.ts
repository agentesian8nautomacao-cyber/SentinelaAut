/**
 * B16-B-R1 — routing policy helpers (workflow graph semantics).
 */

export function isAgentGatewayApproved(item: {
  _agentGatewayPassed?: boolean;
}): boolean {
  return item._agentGatewayPassed === true;
}

export function shouldReachDispatchSwitch(item: {
  skip_http?: boolean;
  _agentGatewayPassed?: boolean;
  _ingress?: string;
}): boolean {
  if (item.skip_http === true) return false;
  if (item._ingress === 'webhook' && !isAgentGatewayApproved(item)) return false;
  return true;
}
