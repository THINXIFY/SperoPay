# Phase 2A-2: Auth Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and harden Phase 2A-1's real Supabase auth: password recovery with a working deep-link back into the app, a completed email-confirmation experience (with resend), per-user onboarding isolation, real Change Password, better identity sync, and general auth-state/error-handling hardening — without touching Phase 1's local business data.

**Architecture:** PKCE flow + one centralized deep-link callback screen (`app/auth/callback.tsx`, outside every `AuthGate`) handles both recovery and confirmation links via `exchangeCodeForSession`, relying on the Supabase SDK's own `PASSWORD_RECOVERY` vs `SIGNED_IN` event distinction. `isPasswordRecovery` becomes a new top-priority input to the existing pure `authRouting.ts` functions. `onboardingStore` moves from one global boolean to a per-user-ID list, exposed through a new `useHasCompletedOnboarding()` hook that every routing call site switches to.

**Tech Stack:** React Native / Expo Router, Zustand, `@supabase/supabase-js` (PKCE flow), `expo-linking`.

Full design rationale: `docs/superpowers/specs/2026-08-21-phase-2a2-auth-completion-design.md`

---

### Task 1: PKCE flow + centralized deep-link URL helper

**Files:**
- Modify: `src/lib/supabase.ts`
- Create: `src/utils/authDeepLink.ts`
- Test: `src/utils/__tests__/authDeepLink.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/__tests__/authDeepLink.test.ts
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `speropay://${path.replace(/^\//, '')}`),
}));

import { getAuthCallbackUrl } from '../authDeepLink';

