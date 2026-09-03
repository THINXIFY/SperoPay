import { getInitials } from '../getInitials';

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('Farhan Zafar')).toBe('FZ');
  });

  it('uppercases lowercase input', () => {
    expect(getInitials('jane doe')).toBe('JD');
  });

  it('uses a single initial for a one-word name', () => {
    expect(getInitials('Farhan')).toBe('F');
  });

  it('ignores a third or later word', () => {
    expect(getInitials('Farhan Ahmed Zafar')).toBe('FA');
  });

  it('collapses runs of whitespace instead of producing blank initials', () => {
    expect(getInitials('  Farhan   Zafar  ')).toBe('FZ');
  });

  it('returns an empty string for blank input, letting the caller supply its own fallback', () => {
    expect(getInitials('')).toBe('');
    expect(getInitials('   ')).toBe('');
  });
});
