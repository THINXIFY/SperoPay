import { getPasswordStrength } from '../passwordStrength';

describe('getPasswordStrength', () => {
  it('treats anything under 8 characters as weak, regardless of variety', () => {
    expect(getPasswordStrength('Aa1!')).toBe('weak');
  });

  it('treats 8+ chars with low variety as weak', () => {
    expect(getPasswordStrength('lowercaseonly')).toBe('weak');
  });

  it('treats 8+ chars with two character classes as good', () => {
    expect(getPasswordStrength('password1')).toBe('good');
  });

  it('treats 12+ chars with three or more character classes as strong', () => {
    expect(getPasswordStrength('Password123!')).toBe('strong');
  });

  it('does not call a 12+ char password with only two classes strong', () => {
    expect(getPasswordStrength('passwordpassword1')).toBe('good');
  });
});
