// This store persists via AsyncStorage (zustand/persist) -- the first test
// in this codebase to touch an AsyncStorage-backed store, so there's no
// existing mock convention to follow yet. This is the library's own
// documented Jest integration (a working in-memory fake), not a bespoke
// mock -- see https://react-native-async-storage.github.io/async-storage/docs/advanced/jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useNotificationStore } from '../notificationStore';

describe('useNotificationStore', () => {
  it('defaults every category to enabled', () => {
    expect(useNotificationStore.getState().preferences).toEqual({
      payments: true,
      requests: true,
      reminders: true,
      recurring: true,
      customers: true,
    });
  });

  it('updatePreferences patches only the given category, leaving the rest untouched', () => {
    useNotificationStore.getState().updatePreferences({ customers: false });
    expect(useNotificationStore.getState().preferences).toMatchObject({ customers: false, payments: true, requests: true });
    // Restore for other tests in this process.
    useNotificationStore.getState().updatePreferences({ customers: true });
  });
});
