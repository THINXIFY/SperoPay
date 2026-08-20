# SperoPay Phase 2A-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This phase introduces the app's first real backend dependency (Supabase Auth) — treat correctness here as higher-stakes than a typical UI task; do not skip verification steps.

**Goal:** Replace mock authentication with real Supabase Auth — real sign-up/sign-in/sign-out, real session persistence and restoration, and reactive route protection — while every other subsystem (Requests, Customers, Templates, Transactions, Wallet, Business Profile, payment simulation) stays untouched on its existing local Zustand/mock architecture.

**Architecture:** Supabase's client becomes the single source of truth for session persistence (`authStore` stops being independently `persist`-wrapped). One internal action, `_setSession`, is the only code path that ever writes auth state, fed by both `getSession()` (once, on start) and `onAuthStateChange` (continuously). Route protection is a pure, TDD'd decision function (`resolveAuthGateRedirect`) wrapped by one small reactive component (`AuthGate`) used in all three top-level layouts, plus the existing splash screen's one-time redirect (also now driven by a pure function, `resolveInitialRoute`).

**Tech Stack:** React Native / Expo SDK 57 / TypeScript / Zustand / **`@supabase/supabase-js`** (new).

Design reference: `docs/superpowers/specs/2026-08-20-phase-2a1-supabase-auth-design.md`

---

### Task 1: Install dependencies, environment scaffolding, gitignore

**Files:**
- Modify: `package.json` (via install command, not hand-edited)
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Install packages**

```bash
npx expo install @supabase/supabase-js react-native-url-polyfill
```

- [ ] **Step 2: Create `.env.example`**

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- [ ] **Step 3: Update `.gitignore`**

Current relevant section:
```
# local env files
.env*.local
```

Change to:
```
# local env files
.env
.env*.local
```

(`.env.example` must NOT be ignored — it has no real secrets and needs to be committed. Only the plain `.env` line is new; `.env*.local` stays as it already was.)

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

