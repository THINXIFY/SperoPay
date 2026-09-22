jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

import { Alert, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { openTransactionInExplorer } from '../openInExplorer';

const SIGNATURE = '5x7z9vQKzWn3q8mR2pL6tYcV4jH1sB7fN0xE8dA3wU2kM9nP6rT4gS1vC5bZ7yJ3';

// Spies are created ONCE at module scope and reset (not re-created) per
// test via mockReset() -- re-calling jest.spyOn on the same
// react-native.Linking property after jest.restoreAllMocks() was found to
// leave a stale spy behind (its call history from a PRIOR test bled into
// the next one), so this is the one reliable pattern here.
const canOpenURLSpy = jest.spyOn(Linking, 'canOpenURL');
const openURLSpy = jest.spyOn(Linking, 'openURL');
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  canOpenURLSpy.mockReset().mockResolvedValue(true as never);
  openURLSpy.mockReset().mockResolvedValue(true as never);
  alertSpy.mockClear();
  (Clipboard.setStringAsync as jest.Mock).mockClear().mockResolvedValue(undefined);
});

describe('openTransactionInExplorer', () => {
  it('opens the Explorer URL when the device can handle it', async () => {
    await openTransactionInExplorer(SIGNATURE);

    expect(canOpenURLSpy).toHaveBeenCalledWith(expect.stringContaining(SIGNATURE));
    expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining(SIGNATURE));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows the "Unable to open Explorer" alert, never silently failing, when the device cannot open the URL', async () => {
    canOpenURLSpy.mockResolvedValue(false as never);

    await openTransactionInExplorer(SIGNATURE);

    expect(openURLSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Unable to open Explorer',
      'Please try again.',
      expect.arrayContaining([expect.objectContaining({ text: 'Copy Transaction ID' })])
    );
  });

  it('shows the same alert when opening the URL itself throws', async () => {
    openURLSpy.mockRejectedValue(new Error('boom'));

    await openTransactionInExplorer(SIGNATURE);

    expect(alertSpy).toHaveBeenCalledWith('Unable to open Explorer', 'Please try again.', expect.any(Array));
  });

  it('"Copy Transaction ID" copies the exact signature', async () => {
    canOpenURLSpy.mockResolvedValue(false as never);
    alertSpy.mockImplementation((_title, _message, buttons) => {
      const copyButton = buttons?.find((b) => b.text === 'Copy Transaction ID');
      copyButton?.onPress?.();
    });

    await openTransactionInExplorer(SIGNATURE);

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(SIGNATURE);
  });
});