describe('getAuthCallbackUrl', () => {
  it('builds the auth callback deep link via expo-linking', () => {
    expect(getAuthCallbackUrl()).toBe('speropay://auth/callback');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/__tests__/authDeepLink.test.ts`
Expected: FAIL — cannot find module `../authDeepLink`

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/authDeepLink.ts
import * as Linking from 'expo-linking';

// The one redirect URL used for both password-recovery and sign-up-confirmation
// links. Supabase's client (not this URL) is what tells us which flow a given
// code exchange belongs to — see app/auth/callback.tsx.
export function getAuthCallbackUrl(): string {
  return Linking.createURL('/auth/callback');
}
```

- [ ] **Step 4: Add `flowType: 'pkce'` to the Supabase client**

In `src/lib/supabase.ts`, change:

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
```

to:

```ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/utils/__tests__/authDeepLink.test.ts`
Expected: PASS

- [ ] **Step 6: Run full suite + typecheck, then commit**

Run: `npx tsc --noEmit && npx jest`
Expected: clean, all existing tests still pass

```bash
git add src/lib/supabase.ts src/utils/authDeepLink.ts src/utils/__tests__/authDeepLink.test.ts
git commit -m "Switch Supabase client to PKCE flow, add centralized auth callback URL helper"
```

---

### Task 2: Recovery sessions as a top-priority routing input

**Files:**
- Modify: `src/utils/authRouting.ts`
- Test: `src/utils/__tests__/authRouting.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/__tests__/authRouting.test.ts` (inside the existing `describe` blocks):

```ts
// inside describe('resolveInitialRoute', ...), after the existing tests:
it('routes to Reset Password when a password recovery session is active, regardless of other state', () => {
  expect(
    resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding: true, isPasswordRecovery: true })
  ).toBe('/(auth)/reset-password');
  expect(
    resolveInitialRoute({ isAuthenticated: false, hasCompletedOnboarding: false, isPasswordRecovery: true })
  ).toBe('/(auth)/reset-password');
});
```

```ts
// inside describe('resolveAuthGateRedirect', ...), after the existing tests:
it('require-guest allows a password-recovery session to stay put', () => {
  expect(
    resolveAuthGateRedirect('require-guest', {
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      isPasswordRecovery: true,
    })
  ).toBeNull();
});

it('require-auth redirects a password-recovery session to Reset Password', () => {
  expect(
    resolveAuthGateRedirect('require-auth', {
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      isPasswordRecovery: true,
    })
  ).toBe('/(auth)/reset-password');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/utils/__tests__/authRouting.test.ts`
Expected: FAIL — the new cases return the old (wrong) routes since `isPasswordRecovery` isn't handled yet

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/utils/authRouting.ts`:

```ts
export interface AuthRoutingState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isPasswordRecovery?: boolean;
}

export type AuthGateMode = 'require-auth' | 'require-guest';

const RESET_PASSWORD_ROUTE = '/(auth)/reset-password';

export function resolveInitialRoute(state: AuthRoutingState): string {
  if (state.isPasswordRecovery) return RESET_PASSWORD_ROUTE;
  if (!state.isAuthenticated) return '/(auth)/welcome';
  if (!state.hasCompletedOnboarding) return '/(onboarding)/usage-type';
  return '/(app)/home';
}

export function resolveAuthGateRedirect(mode: AuthGateMode, state: AuthRoutingState): string | null {
  // A recovery session is neither an ordinary logged-in session nor a guest:
  // it must never reach Home/Onboarding (require-auth redirects it to Reset
  // Password), but it must also not be bounced out of the (auth) group the
  // way a normal authenticated session would be (require-guest treats it as
  // guest-equivalent and leaves it alone).
  if (state.isPasswordRecovery) {
    return mode === 'require-guest' ? null : RESET_PASSWORD_ROUTE;
  }
  if (mode === 'require-auth' && !state.isAuthenticated) {
    return '/(auth)/welcome';
  }
  if (mode === 'require-guest' && state.isAuthenticated) {
    return resolveInitialRoute(state);
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/__tests__/authRouting.test.ts`
Expected: PASS, all cases (existing + new)

- [ ] **Step 5: Typecheck + full suite, then commit**

Run: `npx tsc --noEmit && npx jest`

```bash
git add src/utils/authRouting.ts src/utils/__tests__/authRouting.test.ts
git commit -m "Make password-recovery sessions a top-priority, centrally-routed state"
```

---

### Task 3: Extend auth error copy for deep-link and network failures

**Files:**
- Modify: `src/utils/authErrors.ts`
- Test: `src/utils/__tests__/authErrors.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `src/utils/__tests__/authErrors.test.ts` in full (the network-error expected copy changes — see Step 3 — and new cases are added):

```ts
import { getAuthErrorMessage } from '../authErrors';

describe('getAuthErrorMessage', () => {
  it('maps invalid credentials', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'))).toBe('Email or password is incorrect.');
  });

  it('maps unconfirmed email', () => {
    expect(getAuthErrorMessage(new Error('Email not confirmed'))).toBe(
      'Please confirm your email before signing in.'
    );
  });

  it('maps already-registered errors', () => {
    expect(getAuthErrorMessage(new Error('User already registered'))).toBe(
      'An account already exists with this email.'
    );
  });

  it('maps weak-password errors', () => {
    expect(getAuthErrorMessage(new Error('Password should be at least 6 characters'))).toBe(
      'Choose a stronger password.'
    );
  });

  it('maps network errors', () => {
    expect(getAuthErrorMessage(new Error('Network request failed'))).toBe(
      "We couldn't connect right now. Check your internet connection and try again."
    );
  });

  it('maps PKCE/deep-link code-exchange failures by error name', () => {
    const error = new Error('No code detected.');
    error.name = 'AuthPKCEGrantCodeExchangeError';
    expect(getAuthErrorMessage(error)).toBe(
      'This link is no longer valid. Request a new one and open it on this device.'
    );
  });

  it('maps a missing PKCE code verifier (wrong-device link) by error name', () => {
    const error = new Error('PKCE code verifier not found in storage.');
    error.name = 'AuthPKCECodeVerifierMissingError';
    expect(getAuthErrorMessage(error)).toBe(
      'This link is no longer valid. Request a new one and open it on this device.'
    );
  });

  it('falls back to a sign-in-flavored generic message by default', () => {
    expect(getAuthErrorMessage(new Error('something odd'))).toBe(
      "We couldn't sign you in right now. Please try again."
    );
  });

  it('falls back to a sign-up-flavored generic message when context is sign-up', () => {
    expect(getAuthErrorMessage(new Error('something odd'), 'sign-up')).toBe(
      "We couldn't create your account right now. Please try again."
    );
  });

  it('falls back to a reset-password-flavored generic message when context is reset-password', () => {
    expect(getAuthErrorMessage(new Error('something odd'), 'reset-password')).toBe(
      "We couldn't send that reset link right now. Please try again."
    );
  });

  it('falls back to an update-password-flavored generic message when context is update-password', () => {
    expect(getAuthErrorMessage(new Error('something odd'), 'update-password')).toBe(
      "We couldn't update your password right now. Please try again."
    );
  });

  it('handles non-Error values safely', () => {
    expect(getAuthErrorMessage('a plain string')).toBe("We couldn't sign you in right now. Please try again.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/utils/__tests__/authErrors.test.ts`
Expected: FAIL — new contexts/PKCE cases not handled, network copy string mismatch

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/utils/authErrors.ts`:

```ts
export type AuthErrorContext = 'sign-in' | 'sign-up' | 'reset-password' | 'update-password';

const CONTEXT_FALLBACKS: Record<AuthErrorContext, string> = {
  'sign-in': "We couldn't sign you in right now. Please try again.",
  'sign-up': "We couldn't create your account right now. Please try again.",
  'reset-password': "We couldn't send that reset link right now. Please try again.",
  'update-password': "We couldn't update your password right now. Please try again.",
};

export function getAuthErrorMessage(error: unknown, context: AuthErrorContext = 'sign-in'): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';
  const normalized = message.toLowerCase();

  if (name.includes('PKCE') || name.includes('ImplicitGrant') || normalized.includes('code verifier')) {
    return 'This link is no longer valid. Request a new one and open it on this device.';
  }
  if (normalized.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (normalized.includes('already registered')) {
    return 'An account already exists with this email.';
  }
  if (normalized.includes('password') && /short|weak|at least|characters/.test(normalized)) {
    return 'Choose a stronger password.';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout')
  ) {
    return "We couldn't connect right now. Check your internet connection and try again.";
  }

  return CONTEXT_FALLBACKS[context];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/utils/__tests__/authErrors.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck + full suite, then commit**

Run: `npx tsc --noEmit && npx jest`

```bash
git add src/utils/authErrors.ts src/utils/__tests__/authErrors.test.ts
git commit -m "Extend auth error copy for PKCE deep-link failures and new contexts"
```

---

### Task 4: `resolveDisplayName` — the identity priority as one pure function

**Files:**
- Create: `src/utils/resolveDisplayName.ts`
- Test: `src/utils/__tests__/resolveDisplayName.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/__tests__/resolveDisplayName.test.ts
import { resolveDisplayName } from '../resolveDisplayName';

describe('resolveDisplayName', () => {
  it('prefers the locally edited profile name', () => {
    expect(resolveDisplayName('Jane Doe', 'Jane D. Auth', 'jane@example.com')).toBe('Jane Doe');
  });

  it('falls back to the Supabase full name when the profile name is blank', () => {
    expect(resolveDisplayName('', 'Jane Auth', 'jane@example.com')).toBe('Jane Auth');
    expect(resolveDisplayName(undefined, 'Jane Auth', 'jane@example.com')).toBe('Jane Auth');
  });

  it('falls back to the email local part when both names are blank', () => {
    expect(resolveDisplayName('', '', 'jane@example.com')).toBe('jane');
  });

  it('treats whitespace-only names as blank', () => {
    expect(resolveDisplayName('   ', '  ', 'jane@example.com')).toBe('jane');
  });

  it('returns an empty string when nothing is available, letting the caller supply its own fallback', () => {
    expect(resolveDisplayName(undefined, undefined, undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/__tests__/resolveDisplayName.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write the implementation**

```ts
// src/utils/resolveDisplayName.ts

// Priority: an intentionally-edited local profile name, then the Supabase
// account's full_name, then an email-derived fallback. Returns '' (not a
// hardcoded word) when nothing is available — callers already have their own
// context-appropriate final fallback ("there" for a greeting, "Your Name" for
// a profile header) and this keeps that choice with them.
export function resolveDisplayName(
  profileName: string | undefined,
  authFullName: string | undefined,
  email: string | undefined
): string {
  const trimmedProfile = profileName?.trim();
  if (trimmedProfile) return trimmedProfile;

  const trimmedAuthName = authFullName?.trim();
  if (trimmedAuthName) return trimmedAuthName;

  const emailLocalPart = email?.split('@')[0]?.trim();
  return emailLocalPart || '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/__tests__/resolveDisplayName.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add src/utils/resolveDisplayName.ts src/utils/__tests__/resolveDisplayName.test.ts
git commit -m "Add resolveDisplayName: profile name -> Supabase full_name -> email fallback"
```

---

### Task 5: Per-user onboarding completion

**Files:**
- Modify: `src/store/onboardingStore.ts`
- Test: Create `src/store/__tests__/onboardingStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/store/__tests__/onboardingStore.test.ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/onboardingStore.test.ts`
Expected: FAIL — `completedUserIds`/`isOnboardingComplete` don't exist yet

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/store/onboardingStore.ts`:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './authStore';

interface OnboardingState {
  completedUserIds: string[];
  hasHydrated: boolean;
  completeOnboarding: (userId: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completedUserIds: [],
      hasHydrated: false,
      completeOnboarding: (userId) =>
        set((state) =>
          state.completedUserIds.includes(userId)
            ? state
            : { completedUserIds: [...state.completedUserIds, userId] }
        ),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'speropay/onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate onboarding store', error);
        }
        // Read from the store directly rather than relying on `state` so the
        // flag is still flipped even if rehydration errored out.
        useOnboardingStore.getState().setHasHydrated(true);
      },
    }
  )
);

export function isOnboardingComplete(userId: string | undefined, completedUserIds: string[]): boolean {
  return !!userId && completedUserIds.includes(userId);
}

// The one place routing/screens should read onboarding completion from —
// replaces the old global `hasCompletedOnboarding` boolean, which didn't
// distinguish between users on the same device.
export function useHasCompletedOnboarding(): boolean {
  const userId = useAuthStore((state) => state.user?.id);
  const completedUserIds = useOnboardingStore((state) => state.completedUserIds);
  return isOnboardingComplete(userId, completedUserIds);
}
```

**Note:** this drops the old `hasCompletedOnboarding: boolean` field and the `resetOnboarding` action (confirmed via grep to have zero remaining call sites after Phase 2A-1's holistic-review fix removed its only caller in `profile/index.tsx`). Anyone who completed onboarding under the old boolean-only shape will see `completedUserIds` start empty and go through onboarding once more — acceptable for a pre-launch app with no real users yet; not worth migration machinery.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/onboardingStore.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: **errors** in every file that still reads `state.hasCompletedOnboarding` or calls `state.resetOnboarding` — this is expected; those call sites are fixed in Tasks 6-9. Confirm the errors are exactly the ones you expect (in `AuthGate.tsx`, `app/index.tsx`, `app/(auth)/login.tsx`, `app/(onboarding)/wallet-setup.tsx`) and no others, then proceed.

- [ ] **Step 6: Commit**

```bash
git add src/store/onboardingStore.ts src/store/__tests__/onboardingStore.test.ts
git commit -m "Make onboarding completion per-user instead of a single global boolean"
```

---

### Task 6: Extend `authStore` — recovery, password update, resend, code exchange, session-expiry tracking

**Files:**
- Modify: `src/store/authStore.ts`
- Test: `src/store/__tests__/authStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these `describe` blocks to `src/store/__tests__/authStore.test.ts` (after the existing ones, before the final closing of the file). Also add `resend: jest.fn(), updateUser: jest.fn(), exchangeCodeForSession: jest.fn(),` to the mocked `supabase.auth` object at the top of the file:

```ts
// Add to the jest.mock('../../lib/supabase', ...) auth object, alongside the existing keys:
      resend: jest.fn(),
      updateUser: jest.fn(),
      exchangeCodeForSession: jest.fn(),
```

```ts
describe('sendPasswordReset', () => {
  it('passes the centralized callback URL as redirectTo', async () => {
    mockedSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().sendPasswordReset('jane@example.com');

    expect(mockedSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'jane@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('auth/callback') })
    );
  });
});

describe('updatePassword', () => {
  it('calls updateUser with the new password and clears loading on success', async () => {
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().updatePassword('newpassword123');

    expect(mockedSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpassword123' });
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('sets a human-friendly error and rethrows on failure', async () => {
    mockedSupabase.auth.updateUser.mockResolvedValue({ data: {}, error: new Error('weird failure') } as never);

    await expect(useAuthStore.getState().updatePassword('newpassword123')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe("We couldn't update your password right now. Please try again.");
  });
});

describe('resendConfirmationEmail', () => {
  it('calls resend with type signup and the centralized callback URL', async () => {
    mockedSupabase.auth.resend.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().resendConfirmationEmail('jane@example.com');

    expect(mockedSupabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'jane@example.com',
      options: { emailRedirectTo: expect.stringContaining('auth/callback') },
    });
  });
});

describe('exchangeAuthCode', () => {
  it('calls exchangeCodeForSession and clears loading on success', async () => {
    mockedSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().exchangeAuthCode('the-code');

    expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('the-code');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('sets an invalid-link error and rethrows on failure', async () => {
    const pkceError = new Error('No code detected.');
    pkceError.name = 'AuthPKCEGrantCodeExchangeError';
    mockedSupabase.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: pkceError } as never);

    await expect(useAuthStore.getState().exchangeAuthCode('bad-code')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe(
      'This link is no longer valid. Request a new one and open it on this device.'
    );
  });
});

describe('password recovery state', () => {
  it('sets isPasswordRecovery when onAuthStateChange reports PASSWORD_RECOVERY', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    mockedSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb as never;
      return { data: { subscription: { unsubscribe: jest.fn() } } } as never;
    });

    initializeAuthListener();
    capturedCallback?.('PASSWORD_RECOVERY', makeSession());

    expect(useAuthStore.getState().isPasswordRecovery).toBe(true);
  });

  it('clearPasswordRecovery resets the flag', () => {
    useAuthStore.setState({ isPasswordRecovery: true });
    useAuthStore.getState().clearPasswordRecovery();
    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });

  it('signOut defensively clears isPasswordRecovery', async () => {
    useAuthStore.setState({ isPasswordRecovery: true });
    mockedSupabase.auth.signOut.mockResolvedValue({ error: null } as never);

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });
});

describe('sessionExpiredNotice', () => {
  it('is set when the SDK reports SIGNED_OUT without our own signOut() having been called', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    mockedSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb as never;
      return { data: { subscription: { unsubscribe: jest.fn() } } } as never;
    });

    initializeAuthListener();
    capturedCallback?.('SIGNED_OUT', null);

    expect(useAuthStore.getState().sessionExpiredNotice).toBe(true);
  });

  it('is NOT set when SIGNED_OUT follows our own explicit signOut()', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    let capturedCallback: ((event: string, session: unknown) => void) | undefined;
    mockedSupabase.auth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb as never;
      return { data: { subscription: { unsubscribe: jest.fn() } } } as never;
    });
    mockedSupabase.auth.signOut.mockImplementation(async () => {
      capturedCallback?.('SIGNED_OUT', null);
      return { error: null } as never;
    });

    initializeAuthListener();
    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().sessionExpiredNotice).toBe(false);
  });

  it('clearSessionExpiredNotice resets the flag', () => {
    useAuthStore.setState({ sessionExpiredNotice: true });
    useAuthStore.getState().clearSessionExpiredNotice();
    expect(useAuthStore.getState().sessionExpiredNotice).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/authStore.test.ts`
Expected: FAIL — new actions/state don't exist yet

- [ ] **Step 3: Write the implementation**

Replace the full contents of `src/store/authStore.ts`:

```ts
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { mapSupabaseUser } from '../utils/mapSupabaseUser';
import { getAuthErrorMessage } from '../utils/authErrors';
import { getAuthCallbackUrl } from '../utils/authDeepLink';

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;
  isPasswordRecovery: boolean;
  sessionExpiredNotice: boolean;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  exchangeAuthCode: (code: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  clearSessionExpiredNotice: () => void;
  clearError: () => void;
  _setSession: (session: Session | null) => void;
}

// Lets the auth-state listener tell an explicit signOut() apart from a
// SIGNED_OUT event the SDK fired on its own (refresh failure, revoked
// session) — only the latter should surface a "session expired" notice.
// Module-level and transient by design: it's not UI-bindable state.
let isExplicitSignOut = false;

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  hasHydrated: false,
  error: null,
  isPasswordRecovery: false,
  sessionExpiredNotice: false,

  signUp: async (fullName, email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: getAuthCallbackUrl() },
    });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-up') });
      throw error;
    }
    set({ isLoading: false });
    return { needsEmailConfirmation: !data.session };
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in') });
      throw error;
    }
    set({ isLoading: false });
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    isExplicitSignOut = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ error: getAuthErrorMessage(error, 'sign-in') });
        throw error;
      }
    } finally {
      set({ isLoading: false, isPasswordRecovery: false });
    }
  },

  sendPasswordReset: async (email) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: getAuthCallbackUrl() });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'reset-password') });
      throw error;
    }
    set({ isLoading: false });
  },

  updatePassword: async (password) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'update-password') });
      throw error;
    }
    set({ isLoading: false });
  },

  resendConfirmationEmail: async (email) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-up') });
      throw error;
    }
    set({ isLoading: false });
  },

  exchangeAuthCode: async (code) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in') });
      throw error;
    }
    set({ isLoading: false });
  },

  clearPasswordRecovery: () => set({ isPasswordRecovery: false }),
  clearSessionExpiredNotice: () => set({ sessionExpiredNotice: false }),
  clearError: () => set({ error: null }),

  _setSession: (session) => {
    set({
      session,
      user: session ? mapSupabaseUser(session.user) : null,
      isAuthenticated: !!session,
      hasHydrated: true,
    });
  },
}));

export function initializeAuthListener(): () => void {
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      useAuthStore.getState()._setSession(session);
    })
    .catch(() => {
      useAuthStore.getState()._setSession(null);
    });

  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      useAuthStore.setState({ isPasswordRecovery: true });
    }

    if (event === 'SIGNED_OUT') {
      useAuthStore.setState({ sessionExpiredNotice: !isExplicitSignOut });
      isExplicitSignOut = false;
    }

    useAuthStore.getState()._setSession(session);
  });

  return () => listener.subscription.unsubscribe();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/authStore.test.ts`
Expected: PASS (all — existing 2A-1 tests plus the new ones)

- [ ] **Step 5: Typecheck + full suite, then commit**

Run: `npx tsc --noEmit && npx jest`
(The same 4 pre-existing errors from Task 5 are still expected here — untouched call sites, fixed next.)

```bash
git add src/store/authStore.ts src/store/__tests__/authStore.test.ts
git commit -m "Add password recovery, update-password, resend, and code-exchange to authStore"
```

---

### Task 7: Fix `AuthGate` and splash routing call sites

**Files:**
- Modify: `src/components/AuthGate.tsx`
- Modify: `app/index.tsx`

- [ ] **Step 1: Update `AuthGate.tsx`**

Replace the full contents of `src/components/AuthGate.tsx`:

```tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useHasCompletedOnboarding, useOnboardingStore } from '../store/onboardingStore';
import { resolveAuthGateRedirect, type AuthGateMode } from '../utils/authRouting';

interface AuthGateProps {
  mode: AuthGateMode;
  children: React.ReactNode;
}

/**
 * Wraps a top-level layout and reactively redirects if the current auth state
 * doesn't match what that segment requires. This is the backstop for the fact
 * that a real Supabase session can end reactively (not just via the Sign Out
 * button) — the splash screen's one-time redirect alone isn't enough once
 * sessions can expire mid-use.
 */
export function AuthGate({ mode, children }: AuthGateProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const hasCompletedOnboarding = useHasCompletedOnboarding();
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);

  // Both stores must be hydrated before a redirect decision can be trusted.
  // `resolveAuthGateRedirect`'s require-guest branch routes on
  // `hasCompletedOnboarding`, which reads `false` until the onboarding store
  // finishes rehydrating. Deciding on that default would send an already-
  // onboarded user into the onboarding flow, where re-entering the business
  // profile overwrites it — and nothing re-evaluates afterwards to undo it.
  // This mirrors the two-store gate `app/index.tsx` already applies.
  if (!authHasHydrated || !onboardingHasHydrated) {
    return null;
  }

  const redirectTo = resolveAuthGateRedirect(mode, { isAuthenticated, hasCompletedOnboarding, isPasswordRecovery });
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Update `app/index.tsx`**

Replace the two onboarding-related lines. Change:

```ts
import { useOnboardingStore } from '../src/store/onboardingStore';
```

to:

```ts
import { useHasCompletedOnboarding, useOnboardingStore } from '../src/store/onboardingStore';
```

Change:

```ts
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);
```

to:

```ts
  const hasCompletedOnboarding = useHasCompletedOnboarding();
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
```

Change the redirect call from:

```ts
    router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding }));
```

to:

```ts
    router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding, isPasswordRecovery }));