(No code changes yet, this just confirms the install didn't break anything.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "Add Supabase client dependencies and .env scaffolding"
```

---

### Task 2: Centralized Supabase client

**Files:**
- Create: `src/lib/supabase.ts`

Depends on Task 1.

- [ ] **Step 1: Write `src/lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values, then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Supabase's token auto-refresh timer only runs while this is explicitly told the
// app is active — without this, sessions can silently fail to refresh in the
// background and appear expired the next time the app is foregrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

This is the ONLY file in the whole codebase that should ever call `createClient`. Every other file that needs Supabase imports `supabase` from here.

- [ ] **Step 2: Manually create a local `.env` (not committed) to unblock your own `npx tsc`/dev-server runs for the rest of this plan**

You will not have real Supabase credentials in this environment. Create `.env` (gitignored per Task 1) with clearly-fake placeholder values so `npx tsc --noEmit` and `npx jest` don't fail from the module-load throw:
```
EXPO_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
```
Note: `npx tsc --noEmit` does not execute code, so this file isn't strictly required for type-checking to pass, but `npx jest` DOES execute module code for any file that isn't explicitly mocked — however, Task 12's tests mock `src/lib/supabase.ts` entirely via `jest.mock(...)`, so the real module (and its throw) never actually executes during `npx jest` either. Create the placeholder `.env` anyway since a real device/simulator run (if you get to try one) would need it, and it costs nothing.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "Add centralized Supabase client with AppState-driven token refresh"
```

(Do NOT `git add .env` — it's gitignored and should show as untracked, not staged.)

---

### Task 3: Pure auth-logic utilities (TDD)

**Files:**
- Create: `src/utils/mapSupabaseUser.ts`
- Create: `src/utils/authErrors.ts`
- Create: `src/utils/authRouting.ts`
- Test: `src/utils/__tests__/mapSupabaseUser.test.ts`
- Test: `src/utils/__tests__/authErrors.test.ts`
- Test: `src/utils/__tests__/authRouting.test.ts`

Depends on Task 2 (imports `@supabase/supabase-js` types only, no client usage).

- [ ] **Step 1: Write the failing tests**

`src/utils/__tests__/mapSupabaseUser.test.ts`:
```ts
import { mapSupabaseUser } from '../mapSupabaseUser';
import type { User as SupabaseUser } from '@supabase/supabase-js';

function makeSupabaseUser(overrides: Partial<SupabaseUser> = {}): SupabaseUser {
  return {
    id: 'user-123',
    app_metadata: {},
    user_metadata: { full_name: 'Jane Doe' },
    aud: 'authenticated',
    created_at: '2026-08-20T00:00:00.000Z',
    email: 'jane@example.com',
    ...overrides,
  } as SupabaseUser;
}

describe('mapSupabaseUser', () => {
  it('maps id, full name, email, and createdAt from a Supabase user', () => {
    const result = mapSupabaseUser(makeSupabaseUser());
    expect(result).toEqual({
      id: 'user-123',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      createdAt: '2026-08-20T00:00:00.000Z',
    });
  });

  it('falls back to an empty full name when user_metadata.full_name is missing', () => {
    const result = mapSupabaseUser(makeSupabaseUser({ user_metadata: {} }));
    expect(result.fullName).toBe('');
  });

  it('falls back to an empty email when the Supabase user has none', () => {
    const result = mapSupabaseUser(makeSupabaseUser({ email: undefined }));
    expect(result.email).toBe('');
  });
});
```

`src/utils/__tests__/authErrors.test.ts`:
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
      "We couldn't connect. Check your internet connection and try again."
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

  it('handles non-Error values safely', () => {
    expect(getAuthErrorMessage('a plain string')).toBe("We couldn't sign you in right now. Please try again.");
  });
});
```

`src/utils/__tests__/authRouting.test.ts`:
```ts
import { resolveInitialRoute, resolveAuthGateRedirect } from '../authRouting';

describe('resolveInitialRoute', () => {
  it('routes to Welcome when unauthenticated', () => {
    expect(resolveInitialRoute({ isAuthenticated: false, hasCompletedOnboarding: false })).toBe('/(auth)/welcome');
    expect(resolveInitialRoute({ isAuthenticated: false, hasCompletedOnboarding: true })).toBe('/(auth)/welcome');
  });

  it('routes to onboarding when authenticated but not onboarded', () => {
    expect(resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding: false })).toBe(
      '/(onboarding)/usage-type'
    );
  });

  it('routes to Home when authenticated and onboarded', () => {
    expect(resolveInitialRoute({ isAuthenticated: true, hasCompletedOnboarding: true })).toBe('/(app)/home');
  });
});

describe('resolveAuthGateRedirect', () => {
  it('require-auth redirects to Welcome when not authenticated', () => {
    expect(resolveAuthGateRedirect('require-auth', { isAuthenticated: false, hasCompletedOnboarding: true })).toBe(
      '/(auth)/welcome'
    );
  });

  it('require-auth allows access when authenticated', () => {
    expect(
      resolveAuthGateRedirect('require-auth', { isAuthenticated: true, hasCompletedOnboarding: true })
    ).toBeNull();
  });

  it('require-guest redirects an authenticated user to onboarding or home', () => {
    expect(resolveAuthGateRedirect('require-guest', { isAuthenticated: true, hasCompletedOnboarding: false })).toBe(
      '/(onboarding)/usage-type'
    );
    expect(resolveAuthGateRedirect('require-guest', { isAuthenticated: true, hasCompletedOnboarding: true })).toBe(
      '/(app)/home'
    );
  });

  it('require-guest allows access when not authenticated', () => {
    expect(
      resolveAuthGateRedirect('require-guest', { isAuthenticated: false, hasCompletedOnboarding: false })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest mapSupabaseUser authErrors authRouting`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/utils/mapSupabaseUser.ts`**

```ts
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '../types';

export function mapSupabaseUser(supabaseUser: SupabaseUser): User {
  return {
    id: supabaseUser.id,
    fullName: (supabaseUser.user_metadata?.full_name as string | undefined) ?? '',
    email: supabaseUser.email ?? '',
    createdAt: supabaseUser.created_at,
  };
}
```

- [ ] **Step 4: Write `src/utils/authErrors.ts`**

```ts
export type AuthErrorContext = 'sign-in' | 'sign-up';

export function getAuthErrorMessage(error: unknown, context: AuthErrorContext = 'sign-in'): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

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
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return "We couldn't connect. Check your internet connection and try again.";
  }

  return context === 'sign-up'
    ? "We couldn't create your account right now. Please try again."
    : "We couldn't sign you in right now. Please try again.";
}
```

- [ ] **Step 5: Write `src/utils/authRouting.ts`**

```ts
export interface AuthRoutingState {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
}

