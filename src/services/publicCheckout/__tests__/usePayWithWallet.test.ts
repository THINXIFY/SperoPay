import { renderHook, act } from '@testing-library/react-native';
import { usePayWithWallet, NO_WALLET_MESSAGE } from '../usePayWithWallet';

const URI = 'solana:7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu?amount=10&spl-token=mint&reference=ref';

function makeDeps(overrides: Partial<{ canOpenURL: jest.Mock; openURL: jest.Mock }> = {}) {
  return {
    canOpenURL: overrides.canOpenURL ?? jest.fn().mockResolvedValue(true),
    openURL: overrides.openURL ?? jest.fn().mockResolvedValue(undefined),
  };
}

describe('usePayWithWallet', () => {
  it('opens the wallet and marks hasInitiated on a supported URI', async () => {
    const deps = makeDeps();
    const { result } = await renderHook(() => usePayWithWallet(deps));

    await act(async () => {
      await result.current.pay(URI);
    });

    expect(deps.canOpenURL).toHaveBeenCalledWith(URI);
    expect(deps.openURL).toHaveBeenCalledWith(URI);
    expect(result.current.hasInitiated).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isProcessing).toBe(false);
  });

  it('shows the friendly no-wallet message and does not initiate when no wallet supports the URI', async () => {
    const deps = makeDeps({ canOpenURL: jest.fn().mockResolvedValue(false) });
    const { result } = await renderHook(() => usePayWithWallet(deps));

    await act(async () => {
      await result.current.pay(URI);
    });

    expect(deps.openURL).not.toHaveBeenCalled();
    expect(result.current.hasInitiated).toBe(false);
    expect(result.current.error).toBe(NO_WALLET_MESSAGE);
  });

  it('fails safely (friendly message, no crash) when openURL throws', async () => {
    const deps = makeDeps({ openURL: jest.fn().mockRejectedValue(new Error('no handler registered')) });
    const { result } = await renderHook(() => usePayWithWallet(deps));

    await act(async () => {
      await result.current.pay(URI);
    });

    expect(result.current.hasInitiated).toBe(false);
    expect(result.current.error).toBe(NO_WALLET_MESSAGE);
  });

  it('fails safely when the URI could not be built (invalid wallet/reference upstream)', async () => {
    const deps = makeDeps();
    const { result } = await renderHook(() => usePayWithWallet(deps));

    await act(async () => {
      await result.current.pay(null);
    });

    expect(deps.canOpenURL).not.toHaveBeenCalled();
    expect(deps.openURL).not.toHaveBeenCalled();
    expect(result.current.error).toBe(NO_WALLET_MESSAGE);
  });

  it('double tap opens the wallet only once', async () => {
    let resolveCanOpen: (value: boolean) => void = () => {};
    const deps = makeDeps({
      canOpenURL: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCanOpen = resolve;
          })
      ),
    });
    const { result } = await renderHook(() => usePayWithWallet(deps));

    // Two synchronous taps before the first call resolves -- the ref-based
    // guard must block the second one immediately, not just eventually.
    let firstCall: Promise<void>;
    let secondCall: Promise<void>;
    await act(async () => {
      firstCall = result.current.pay(URI);
      secondCall = result.current.pay(URI);
    });
    expect(deps.canOpenURL).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCanOpen(true);
      await firstCall;
      await secondCall;
    });

    expect(deps.canOpenURL).toHaveBeenCalledTimes(1);
    expect(deps.openURL).toHaveBeenCalledTimes(1);
  });

  it('is processing only while the attempt is in flight', async () => {
    let resolveCanOpen: (value: boolean) => void = () => {};
    const deps = makeDeps({
      canOpenURL: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCanOpen = resolve;
          })
      ),
    });
    const { result } = await renderHook(() => usePayWithWallet(deps));

    let payPromise: Promise<void>;
    await act(async () => {
      payPromise = result.current.pay(URI);
    });
    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      resolveCanOpen(true);
      await payPromise;
    });
    expect(result.current.isProcessing).toBe(false);
  });

  it('a retry after a failed attempt is allowed (hasInitiated only flips on success)', async () => {
    const deps = makeDeps({ canOpenURL: jest.fn().mockResolvedValue(false) });
    const { result } = await renderHook(() => usePayWithWallet(deps));

    await act(async () => {
      await result.current.pay(URI);
    });
    expect(result.current.hasInitiated).toBe(false);

    deps.canOpenURL.mockResolvedValue(true);
    await act(async () => {
      await result.current.pay(URI);
    });
    expect(result.current.hasInitiated).toBe(true);
  });
});