```

And add `isPasswordRecovery` to the effect's dependency array (`[minDurationElapsed, storesHydrated, isAuthenticated, hasCompletedOnboarding, isPasswordRecovery]`).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 2 of the 4 pre-existing errors from Task 5 are now gone (`AuthGate.tsx`, `app/index.tsx`); `login.tsx` and `wallet-setup.tsx` still error — fixed next.

- [ ] **Step 4: Commit**

```bash
npx jest
git add src/components/AuthGate.tsx app/index.tsx
git commit -m "Route AuthGate and splash screen through per-user onboarding + recovery state"
```

---

### Task 8: Fix remaining onboarding-store call sites (`login.tsx`, `wallet-setup.tsx`)

**Files:**
- Modify: `app/(auth)/login.tsx`
- Modify: `app/(onboarding)/wallet-setup.tsx`

- [ ] **Step 1: Update `login.tsx`**

Change:

```ts
import { useOnboardingStore } from '../../src/store/onboardingStore';
```

to:

```ts
import { useHasCompletedOnboarding } from '../../src/store/onboardingStore';
```

Change:

```ts
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
```

to:

```ts
  const hasCompletedOnboarding = useHasCompletedOnboarding();
```

- [ ] **Step 2: Update `wallet-setup.tsx`**

Add an import:

```ts
import { useAuthStore } from '../../src/store/authStore';
```

Change:

```ts
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
```

to:

```ts
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);
  const userId = useAuthStore((state) => state.user?.id);
