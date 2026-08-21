import { registerResettable, resetAllUserData } from '../dataLifecycle';

describe('resetAllUserData', () => {
  it('calls every registered resetter', () => {
    const a = jest.fn();
    const b = jest.fn();
    registerResettable(a);
    registerResettable(b);

    resetAllUserData();

    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});
