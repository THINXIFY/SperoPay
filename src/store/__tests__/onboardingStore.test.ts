jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// onboardingStore imports authStore, which imports lib/supabase — that module
// throws at import time without real env vars. Mock it out the same way
// authStore.test.ts does, since this test never needs a real client.
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      resend: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

import { useOnboardingStore, isOnboardingComplete } from '../onboardingStore';

beforeEach(() => {
  useOnboardingStore.setState({ completedUserIds: [], hasHydrated: false });
});

describe('isOnboardingComplete', () => {
  it('is false with no userId', () => {
    expect(isOnboardingComplete(undefined, ['user-a'])).toBe(false);
  });

  it('is true when the userId is in the completed list', () => {
    expect(isOnboardingComplete('user-a', ['user-a', 'user-b'])).toBe(true);
  });

  it('is false when the userId is not in the completed list', () => {
    expect(isOnboardingComplete('user-c', ['user-a', 'user-b'])).toBe(false);
  });
});

describe('completeOnboarding', () => {
  it('adds a user id to the completed list', () => {
    useOnboardingStore.getState().completeOnboarding('user-a');
    expect(useOnboardingStore.getState().completedUserIds).toEqual(['user-a']);
  });

  it('does not duplicate an already-completed user id', () => {
    useOnboardingStore.getState().completeOnboarding('user-a');
    useOnboardingStore.getState().completeOnboarding('user-a');
    expect(useOnboardingStore.getState().completedUserIds).toEqual(['user-a']);
  });

  it('keeps user isolation — completing for one user does not affect another', () => {
    useOnboardingStore.getState().completeOnboarding('user-a');
    const ids = useOnboardingStore.getState().completedUserIds;
    expect(isOnboardingComplete('user-b', ids)).toBe(false);
    expect(isOnboardingComplete('user-a', ids)).toBe(true);
  });
});
