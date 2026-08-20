import { getAuthErrorMessage } from '../authErrors';

describe('getAuthErrorMessage', () => {
  it('maps invalid credentials', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'))).toBe('Email or password is incorrect.');
  });

  it('maps unconfirmed email', () => {
    expect(getAuthErrorMessage(new Error('Email not confirmed'))).toBe(
      'Please confirm your email before signing in.'
    );
  });

  it('maps already-registered errors', () => {
    expect(getAuthErrorMessage(new Error('User already registered'))).toBe(
      'An account already exists with this email.'
    );
  });

  it('maps weak-password errors', () => {
    expect(getAuthErrorMessage(new Error('Password should be at least 6 characters'))).toBe(
      'Choose a stronger password.'
    );
  });

  it('maps network errors', () => {
    expect(getAuthErrorMessage(new Error('Network request failed'))).toBe(
      "We couldn't connect. Check your internet connection and try again."
    );
  });

  it('falls back to a sign-in-flavored generic message by default', () => {
    expect(getAuthErrorMessage(new Error('something odd'))).toBe(
      "We couldn't sign you in right now. Please try again."
    );
  });

  it('falls back to a sign-up-flavored generic message when context is sign-up', () => {
    expect(getAuthErrorMessage(new Error('something odd'), 'sign-up')).toBe(
      "We couldn't create your account right now. Please try again."
    );
  });

  it('handles non-Error values safely', () => {
    expect(getAuthErrorMessage('a plain string')).toBe("We couldn't sign you in right now. Please try again.");
  });
});