```

Change `handleComplete`:

```ts
  function handleComplete() {
    if (!isValidWalletAddress(address.trim())) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    setWalletAddress(address.trim());
    completeOnboarding();
    router.replace('/(app)/home');
  }
```

to:

```ts
  function handleComplete() {
    if (!isValidWalletAddress(address.trim())) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    if (!userId) return; // Onboarding is only reachable while authenticated.
    setWalletAddress(address.trim());
    completeOnboarding(userId);
    router.replace('/(app)/home');
  }
```

- [ ] **Step 3: Typecheck — all 4 pre-existing errors from Task 5 should now be gone**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Full suite + commit**

```bash
npx jest
git add app/\(auth\)/login.tsx app/\(onboarding\)/wallet-setup.tsx
git commit -m "Update login and wallet-setup to use per-user onboarding completion"
```

---

### Task 9: Pre-fill Display Name in onboarding from the Supabase account

**Files:**
- Modify: `app/(onboarding)/profile.tsx`

- [ ] **Step 1: Add the import and pre-fill**

Add:

```ts
import { useAuthStore } from '../../src/store/authStore';
```

Change:

```ts
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);

  const [hasMockAvatar, setHasMockAvatar] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
```

to:

```ts
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const authFullName = useAuthStore((state) => state.user?.fullName);

  const [hasMockAvatar, setHasMockAvatar] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName || authFullName || '');
