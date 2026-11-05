import { describe, expect, it } from 'vitest';
import {
  isAgentGatewayApproved,
  shouldReachDispatchSwitch
} from './agentGatewayWorkflowPolicy';
import { agentGatewayFailureToRouterItem } from './agentGatewayV1';
import { AGENT_PUBLIC_AUTH_FAILED, AGENT_PUBLIC_UNAVAILABLE } from './agentGatewayV1';

describe('agentGatewayWorkflowPolicy', () => {
  it('17 — webhook without _agentGatewayPassed blocked', () => {
    expect(isAgentGatewayApproved({})).toBe(false);
    expect(shouldReachDispatchSwitch({ _ingress: 'webhook' })).toBe(false);
  });

  it('18 — approved webhook reaches dispatch path', () => {
    expect(isAgentGatewayApproved({ _agentGatewayPassed: true })).toBe(true);
    expect(
      shouldReachDispatchSwitch({ _agentGatewayPassed: true, _ingress: 'webhook' })
    ).toBe(true);
  });

  it('19–20 — auth failure skip_http blocks dispatch', () => {
    const f401 = agentGatewayFailureToRouterItem({
      ok: false,
      httpStatus: 401,
      internal_code: 'x',
      public_code: AGENT_PUBLIC_AUTH_FAILED
    });
    const f503 = agentGatewayFailureToRouterItem({
      ok: false,
      httpStatus: 503,
      internal_code: 'y',
      public_code: AGENT_PUBLIC_UNAVAILABLE
    });
    expect(shouldReachDispatchSwitch(f401)).toBe(false);
    expect(shouldReachDispatchSwitch(f503)).toBe(false);
    expect(f401.httpStatus).toBe(401);
    expect(f503.httpStatus).toBe(503);
  });

  it('21–22 — manual/form without webhook ingress', () => {
    expect(shouldReachDispatchSwitch({ skip_http: false })).toBe(true);
  });
});