export type AuthGateMode = 'require-auth' | 'require-guest';

export function resolveInitialRoute(state: AuthRoutingState): string {
  if (!state.isAuthenticated) return '/(auth)/welcome';
  if (!state.hasCompletedOnboarding) return '/(onboarding)/usage-type';
  return '/(app)/home';
}

export function resolveAuthGateRedirect(mode: AuthGateMode, state: AuthRoutingState): string | null {
  if (mode === 'require-auth' && !state.isAuthenticated) {
    return '/(auth)/welcome';
  }
  if (mode === 'require-guest' && state.isAuthenticated) {
    return resolveInitialRoute(state);
  }
  return null;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest mapSupabaseUser authErrors authRouting`
Expected: PASS, 20 tests total (3 + 8 + 9).

- [ ] **Step 7: Verify full suite and types**

```bash
npx tsc --noEmit
npx jest --silent
```

- [ ] **Step 8: Commit**

```bash
git add src/utils/mapSupabaseUser.ts src/utils/authErrors.ts src/utils/authRouting.ts src/utils/__tests__/mapSupabaseUser.test.ts src/utils/__tests__/authErrors.test.ts src/utils/__tests__/authRouting.test.ts
git commit -m "Add pure auth-logic utilities: user mapping, error copy, route resolution (TDD)"
```

---

### Task 4: Rewrite `authStore` as a real, Supabase-backed store

**Files:**
- Modify: `src/store/authStore.ts` (full rewrite)

Depends on Tasks 2-3. This is the most important task in the plan — the actual authentication engine.

- [ ] **Step 1: Replace the entire file**

```ts
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { User } from '../types';
import { mapSupabaseUser } from '../utils/mapSupabaseUser';
import { getAuthErrorMessage } from '../utils/authErrors';

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasHydrated: boolean;
  error: string | null;
  signUp: (fullName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  clearError: () => void;
  _setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  hasHydrated: false,
  error: null,

  signUp: async (fullName, email, password) => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
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
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ isLoading: false });
  },

  sendPasswordReset: async (email) => {
    set({ isLoading: true, error: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      set({ isLoading: false, error: getAuthErrorMessage(error, 'sign-in') });
      throw error;
    }
    set({ isLoading: false });
  },

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

/**
 * Wires the store to Supabase's actual session state: one immediate read via
 * getSession() (whatever Supabase already restored from its own persistence),
 * then a continuous subscription for the app's lifetime. Both paths funnel
 * through _setSession, so there is exactly one place that ever writes session/
 * user/isAuthenticated/hasHydrated. Call once from the root layout; the
 * returned function unsubscribes.
 */
export function initializeAuthListener(): () => void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.getState()._setSession(session);
  });

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState()._setSession(session);
  });

  return () => listener.subscription.unsubscribe();
}
```

Note this is a complete architectural replacement, not an incremental edit — the old file's `persist` wrapper, `generateId()`-based fake user, and unconditionally-succeeding mock `signIn`/`signUp` are all gone. `_password` is no longer a thing — passwords are real now and go to Supabase.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expect this to surface type errors in every file that still references the OLD `authStore` shape (`onRehydrateStorage`, old `signUp`/`signIn` positional-arg mismatches if any changed, etc.) — that's expected and exactly what Tasks 5-11 fix. Do not try to fix other files in this task; just confirm the NEW `authStore.ts` itself is internally type-correct (the remaining errors will be in `app/index.tsx`, `app/(auth)/*`, `app/(app)/profile/index.tsx` — all handled by later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/store/authStore.ts
git commit -m "Rewrite authStore as a real, Supabase-backed session store"
```

---

### Task 5: Wire the auth listener into the root layout

**Files:**
- Modify: `app/_layout.tsx`

Depends on Task 4.

- [ ] **Step 1: Add the listener wiring**

Change:
```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useTheme } from '../src/theme/useTheme';
```
to:
```tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useTheme } from '../src/theme/useTheme';
import { initializeAuthListener } from '../src/store/authStore';
```

Change:
```tsx
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }
```
to:
```tsx
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const unsubscribe = initializeAuthListener();
    return unsubscribe;
  }, []);

  if (!fontsLoaded) {
    return null;
  }
```

The rest of the file (`RootNavigator`, `GestureHandlerRootView`/`SafeAreaProvider`/`ThemeProvider` wrapping) is unchanged.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "Wire the Supabase auth listener into the root layout with cleanup"
```

---

### Task 6: `AuthGate` component, wrap the three top-level layouts

**Files:**
- Create: `src/components/AuthGate.tsx`
- Modify: `app/(auth)/_layout.tsx`
- Modify: `app/(onboarding)/_layout.tsx`
- Modify: `app/(app)/_layout.tsx`

Depends on Tasks 3-4.

- [ ] **Step 1: Write `src/components/AuthGate.tsx`**

```tsx
import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
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
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);

  if (!hasHydrated) {
    return null;
  }

  const redirectTo = resolveAuthGateRedirect(mode, { isAuthenticated, hasCompletedOnboarding });
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap `app/(auth)/_layout.tsx`**

Change:
```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
```
to:
```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AuthGate } from '../../src/components/AuthGate';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <AuthGate mode="require-guest">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AuthGate>
  );
}
```

- [ ] **Step 3: Wrap `app/(onboarding)/_layout.tsx`**

Change:
```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
```
to:
```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AuthGate } from '../../src/components/AuthGate';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <AuthGate mode="require-auth">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </AuthGate>
  );
}
```

- [ ] **Step 4: Wrap `app/(app)/_layout.tsx`**

Change:
```tsx
import { Tabs } from 'expo-router/js-tabs';
import { BottomNavigation } from '../../src/components/BottomNavigation';

export default function AppTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNavigation {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="requests" />
      <Tabs.Screen name="request-action" />
      <Tabs.Screen name="customers" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
```
to:
```tsx
import { Tabs } from 'expo-router/js-tabs';
import { BottomNavigation } from '../../src/components/BottomNavigation';
import { AuthGate } from '../../src/components/AuthGate';

export default function AppTabsLayout() {
  return (
    <AuthGate mode="require-auth">
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNavigation {...props} />}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="requests" />
        <Tabs.Screen name="request-action" />
        <Tabs.Screen name="customers" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </AuthGate>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Note: this does NOT add any new routes (`AuthGate` is a plain wrapper component, not a route), so the route tree (`(auth)`, `(onboarding)`, `(app)` and their children) is structurally unchanged — Task 13's final verification should confirm this empirically.

- [ ] **Step 6: Commit**

```bash
git add src/components/AuthGate.tsx "app/(auth)/_layout.tsx" "app/(onboarding)/_layout.tsx" "app/(app)/_layout.tsx"
git commit -m "Add reactive AuthGate route protection to all three top-level layouts"
```

---

### Task 7: Rewire the splash screen (`app/index.tsx`)

**Files:**
- Modify: `app/index.tsx`

Depends on Task 3 (uses `resolveInitialRoute`).

- [ ] **Step 1: Replace the routing logic**

Change:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { Logo } from '../src/components/Logo';
import { useAuthStore } from '../src/store/authStore';
import { useOnboardingStore } from '../src/store/onboardingStore';

const SPLASH_DURATION_MS = 1200;

export default function SplashScreen() {
  const { colors, spacing, typography } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);

  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const storesHydrated = authHasHydrated && onboardingHasHydrated;

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minDurationElapsed || !storesHydrated) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/(auth)/welcome');
    } else if (!hasCompletedOnboarding) {
      router.replace('/(onboarding)/usage-type');
    } else {
      router.replace('/(app)/home');
    }
  }, [minDurationElapsed, storesHydrated, isAuthenticated, hasCompletedOnboarding]);
```
to:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme/useTheme';
import { Logo } from '../src/components/Logo';
import { useAuthStore } from '../src/store/authStore';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { resolveInitialRoute } from '../src/utils/authRouting';

const SPLASH_DURATION_MS = 1200;

export default function SplashScreen() {
  const { colors, spacing, typography } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const onboardingHasHydrated = useOnboardingStore((state) => state.hasHydrated);

  const [minDurationElapsed, setMinDurationElapsed] = useState(false);
  const storesHydrated = authHasHydrated && onboardingHasHydrated;

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minDurationElapsed || !storesHydrated) {
      return;
    }

    router.replace(resolveInitialRoute({ isAuthenticated, hasCompletedOnboarding }));
  }, [minDurationElapsed, storesHydrated, isAuthenticated, hasCompletedOnboarding]);
```

The rest of the file (the branded splash UI JSX, `styles`) is unchanged. `authHasHydrated` now reflects real Supabase session restoration (from `authStore`'s new `hasHydrated`, set by `_setSession`) instead of zustand-persist rehydration — same variable name, same role in the gating logic, different underlying source.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "Drive splash screen routing through the pure resolveInitialRoute function"
```

---

### Task 8: Real Login

**Files:**
- Modify: `app/(auth)/login.tsx`

Depends on Task 4.

- [ ] **Step 1: Replace the entire file**

```tsx
import { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

export default function LoginScreen() {
  const { colors, spacing, typography } = useTheme();
  const signIn = useAuthStore((state) => state.signIn);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  async function handleSubmit() {
    const nextErrors: typeof errors = {};
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email';
    if (!isValidPassword(password)) nextErrors.password = 'Use at least 8 characters';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isLoading) return;

    try {
      await signIn(email.trim(), password);
      router.replace(hasCompletedOnboarding ? '/(app)/home' : '/(onboarding)/usage-type');
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Sign In" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
            Welcome back to Spero
          </Text>
          {authError ? (
            <Text style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.base }]}>
              {authError}
            </Text>
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Forgot password?</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Sign In" onPress={handleSubmit} loading={isLoading} />
      </View>
    </SafeAreaView>
  );
}
```

Key changes from the mock version: `signIn` is awaited inside a `try`/`catch` (it now genuinely rejects on bad credentials), a new `authError` selector renders `authStore.error` as a visible banner (previously this field existed but nothing ever read it), and a new "Welcome back to Spero" heading. `hasCompletedOnboarding`-based post-login routing is unchanged — onboarding stays local-only this phase.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/login.tsx"
git commit -m "Connect Login to real Supabase signInWithPassword with visible error state"
```

---

### Task 9: Real Sign Up, with the email-confirmation outcome

**Files:**
- Modify: `app/(auth)/sign-up.tsx`

Depends on Task 4.

- [ ] **Step 1: Replace the entire file**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

export default function SignUpScreen() {
  const { colors, spacing, typography } = useTheme();
  const signUp = useAuthStore((state) => state.signUp);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit() {
    const nextErrors: typeof errors = {};
    if (fullName.trim().length === 0) nextErrors.fullName = 'Enter your full name';
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email';
    if (!isValidPassword(password)) nextErrors.password = 'Use at least 8 characters';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isLoading) return;

    try {
      const { needsEmailConfirmation } = await signUp(fullName.trim(), email.trim(), password);
      if (needsEmailConfirmation) {
        setNeedsConfirmation(true);
      } else {
        router.replace('/(onboarding)/usage-type');
      }
    } catch {
      // authStore.error already holds a user-friendly message, rendered below.
    }
  }

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Create Account" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.lg }]}>
            Create your Spero account
          </Text>
          {authError ? (
            <Text style={[typography.bodySmall, { color: colors.error, marginBottom: spacing.base }]}>
              {authError}
            </Text>
          ) : null}
          <TextField
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Create Account" onPress={handleSubmit} loading={isLoading} />
      </View>
    </SafeAreaView>
  );
}
```

The `needsConfirmation` branch reuses the same "swap the form for a static confirmation message" pattern already established in `forgot-password.tsx`'s `sent` state — no new route, no new screen file.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/sign-up.tsx"
git commit -m "Connect Sign Up to real Supabase signUp, handling the email-confirmation outcome"
```

---

### Task 10: Forgot Password — real reset email, no completion flow yet

**Files:**
- Modify: `app/(auth)/forgot-password.tsx`

Depends on Task 4.

- [ ] **Step 1: Replace the entire file**

```tsx
import { useState } from 'react';
import { View, ScrollView, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail } from '../../src/utils/validators';

// Sends a real Supabase password-reset email. The full recovery completion
// flow (a working deep link back into the app + a reset-password screen) is
// deferred to Phase 2A-2 — this screen only confirms the email was sent.
export default function ForgotPasswordScreen() {
  const { colors, spacing, typography } = useTheme();
  const sendPasswordReset = useAuthStore((state) => state.sendPasswordReset);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (isLoading || sent) return;
    if (!isValidEmail(email)) {
      setError('Enter a valid email');
      return;
    }
    setError(undefined);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch {
      // Treat failures the same as success — the existing copy below is already
      // deliberately non-committal about whether an email is registered, and
      // reacting differently to an error here would leak that information.
      setSent(true);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Reset Password" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!sent}
          />
          {sent ? (
            <Text style={[typography.bodySmall, { color: colors.success, marginTop: spacing.sm }]}>
              If an account exists for that email, a reset link is on its way.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Send Reset Link" onPress={handleSubmit} loading={isLoading} disabled={sent} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/forgot-password.tsx"
git commit -m "Wire Forgot Password to Supabase's real resetPasswordForEmail"
```

---

### Task 11: Real Sign Out

**Files:**
- Modify: `app/(app)/profile/index.tsx`

Depends on Task 4.

- [ ] **Step 1: Make the sign-out handler async**

Change:
```tsx
  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          signOut();
          resetOnboarding();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  }
```
to:
```tsx
  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          resetOnboarding();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  }
```

Nothing else in this file changes — `resetOnboarding()` still runs, the explicit `router.replace('/(auth)/welcome')` still runs immediately (don't rely solely on the reactive `AuthGate` picking this up, for instant UX responsiveness — the gate is a backstop for *other* session-ending scenarios, not a replacement for this explicit navigation). Every other store (`profileStore`, `walletStore`, `customerStore`, `requestStore`, etc.) is untouched, exactly matching current behavior.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile/index.tsx"
git commit -m "Make Sign Out call the real, async Supabase signOut"
```

---

### Task 12: `authStore` tests (mocked Supabase)

**Files:**
- Test: `src/store/__tests__/authStore.test.ts`

Depends on Task 4. This is the first test file in the codebase that mocks an entire external SDK module — follow the pattern precisely.

- [ ] **Step 1: Write `src/store/__tests__/authStore.test.ts`**

```ts
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}));

import { supabase } from '../../lib/supabase';
import { useAuthStore, initializeAuthListener } from '../authStore';

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'jane@example.com',
      user_metadata: { full_name: 'Jane Doe' },
      created_at: '2026-08-20T00:00:00.000Z',
      app_metadata: {},
      aud: 'authenticated',
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    session: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasHydrated: false,
    error: null,
  });
});

describe('signIn', () => {
  it('calls signInWithPassword and clears loading/error on success', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null } as never);

    await useAuthStore.getState().signIn('jane@example.com', 'password123');

    expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
    });
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('sets a human-friendly error and rethrows on failure', async () => {
    mockedSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error('Invalid login credentials'),
    } as never);

    await expect(useAuthStore.getState().signIn('jane@example.com', 'wrong')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe('Email or password is incorrect.');
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('signUp', () => {
  it('reports needsEmailConfirmation: false when a session is returned', async () => {
    const session = makeSession();
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session, user: session.user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result).toEqual({ needsEmailConfirmation: false });
    expect(mockedSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'password123',
      options: { data: { full_name: 'Jane Doe' } },
    });
  });

  it('reports needsEmailConfirmation: true when no session is returned', async () => {
    const session = makeSession();
    mockedSupabase.auth.signUp.mockResolvedValue({ data: { session: null, user: session.user }, error: null } as never);

    const result = await useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123');

    expect(result).toEqual({ needsEmailConfirmation: true });
  });

  it('sets a human-friendly error and rethrows on failure', async () => {
    mockedSupabase.auth.signUp.mockResolvedValue({
      data: {},
      error: new Error('User already registered'),
    } as never);

    await expect(useAuthStore.getState().signUp('Jane Doe', 'jane@example.com', 'password123')).rejects.toThrow();
    expect(useAuthStore.getState().error).toBe('An account already exists with this email.');
  });
});

describe('signOut', () => {
  it('calls supabase.auth.signOut and clears loading', async () => {
    mockedSupabase.auth.signOut.mockResolvedValue({ error: null } as never);

    await useAuthStore.getState().signOut();

    expect(mockedSupabase.auth.signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

describe('_setSession', () => {
  it('populates user/isAuthenticated/hasHydrated from a session', () => {
    useAuthStore.getState()._setSession(makeSession() as never);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.hasHydrated).toBe(true);
    expect(state.user).toEqual({
      id: 'user-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      createdAt: '2026-08-20T00:00:00.000Z',
    });
  });

  it('clears user/isAuthenticated when given a null session, still marking hydrated', () => {
    useAuthStore.getState()._setSession(makeSession() as never);
    useAuthStore.getState()._setSession(null);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.hasHydrated).toBe(true);
  });
});

describe('initializeAuthListener', () => {
  it('calls _setSession from the initial getSession() resolution', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: makeSession() } } as never);
    mockedSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    } as never);

    initializeAuthListener();
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('returns an unsubscribe function that calls through to the Supabase subscription', () => {
    const unsubscribe = jest.fn();
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null } } as never);
    mockedSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    } as never);

    const cleanup = initializeAuthListener();
    cleanup();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

If any `as never` cast causes a genuine type error rather than silencing an intentionally-loose mock shape, adjust the cast (e.g. to `as any` — acceptable in test files only, never production code) rather than trying to fully replicate Supabase's real response types by hand.

- [ ] **Step 2: Run and verify**

```bash
npx jest authStore
```
Expected: PASS, 10 tests.

- [ ] **Step 3: Run the full suite**

```bash
npx tsc --noEmit
npx jest --silent
```

- [ ] **Step 4: Commit**

```bash
git add src/store/__tests__/authStore.test.ts
git commit -m "Add authStore tests with a fully mocked Supabase client"
```

---

### Task 13: Final regression check, security audit, and verification pass

**Files:** None created — this task audits and, if needed, fixes issues found across Tasks 1-12.

- [ ] **Step 1: Full `tsc`/`jest` run**

```bash
npx tsc --noEmit
npx jest
```
Expect 0 TypeScript errors. Expect all prior suites plus this phase's new ones passing — confirm the exact final count (should be 75 pre-existing + 20 from Task 3 + 10 from Task 12 = 105, but treat the actual passing count as authoritative over this estimate).

- [ ] **Step 2: Manual scenario trace (code-level, no live Supabase project, no device)**

Trace through each of the 5 scenarios from the phase brief, reading the actual final code, not just asserting it works:

1. **Fresh user:** Launch → `app/index.tsx` waits for `hasHydrated` (now true once `_setSession` first fires from `getSession()`) → not authenticated → `/(auth)/welcome`. Tap "Get Started" → `/(auth)/sign-up`. Submit → `signUp()` calls real `supabase.auth.signUp`. If a session comes back immediately (email confirmation disabled in the target Supabase project), `needsEmailConfirmation` is `false` → `router.replace('/(onboarding)/usage-type')`. Confirm `AuthGate mode="require-auth"` on `(onboarding)/_layout.tsx` doesn't block this (the auth listener's `onAuthStateChange` should have already fired `_setSession` with the new session by the time this render happens — trace whether there's a race where `AuthGate` could redirect back to Welcome before the listener catches up, and if so, whether it's a real problem or self-correcting).

2. **Existing user:** Launch → Welcome → `/(auth)/login` → `Sign In` → `signIn()` → on success, `router.replace(hasCompletedOnboarding ? '/(app)/home' : '/(onboarding)/usage-type')`.

3. **Persistent session:** Login → app "closes" (simulate by tracing what happens on a fresh cold start with a session already in AsyncStorage from Supabase's own persistence) → `app/index.tsx` waits for `hasHydrated` → `getSession()` resolves with the restored session → `isAuthenticated: true` → routes past Welcome directly.

4. **Sign out:** Profile → Sign Out → confirm → `await signOut()` (real `supabase.auth.signOut()`) → `resetOnboarding()` → `router.replace('/(auth)/welcome')`. Confirm `AuthGate mode="require-auth"` on `(app)/_layout.tsx` would ALSO catch this reactively (via the listener's `SIGNED_OUT` event) if the explicit replace were somehow skipped — confirm this doesn't cause a double-navigation problem (trace whether `router.replace` to the same route twice causes any visible issue; if genuinely uncertain, note it rather than guessing).

5. **Invalid login:** Wrong password → `signIn()` rejects → `catch` block does nothing extra (error is already on the store) → `authError` renders as a banner on `login.tsx` → no navigation occurs (confirm the `router.replace` line is genuinely unreached in this path, not just visually skipped).

6. **Email confirmation enabled:** Sign up → `needsEmailConfirmation: true` → `needsConfirmation` state flips → the form is replaced by "Check your email" copy → NO navigation into `(onboarding)` or `(app)` occurs (confirm this explicitly — the whole point of this scenario is that no false-authenticated navigation happens).

If any trace reveals a genuine bug, fix it (small, targeted fix only) before proceeding.

- [ ] **Step 3: Route-tree verification**

Run the same expo-router `getRoutes()` throwaway-script technique used at the end of prior phases (do not commit the script). Confirm the route tree is structurally IDENTICAL to before this phase — `AuthGate` is a component, not a route, so `(auth)`, `(onboarding)`, `(app)` and all their children should be byte-for-byte the same shape as the pre-phase baseline. This confirms Task 6 didn't accidentally introduce a new route or break the nested-Stack collapsing that previous phases fixed.

- [ ] **Step 4: Security audit**

- Grep the whole diff for anything that could be a hardcoded credential (`grep -rn "supabase" --include="*.ts" --include="*.tsx"` and manually confirm every match reads from `process.env.EXPO_PUBLIC_*`, never a literal URL/key string).
- Confirm `.env` is genuinely gitignored: `git check-ignore -q .env && echo IGNORED`.
- Confirm `.env` was never staged in any commit this phase: `git log --all --oneline -- .env` should be empty.
- Grep for `console.log` anywhere near password/token/session handling — confirm none of Tasks 4-12 introduced logging of `password`, `access_token`, `refresh_token`, or the full `session` object.
- Confirm no service-role key concept was ever introduced (grep for "service_role" or "service-role" — should be zero matches).

- [ ] **Step 5: Confirm Phase 1 business data is untouched**

Via `git diff <task-1-commit>^..HEAD --stat`, confirm the touched-file list matches exactly what this plan specifies — no file under `src/store/requestStore.ts`, `customerStore.ts`, `templateStore.ts`, `transactionStore.ts`, `walletStore.ts`, `profileStore.ts`, `paymentDefaultsStore.ts`, `notificationStore.ts`, `securityStore.ts`, `requestEventStore.ts`, `requestDraftStore.ts`, or `themeStore.ts`, and nothing under `app/(app)/requests/`, `app/(app)/customers/`, `app/(app)/profile/` other than `profile/index.tsx`'s one-line sign-out change, `app/request/`, or `app/pay/` should appear in the diff.

- [ ] **Step 6: Bundle export verification**

```bash
npx expo export --platform ios --output-dir .tmp-verify-2a1
```
This will fail if `.env` doesn't exist with placeholder values (per Task 2, Step 2) — confirm it's present. Grep the output bundle for `"Welcome back to Spero"`, `"Create your Spero account"`, `"Check your email"` to confirm the new auth UI strings are genuinely bundled. Delete `.tmp-verify-2a1` afterward, confirm `git status` clean.

- [ ] **Step 7: Fix anything found, final commit**

Small, targeted fixes only. If nothing needs fixing, state that explicitly and skip the commit.

```bash
git add -A
git commit -m "Phase 2A-1 final verification pass"
```
(Only if fixes were made.)

---

## Post-plan

After Task 13, do a final holistic review across the whole branch diff (base = the commit before Task 1), following the same process used at the end of every prior phase — specifically re-verify, fresh, independent of any prior task's self-report: (a) that `authStore` is genuinely the only place that ever mutates auth-related state, (b) that no credential or token is ever logged or persisted outside Supabase's own storage, (c) that the `AuthGate`/splash redirect logic can't produce a loop, and (d) that Phase 1 business data flows are provably untouched. Fix anything found, then use `superpowers:finishing-a-development-branch` to merge.

This is the first phase touching real backend infrastructure — the user needs to configure real Supabase project values before this can be tested end-to-end. Do **not** start Phase 2A-2. Wait for explicit user approval.
