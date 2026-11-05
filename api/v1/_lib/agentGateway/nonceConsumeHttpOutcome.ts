/**
 * B16-D3 — Map API nonce/consume HTTP status → gateway store outcome (shared contract).
 */

export type NonceConsumeHttpOutcome =
  | 'ok'
  | 'replay'
  | 'unauthorized'
  | 'forbidden'
  | 'bad_request'
  | 'unavailable';

/** Classify HTTP status from POST /agent-gateway/nonce/consume. */
export function mapNonceConsumeHttpStatus(status: number): NonceConsumeHttpOutcome {
  if (status === 200) return 'ok';
  if (status === 409) return 'replay';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400) return 'bad_request';
  return 'unavailable';
}