```

- [ ] **Step 2: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add app/\(onboarding\)/profile.tsx
git commit -m "Pre-fill onboarding Display Name from the Supabase account's full name"
```

---

### Task 10: Centralized deep-link callback screen

**Files:**
- Create: `app/auth/callback.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create the callback screen**

```tsx
// app/auth/callback.tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { Logo } from '../../src/components/Logo';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { useHasCompletedOnboarding } from '../../src/store/onboardingStore';
import { resolveInitialRoute } from '../../src/utils/authRouting';

// The single landing point for both password-recovery and sign-up-confirmation
// deep links (see src/utils/authDeepLink.ts). Deliberately NOT inside the
// (auth) route group, so it is never subject to AuthGate's require-guest
// redirect — exchanging the code can make isAuthenticated true (a recovery
// session) before we've had a chance to route the user anywhere.
export default function AuthCallbackScreen() {
  const { colors, spacing, typography } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const exchangeAuthCode = useAuthStore((state) => state.exchangeAuthCode);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isPasswordRecovery = useAuthStore((state) => state.isPasswordRecovery);
  const hasCompletedOnboarding = useHasCompletedOnboarding();
  const [failed, setFailed] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = params.code;
    if (!code) {
      setFailed(true);
      return;
    }

    exchangeAuthCode(code).catch(() => {
      setFailed(true);
    });
  }, [params.code, exchangeAuthCode]);

  useEffect(() => {
    if (failed || !isAuthenticated) return;
    router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding, isPasswordRecovery }));
  }, [failed, isAuthenticated, hasCompletedOnboarding, isPasswordRecovery]);

  if (failed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>
          This link is no longer valid
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          It may have expired, already been used, or been opened on a different device. Request a new one from Sign
          In.
        </Text>
        <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.xl, width: '100%' }}>
          <PrimaryButton label="Back to Sign In" onPress={() => router.replace('/(auth)/welcome')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.heroSurface }]}>
      <Logo size={56} />
      <ActivityIndicator color={colors.primaryAction} style={{ marginTop: spacing.xl }} />
      <Text style={[typography.bodySmall, { color: colors.primaryAction, marginTop: spacing.md }]}>
        Finishing up...
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
```

- [ ] **Step 2: Register the route in `app/_layout.tsx`**

Change:

```tsx
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pay" />
```

to:

```tsx
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pay" />
```

- [ ] **Step 3: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add app/auth/callback.tsx app/_layout.tsx
git commit -m "Add centralized auth deep-link callback screen"
```

