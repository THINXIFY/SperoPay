jest.mock('expo-brightness', () => ({
  isAvailableAsync: jest.fn(),
  getBrightnessAsync: jest.fn(),
  setBrightnessAsync: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import * as Brightness from 'expo-brightness';
import { useTemporaryBrightness } from '../useTemporaryBrightness';

const isAvailableAsync = Brightness.isAvailableAsync as jest.Mock;
const getBrightnessAsync = Brightness.getBrightnessAsync as jest.Mock;
const setBrightnessAsync = Brightness.setBrightnessAsync as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
});

describe('useTemporaryBrightness', () => {
  it('boost() saves the current brightness and sets a new one', async () => {
    isAvailableAsync.mockResolvedValue(true);
    getBrightnessAsync.mockResolvedValue(0.4);
    setBrightnessAsync.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useTemporaryBrightness());

    await act(async () => {
      await result.current.boost();
    });

    expect(setBrightnessAsync).toHaveBeenCalledWith(1);
  });

  it('restore() sets brightness back to the value saved by boost()', async () => {
    isAvailableAsync.mockResolvedValue(true);
    getBrightnessAsync.mockResolvedValue(0.4);
    setBrightnessAsync.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useTemporaryBrightness());

    await act(async () => {
      await result.current.boost();
    });
    await act(async () => {
      await result.current.restore();
    });

    expect(setBrightnessAsync).toHaveBeenLastCalledWith(0.4);
  });

  it('restore() is a no-op if boost() was never called', async () => {
    const { result } = await renderHook(() => useTemporaryBrightness());

    await act(async () => {
      await result.current.restore();
    });

    expect(setBrightnessAsync).not.toHaveBeenCalled();
  });

  it('boost() does nothing when the Brightness API is unavailable on this device', async () => {
    isAvailableAsync.mockResolvedValue(false);
    const { result } = await renderHook(() => useTemporaryBrightness());

    await act(async () => {
      await result.current.boost();
    });

    expect(getBrightnessAsync).not.toHaveBeenCalled();
    expect(setBrightnessAsync).not.toHaveBeenCalled();
  });

  it('never throws even if the underlying native calls reject (QR usability must not depend on this)', async () => {
    isAvailableAsync.mockRejectedValue(new Error('native module error'));
    const { result } = await renderHook(() => useTemporaryBrightness());

    await act(async () => {
      await expect(result.current.boost()).resolves.toBeUndefined();
    });

    setBrightnessAsync.mockRejectedValue(new Error('native module error'));
    isAvailableAsync.mockResolvedValue(true);
    getBrightnessAsync.mockResolvedValue(0.5);
    await act(async () => {
      await result.current.boost();
    });
    await act(async () => {
      await expect(result.current.restore()).resolves.toBeUndefined();
    });
  });
});
