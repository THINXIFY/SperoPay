jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { usePaymentDefaultsStore } from '../paymentDefaultsStore';

describe('usePaymentDefaultsStore', () => {
  afterEach(() => {
    // Restore for other tests in this process (this store persists via
    // AsyncStorage and is a singleton across the whole test file).
    usePaymentDefaultsStore.setState({ defaultCurrency: 'USDC', defaultExpiryOption: '7d' });
  });

  it('defaults to USDC, matching the existing-user default (spec section 3)', () => {
    expect(usePaymentDefaultsStore.getState().defaultCurrency).toBe('USDC');
  });

  it('setDefaultCurrency updates the default', () => {
    usePaymentDefaultsStore.getState().setDefaultCurrency('EURC');
    expect(usePaymentDefaultsStore.getState().defaultCurrency).toBe('EURC');
  });

  // This store only ever seeds a NEW draft's starting currency (see
  // requestDraftStore.startFresh) -- it holds no reference to any existing
  // request, so there is nothing here for a changed default to rewrite.
  // The "changing the default never touches existing requests" guarantee
  // is therefore structural, not something this store's own state could
  // violate even in principle -- covered concretely in
  // requestDraftStore.test.ts and buildPaymentRequest.test.ts.
  it('changing the default does not affect unrelated store state', () => {
    usePaymentDefaultsStore.getState().setDefaultExpiryOption('24h');
    usePaymentDefaultsStore.getState().setDefaultCurrency('EURC');
    expect(usePaymentDefaultsStore.getState().defaultExpiryOption).toBe('24h');
  });
});
