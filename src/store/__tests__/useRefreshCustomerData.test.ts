jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useRefreshCustomerData } from '../useRefreshCustomerData';
import { useAuthStore } from '../authStore';
import { useCustomerStore } from '../customerStore';
import { useRequestStore } from '../requestStore';
import { useTransactionStore } from '../transactionStore';

function signIn() {
  useAuthStore.setState({ user: { id: 'user-1', fullName: 'Ada', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' } });
}

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ user: null });
});

describe('useRefreshCustomerData', () => {
  it('refreshes customers, requests, and transactions together for the signed-in user', async () => {
    signIn();
    const customerSpy = jest.spyOn(useCustomerStore.getState(), 'loadForUser').mockResolvedValue(undefined);
    const requestSpy = jest.spyOn(useRequestStore.getState(), 'loadForUser').mockResolvedValue(undefined);
    const txSpy = jest.spyOn(useTransactionStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshCustomerData());
    await act(async () => {
      await result.current.refresh();
    });

    expect(customerSpy).toHaveBeenCalledWith('user-1');
    expect(requestSpy).toHaveBeenCalledWith('user-1');
    expect(txSpy).toHaveBeenCalledWith('user-1');
  });

  it('does nothing when no user is signed in', async () => {
    const customerSpy = jest.spyOn(useCustomerStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshCustomerData());
    await act(async () => {
      await result.current.refresh();
    });

    expect(customerSpy).not.toHaveBeenCalled();
  });

  it('ignores a second refresh() call while one is already in flight', async () => {
    signIn();
    let resolveLoad: () => void = () => {};
    const customerSpy = jest.spyOn(useCustomerStore.getState(), 'loadForUser').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = () => resolve(undefined);
        })
    );
    const requestSpy = jest.spyOn(useRequestStore.getState(), 'loadForUser').mockResolvedValue(undefined);
    const txSpy = jest.spyOn(useTransactionStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshCustomerData());

    let firstRefresh: Promise<void> = Promise.resolve();
    await act(async () => {
      firstRefresh = result.current.refresh();
    });
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      await result.current.refresh();
    });

    expect(customerSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(txSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      resolveLoad();
      await firstRefresh;
    });
    expect(result.current.isRefreshing).toBe(false);
  });
});
