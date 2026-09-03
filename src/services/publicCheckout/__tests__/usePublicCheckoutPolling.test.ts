import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePublicCheckoutPolling } from '../usePublicCheckoutPolling';
import { fetchPublicCheckout } from '../publicCheckoutService';
import { triggerPaymentVerification } from '../verifyPayment';
import type { PublicCheckoutData } from '../types';

jest.mock('../publicCheckoutService', () => ({
  fetchPublicCheckout: jest.fn(),
}));

jest.mock('../verifyPayment', () => ({
  triggerPaymentVerification: jest.fn().mockResolvedValue(undefined),
}));

const mockedFetch = jest.mocked(fetchPublicCheckout);
const mockedTriggerVerification = jest.mocked(triggerPaymentVerification);

const TOKEN = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const POLL_INTERVAL_MS = 1000;

function checkoutData(overrides: Partial<PublicCheckoutData> = {}): PublicCheckoutData {
  return {
    paymentCode: 'SP-AAAAA',
    amount: 10.5,
    currency: 'USDC',
    network: 'Solana',
    description: null,
    status: 'pending',
    expiresAt: null,
    merchantName: 'Acme Co',
    destinationWallet: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu',
    solanaReference: 'GsbwXfJraMomNxBcpR5TVQaaB6WcU9v4rTUgHTKfyG3g',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('usePublicCheckoutPolling', () => {
  it('fetches immediately on mount', async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: checkoutData() });

    const { result } = await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));

    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith(TOKEN);
  });

  it('nudges server-side verification before each fetch', async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: checkoutData({ status: 'pending' }) });

    await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    expect(mockedTriggerVerification).toHaveBeenCalledWith(TOKEN);
    expect(mockedTriggerVerification).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
    expect(mockedTriggerVerification).toHaveBeenCalledTimes(2);
  });

  it('reschedules another poll while status is pending', async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: checkoutData({ status: 'pending' }) });

    const { result } = await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
    expect(result.current.result?.ok).toBe(true);
  });

  it('reschedules another poll while status is confirming', async () => {
    mockedFetch.mockResolvedValue({ ok: true, data: checkoutData({ status: 'confirming' }) });

    await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
  });

  it.each(['paid', 'expired', 'cancelled'] as const)(
    'stops polling once status is terminal (%s)',
    async (status) => {
      mockedFetch.mockResolvedValue({ ok: true, data: checkoutData({ status }) });

      await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
      await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));

      await act(async () => {
        jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
      });
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    }
  );

  it('stops polling on an error result instead of retrying automatically', async () => {
    mockedFetch.mockResolvedValue({ ok: false, code: 'network_error', message: 'Something went wrong.' });

    await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('never has two fetches in flight at once (no overlap even if a fetch is slow)', async () => {
    let resolveFirst: (value: { ok: true; data: PublicCheckoutData }) => void = () => {};
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    mockedFetch.mockResolvedValue({ ok: true, data: checkoutData() });

    await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    // Time passes well beyond the poll interval while the first request is
    // still unresolved -- no second fetch should fire, because scheduling
    // only happens after the in-flight one resolves.
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 5);
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({ ok: true, data: checkoutData() });
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
  });

  it('stops polling and applies no further state updates after unmount', async () => {
    let resolveFirst: (value: { ok: true; data: PublicCheckoutData }) => void = () => {};
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    const { unmount } = await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await unmount();

    await act(async () => {
      resolveFirst({ ok: true, data: checkoutData() });
    });
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    });

    // Only the initial in-flight fetch happened; nothing scheduled after unmount.
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('produces an invalid_token result without calling the service when token is missing', async () => {
    const { result } = await renderHook(() => usePublicCheckoutPolling(undefined, POLL_INTERVAL_MS));

    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result).toEqual({
      ok: false,
      code: 'invalid_token',
      message: expect.any(String),
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('refresh() re-triggers a fetch and sets isRefreshing until it resolves', async () => {
    mockedFetch.mockResolvedValueOnce({ ok: true, data: checkoutData({ status: 'paid' }) });

    const { result } = await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    expect(result.current.isRefreshing).toBe(false);

    let resolveRefresh: (value: { ok: true; data: PublicCheckoutData }) => void = () => {};
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );

    await act(async () => {
      result.current.refresh();
    });
    expect(result.current.isRefreshing).toBe(true);
    expect(mockedFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveRefresh({ ok: true, data: checkoutData({ status: 'paid' }) });
    });
    expect(result.current.isRefreshing).toBe(false);
  });

  it('keeps the last known-good data on screen and flags isOffline on a transient failure after a successful load', async () => {
    const goodData = checkoutData({ status: 'pending' });
    mockedFetch.mockResolvedValueOnce({ ok: true, data: goodData });

    const { result } = await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    expect(result.current.isOffline).toBe(false);

    mockedFetch.mockResolvedValueOnce({ ok: false, code: 'network_error', message: 'oops' });
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));

    expect(result.current.isOffline).toBe(true);
    // Unchanged -- the transient failure never replaced the last good result.
    expect(result.current.result).toEqual({ ok: true, data: goodData });
  });

  it('keeps polling during a transient outage and recovers automatically once a fetch succeeds again', async () => {
    const goodData = checkoutData({ status: 'pending' });
    mockedFetch.mockResolvedValueOnce({ ok: true, data: goodData });

    const { result } = await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));

    mockedFetch.mockResolvedValueOnce({ ok: false, code: 'network_error', message: 'oops' });
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(result.current.isOffline).toBe(true));

    const updatedData = checkoutData({ status: 'confirming' });
    mockedFetch.mockResolvedValueOnce({ ok: true, data: updatedData });
    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(3));

    expect(result.current.isOffline).toBe(false);
    expect(result.current.result).toEqual({ ok: true, data: updatedData });
  });

  it('skips a duplicate verification call while one is already in flight, but still fetches fresh status', async () => {
    let resolveVerify: () => void = () => {};
    mockedTriggerVerification.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveVerify = () => resolve(undefined);
        })
    );
    mockedFetch.mockResolvedValue({ ok: true, data: checkoutData() });

    const { result } = await renderHook(() => usePublicCheckoutPolling(TOKEN, POLL_INTERVAL_MS));
    expect(mockedTriggerVerification).toHaveBeenCalledTimes(1);
    expect(mockedFetch).not.toHaveBeenCalled(); // still waiting on the in-flight verification call

    await act(async () => {
      result.current.refresh();
    });

    // The refresh's own tick found a verification call already in flight
    // and skipped re-triggering it, but still fetched current status.
    expect(mockedTriggerVerification).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVerify();
    });
  });
});
