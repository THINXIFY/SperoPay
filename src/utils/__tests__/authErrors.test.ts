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
      "We couldn't connect right now. Check your internet connection and try again."
    );
  });

  it('maps rate-limit errors', () => {
    expect(getAuthErrorMessage(new Error('Email rate limit exceeded'))).toBe(
      "You've tried a few too many times. Wait a moment and try again."
    );
  });

  it('maps the resend cooldown message Supabase returns', () => {
    expect(getAuthErrorMessage(new Error('For security purposes, you can only request this after 34 seconds.'))).toBe(
      "You've tried a few too many times. Wait a moment and try again."
    );
  });

  it('maps user-not-found the same as invalid credentials, without revealing account existence', () => {
    expect(getAuthErrorMessage(new Error('User not found'))).toBe('Email or password is incorrect.');
  });

  it('maps PKCE/deep-link code-exchange failures by error name', () => {
    const error = new Error('No code detected.');
    error.name = 'AuthPKCEGrantCodeExchangeError';
    expect(getAuthErrorMessage(error)).toBe(
      'This link is no longer valid. Request a new one and open it on this device.'
    );
  });

  it('maps a missing PKCE code verifier (wrong-device link) by error name', () => {
    const error = new Error('PKCE code verifier not found in storage.');
    error.name = 'AuthPKCECodeVerifierMissingError';
    expect(getAuthErrorMessage(error)).toBe(
      'This link is no longer valid. Request a new one and open it on this device.'
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

  it('falls back to a reset-password-flavored generic message when context is reset-password', () => {
    expect(getAuthErrorMessage(new Error('something odd'), 'reset-password')).toBe(
      "We couldn't send that reset link right now. Please try again."
    );
  });

  it('falls back to an update-password-flavored generic message when context is update-password', () => {
    expect(getAuthErrorMessage(new Error('something odd'), 'update-password')).toBe(
      "We couldn't update your password right now. Please try again."
    );
  });

  it('handles non-Error values safely', () => {
    expect(getAuthErrorMessage('a plain string')).toBe("We couldn't sign you in right now. Please try again.");
  });
});