---

### Task 11: Reset Password screen

**Files:**
- Create: `app/(auth)/reset-password.tsx`

- [ ] **Step 1: Create the screen**

```tsx
// app/(auth)/reset-password.tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { useHasCompletedOnboarding } from '../../src/store/onboardingStore';
import { resolveInitialRoute } from '../../src/utils/authRouting';
import { isValidPassword } from '../../src/utils/validators';

export default function ResetPasswordScreen() {
  const { colors, spacing, typography } = useTheme();
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const clearPasswordRecovery = useAuthStore((state) => state.clearPasswordRecovery);
  const signOut = useAuthStore((state) => state.signOut);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const hasCompletedOnboarding = useHasCompletedOnboarding();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  async function handleSubmit() {
    const nextErrors: typeof errors = {};
    if (!isValidPassword(password)) nextErrors.password = 'Use at least 8 characters';
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isLoading) return;

    try {
      await updatePassword(password);
      clearPasswordRecovery();
      setDone(true);
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
    }
  }

  function handleContinue() {
    router.replace(resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding }));
  }

  async function handleCancel() {
    clearPasswordRecovery();
    await signOut().catch(() => {});
    router.replace('/(auth)/welcome');
  }

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>Password updated</Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            Your new password is ready to use.
          </Text>
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Continue" onPress={handleContinue} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Reset Password" onBackPress={handleCancel} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
            Choose a new password
          </Text>
          {authError ? (
            <Text style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.base }]}>
              {authError}
            </Text>
          ) : null}
          <TextField
            label="New Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="next"
          />
          <TextField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Update Password" onPress={handleSubmit} loading={isLoading} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add app/\(auth\)/reset-password.tsx
git commit -m "Add Reset Password screen"
```

---

### Task 12: Resend Confirmation + Open Email App on the Sign Up confirmation screen

**Files:**
- Modify: `app/(auth)/sign-up.tsx`

- [ ] **Step 1: Update imports and add resend/cooldown state**

**Note:** Phase 2A-1's holistic-review fix pass already added `useEffect`, `clearError`, and a mount-time `useEffect(() => { clearError(); }, [clearError]);` to this file (to stop stale errors leaking from Login). The diffs below are relative to that current state, not the original 2A-1 version — read the file first to confirm.

Change:

