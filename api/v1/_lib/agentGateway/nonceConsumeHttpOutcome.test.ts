import { describe, expect, it } from 'vitest';
import { mapNonceConsumeHttpStatus } from './nonceConsumeHttpOutcome';

describe('mapNonceConsumeHttpStatus', () => {
  it.each([
    [200, 'ok'],
    [400, 'bad_request'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [409, 'replay'],
    [500, 'unavailable'],
    [503, 'unavailable'],
    [0, 'unavailable']
  ] as const)('HTTP %i → %s', (status, expected) => {
    expect(mapNonceConsumeHttpStatus(status)).toBe(expected);
  });
});
