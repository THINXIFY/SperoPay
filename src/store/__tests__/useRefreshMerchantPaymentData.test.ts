jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useRefreshMerchantPaymentData } from '../useRefreshMerchantPaymentData';
import { useAuthStore } from '../authStore';
import { useRequestStore } from '../requestStore';
import { useTransactionStore } from '../transactionStore';
import { useRequestEventStore } from '../requestEventStore';

function signIn() {
  useAuthStore.setState({ user: { id: 'user-1', fullName: 'Ada', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' } });
}

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ user: null });
});

describe('useRefreshMerchantPaymentData', () => {
  it('refreshes requests, transactions, and request events together for the signed-in user', async () => {
    signIn();
    const requestSpy = jest.spyOn(useRequestStore.getState(), 'loadForUser').mockResolvedValue(undefined);
    const txSpy = jest.spyOn(useTransactionStore.getState(), 'loadForUser').mockResolvedValue(undefined);
    const eventSpy = jest.spyOn(useRequestEventStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshMerchantPaymentData());
    await act(async () => {
      await result.current.refresh();
    });

    expect(requestSpy).toHaveBeenCalledWith('user-1');
    expect(txSpy).toHaveBeenCalledWith('user-1');
    expect(eventSpy).toHaveBeenCalledWith('user-1');
  });

  it('does nothing when no user is signed in', async () => {
    const requestSpy = jest.spyOn(useRequestStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshMerchantPaymentData());
    await act(async () => {
      await result.current.refresh();
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('tracks isRefreshing across the refresh call', async () => {
    signIn();
    let resolveLoad: () => void = () => {};
    jest.spyOn(useRequestStore.getState(), 'loadForUser').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = () => resolve(undefined);
        })
    );
    jest.spyOn(useTransactionStore.getState(), 'loadForUser').mockResolvedValue(undefined);
    jest.spyOn(useRequestEventStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshMerchantPaymentData());
    expect(result.current.isRefreshing).toBe(false);

    let refreshPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      refreshPromise = result.current.refresh();
    });
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      resolveLoad();
      await refreshPromise;
    });
    expect(result.current.isRefreshing).toBe(false);
  });
});
