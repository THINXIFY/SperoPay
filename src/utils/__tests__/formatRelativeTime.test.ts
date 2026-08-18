import { formatRelativeTime } from '../formatRelativeTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('shows minutes for < 1 hour', () => {
    const twoMinAgo = new Date('2026-08-18T11:58:00.000Z').toISOString();
    expect(formatRelativeTime(twoMinAgo, now)).toBe('2m ago');
  });

  it('shows hours for < 24 hours', () => {
    const oneHourAgo = new Date('2026-08-18T11:00:00.000Z').toISOString();
    expect(formatRelativeTime(oneHourAgo, now)).toBe('1h ago');
  });

  it('shows days for >= 24 hours', () => {
    const twoDaysAgo = new Date('2026-08-16T12:00:00.000Z').toISOString();
    expect(formatRelativeTime(twoDaysAgo, now)).toBe('2d ago');
  });

  it('shows "just now" for under a minute', () => {
    const fewSecondsAgo = new Date('2026-08-18T11:59:50.000Z').toISOString();
    expect(formatRelativeTime(fewSecondsAgo, now)).toBe('just now');
  });
});