```ts
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
```

to:

```ts
import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
```

Change:

```ts
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';
```

to:

```ts
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

const RESEND_COOLDOWN_SECONDS = 30;
```

Add, alongside the existing `clearError` selector:

```ts
  const resendConfirmationEmail = useAuthStore((state) => state.resendConfirmationEmail);
```

Add, alongside the existing `useState`/`useEffect` declarations (keep the existing `clearError()` mount effect as-is, add this as a second, separate effect):

```ts
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);
```

- [ ] **Step 2: Add the resend and open-email-app handlers**

Add these functions, alongside `handleSubmit`:

```ts
  async function handleResend() {
    if (resendState === 'sending' || cooldown > 0) return;
    setResendState('sending');
    try {
      await resendConfirmationEmail(email.trim());
      setResendState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      cooldownTimer.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownTimer.current) clearInterval(cooldownTimer.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setResendState('idle');
    }
  }

  function handleOpenEmailApp() {
    // Best-effort only — see design doc 3.6. No reliable cross-platform
    // "open inbox" API exists without extra native config, so this silently
    // no-ops if it doesn't work on the current device.
    Linking.openURL('message://').catch(() => {});
  }
```

- [ ] **Step 3: Update the `needsConfirmation` JSX block**

Change:

```tsx
  if (needsConfirmation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Create Account" onBackPress={() => router.back()} />
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>Check your email</Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
          >
            We've sent you a confirmation link. Confirm your email, then sign in to continue.
          </Text>
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Go to Sign In" onPress={() => router.replace('/(auth)/login')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

to:

```tsx
  if (needsConfirmation) {
    const resendLabel =
      cooldown > 0
        ? `Resend available in ${cooldown}s`
        : resendState === 'sending'
          ? 'Sending...'
          : 'Resend Confirmation';

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Create Account" onBackPress={() => router.back()} />
        <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
          <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'center' }]}>Check your email</Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
          >
            We sent a confirmation link to:
          </Text>
          <Text
            style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs, textAlign: 'center' }]}
          >
            {email.trim()}
          </Text>
          <Text
            style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}
          >
            Confirm your email to finish setting up your Spero account.
          </Text>
          {resendState === 'sent' && cooldown > 0 ? (
            <Text
              style={[typography.bodySmall, { color: colors.success, marginTop: spacing.md, textAlign: 'center' }]}
            >
              Confirmation email sent. Check your inbox for a new link.
            </Text>
          ) : null}
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Open Email App" onPress={handleOpenEmailApp} />
            <SecondaryButton
              label={resendLabel}
              onPress={handleResend}
              disabled={cooldown > 0 || resendState === 'sending'}
            />
            <SecondaryButton label="Back to Sign In" onPress={() => router.replace('/(auth)/login')} />
          </View>
        </View>
      </SafeAreaView>
    );
  }
```

- [ ] **Step 4: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add app/\(auth\)/sign-up.tsx
git commit -m "Add Resend Confirmation and Open Email App to the sign-up confirmation screen"
```

---

### Task 13: Real Change Password, drop the fake Current Password field

**Files:**
- Modify: `app/(app)/profile/security.tsx`

- [ ] **Step 1: Replace the full file contents**

```tsx
// app/(app)/profile/security.tsx
import { useState } from 'react';
import { View, Text, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useSecurityStore } from '../../../src/store/securityStore';
import { useAuthStore } from '../../../src/store/authStore';
import { isValidPassword } from '../../../src/utils/validators';

export default function SecurityScreen() {
  const { colors, spacing, typography } = useTheme();
  const biometricLockEnabled = useSecurityStore((state) => state.biometricLockEnabled);
  const setBiometricLockEnabled = useSecurityStore((state) => state.setBiometricLockEnabled);
  const appLockEnabled = useSecurityStore((state) => state.appLockEnabled);
  const setAppLockEnabled = useSecurityStore((state) => state.setAppLockEnabled);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const authError = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleUpdatePassword() {
    if (!isValidPassword(newPassword)) {
      setFieldError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError('New passwords do not match');
      return;
    }
    setFieldError(undefined);
    clearError();
    setIsSaving(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password Updated', 'Your password has been changed.');
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
      // If Supabase ever requires reauthentication for this, its error copy
      // is generic ("couldn't update your password") rather than a fabricated
      // local reauth check we can't actually verify.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Security" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.caption, { color: colors.textMuted }]}>CHANGE PASSWORD</Text>
          {authError ? <Text style={[typography.bodySmall, { color: colors.error }]}>{authError}</Text> : null}
          <TextField
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            error={fieldError}
          />
          <TextField label="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <PrimaryButton label="Update Password" onPress={handleUpdatePassword} loading={isSaving} />

          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg }]}>APP SECURITY</Text>
          <ThemeAwareCard style={{ paddingVertical: 0 }}>
            <View style={[styles.row, { paddingVertical: spacing.md }]}>
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>Biometric Lock</Text>
              <Switch
                value={biometricLockEnabled}
                onValueChange={setBiometricLockEnabled}
                trackColor={{ true: colors.primaryAction, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel="Biometric Lock"
              />
            </View>
            <View style={[styles.row, { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>App Lock</Text>
              <Switch
                value={appLockEnabled}
                onValueChange={setAppLockEnabled}
                trackColor={{ true: colors.primaryAction, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel="App Lock"
              />
            </View>
          </ThemeAwareCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add app/\(app\)/profile/security.tsx
git commit -m "Wire Change Password to Supabase, drop the non-functional Current Password field"
```

---

