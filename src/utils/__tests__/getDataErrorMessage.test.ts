import { getDataErrorMessage } from '../getDataErrorMessage';

describe('getDataErrorMessage', () => {
  it('maps a generic failure to a calm, context-flavored message', () => {
    expect(getDataErrorMessage(new Error('relation "x" does not exist'), 'customers')).toBe(
      "We couldn't load your customers. Try again."
    );
  });

  it('maps save failures with save-flavored copy', () => {
    expect(getDataErrorMessage(new Error('constraint violation'), 'requests', 'save')).toBe(
      "We couldn't save this request. Try again."
    );
  });

  it('maps network errors distinctly regardless of context', () => {
    expect(getDataErrorMessage(new Error('Network request failed'), 'wallet')).toBe(
      "We couldn't connect right now. Check your internet connection and try again."
    );
  });

  it('never leaks the raw error message', () => {
    const message = getDataErrorMessage(
      new Error('duplicate key value violates unique constraint "payment_requests_payment_code_key"'),
      'requests'
    );
    expect(message).not.toContain('constraint');
    expect(message).not.toContain('payment_code');
  });

  it('handles non-Error values safely', () => {
    expect(getDataErrorMessage('a plain string', 'templates')).toBe("We couldn't load your templates. Try again.");
  });
});
