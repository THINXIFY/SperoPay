import { canPayRequest } from '../canPayRequest';

describe('canPayRequest', () => {
  it('allows payment when pending', () => {
    expect(canPayRequest('pending')).toBe(true);
  });

  it.each(['confirming', 'paid', 'expired', 'cancelled'] as const)('disallows payment when %s', (status) => {
    expect(canPayRequest(status)).toBe(false);
  });
});