### Task 14: Wire `resolveDisplayName` into Home and Profile

**Files:**
- Modify: `app/(app)/home.tsx`
- Modify: `app/(app)/profile/index.tsx`

- [ ] **Step 1: Update `home.tsx`**

Add an import:

```ts
import { useAuthStore } from '../../src/store/authStore';
import { resolveDisplayName } from '../../src/utils/resolveDisplayName';
```

Add, alongside the existing store selectors:

```ts
  const authUser = useAuthStore((state) => state.user);
```

Change:

```ts
  const firstName = (profile.displayName || 'there').split(' ')[0];
```

to:

```ts
  const firstName = (resolveDisplayName(profile.displayName, authUser?.fullName, authUser?.email) || 'there').split(
    ' '
  )[0];
```

- [ ] **Step 2: Update `profile/index.tsx`**

Add an import:

```ts
import { resolveDisplayName } from '../../../src/utils/resolveDisplayName';
```

Change:

```tsx
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {profile.displayName || 'Your Name'}
              </Text>
```

to:

```tsx
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {resolveDisplayName(profile.displayName, user?.fullName, user?.email) || 'Your Name'}
              </Text>
```

(`user` is already selected from `useAuthStore` in this file from Phase 2A-1 — no new selector needed.)

- [ ] **Step 3: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add app/\(app\)/home.tsx app/\(app\)/profile/index.tsx
git commit -m "Use resolveDisplayName for the Home greeting and Profile header"
```

---

### Task 15: Session-expiry banner on Welcome

**Files:**
- Modify: `app/(auth)/welcome.tsx`

- [ ] **Step 1: Update the file**

Change:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
```

to:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { useAuthStore } from '../../src/store/authStore';
```

Change:

```tsx
export default function WelcomeScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
        <WelcomeVisual />
```

to:

```tsx
export default function WelcomeScreen() {
  const { colors, spacing, typography } = useTheme();
  const sessionExpiredNotice = useAuthStore((state) => state.sessionExpiredNotice);
  const clearSessionExpiredNotice = useAuthStore((state) => state.clearSessionExpiredNotice);
  // Captured once so the banner doesn't disappear mid-render the instant the
  // effect below clears the store flag for next time.
  const [showSessionExpiredNotice] = useState(sessionExpiredNotice);

  useEffect(() => {
    if (sessionExpiredNotice) {
      clearSessionExpiredNotice();
    }
    // Intentionally runs once on mount only.
    // eslint-disable-next-line
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
        {showSessionExpiredNotice ? (
          <Text
            style={[
              typography.bodySmall,
              { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.md },
            ]}
          >
            Your session has ended. Please sign in again.
          </Text>
        ) : null}
        <WelcomeVisual />
```

- [ ] **Step 2: Typecheck + full suite, then commit**

```bash
npx tsc --noEmit && npx jest
git add app/\(auth\)/welcome.tsx
git commit -m "Show a calm one-time banner when a session ends unexpectedly"
```

---

### Task 16: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Full clean verification**

```bash
npx tsc --noEmit
npx jest --silent
```

Expected: `tsc` clean; all suites passing (19 pre-existing + `authDeepLink`, `resolveDisplayName`, `onboardingStore` = 22 suites; test count grows accordingly — do not hardcode an expected number here, count what actually runs).

- [ ] **Step 2: Manual scenario trace (code-level, no device)**

Walk through phase brief §24's matrix against the actual code (not a device) and confirm each holds:

- New account, confirmation enabled: `signUp` → `needsEmailConfirmation: true` → sign-up.tsx confirmation state → tapped link → `app/auth/callback.tsx` exchanges code → `SIGNED_IN` event → `_setSession` → `isAuthenticated: true`, `isPasswordRecovery: false` → `resolveInitialRoute` → onboarding (fresh user, never in `completedUserIds`) → `wallet-setup.tsx` calls `completeOnboarding(userId)` → Home.
- New account, confirmation disabled: `signUp` returns a session directly → `needsEmailConfirmation: false` → straight to onboarding → Home.
- Password recovery: `sendPasswordReset` → tapped link → `app/auth/callback.tsx` exchanges code → SDK's stored `redirectType: 'recovery'` fires `PASSWORD_RECOVERY` → `isPasswordRecovery: true` → `resolveInitialRoute` returns Reset Password regardless of onboarding/auth state → `updatePassword` → `clearPasswordRecovery()` → `resolveInitialRoute` now evaluates normally → Home or Onboarding.
- Existing user: `signIn` → `resolveInitialRoute` via `useHasCompletedOnboarding()` → Home (already onboarded).
- Persistent session: `getSession()` on cold start restores the Supabase-persisted session → `_setSession` → splash routes accordingly.
- Per-user onboarding: User A's `completeOnboarding(userA.id)` only adds `userA.id` to `completedUserIds`; signing out and in as User B evaluates `isOnboardingComplete(userB.id, completedUserIds)` independently — confirmed by Task 5's tests.
- Change password: `profile/security.tsx` → `updatePassword` → Supabase `updateUser` → success alert.

If any step doesn't hold against the actual code, fix it before proceeding — do not defer a real gap found here.

- [ ] **Step 3: Commit if the trace produced any fixes** (skip if Step 2 found nothing to fix)

---

## Post-plan (not plan tasks — handled by the controlling session directly)

- Final holistic review across the whole branch diff (`master..HEAD`), per established project process.
- `superpowers:finishing-a-development-branch` to merge.
- Final report in the format the phase brief's §27 requests.
- Update project memory.
- Do **not** start Phase 2B without explicit user approval.
