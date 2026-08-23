import { AppState } from 'react-native';
import { renderHook } from '@testing-library/react-native';
import { useRefreshOnForeground } from '../useRefreshOnForeground';

let addEventListenerSpy: jest.SpyInstance;
const removeMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (AppState as unknown as { currentState: string }).currentState = 'active';
  addEventListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({
    remove: removeMock,
  }) as never);
});

afterEach(() => {
  addEventListenerSpy.mockRestore();
});

describe('useRefreshOnForeground', () => {
  it('does not call refresh on mount', async () => {
    const refresh = jest.fn();
    await renderHook(() => useRefreshOnForeground(refresh));

    expect(refresh).not.toHaveBeenCalled();
  });

  it('calls refresh exactly once when the app returns from background to active', async () => {
    const refresh = jest.fn();
    await renderHook(() => useRefreshOnForeground(refresh));
    const handler = addEventListenerSpy.mock.calls[0][1] as (state: string) => void;

    handler('background');
    handler('active');

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not call refresh for an active-to-active no-op transition', async () => {
    const refresh = jest.fn();
    await renderHook(() => useRefreshOnForeground(refresh));
    const handler = addEventListenerSpy.mock.calls[0][1] as (state: string) => void;

    handler('active');

    expect(refresh).not.toHaveBeenCalled();
  });

  it('removes its subscription on unmount', async () => {
    const refresh = jest.fn();
    const { unmount } = await renderHook(() => useRefreshOnForeground(refresh));

    await unmount();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
