import { createStaleGuard } from '../staleGuard';

describe('createStaleGuard', () => {
  it('a token is current immediately after being issued', () => {
    const guard = createStaleGuard();
    const token = guard.next();
    expect(guard.isCurrent(token)).toBe(true);
  });

  it('an earlier token becomes stale once a newer one is issued', () => {
    const guard = createStaleGuard();
    const first = guard.next();
    const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });
});
