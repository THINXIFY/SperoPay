jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import { renderHook, act } from '@testing-library/react-native';
import { useRefreshProfileData } from '../useRefreshProfileData';
import { useAuthStore } from '../authStore';
import { useProfileStore } from '../profileStore';
import { useWalletStore } from '../walletStore';

function signIn() {
  useAuthStore.setState({ user: { id: 'user-1', fullName: 'Ada', email: 'ada@example.com', createdAt: '2026-01-01T00:00:00.000Z' } });
}

afterEach(() => {
  jest.restoreAllMocks();
  useAuthStore.setState({ user: null });
});

describe('useRefreshProfileData', () => {
  it('refreshes profile and wallet together for the signed-in user', async () => {
    signIn();
    const profileSpy = jest.spyOn(useProfileStore.getState(), 'loadForUser').mockResolvedValue(undefined);
    const walletSpy = jest.spyOn(useWalletStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshProfileData());
    await act(async () => {
      await result.current.refresh();
    });

    expect(profileSpy).toHaveBeenCalledWith('user-1');
    expect(walletSpy).toHaveBeenCalledWith('user-1');
  });

  it('does nothing when no user is signed in', async () => {
    const profileSpy = jest.spyOn(useProfileStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshProfileData());
    await act(async () => {
      await result.current.refresh();
    });

    expect(profileSpy).not.toHaveBeenCalled();
  });

  it('ignores a second refresh() call while one is already in flight', async () => {
    signIn();
    let resolveLoad: () => void = () => {};
    const profileSpy = jest.spyOn(useProfileStore.getState(), 'loadForUser').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = () => resolve(undefined);
        })
    );
    const walletSpy = jest.spyOn(useWalletStore.getState(), 'loadForUser').mockResolvedValue(undefined);

    const { result } = await renderHook(() => useRefreshProfileData());

    let firstRefresh: Promise<void> = Promise.resolve();
    await act(async () => {
      firstRefresh = result.current.refresh();
    });
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      await result.current.refresh();
    });

    expect(profileSpy).toHaveBeenCalledTimes(1);
    expect(walletSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      resolveLoad();
      await firstRefresh;
    });
    expect(result.current.isRefreshing).toBe(false);
  });
});
