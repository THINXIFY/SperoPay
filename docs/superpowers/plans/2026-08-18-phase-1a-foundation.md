# ThinxPay Phase 1A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete ThinxPay Phase 1A frontend — Splash through Share Payment — as a polished, themeable, mock-data-only Expo/TypeScript app.

**Architecture:** Expo Router file-based routes under `app/` (route groups for auth, onboarding, and the main tab app, plus a stacked `request/` modal flow), backed by typed Zustand stores persisted to AsyncStorage, styled via a `useTheme()` token system (no UI kit). See `docs/superpowers/specs/2026-08-18-phase-1a-foundation-design.md` for the full approved design.

**Tech Stack:** React Native, Expo (managed), TypeScript, Expo Router, Zustand, AsyncStorage, `@gorhom/bottom-sheet`, `react-native-qrcode-svg`, `@expo/vector-icons`, Plus Jakarta Sans (`@expo-google-fonts/plus-jakarta-sans`), `jest-expo` + `@testing-library/react-native` for logic-level TDD.

**Testing scope note:** TDD (red/green) is applied to logic-bearing code — utils and store actions — per `superpowers:test-driven-development`. Presentational screens/components are verified via `tsc --noEmit`, `expo start` runtime checks, and manual Light/Dark/small-screen passes, matching the spec's own completion criteria (spec §11–12). This is a deliberate scope decision, not a skipped step.

---

## Task 1: Project scaffolding

**Files:**
- Create: whole Expo project root (`package.json`, `app.json`, `babel.config.js`, `tsconfig.json`, `app/` entry files)

- [ ] **Step 1: Scaffold the base project**

Run in the project root (already contains `.git/` and `docs/`, no `package.json` yet):

```bash
npx create-expo-app@latest . --template blank-typescript
```

- [ ] **Step 2: Install navigation + storage + animation deps**

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install @react-native-async-storage/async-storage
npm install zustand
```

- [ ] **Step 3: Install UI/feature deps**

```bash
npx expo install @gorhom/bottom-sheet react-native-svg
npm install react-native-qrcode-svg
npx expo install expo-font expo-splash-screen expo-clipboard
npm install @expo-google-fonts/plus-jakarta-sans
```

- [ ] **Step 4: Install test tooling (devDependencies)**

```bash
npx expo install jest-expo --dev
npm install --save-dev @testing-library/react-native
```

- [ ] **Step 5: Configure `package.json` for Expo Router entry and test script**

Edit `package.json`:

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 6: Configure `app.json`**

Edit `app.json`, inside `"expo"`:

```json
{
  "scheme": "thinxpay",
  "userInterfaceStyle": "automatic",
  "plugins": [
    "expo-router",
    "expo-font"
  ]
}
```

- [ ] **Step 7: Configure `babel.config.js` for Reanimated**

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

`react-native-reanimated/plugin` must be listed last.

- [ ] **Step 8: Remove template boilerplate**

Delete the template's `App.tsx` (Expo Router uses `app/` instead) and any generated `assets/` placeholders you don't need yet (keep `icon.png`, `splash.png`, `adaptive-icon.png` — they'll be replaced by design assets later, not in Phase 1A scope).

- [ ] **Step 9: Verify the project boots**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` reports no errors (there's no `app/` yet, so this should pass trivially); `expo start` boots the dev server without crashing. Stop the dev server after confirming.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold Expo Router + TypeScript project with core dependencies"
```

---

## Task 2: Theme tokens

**Files:**
- Create: `src/theme/colors.ts`
- Create: `src/theme/spacing.ts`
- Create: `src/theme/typography.ts`
- Create: `src/theme/index.ts`

- [ ] **Step 1: Write `src/theme/colors.ts`**

```typescript
export type ThemeColors = typeof lightColors;

export const lightColors = {
  background: '#F5F6F4',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  heroSurface: '#050505',
  heroSurfaceText: '#FFFFFF',
  textPrimary: '#0A0A0A',
  textSecondary: '#707070',
  textMuted: '#A1A1A1',
  border: '#E7E7E4',
  primaryAction: '#C7F500',
  primaryActionPressed: '#B2DD00',
  primaryActionText: '#050505',
  tabBarBackground: '#050505',
  tabBarIcon: '#FFFFFF',
  tabBarIconMuted: '#8A8A8A',
  tabBarIconActive: '#C7F500',
  softMint: '#DDF7E7',
  softMintText: '#0F5132',
  softLavender: '#DDD8FF',
  softLavenderText: '#3B2E8C',
  softBlue: '#E4F3FF',
  softBlueText: '#0B4C7A',
  softRed: '#FFE8E8',
  softRedText: '#8C2222',
  success: '#22C55E',
  pending: '#F59E0B',
  error: '#EF4444',
  expired: '#D9848E',
} as const;

export const darkColors: ThemeColors = {
  background: '#050505',
  surface: '#111111',
  surfaceRaised: '#191919',
  heroSurface: '#191919',
  heroSurfaceText: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A8A8A8',
  textMuted: '#707070',
  border: '#292929',
  primaryAction: '#C7F500',
  primaryActionPressed: '#B2DD00',
  primaryActionText: '#050505',
  tabBarBackground: '#050505',
  tabBarIcon: '#FFFFFF',
  tabBarIconMuted: '#6E6E6E',
  tabBarIconActive: '#C7F500',
  softMint: '#16281E',
  softMintText: '#7FE3AA',
  softLavender: '#211D3A',
  softLavenderText: '#B7ACFF',
  softBlue: '#132330',
  softBlueText: '#8FCBFF',
  softRed: '#2E1717',
  softRedText: '#FF9E9E',
  success: '#22C55E',
  pending: '#F59E0B',
  error: '#EF4444',
  expired: '#D9848E',
};
```

- [ ] **Step 2: Write `src/theme/spacing.ts`**

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;
```

- [ ] **Step 3: Write `src/theme/typography.ts`**

```typescript
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 40, lineHeight: 46 },
  heroNumber: { fontFamily: fontFamily.extrabold, fontSize: 32, lineHeight: 38 },
  h1: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fontFamily.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 22 },
  bodySmall: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20 },
} as const;
```

- [ ] **Step 4: Write `src/theme/index.ts`**

```typescript
export * from './colors';
export * from './spacing';
export * from './typography';
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/theme
git commit -m "Add theme color, spacing, and typography tokens"
```

---

## Task 3: Theme resolution logic (TDD) + useTheme hook

**Files:**
- Test: `src/theme/__tests__/resolveThemeMode.test.ts`
- Create: `src/theme/resolveThemeMode.ts`
- Create: `src/theme/useTheme.ts`

`ThemeProvider` (which needs `useThemeStore`) is deferred to Task 13, where the store it depends on already exists — see that task for details.

- [ ] **Step 1: Write the failing test**

```typescript
// src/theme/__tests__/resolveThemeMode.test.ts
import { resolveThemeMode } from '../resolveThemeMode';

describe('resolveThemeMode', () => {
  it('defaults to light when no preference is stored', () => {
    expect(resolveThemeMode(null, 'dark')).toBe('light');
  });

  it('follows the device scheme when preference is "system"', () => {
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
  });

  it('follows the device scheme and defaults to light when scheme is null', () => {
    expect(resolveThemeMode('system', null)).toBe('light');
  });

  it('uses the explicit stored preference when set to light or dark', () => {
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/theme/__tests__/resolveThemeMode.test.ts
```

Expected: FAIL — `Cannot find module '../resolveThemeMode'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/theme/resolveThemeMode.ts
import type { ColorSchemeName } from 'react-native';

type ThemePreferenceInput = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export function resolveThemeMode(
  preference: ThemePreferenceInput | null,
  deviceScheme: ColorSchemeName
): ResolvedThemeMode {
  if (preference === null) return 'light';
  if (preference === 'system') return deviceScheme === 'dark' ? 'dark' : 'light';
  return preference;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest src/theme/__tests__/resolveThemeMode.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Write `src/theme/useTheme.ts`**

```typescript
import { createContext, useContext } from 'react';
import { lightColors, darkColors, type ThemeColors } from './colors';
import { spacing, radius } from './spacing';
import { typography } from './typography';
import type { ResolvedThemeMode } from './resolveThemeMode';

export interface ThemeContextValue {
  mode: ResolvedThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: lightColors,
  spacing,
  radius,
  typography,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export { lightColors, darkColors };
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npx jest
```

Expected: no TypeScript errors; `resolveThemeMode` suite passes (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/theme
git commit -m "Add theme resolution logic (TDD) and useTheme hook"
```

---

## Task 4: Core TypeScript types

**Files:**
- Create: `src/types/user.ts`
- Create: `src/types/customer.ts`
- Create: `src/types/payment.ts`
- Create: `src/types/preferences.ts`
- Create: `src/types/index.ts`

- [ ] **Step 1: Write `src/types/user.ts`**

```typescript
export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

export type UsageType = 'freelancer' | 'business' | 'creator' | 'personal';

export interface Profile {
  usageType: UsageType | null;
  displayName: string;
  businessName?: string;
  country: string;
  website?: string;
  avatarUri?: string;
}

export interface Wallet {
  stablecoin: 'USDC';
  network: 'Solana';
  address: string;
}
```

- [ ] **Step 2: Write `src/types/customer.ts`**

```typescript
export interface Customer {
  id: string;
  name: string;
  email: string;
  avatarColor: 'mint' | 'lavender' | 'blue' | 'red';
  totalRequests: number;
  totalAmount: number;
}
```

- [ ] **Step 3: Write `src/types/payment.ts`**

```typescript
export type PaymentRequestStatus = 'pending' | 'paid' | 'expired';

export type ExpiryOption = '1h' | '24h' | '7d' | 'never';

export interface PaymentRequest {
  id: string;
  paymentCode: string;
  amount: number;
  currency: 'USDC';
  network: 'Solana';
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  expiresAt: string | null;
  note?: string;
  status: PaymentRequestStatus;
  createdAt: string;
  paymentLink: string;
}

export interface Transaction {
  id: string;
  requestId: string;
  amount: number;
  currency: 'USDC';
  network: 'Solana';
  fromCustomerId: string;
  txHash: string;
  paidAt: string;
}

export type RequestEventType = 'created' | 'viewed' | 'paid' | 'expired';

export interface RequestEvent {
  id: string;
  requestId: string;
  type: RequestEventType;
  occurredAt: string;
}
```

- [ ] **Step 4: Write `src/types/preferences.ts`**

```typescript
export type ThemePreference = 'light' | 'dark' | 'system';

export interface NotificationPreferences {
  paymentReceived: boolean;
  requestExpiring: boolean;
  productUpdates: boolean;
}
```

- [ ] **Step 5: Write `src/types/index.ts`**

```typescript
export * from './user';
export * from './customer';
export * from './payment';
export * from './preferences';
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/types
git commit -m "Add core TypeScript data models"
```

---

## Task 5: Utility functions (TDD)

**Files:**
- Test: `src/utils/__tests__/formatCurrency.test.ts`
- Create: `src/utils/formatCurrency.ts`
- Test: `src/utils/__tests__/formatRelativeTime.test.ts`
- Create: `src/utils/formatRelativeTime.ts`
- Test: `src/utils/__tests__/ids.test.ts`
- Create: `src/utils/ids.ts`
- Test: `src/utils/__tests__/validators.test.ts`
- Create: `src/utils/validators.ts`
- Test: `src/utils/__tests__/expiry.test.ts`
- Create: `src/utils/expiry.ts`

- [ ] **Step 1: Write failing test for `formatCurrency`**

```typescript
// src/utils/__tests__/formatCurrency.test.ts
import { formatCurrency } from '../formatCurrency';

describe('formatCurrency', () => {
  it('formats with two decimals and thousands separators', () => {
    expect(formatCurrency(12540.25)).toBe('$12,540.25');
    expect(formatCurrency(750)).toBe('$750.00');
    expect(formatCurrency(0)).toBe('$0.00');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx jest src/utils/__tests__/formatCurrency.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/formatCurrency.ts`**

```typescript
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx jest src/utils/__tests__/formatCurrency.test.ts
```

Expected: PASS, 1 test.

- [ ] **Step 5: Write failing test for `formatRelativeTime`**

```typescript
// src/utils/__tests__/formatRelativeTime.test.ts
import { formatRelativeTime } from '../formatRelativeTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('shows minutes for < 1 hour', () => {
    const twoMinAgo = new Date('2026-08-18T11:58:00.000Z').toISOString();
    expect(formatRelativeTime(twoMinAgo, now)).toBe('2m ago');
  });

  it('shows hours for < 24 hours', () => {
    const oneHourAgo = new Date('2026-08-18T11:00:00.000Z').toISOString();
    expect(formatRelativeTime(oneHourAgo, now)).toBe('1h ago');
  });

  it('shows days for >= 24 hours', () => {
    const twoDaysAgo = new Date('2026-08-16T12:00:00.000Z').toISOString();
    expect(formatRelativeTime(twoDaysAgo, now)).toBe('2d ago');
  });

  it('shows "just now" for under a minute', () => {
    const fewSecondsAgo = new Date('2026-08-18T11:59:50.000Z').toISOString();
    expect(formatRelativeTime(fewSecondsAgo, now)).toBe('just now');
  });
});
```

- [ ] **Step 6: Run test, verify it fails**

```bash
npx jest src/utils/__tests__/formatRelativeTime.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement `src/utils/formatRelativeTime.ts`**

```typescript
export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(isoDate).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
```

- [ ] **Step 8: Run test, verify it passes**

```bash
npx jest src/utils/__tests__/formatRelativeTime.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 9: Write failing test for id generation**

```typescript
// src/utils/__tests__/ids.test.ts
import { generateId, generatePaymentCode } from '../ids';

describe('generateId', () => {
  it('generates a non-empty unique string each call', () => {
    const a = generateId();
    const b = generateId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe('generatePaymentCode', () => {
  it('generates a code matching the TP-XXXXX pattern', () => {
    const code = generatePaymentCode();
    expect(code).toMatch(/^TP-[A-Z0-9]{5}$/);
  });

  it('generates different codes on subsequent calls', () => {
    expect(generatePaymentCode()).not.toBe(generatePaymentCode());
  });
});
```

- [ ] **Step 10: Run test, verify it fails**

```bash
npx jest src/utils/__tests__/ids.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 11: Implement `src/utils/ids.ts`**

```typescript
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePaymentCode(): string {
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `TP-${suffix}`;
}
```

- [ ] **Step 12: Run test, verify it passes**

```bash
npx jest src/utils/__tests__/ids.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 13: Write failing test for validators**

```typescript
// src/utils/__tests__/validators.test.ts
import { isValidEmail, isValidPassword, isValidAmount, isValidWalletAddress } from '../validators';

describe('isValidEmail', () => {
  it('accepts well-formed emails', () => {
    expect(isValidEmail('john@doe.com')).toBe(true);
  });
  it('rejects malformed emails', () => {
    expect(isValidEmail('john@doe')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts passwords with at least 8 characters', () => {
    expect(isValidPassword('password123')).toBe(true);
  });
  it('rejects passwords under 8 characters', () => {
    expect(isValidPassword('short1')).toBe(false);
  });
});

describe('isValidAmount', () => {
  it('accepts positive amounts', () => {
    expect(isValidAmount(750)).toBe(true);
    expect(isValidAmount(0.5)).toBe(true);
  });
  it('rejects zero or negative amounts', () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-10)).toBe(false);
  });
});

describe('isValidWalletAddress', () => {
  it('accepts a plausible base58 Solana address', () => {
    expect(isValidWalletAddress('7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu')).toBe(true);
  });
  it('rejects addresses that are too short or contain invalid characters', () => {
    expect(isValidWalletAddress('short')).toBe(false);
    expect(isValidWalletAddress('0OIl-invalid-chars-000000000000000000000')).toBe(false);
    expect(isValidWalletAddress('')).toBe(false);
  });
});
```

- [ ] **Step 14: Run test, verify it fails**

```bash
npx jest src/utils/__tests__/validators.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 15: Implement `src/utils/validators.ts`**

```typescript
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0;
}

export function isValidWalletAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
```

- [ ] **Step 16: Run test, verify it passes**

```bash
npx jest src/utils/__tests__/validators.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 17: Write failing test for expiry calculation**

```typescript
// src/utils/__tests__/expiry.test.ts
import { calculateExpiresAt } from '../expiry';

describe('calculateExpiresAt', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('adds 1 hour for "1h"', () => {
    expect(calculateExpiresAt('1h', now)).toBe('2026-08-18T13:00:00.000Z');
  });

  it('adds 24 hours for "24h"', () => {
    expect(calculateExpiresAt('24h', now)).toBe('2026-08-19T12:00:00.000Z');
  });

  it('adds 7 days for "7d"', () => {
    expect(calculateExpiresAt('7d', now)).toBe('2026-08-25T12:00:00.000Z');
  });

  it('returns null for "never"', () => {
    expect(calculateExpiresAt('never', now)).toBeNull();
  });
});
```

- [ ] **Step 18: Run test, verify it fails**

```bash
npx jest src/utils/__tests__/expiry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 19: Implement `src/utils/expiry.ts`**

```typescript
import type { ExpiryOption } from '../types';

const HOUR_MS = 60 * 60 * 1000;

export function calculateExpiresAt(option: ExpiryOption, now: Date = new Date()): string | null {
  switch (option) {
    case '1h':
      return new Date(now.getTime() + HOUR_MS).toISOString();
    case '24h':
      return new Date(now.getTime() + 24 * HOUR_MS).toISOString();
    case '7d':
      return new Date(now.getTime() + 7 * 24 * HOUR_MS).toISOString();
    case 'never':
      return null;
  }
}
```

- [ ] **Step 20: Run test, verify it passes**

```bash
npx jest src/utils/__tests__/expiry.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 21: Run the full test suite**

```bash
npx jest
```

Expected: all suites pass (5 suites, 20 tests).

- [ ] **Step 22: Commit**

```bash
git add src/utils
git commit -m "Add currency, time, id, validator, and expiry utils (TDD)"
```

---

## Task 6: Mock data

**Files:**
- Create: `src/data/user.ts`
- Create: `src/data/customers.ts`
- Create: `src/data/requests.ts`

- [ ] **Step 1: Write `src/data/user.ts`**

```typescript
import type { User, Profile, Wallet } from '../types';

export const mockUser: User = {
  id: 'user-farhan',
  fullName: 'Farhan Z.',
  email: 'thinxify@gmail.com',
  createdAt: '2026-06-01T09:00:00.000Z',
};

export const mockProfile: Profile = {
  usageType: 'business',
  displayName: 'Farhan Z.',
  businessName: 'THINXIFY',
  country: 'United Arab Emirates',
  website: 'https://thinxify.app',
};

export const mockWallet: Wallet = {
  stablecoin: 'USDC',
  network: 'Solana',
  address: '7fUAJdStEuGbc3sM84cKRL6yYaYr3wgHKmqwn9LFTQuu',
};
```

- [ ] **Step 2: Write `src/data/customers.ts`**

```typescript
import type { Customer } from '../types';

export const mockCustomers: Customer[] = [
  {
    id: 'cust-john-doe',
    name: 'John Doe',
    email: 'john@doe.com',
    avatarColor: 'blue',
    totalRequests: 3,
    totalAmount: 2250,
  },
  {
    id: 'cust-acme-studios',
    name: 'Acme Studios',
    email: 'billing@acmestudios.com',
    avatarColor: 'mint',
    totalRequests: 5,
    totalAmount: 4560,
  },
  {
    id: 'cust-web3-labs',
    name: 'Web3 Labs',
    email: 'hello@web3labs.io',
    avatarColor: 'lavender',
    totalRequests: 2,
    totalAmount: 1200,
  },
  {
    id: 'cust-design-collective',
    name: 'Design Collective',
    email: 'pay@designcollective.co',
    avatarColor: 'red',
    totalRequests: 4,
    totalAmount: 980,
  },
  {
    id: 'cust-mike-harrison',
    name: 'Mike Harrison',
    email: 'mike@harrison.co',
    avatarColor: 'blue',
    totalRequests: 1,
    totalAmount: 750,
  },
];
```

- [ ] **Step 3: Write `src/data/requests.ts`**

```typescript
import type { PaymentRequest } from '../types';

export const mockRequests: PaymentRequest[] = [
  {
    id: 'req-1',
    paymentCode: 'TP-A82KD',
    amount: 1250,
    currency: 'USDC',
    network: 'Solana',
    description: 'Website Redesign',
    customerId: 'cust-acme-studios',
    expiryOption: '7d',
    expiresAt: '2026-08-25T10:00:00.000Z',
    status: 'paid',
    createdAt: '2026-08-18T09:58:00.000Z',
    paymentLink: 'https://pay.thinxpay.app/r/a82kd91',
  },
  {
    id: 'req-2',
    paymentCode: 'TP-B71LM',
    amount: 750,
    currency: 'USDC',
    network: 'Solana',
    description: 'Landing Page Design',
    customerId: 'cust-web3-labs',
    expiryOption: '7d',
    expiresAt: '2026-08-20T09:45:00.000Z',
    status: 'pending',
    createdAt: '2026-08-18T09:45:00.000Z',
    paymentLink: 'https://pay.thinxpay.app/r/b71lm42',
  },
  {
    id: 'req-3',
    paymentCode: 'TP-C93NP',
    amount: 320,
    currency: 'USDC',
    network: 'Solana',
    description: 'Brand Identity',
    customerId: 'cust-design-collective',
    expiryOption: '7d',
    expiresAt: '2026-05-18T09:00:00.000Z',
    status: 'expired',
    createdAt: '2026-05-11T09:00:00.000Z',
    paymentLink: 'https://pay.thinxpay.app/r/c93np18',
  },
  {
    id: 'req-4',
    paymentCode: 'TP-D64QR',
    amount: 500,
    currency: 'USDC',
    network: 'Solana',
    description: 'Consulting Session',
    customerId: 'cust-mike-harrison',
    expiryOption: '24h',
    expiresAt: '2026-08-19T08:00:00.000Z',
    status: 'pending',
    createdAt: '2026-08-18T08:00:00.000Z',
    paymentLink: 'https://pay.thinxpay.app/r/d64qr77',
  },
  {
    id: 'req-5',
    paymentCode: 'TP-E15ST',
    amount: 2000,
    currency: 'USDC',
    network: 'Solana',
    description: 'Q3 Retainer',
    customerId: 'cust-john-doe',
    expiryOption: 'never',
    expiresAt: null,
    status: 'paid',
    createdAt: '2026-08-17T08:26:00.000Z',
    paymentLink: 'https://pay.thinxpay.app/r/e15st63',
  },
  {
    id: 'req-6',
    paymentCode: 'TP-F26UV',
    amount: 150,
    currency: 'USDC',
    network: 'Solana',
    description: 'Logo Revisions',
    customerId: 'cust-john-doe',
    expiryOption: '7d',
    expiresAt: '2026-08-24T07:10:00.000Z',
    status: 'paid',
    createdAt: '2026-08-17T07:10:00.000Z',
    paymentLink: 'https://pay.thinxpay.app/r/f26uv29',
  },
];
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "Add mock user, customer, and payment request data"
```

---

## Task 7: `buildPaymentRequest` pure builder (TDD)

**Files:**
- Test: `src/utils/__tests__/buildPaymentRequest.test.ts`
- Create: `src/utils/buildPaymentRequest.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/__tests__/buildPaymentRequest.test.ts
import { buildPaymentRequest } from '../buildPaymentRequest';

describe('buildPaymentRequest', () => {
  const now = new Date('2026-08-18T12:00:00.000Z');

  it('builds a pending request with computed fields', () => {
    const request = buildPaymentRequest(
      {
        amount: 750,
        description: 'Website design service',
        customerId: 'cust-john-doe',
        expiryOption: '7d',
        note: 'Thank you for your business!',
      },
      now
    );

    expect(request.amount).toBe(750);
    expect(request.currency).toBe('USDC');
    expect(request.network).toBe('Solana');
    expect(request.description).toBe('Website design service');
    expect(request.customerId).toBe('cust-john-doe');
    expect(request.note).toBe('Thank you for your business!');
    expect(request.status).toBe('pending');
    expect(request.createdAt).toBe(now.toISOString());
    expect(request.expiresAt).toBe('2026-08-25T12:00:00.000Z');
    expect(request.paymentCode).toMatch(/^TP-[A-Z0-9]{5}$/);
    expect(request.paymentLink).toBe(`https://pay.thinxpay.app/r/${request.id}`);
    expect(request.id.length).toBeGreaterThan(0);
  });

  it('supports "never" expiry and omits optional fields', () => {
    const request = buildPaymentRequest(
      { amount: 320, expiryOption: 'never' },
      now
    );

    expect(request.expiresAt).toBeNull();
    expect(request.description).toBeUndefined();
    expect(request.customerId).toBeUndefined();
    expect(request.note).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npx jest src/utils/__tests__/buildPaymentRequest.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/utils/buildPaymentRequest.ts`**

```typescript
import type { PaymentRequest, ExpiryOption } from '../types';
import { generateId, generatePaymentCode } from './ids';
import { calculateExpiresAt } from './expiry';

export interface CreateRequestInput {
  amount: number;
  description?: string;
  customerId?: string;
  expiryOption: ExpiryOption;
  note?: string;
}

export function buildPaymentRequest(input: CreateRequestInput, now: Date = new Date()): PaymentRequest {
  const id = generateId();

  return {
    id,
    paymentCode: generatePaymentCode(),
    amount: input.amount,
    currency: 'USDC',
    network: 'Solana',
    description: input.description,
    customerId: input.customerId,
    expiryOption: input.expiryOption,
    expiresAt: calculateExpiresAt(input.expiryOption, now),
    note: input.note,
    status: 'pending',
    createdAt: now.toISOString(),
    paymentLink: `https://pay.thinxpay.app/r/${id}`,
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npx jest src/utils/__tests__/buildPaymentRequest.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils
git commit -m "Add buildPaymentRequest pure builder (TDD)"
```

---

## Task 8: Zustand stores

**Files:**
- Create: `src/store/themeStore.ts`
- Create: `src/store/authStore.ts`
- Create: `src/store/onboardingStore.ts`
- Create: `src/store/profileStore.ts`
- Create: `src/store/walletStore.ts`
- Create: `src/store/customerStore.ts`
- Create: `src/store/requestStore.ts`
- Create: `src/store/index.ts`

- [ ] **Step 1: Write `src/store/themeStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '../types';

interface ThemeState {
  preference: ThemePreference | null;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: null,
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'thinxpay/theme', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 2: Write `src/store/authStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';
import { generateId } from '../utils/ids';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => void;
}

function mockDelay(ms = 900) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      signUp: async (fullName, email, _password) => {
        set({ isLoading: true, error: null });
        await mockDelay();
        set({
          user: { id: generateId(), fullName, email, createdAt: new Date().toISOString() },
          isAuthenticated: true,
          isLoading: false,
        });
      },

      signIn: async (email, _password) => {
        set({ isLoading: true, error: null });
        await mockDelay();
        set({
          user: { id: generateId(), fullName: 'Farhan Z.', email, createdAt: new Date().toISOString() },
          isAuthenticated: true,
          isLoading: false,
        });
      },

      sendPasswordReset: async (_email) => {
        set({ isLoading: true, error: null });
        await mockDelay();
        set({ isLoading: false });
      },

      signOut: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'thinxpay/auth', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 3: Write `src/store/onboardingStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
    }),
    { name: 'thinxpay/onboarding', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 4: Write `src/store/profileStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile, UsageType } from '../types';

interface ProfileState {
  profile: Profile;
  setUsageType: (usageType: UsageType) => void;
  updateProfile: (patch: Partial<Omit<Profile, 'usageType'>>) => void;
}

const emptyProfile: Profile = {
  usageType: null,
  displayName: '',
  businessName: undefined,
  country: '',
  website: undefined,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: emptyProfile,
      setUsageType: (usageType) => set((state) => ({ profile: { ...state.profile, usageType } })),
      updateProfile: (patch) => set((state) => ({ profile: { ...state.profile, ...patch } })),
    }),
    { name: 'thinxpay/profile', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 5: Write `src/store/walletStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Wallet } from '../types';

interface WalletState {
  wallet: Wallet | null;
  setWalletAddress: (address: string) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      wallet: null,
      setWalletAddress: (address) =>
        set({ wallet: { stablecoin: 'USDC', network: 'Solana', address } }),
    }),
    { name: 'thinxpay/wallet', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 6: Write `src/store/customerStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer } from '../types';
import { mockCustomers } from '../data/customers';
import { generateId } from '../utils/ids';

interface CustomerState {
  customers: Customer[];
  addCustomer: (name: string, email: string) => Customer;
  getCustomerById: (id: string) => Customer | undefined;
}

const AVATAR_COLORS: Customer['avatarColor'][] = ['mint', 'lavender', 'blue', 'red'];

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: mockCustomers,
      addCustomer: (name, email) => {
        const customer: Customer = {
          id: generateId(),
          name,
          email,
          avatarColor: AVATAR_COLORS[get().customers.length % AVATAR_COLORS.length],
          totalRequests: 0,
          totalAmount: 0,
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return customer;
      },
      getCustomerById: (id) => get().customers.find((c) => c.id === id),
    }),
    { name: 'thinxpay/customers', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 7: Write `src/store/requestStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaymentRequest } from '../types';
import { mockRequests } from '../data/requests';
import { buildPaymentRequest, type CreateRequestInput } from '../utils/buildPaymentRequest';

interface RequestState {
  requests: PaymentRequest[];
  isCreating: boolean;
  createRequest: (input: CreateRequestInput) => Promise<PaymentRequest>;
  getRequestById: (id: string) => PaymentRequest | undefined;
}

function mockDelay(ms = 1400) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useRequestStore = create<RequestState>()(
  persist(
    (set, get) => ({
      requests: mockRequests,
      isCreating: false,
      createRequest: async (input) => {
        set({ isCreating: true });
        await mockDelay();
        const request = buildPaymentRequest(input);
        set((state) => ({ requests: [request, ...state.requests], isCreating: false }));
        return request;
      },
      getRequestById: (id) => get().requests.find((r) => r.id === id),
    }),
    { name: 'thinxpay/requests', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 8: Write `src/store/index.ts`**

```typescript
export * from './themeStore';
export * from './authStore';
export * from './onboardingStore';
export * from './profileStore';
export * from './walletStore';
export * from './customerStore';
export * from './requestStore';
```

- [ ] **Step 9: Verify**

```bash
npx tsc --noEmit
npx jest
```

Expected: no TypeScript errors; all previous test suites still pass (stores have no dedicated tests — their persisted/async nature is covered indirectly through `buildPaymentRequest` and manual verification in later tasks).

- [ ] **Step 10: Commit**

```bash
git add src/store
git commit -m "Add Zustand stores for theme, auth, onboarding, profile, wallet, customers, requests"
```

---

## Task 9: Button primitives

**Files:**
- Create: `src/components/PrimaryButton.tsx`
- Create: `src/components/SecondaryButton.tsx`
- Create: `src/components/IconButton.tsx`

- [ ] **Step 1: Write `src/components/PrimaryButton.tsx`**

```tsx
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface PrimaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function PrimaryButton({ label, onPress, disabled, loading }: PrimaryButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.primaryAction,
          borderRadius: radius.md,
          paddingVertical: spacing.base,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryActionText} />
      ) : (
        <Text style={[typography.button, { color: colors.primaryActionText }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Write `src/components/SecondaryButton.tsx`**

```tsx
import React from 'react';
import { Pressable, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface SecondaryButtonProps {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
}

export function SecondaryButton({ label, onPress, disabled }: SecondaryButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: spacing.base,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[typography.button, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
```

- [ ] **Step 3: Write `src/components/IconButton.tsx`**

```tsx
import React from 'react';
import { Pressable, StyleSheet, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  onPress: (event: GestureResponderEvent) => void;
  variant?: 'default' | 'strong';
  size?: number;
  accessibilityLabel: string;
}

export function IconButton({ name, onPress, variant = 'default', size = 20, accessibilityLabel }: IconButtonProps) {
  const { colors, radius } = useTheme();
  const isStrong = variant === 'strong';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isStrong ? colors.heroSurface : colors.surface,
          borderRadius: radius.full,
          borderWidth: isStrong ? 0 : 1,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={name} size={size} color={isStrong ? colors.heroSurfaceText : colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors (these components aren't reachable from an entry point yet, but they must still typecheck standalone).

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "Add PrimaryButton, SecondaryButton, IconButton primitives"
```

---

## Task 10: Form input components

**Files:**
- Create: `src/components/TextField.tsx`
- Create: `src/components/NumericKeypad.tsx`
- Create: `src/components/AmountInput.tsx`

- [ ] **Step 1: Write `src/components/TextField.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={{ marginBottom: spacing.base }}>
      <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        style={[
          typography.body,
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: error ? colors.error : isFocused ? colors.primaryAction : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.base,
          },
          style,
        ]}
      />
      {error ? (
        <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 52, borderWidth: 1 },
});
```

- [ ] **Step 2: Write `src/components/NumericKeypad.tsx`**

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'delete'];

export function NumericKeypad({ onKeyPress, onDelete }: NumericKeypadProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={styles.grid}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => (key === 'delete' ? onDelete() : onKeyPress(key))}
          style={({ pressed }) => [styles.key, { opacity: pressed ? 0.5 : 1 }]}
        >
          {key === 'delete' ? (
            <Ionicons name="backspace-outline" size={24} color={colors.textPrimary} />
          ) : (
            <Text style={[typography.h1, { color: colors.textPrimary }]}>{key}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  key: { width: '33.33%', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
});
```

- [ ] **Step 3: Write `src/components/AmountInput.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { NumericKeypad } from './NumericKeypad';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
}

const MAX_DECIMAL_PLACES = 2;

export function AmountInput({ value, onChange }: AmountInputProps) {
  const { colors, spacing, typography } = useTheme();

  function handleKeyPress(key: string) {
    if (key === '.' && value.includes('.')) return;

    const [, decimals] = value.split('.');
    if (decimals && decimals.length >= MAX_DECIMAL_PLACES) return;

    if (value === '0' && key !== '.') {
      onChange(key);
      return;
    }

    onChange(value + key);
  }

  function handleDelete() {
    onChange(value.length > 1 ? value.slice(0, -1) : '0');
  }

  return (
    <View>
      <View style={[styles.display, { marginBottom: spacing.xl }]}>
        <Text style={[typography.display, { color: colors.textPrimary }]}>${value}</Text>
      </View>
      <NumericKeypad onKeyPress={handleKeyPress} onDelete={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  display: { alignItems: 'center' },
});
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "Add TextField, NumericKeypad, AmountInput components"
```

---

## Task 11: Display components

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/CustomerAvatar.tsx`
- Create: `src/components/SectionHeader.tsx`
- Create: `src/components/ActivityRow.tsx`
- Create: `src/components/RequestCard.tsx`

- [ ] **Step 1: Write `src/components/StatusBadge.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { PaymentRequestStatus } from '../types';

const LABELS: Record<PaymentRequestStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  expired: 'Expired',
};

const COLOR_KEYS: Record<PaymentRequestStatus, 'pending' | 'success' | 'expired'> = {
  pending: 'pending',
  paid: 'success',
  expired: 'expired',
};

export function StatusBadge({ status }: { status: PaymentRequestStatus }) {
  const { colors, spacing, radius, typography } = useTheme();
  const color = colors[COLOR_KEYS[status]];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: `${color}26`,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs / 2,
        },
      ]}
    >
      <Text style={[typography.caption, { color }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
});
```

- [ ] **Step 2: Write `src/components/CustomerAvatar.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Customer } from '../types';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function CustomerAvatar({ name, color, size = 44 }: { name: string; color: Customer['avatarColor']; size?: number }) {
  const { colors, radius, typography } = useTheme();
  const bg = colors[`soft${capitalize(color)}` as keyof typeof colors] as string;
  const text = colors[`soft${capitalize(color)}Text` as keyof typeof colors] as string;

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.full, backgroundColor: bg },
      ]}
    >
      <Text style={[typography.caption, { color: text, fontSize: size * 0.36 }]}>{getInitials(name)}</Text>
    </View>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 3: Write `src/components/SectionHeader.tsx`**

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.row, { marginBottom: spacing.md }]}>
      <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress}>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
```

- [ ] **Step 4: Write `src/components/ActivityRow.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { CustomerAvatar } from './CustomerAvatar';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '../utils/formatCurrency';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import type { Customer, PaymentRequestStatus } from '../types';

interface ActivityRowProps {
  customerName: string;
  avatarColor: Customer['avatarColor'];
  amount: number;
  currency: string;
  status: PaymentRequestStatus;
  createdAt: string;
}

export function ActivityRow({ customerName, avatarColor, amount, currency, status, createdAt }: ActivityRowProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.row, { paddingVertical: spacing.md }]}>
      <CustomerAvatar name={customerName} color={avatarColor} />
      <View style={[styles.middle, { marginLeft: spacing.md }]}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{customerName}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{currency}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[typography.bodyMedium, { color: colors.success }]}>+{formatCurrency(amount)}</Text>
        <View style={[styles.rightMeta, { marginTop: spacing.xs }]}>
          <StatusBadge status={status} />
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs }]}>
            {formatRelativeTime(createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1 },
  right: { alignItems: 'flex-end' },
  rightMeta: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 5: Write `src/components/RequestCard.tsx`**

```tsx
import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { StatusBadge } from './StatusBadge';
import { formatCurrency } from '../utils/formatCurrency';
import type { PaymentRequestStatus } from '../types';

interface RequestCardProps {
  title: string;
  description?: string;
  amount: number;
  currency: string;
  status: PaymentRequestStatus;
  dateLabel: string;
  onPress?: () => void;
}

export function RequestCard({ title, description, amount, currency, status, dateLabel, onPress }: RequestCardProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.base,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
          {formatCurrency(amount)} {currency}
        </Text>
      </View>
      {description ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs / 2 }]}>
          {description}
        </Text>
      ) : null}
      <View style={[styles.footerRow, { marginTop: spacing.sm }]}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{dateLabel}</Text>
        <StatusBadge status={status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components
git commit -m "Add StatusBadge, CustomerAvatar, SectionHeader, ActivityRow, RequestCard"
```

---

## Task 12: Structural and state components

**Files:**
- Create: `src/components/AppHeader.tsx`
- Create: `src/components/ThemeAwareCard.tsx`
- Create: `src/components/SelectableCard.tsx`
- Create: `src/components/EmptyState.tsx`
- Create: `src/components/SkeletonLoader.tsx`
- Create: `src/components/ConfirmationModal.tsx`
- Create: `src/components/AppBottomSheet.tsx`

- [ ] **Step 1: Write `src/components/AppHeader.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { IconButton } from './IconButton';

interface AppHeaderProps {
  title: string;
  onBackPress?: () => void;
  rightIcon?: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  onRightPress?: () => void;
}

export function AppHeader({ title, onBackPress, rightIcon, onRightPress }: AppHeaderProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.base, paddingVertical: spacing.md }]}>
      <View style={styles.side}>
        {onBackPress ? (
          <IconButton name="chevron-back" onPress={onBackPress} accessibilityLabel="Go back" />
        ) : null}
      </View>
      <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
      <View style={[styles.side, styles.sideRight]}>
        {rightIcon && onRightPress ? (
          <IconButton name={rightIcon} onPress={onRightPress} accessibilityLabel={`${title} action`} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 40, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
});
```

- [ ] **Step 2: Write `src/components/ThemeAwareCard.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface ThemeAwareCardProps extends ViewProps {
  variant?: 'surface' | 'hero';
}

export function ThemeAwareCard({ variant = 'surface', style, children, ...rest }: ThemeAwareCardProps) {
  const { colors, spacing, radius } = useTheme();
  const isHero = variant === 'hero';

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: isHero ? colors.heroSurface : colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          borderWidth: isHero ? 0 : 1,
          borderColor: colors.border,
        },
        styles.shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});
```

- [ ] **Step 3: Write `src/components/SelectableCard.tsx`**

```tsx
import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface SelectableCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function SelectableCard({ icon, label, selected, onPress }: SelectableCardProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          borderRadius: radius.lg,
          padding: spacing.base,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primaryAction : colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: selected ? colors.primaryAction : colors.background, borderRadius: radius.full },
        ]}
      >
        <Ionicons name={icon} size={20} color={selected ? colors.primaryActionText : colors.textPrimary} />
      </View>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  iconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Write `src/components/EmptyState.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, { padding: spacing.xxl }]}>
      <Ionicons name={icon} size={32} color={colors.textMuted} />
      <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md }]}>{title}</Text>
      <Text
        style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}
      >
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 5: Write `src/components/SkeletonLoader.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

interface SkeletonLoaderProps {
  width: number | `${number}%`;
  height: number;
  style?: ViewStyle;
}

export function SkeletonLoader({ width, height, style }: SkeletonLoaderProps) {
  const { colors, radius } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, backgroundColor: colors.border, borderRadius: radius.sm, opacity },
        style,
      ]}
    />
  );
}
```

- [ ] **Step 6: Write `src/components/ConfirmationModal.tsx`**

```tsx
import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { padding: spacing.xl }]}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
          ]}
        >
          <Text style={[typography.h3, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
            {description}
          </Text>
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label={confirmLabel} onPress={onConfirm} />
            <SecondaryButton label={cancelLabel} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,5,5,0.5)', alignItems: 'stretch', justifyContent: 'center' },
  sheet: {},
});
```

- [ ] **Step 7: Write `src/components/AppBottomSheet.tsx`**

```tsx
import React, { forwardRef, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetProps } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/useTheme';

interface AppBottomSheetProps extends Partial<BottomSheetProps> {
  children: React.ReactNode;
}

export const AppBottomSheet = forwardRef<BottomSheet, AppBottomSheetProps>(({ children, ...rest }, ref) => {
  const { colors, spacing, radius } = useTheme();
  const snapPoints = useMemo(() => ['40%', '70%'], []);

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: colors.surface, borderRadius: radius.xl }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      )}
      {...rest}
    >
      <BottomSheetView style={[styles.content, { paddingHorizontal: spacing.base, paddingBottom: spacing.xl }]}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
});
AppBottomSheet.displayName = 'AppBottomSheet';

const styles = StyleSheet.create({
  content: { flex: 1 },
});
```

- [ ] **Step 8: Write `src/components/index.ts`**

```typescript
export * from './PrimaryButton';
export * from './SecondaryButton';
export * from './IconButton';
export * from './TextField';
export * from './NumericKeypad';
export * from './AmountInput';
export * from './StatusBadge';
export * from './CustomerAvatar';
export * from './SectionHeader';
export * from './ActivityRow';
export * from './RequestCard';
export * from './AppHeader';
export * from './ThemeAwareCard';
export * from './SelectableCard';
export * from './EmptyState';
export * from './SkeletonLoader';
export * from './ConfirmationModal';
export * from './AppBottomSheet';
```

- [ ] **Step 9: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components
git commit -m "Add AppHeader, ThemeAwareCard, SelectableCard, EmptyState, SkeletonLoader, ConfirmationModal, AppBottomSheet"
```

---

## Task 13: Root layout, fonts, and theme wiring

**Files:**
- Create: `src/theme/ThemeProvider.tsx`
- Create: `app/_layout.tsx`

- [ ] **Step 1: Write `src/theme/ThemeProvider.tsx`**

`useThemeStore` (Task 8) now exists, so `ThemeProvider` can be built and wired up in the same task where it's first consumed.

```tsx
import React, { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext } from './useTheme';
import { lightColors, darkColors } from './colors';
import { spacing, radius } from './spacing';
import { typography } from './typography';
import { resolveThemeMode } from './resolveThemeMode';
import { useThemeStore } from '../store/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useThemeStore((state) => state.preference);
  const deviceScheme = useColorScheme();

  const value = useMemo(() => {
    const mode = resolveThemeMode(preference, deviceScheme);
    return {
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      spacing,
      radius,
      typography,
    };
  }, [preference, deviceScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

- [ ] **Step 2: Write `app/_layout.tsx`**

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

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { mode, colors } = useTheme();

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. `expo start` boots; since no route files exist under `app/` besides `_layout.tsx` yet, the app will show a "no routes" screen from Expo Router — that's expected at this point and resolves once Task 14 adds `app/index.tsx`. Stop the dev server after confirming no red error screen (crash) appears.

- [ ] **Step 4: Commit**

```bash
git add src/theme/ThemeProvider.tsx app/_layout.tsx
git commit -m "Add ThemeProvider and root layout with font loading and theme wiring"
```

---

## Task 14: Splash screen with routing gate

**Files:**
- Create: `app/index.tsx`
- Create: `src/components/Logo.tsx`

- [ ] **Step 1: Write `src/components/Logo.tsx`**

A simple geometric placeholder logo built from primitives (no image assets needed), combining a "T→P" monogram with a payment-direction arrow accent in lime.

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function Logo({ size = 64 }: { size?: number }) {
  const { colors, radius } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius.lg,
          backgroundColor: colors.heroSurface,
        },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: size * 0.42, color: colors.heroSurfaceText }]}>T</Text>
      <View
        style={[
          styles.arrow,
          { width: size * 0.22, height: size * 0.22, borderRadius: radius.full, backgroundColor: colors.primaryAction },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: 'PlusJakartaSans_800ExtraBold' },
  arrow: { position: 'absolute', bottom: 6, right: 6 },
});
```

- [ ] **Step 2: Write `app/index.tsx`**

```tsx
import { useEffect } from 'react';
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
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace('/(auth)/welcome');
      } else if (!hasCompletedOnboarding) {
        router.replace('/(onboarding)/usage-type');
      } else {
        router.replace('/(app)/home');
      }
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, [isAuthenticated, hasCompletedOnboarding]);

  return (
    <View style={[styles.container, { backgroundColor: colors.heroSurface }]}>
      <Logo size={72} />
      <Text style={[typography.h1, { color: colors.heroSurfaceText, marginTop: spacing.lg }]}>ThinxPay</Text>
      <Text
        style={[
          typography.bodySmall,
          { color: colors.primaryAction, marginTop: spacing.sm, position: 'absolute', bottom: 64 },
        ]}
      >
        Request. Share. Get Paid.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. `expo start` boots to the splash screen (black hero background, "ThinxPay", tagline); after ~1.2s it attempts to navigate to `/(auth)/welcome`, which doesn't exist yet, so Expo Router shows a "Unmatched route" screen — expected until Task 15. Confirm no crash occurs before that point.

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx src/components/Logo.tsx
git commit -m "Add splash screen with auth/onboarding routing gate"
```

---

## Task 15: Welcome screen

**Files:**
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/welcome.tsx`

- [ ] **Step 1: Write `app/(auth)/_layout.tsx`**

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

- [ ] **Step 2: Write `app/(auth)/welcome.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';

export function WelcomeVisual() {
  const { colors, radius } = useTheme();

  return (
    <View style={styles.visualWrap}>
      <View
        style={[
          styles.visualCardBack,
          { backgroundColor: colors.heroSurface, borderRadius: radius.xl },
        ]}
      />
      <View
        style={[
          styles.visualCardFront,
          { backgroundColor: colors.primaryAction, borderRadius: radius.xl },
        ]}
      />
      <View
        style={[
          styles.visualDot,
          { backgroundColor: colors.surface, borderRadius: radius.full, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

export default function WelcomeScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: spacing.xl }]}>
        <WelcomeVisual />
        <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.xxl }]}>
          Stablecoin payments made simple.
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Request payments, share a link or QR code, and keep your payment activity organized.
        </Text>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Get Started" onPress={() => router.push('/(auth)/sign-up')} />
        <SecondaryButton label="I already have an account" onPress={() => router.push('/(auth)/login')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center' },
  visualWrap: { height: 220, justifyContent: 'center' },
  visualCardBack: { position: 'absolute', width: '80%', height: 140, top: 20, left: '4%', opacity: 0.9 },
  visualCardFront: { position: 'absolute', width: '70%', height: 130, top: 60, left: '16%' },
  visualDot: { position: 'absolute', width: 56, height: 56, top: 10, right: '10%', borderWidth: 1 },
});
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. `expo start` now carries the splash screen through to Welcome without an "Unmatched route" error. "Get Started" and "I already have an account" will hit unmatched routes until Task 16 — expected for now.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)"
git commit -m "Add Welcome screen"
```

---

## Task 16: Auth screens — Sign Up, Login, Forgot Password

**Files:**
- Create: `app/(auth)/sign-up.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/forgot-password.tsx`

- [ ] **Step 1: Write `app/(auth)/sign-up.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail, isValidPassword } from '../../src/utils/validators';

export default function SignUpScreen() {
  const { colors, spacing } = useTheme();
  const signUp = useAuthStore((state) => state.signUp);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  async function handleSubmit() {
    const nextErrors: typeof errors = {};
    if (fullName.trim().length === 0) nextErrors.fullName = 'Enter your full name';
    if (!isValidEmail(email)) nextErrors.email = 'Enter a valid email';
    if (!isValidPassword(password)) nextErrors.password = 'Use at least 8 characters';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || isLoading) return;

    await signUp(fullName.trim(), email.trim(), password);
    router.replace('/(onboarding)/usage-type');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Create Account" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
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

- [ ] **Step 2: Write `app/(auth)/login.tsx`**

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

    await signIn(email.trim(), password);
    router.replace(hasCompletedOnboarding ? '/(app)/home' : '/(onboarding)/usage-type');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Sign In" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
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

- [ ] **Step 3: Write `app/(auth)/forgot-password.tsx`**

```tsx
import { useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail } from '../../src/utils/validators';

export default function ForgotPasswordScreen() {
  const { colors, spacing, typography } = useTheme();
  const sendPasswordReset = useAuthStore((state) => state.sendPasswordReset);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!isValidEmail(email)) {
      setError('Enter a valid email');
      return;
    }
    setError(undefined);
    await sendPasswordReset(email.trim());
    setSent(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Reset Password" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flexGrow: 1 }}>
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
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Send Reset Link" onPress={handleSubmit} loading={isLoading} disabled={sent} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually walk Welcome → Sign Up (fill form, submit, confirm mock loading spinner then redirect toward onboarding, which 404s until Task 17 — expected) and Welcome → Login → Forgot Password.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)"
git commit -m "Add Sign Up, Login, and Forgot Password screens"
```

---

## Task 17: Onboarding Step 1 — Usage Type

**Files:**
- Create: `app/(onboarding)/_layout.tsx`
- Create: `app/(onboarding)/usage-type.tsx`

- [ ] **Step 1: Write `app/(onboarding)/_layout.tsx`**

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

- [ ] **Step 2: Write `app/(onboarding)/usage-type.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { SelectableCard } from '../../src/components/SelectableCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useProfileStore } from '../../src/store/profileStore';
import type { UsageType } from '../../src/types';

const OPTIONS: { value: UsageType; label: string; icon: 'briefcase-outline' | 'business-outline' | 'color-palette-outline' | 'person-outline' }[] = [
  { value: 'freelancer', label: 'Freelancer', icon: 'briefcase-outline' },
  { value: 'business', label: 'Business', icon: 'business-outline' },
  { value: 'creator', label: 'Creator', icon: 'color-palette-outline' },
  { value: 'personal', label: 'Personal', icon: 'person-outline' },
];

export default function UsageTypeScreen() {
  const { colors, spacing, typography } = useTheme();
  const setUsageType = useProfileStore((state) => state.setUsageType);
  const [selected, setSelected] = useState<UsageType | null>(null);

  function handleContinue() {
    if (!selected) return;
    setUsageType(selected);
    router.push('/(onboarding)/profile');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>How will you use ThinxPay?</Text>
        <View style={[styles.grid, { marginTop: spacing.xl, gap: spacing.md }]}>
          {OPTIONS.map((option) => (
            <SelectableCard
              key={option.value}
              icon={option.icon}
              label={option.label}
              selected={selected === option.value}
              onPress={() => setSelected(option.value)}
            />
          ))}
        </View>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!selected} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
```

Note: `SelectableCard`'s `card` style uses `flex: 1`; wrap each in a fixed-width `View` if a strict 2-column grid is desired. For Phase 1A, `flexWrap: 'wrap'` with each card at roughly half width is achieved by giving each `SelectableCard` instance a wrapper `View` sized `48%`:

```tsx
{OPTIONS.map((option) => (
  <View key={option.value} style={{ width: '47%' }}>
    <SelectableCard
      icon={option.icon}
      label={option.label}
      selected={selected === option.value}
      onPress={() => setSelected(option.value)}
    />
  </View>
))}
```

Use this wrapped version in the actual file (replaces the bare `.map` above).

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually confirm the four cards lay out in a 2x2 grid, selection highlights in lime, Continue is disabled until a card is selected.

- [ ] **Step 4: Commit**

```bash
git add "app/(onboarding)"
git commit -m "Add onboarding Step 1: usage type selection"
```

---

## Task 18: Onboarding Step 2 — Profile

**Files:**
- Create: `app/(onboarding)/profile.tsx`

- [ ] **Step 1: Write `app/(onboarding)/profile.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { useProfileStore } from '../../src/store/profileStore';

export default function ProfileSetupScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);

  const [hasMockAvatar, setHasMockAvatar] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [businessName, setBusinessName] = useState(profile.businessName ?? '');
  const [country, setCountry] = useState(profile.country);
  const [website, setWebsite] = useState(profile.website ?? '');
  const [error, setError] = useState<string | undefined>();

  function handleContinue() {
    if (displayName.trim().length === 0) {
      setError('Enter a display name');
      return;
    }
    updateProfile({
      displayName: displayName.trim(),
      businessName: businessName.trim() || undefined,
      country: country.trim(),
      website: website.trim() || undefined,
    });
    router.push('/(onboarding)/wallet-setup');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Your Profile" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => setHasMockAvatar((prev) => !prev)}
            style={[
              styles.avatar,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.full, marginBottom: spacing.xl },
            ]}
          >
            {hasMockAvatar ? (
              <Text style={[typography.h2, { color: colors.textPrimary }]}>
                {displayName.trim().slice(0, 1).toUpperCase() || 'F'}
              </Text>
            ) : (
              <Ionicons name="camera-outline" size={24} color={colors.textMuted} />
            )}
          </Pressable>
          <TextField label="Display Name" value={displayName} onChangeText={setDisplayName} error={error} />
          <TextField label="Business Name (Optional)" value={businessName} onChangeText={setBusinessName} />
          <TextField label="Country" value={country} onChangeText={setCountry} />
          <TextField
            label="Website (Optional)"
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Continue" onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'center' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually confirm tapping the avatar circle toggles a mock initial, form fields scroll correctly above the keyboard, Continue proceeds to `/(onboarding)/wallet-setup` (404 until Task 19 — expected).

- [ ] **Step 3: Commit**

```bash
git add "app/(onboarding)"
git commit -m "Add onboarding Step 2: profile setup"
```

---

## Task 19: Onboarding Step 3 — Wallet Setup

**Files:**
- Create: `app/(onboarding)/wallet-setup.tsx`

- [ ] **Step 1: Write `app/(onboarding)/wallet-setup.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { useWalletStore } from '../../src/store/walletStore';
import { useOnboardingStore } from '../../src/store/onboardingStore';
import { isValidWalletAddress } from '../../src/utils/validators';

export default function WalletSetupScreen() {
  const { colors, spacing, typography } = useTheme();
  const setWalletAddress = useWalletStore((state) => state.setWalletAddress);
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | undefined>();

  function handleComplete() {
    if (!isValidWalletAddress(address.trim())) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    setWalletAddress(address.trim());
    completeOnboarding();
    router.replace('/(app)/home');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Wallet Setup" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.h1, { color: colors.textPrimary }]}>Where should payments go?</Text>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.base }}>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Stablecoin</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>USDC</Text>
            </ThemeAwareCard>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>Solana</Text>
            </ThemeAwareCard>
          </View>

          <TextField
            label="Receiving Wallet Address"
            value={address}
            onChangeText={setAddress}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Enter your Solana wallet address"
          />

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.softBlue,
              borderRadius: 12,
              padding: spacing.base,
              marginTop: spacing.sm,
              gap: spacing.sm,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.softBlueText} />
            <Text style={[typography.bodySmall, { color: colors.softBlueText, flex: 1 }]}>
              ThinxPay never asks for your seed phrase or private key.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Complete Setup" onPress={handleComplete} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually walk through the full chain: Splash → Welcome → Sign Up → Usage Type → Profile → Wallet Setup → "Complete Setup" attempts `/(app)/home`, which 404s until Task 20 — expected. Confirm the security notice card renders in the soft blue accent, not full-bleed color.

- [ ] **Step 3: Commit**

```bash
git add "app/(onboarding)"
git commit -m "Add onboarding Step 3: wallet setup with validation and security notice"
```

---

## Task 20: Bottom tab navigator with elevated center Request action

**Files:**
- Create: `src/components/BottomNavigation.tsx`
- Create: `app/(app)/_layout.tsx`
- Create: `app/(app)/request-action.tsx`
- Create: `app/(app)/home.tsx` (stub, replaced in Task 21)
- Create: `app/(app)/requests/index.tsx` (stub, replaced in Task 22)
- Create: `app/(app)/customers/index.tsx` (stub, replaced in Task 23)
- Create: `app/(app)/profile/index.tsx` (stub, replaced in Task 24)

- [ ] **Step 1: Install the bottom-tabs types package**

```bash
npx expo install @react-navigation/bottom-tabs
```

- [ ] **Step 2: Write `src/components/BottomNavigation.tsx`**

```tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/useTheme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  'requests/index': 'document-text-outline',
  'customers/index': 'people-outline',
  'profile/index': 'person-outline',
};

const LABELS: Record<string, string> = {
  home: 'Home',
  'requests/index': 'Requests',
  'customers/index': 'Customers',
  'profile/index': 'Profile',
};

export function BottomNavigation({ state, navigation }: BottomTabBarProps) {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const visibleRoutes = state.routes.filter((route) => route.name !== 'request-action');
  const leftRoutes = visibleRoutes.slice(0, 2);
  const rightRoutes = visibleRoutes.slice(2);

  function renderTab(route: (typeof state.routes)[number]) {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const icon = ICONS[route.name] ?? 'ellipse-outline';

    return (
      <Pressable
        key={route.key}
        onPress={() => navigation.navigate(route.name)}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityLabel={LABELS[route.name] ?? route.name}
      >
        <Ionicons name={icon} size={22} color={isFocused ? colors.tabBarIconActive : colors.tabBarIcon} />
        <Text
          style={[
            typography.caption,
            { color: isFocused ? colors.tabBarIconActive : colors.tabBarIconMuted, marginTop: spacing.xs / 2 },
          ]}
        >
          {LABELS[route.name] ?? route.name}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.tabBarBackground, paddingBottom: insets.bottom || spacing.sm },
      ]}
    >
      {leftRoutes.map(renderTab)}

      <View style={styles.centerWrap}>
        <Pressable
          onPress={() => router.push('/request/amount')}
          style={[styles.centerButton, { backgroundColor: colors.primaryAction, borderRadius: radius.full }]}
          accessibilityRole="button"
          accessibilityLabel="Request payment"
        >
          <Ionicons name="add" size={26} color={colors.primaryActionText} />
        </Pressable>
      </View>

      {rightRoutes.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 10, paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  centerWrap: { flex: 1, alignItems: 'center' },
  centerButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: -24 },
});
```

- [ ] **Step 3: Write `app/(app)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { BottomNavigation } from '../../src/components/BottomNavigation';

export default function AppTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <BottomNavigation {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="requests/index" />
      <Tabs.Screen name="request-action" />
      <Tabs.Screen name="customers/index" />
      <Tabs.Screen name="profile/index" />
    </Tabs>
  );
}
```

- [ ] **Step 4: Write `app/(app)/request-action.tsx`**

```tsx
import { Redirect } from 'expo-router';

export default function RequestActionTab() {
  return <Redirect href="/(app)/home" />;
}
```

This route is never actually navigated to under normal use — `BottomNavigation` intercepts the center button press and pushes `/request/amount` directly — but the file must exist to register the tab, and redirects safely if ever reached.

- [ ] **Step 5: Write stub screens**

```tsx
// app/(app)/home.tsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/useTheme';

export default function HomeScreen() {
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Home</Text>
      </View>
    </SafeAreaView>
  );
}
```

```tsx
// app/(app)/requests/index.tsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/useTheme';

export default function RequestsScreen() {
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Requests</Text>
      </View>
    </SafeAreaView>
  );
}
```

```tsx
// app/(app)/customers/index.tsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/useTheme';

export default function CustomersScreen() {
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Customers</Text>
      </View>
    </SafeAreaView>
  );
}
```

```tsx
// app/(app)/profile/index.tsx
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/useTheme';

export default function ProfileScreen() {
  const { colors, typography } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>Profile</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Completing onboarding now lands on a working tab bar: black background, white inactive icons, lime active icon, and an elevated lime circular button in the center that (when pressed) attempts `/request/amount` — 404 until Task 25, which is expected. Confirm all four side tabs switch correctly.

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomNavigation.tsx "app/(app)"
git commit -m "Add bottom tab navigator with elevated center Request action"
```

---

## Task 21: Home screen (full)

**Files:**
- Modify: `app/(app)/home.tsx` (replaces Task 20 stub)

- [ ] **Step 1: Replace `app/(app)/home.tsx` with the full implementation**

```tsx
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { SectionHeader } from '../../src/components/SectionHeader';
import { ActivityRow } from '../../src/components/ActivityRow';
import { useProfileStore } from '../../src/store/profileStore';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

const HERO_AMOUNT = 12540.25;
const HERO_GROWTH = '+18.6%';
const HERO_SUPPORTING = '12 payments · vs last month';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);

  const paidCount = useMemo(() => requests.filter((r) => r.status === 'paid').length, [requests]);
  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const recentActivity = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'paid')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4),
    [requests]
  );

  const firstName = (profile.displayName || 'there').split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}>
        <View style={[styles.headerRow, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.softLavender, borderRadius: radius.full }]}>
              <Text style={[typography.bodyMedium, { color: colors.softLavenderText }]}>
                {firstName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {getGreeting()}, {firstName} 👋
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Welcome back to ThinxPay</Text>
            </View>
          </View>
          <Pressable
            onPress={() => Alert.alert('Notifications', "You're all caught up.")}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ThemeAwareCard variant="hero">
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Received this month</Text>
          <View style={[styles.heroRow, { marginTop: spacing.xs }]}>
            <Text style={[typography.heroNumber, { color: colors.heroSurfaceText }]}>
              {formatCurrency(HERO_AMOUNT)}
            </Text>
            <View
              style={[
                styles.growthPill,
                { backgroundColor: `${colors.success}26`, borderRadius: radius.full, marginLeft: spacing.sm },
              ]}
            >
              <Text style={[typography.caption, { color: colors.success }]}>{HERO_GROWTH}</Text>
            </View>
          </View>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {HERO_SUPPORTING}
          </Text>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.base, gap: spacing.sm }}>
          <PrimaryButton label="Request Payment →" onPress={() => router.push('/request/amount')} />
          <SecondaryButton
            label="Send Payment →"
            onPress={() => Alert.alert('Coming soon', 'Send Payment will be available in a future update.')}
          />
        </View>

        <View style={[styles.statsRow, { marginTop: spacing.xl, gap: spacing.md }]}>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Paid</Text>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>{paidCount}</Text>
          </ThemeAwareCard>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Pending</Text>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>{pendingCount}</Text>
          </ThemeAwareCard>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader
            title="Recent Activity"
            actionLabel="View All"
            onActionPress={() => router.push('/(app)/requests')}
          />
          {recentActivity.map((request) => {
            const customer = customers.find((c) => c.id === request.customerId);
            return (
              <ActivityRow
                key={request.id}
                customerName={customer?.name ?? 'Unknown'}
                avatarColor={customer?.avatarColor ?? 'blue'}
                amount={request.amount}
                currency={request.currency}
                status={request.status}
                createdAt={request.createdAt}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'baseline' },
  growthPill: { paddingHorizontal: 8, paddingVertical: 2 },
  statsRow: { flexDirection: 'row' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually confirm: greeting reflects time of day, hero card renders in black/raised-dark with lime-tinted growth pill, Paid/Pending counts match the mock request data (Paid: 3, Pending: 2 given the Task 6 seed data), Recent Activity lists paid requests newest-first, "Request Payment →" pushes toward `/request/amount` (still 404 until Task 25).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/home.tsx"
git commit -m "Build full Home screen with hero card, stats, and recent activity"
```

---

## Task 22: Requests list screen

**Files:**
- Modify: `app/(app)/requests/index.tsx` (replaces Task 20 stub)

- [ ] **Step 1: Replace `app/(app)/requests/index.tsx` with the full implementation**

```tsx
import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import type { PaymentRequest, PaymentRequestStatus } from '../../../src/types';

type Filter = 'all' | PaymentRequestStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
];

function getDateLabel(request: PaymentRequest): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'expired') return `Expired on ${request.expiresAt ? formatDate(request.expiresAt) : formatDate(request.createdAt)}`;
  if (!request.expiresAt) return 'No expiry';

  const daysLeft = Math.ceil((new Date(request.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  return daysLeft <= 0 ? 'Expires today' : `Expires in ${daysLeft}d`;
}

export default function RequestsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const requests = useRequestStore((state) => state.requests);
  const customers = useCustomerStore((state) => state.customers);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const sorted = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filter === 'all' ? sorted : sorted.filter((r) => r.status === filter);
  }, [requests, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Requests</Text>
        <View style={[styles.filterRow, { marginTop: spacing.lg, gap: spacing.sm }]}>
          {FILTERS.map((item) => {
            const isActive = filter === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setFilter(item.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.heroSurface : colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                  },
                ]}
              >
                <Text style={[typography.bodySmall, { color: isActive ? colors.heroSurfaceText : colors.textSecondary }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="No requests yet"
            description="Requests you create will show up here."
          />
        }
        renderItem={({ item }) => {
          const customer = customers.find((c) => c.id === item.customerId);
          return (
            <RequestCard
              title={customer?.name ?? 'No customer'}
              description={item.description}
              amount={item.amount}
              currency={item.currency}
              status={item.status}
              dateLabel={getDateLabel(item)}
              onPress={() => router.push(`/(app)/requests/${item.id}`)}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row' },
  filterChip: { paddingVertical: 8, borderWidth: 1 },
});
```

- [ ] **Step 2: Write the request detail stub `app/(app)/requests/[id].tsx`**

Referenced by the card's `onPress` above. A detail/read-only view of a single request is useful but outside Phase 1A's core "Create → Share" journey; keep it a lightweight read-only view rather than leaving a dead link.

```tsx
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { formatCurrency } from '../../../src/utils/formatCurrency';

export default function RequestDetailScreen() {
  const { colors, spacing, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Request" onBackPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Request Detail" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <ThemeAwareCard variant="hero">
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {formatCurrency(request.amount)} {request.currency}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <StatusBadge status={request.status} />
          </View>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Customer</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {customer?.name ?? 'No customer'}
            </Text>
          </View>
          {request.description ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Description</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {request.description}
              </Text>
            </View>
          ) : null}
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment Link</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentLink}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually confirm filter chips switch the list correctly, cards route to a working detail screen, and the empty state appears when filtering to a status with zero matches (e.g. if you filter before any request exists in a fresh state).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/requests"
git commit -m "Build Requests list screen with status filters and detail view"
```

---

## Task 23: Customers list screen

**Files:**
- Modify: `app/(app)/customers/index.tsx` (replaces Task 20 stub)

- [ ] **Step 1: Replace `app/(app)/customers/index.tsx` with the full implementation**

```tsx
import { useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useCustomerStore } from '../../../src/store/customerStore';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidEmail } from '../../../src/utils/validators';

export default function CustomersScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);

  const sheetRef = useRef<BottomSheet>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  function handleAdd() {
    if (name.trim().length === 0 || !isValidEmail(email)) {
      setError('Enter a name and valid email');
      return;
    }
    addCustomer(name.trim(), email.trim());
    setName('');
    setEmail('');
    setError(undefined);
    sheetRef.current?.close();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={[styles.headerRow, { paddingHorizontal: spacing.xl, paddingTop: spacing.md }]}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Customers</Text>
        <Pressable
          onPress={() => sheetRef.current?.expand()}
          style={[styles.addButton, { backgroundColor: colors.primaryAction, borderRadius: radius.full }]}
          accessibilityRole="button"
          accessibilityLabel="Add customer"
        >
          <Ionicons name="add" size={22} color={colors.primaryActionText} />
        </Pressable>
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.base }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <CustomerAvatar name={item.name} color={item.avatarColor} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{item.name}</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{item.email}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {item.totalRequests} {item.totalRequests === 1 ? 'Request' : 'Requests'}
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {formatCurrency(item.totalAmount)}
              </Text>
            </View>
          </View>
        )}
      />

      <AppBottomSheet ref={sheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Add Customer</Text>
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={error}
        />
        <PrimaryButton label="Add Customer" onPress={handleAdd} />
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually confirm the customer list renders the 5 mock customers, tapping "+" opens a bottom sheet that respects safe areas and the keyboard, and adding a customer prepends it to the list and closes the sheet.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/customers"
git commit -m "Build Customers list screen with add-customer bottom sheet"
```

---

## Task 24: Profile screen with functional theme switcher

**Files:**
- Modify: `app/(app)/profile/index.tsx` (replaces Task 20 stub)

- [ ] **Step 1: Replace `app/(app)/profile/index.tsx` with the full implementation**

```tsx
import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useThemeStore } from '../../../src/store/themeStore';
import type { ThemePreference } from '../../../src/types';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.row, { paddingVertical: spacing.md }]}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.md }]}>{label}</Text>
      {value ? (
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginRight: spacing.xs }]}>{value}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const sheetRef = useRef<BottomSheet>(null);

  function comingSoon(label: string) {
    Alert.alert(label, 'This will be available in a future update.');
  }

  const themeLabel = THEME_OPTIONS.find((opt) => opt.value === (preference ?? 'light'))?.label ?? 'Light';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.xl }]}>Profile</Text>

        <ThemeAwareCard>
          <View style={styles.row}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.softMint, borderRadius: radius.full },
              ]}
            >
              <Text style={[typography.h3, { color: colors.softMintText }]}>
                {(profile.displayName || 'F').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {profile.displayName || 'Your Name'}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{user?.email}</Text>
            </View>
          </View>
        </ThemeAwareCard>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.xs }]}>
          PREFERENCES
        </Text>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="color-palette-outline" label="Appearance" value={themeLabel} onPress={() => sheetRef.current?.expand()} />
          <Row icon="cash-outline" label="Currency" value="USD" onPress={() => comingSoon('Currency')} />
          <Row icon="notifications-outline" label="Notifications" value="On" onPress={() => comingSoon('Notifications')} />
          <Row icon="wallet-outline" label="Payment Defaults" value="USDC on Solana" onPress={() => comingSoon('Payment Defaults')} />
        </ThemeAwareCard>

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.xs }]}>
          ACCOUNT
        </Text>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="lock-closed-outline" label="Security" onPress={() => comingSoon('Security')} />
          <Row icon="link-outline" label="Connected Wallets" onPress={() => comingSoon('Connected Wallets')} />
          <Row icon="help-circle-outline" label="Help & Support" onPress={() => comingSoon('Help & Support')} />
        </ThemeAwareCard>
      </ScrollView>

      <AppBottomSheet ref={sheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Appearance</Text>
        {THEME_OPTIONS.map((option) => {
          const isActive = (preference ?? 'light') === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setPreference(option.value);
                sheetRef.current?.close();
              }}
              style={[styles.row, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {isActive ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          );
        })}
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Manually confirm: profile card shows the mock name/email, "Appearance" opens a bottom sheet, selecting Dark immediately re-themes the entire app (tab bar, cards, text) without a reload, selecting System follows the simulator/device's OS theme, and selecting Light returns to the default. This is the primary manual Dark Mode verification point for the whole app — walk back through Home, Requests, and Customers with Dark selected to confirm every screen re-themes correctly.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile"
git commit -m "Build Profile screen with functional Light/Dark/System theme switcher"
```

---

## Task 25: Smart Request — Amount screen

**Files:**
- Create: `src/store/requestDraftStore.ts`
- Modify: `src/store/index.ts`
- Create: `app/request/_layout.tsx`
- Create: `app/request/amount.tsx`

- [ ] **Step 1: Write `src/store/requestDraftStore.ts`**

Ephemeral (not persisted) state carrying the in-progress request across the Amount → Details → Created screens.

```typescript
import { create } from 'zustand';
import type { ExpiryOption } from '../types';

interface RequestDraftState {
  amount: string;
  description: string;
  customerId: string | undefined;
  expiryOption: ExpiryOption;
  note: string;
  lastCreatedRequestId: string | null;
  setAmount: (amount: string) => void;
  setDescription: (description: string) => void;
  setCustomerId: (customerId: string | undefined) => void;
  setExpiryOption: (option: ExpiryOption) => void;
  setNote: (note: string) => void;
  setLastCreatedRequestId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  amount: '0',
  description: '',
  customerId: undefined as string | undefined,
  expiryOption: '7d' as ExpiryOption,
  note: '',
  lastCreatedRequestId: null as string | null,
};

export const useRequestDraftStore = create<RequestDraftState>()((set) => ({
  ...initialState,
  setAmount: (amount) => set({ amount }),
  setDescription: (description) => set({ description }),
  setCustomerId: (customerId) => set({ customerId }),
  setExpiryOption: (expiryOption) => set({ expiryOption }),
  setNote: (note) => set({ note }),
  setLastCreatedRequestId: (lastCreatedRequestId) => set({ lastCreatedRequestId }),
  reset: () => set({ ...initialState }),
}));
```

- [ ] **Step 2: Add it to the store barrel**

Modify `src/store/index.ts`, add:

```typescript
export * from './requestDraftStore';
```

- [ ] **Step 3: Write `app/request/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function RequestLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="amount" />
      <Stack.Screen name="details" />
      <Stack.Screen name="created" />
    </Stack>
  );
}
```

- [ ] **Step 4: Write `app/request/amount.tsx`**

```tsx
import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { AmountInput } from '../../src/components/AmountInput';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { isValidAmount } from '../../src/utils/validators';

export default function AmountScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const amount = useRequestDraftStore((state) => state.amount);
  const setAmount = useRequestDraftStore((state) => state.setAmount);
  const reset = useRequestDraftStore((state) => state.reset);

  const stablecoinSheetRef = useRef<BottomSheet>(null);
  const networkSheetRef = useRef<BottomSheet>(null);

  function handleClose() {
    reset();
    router.back();
  }

  function handleContinue() {
    if (!isValidAmount(Number(amount))) return;
    router.push('/request/details');
  }

  const canContinue = isValidAmount(Number(amount));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Smart Request" onBackPress={handleClose} />
      <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center' }]}>
          How much do you want to request?
        </Text>

        <View style={{ marginTop: spacing.xl }}>
          <AmountInput value={amount} onChange={setAmount} />
        </View>

        <Pressable
          onPress={() => stablecoinSheetRef.current?.expand()}
          style={[
            styles.selectorRow,
            { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.base, marginTop: spacing.lg },
          ]}
        >
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>USDC</Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => networkSheetRef.current?.expand()}
          style={[
            styles.networkCard,
            { backgroundColor: colors.softMint, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.md },
          ]}
        >
          <Text style={[typography.bodyMedium, { color: colors.softMintText }]}>On Solana</Text>
          <Text style={[typography.caption, { color: colors.softMintText, marginTop: spacing.xs / 2 }]}>
            Fast · Low fees · Secure
          </Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={!canContinue} />
      </View>

      <AppBottomSheet ref={stablecoinSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Stablecoin</Text>
        <View style={[styles.optionRow, { paddingVertical: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>USDC</Text>
          <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
        </View>
      </AppBottomSheet>

      <AppBottomSheet ref={networkSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Network</Text>
        <View style={[styles.optionRow, { paddingVertical: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>Solana</Text>
          <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  selectorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, borderWidth: 1 },
  networkCard: {},
  optionRow: { flexDirection: 'row', alignItems: 'center' },
});
```

USDC and Solana are Phase 1A's only supported options (per spec §36, no multi-chain/multi-asset support), so their bottom sheets show a single, already-selected, non-interactive row — present for the "smart request" feel described in the spec without implying functionality that doesn't exist yet.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. From Home, tap "Request Payment →" — the modal now opens on the Amount screen. Confirm the keypad updates the large `$` display, decimal input is capped at 2 places, Continue is disabled at `$0`, and both bottom sheets open/close smoothly and respect Dark mode.

- [ ] **Step 6: Commit**

```bash
git add src/store "app/request"
git commit -m "Add Smart Request Amount screen with stablecoin/network bottom sheets"
```

---

## Task 26: Request Details screen

**Files:**
- Create: `app/request/details.tsx`

- [ ] **Step 1: Write `app/request/details.tsx`**

```tsx
import { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { TextField } from '../../src/components/TextField';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { CustomerAvatar } from '../../src/components/CustomerAvatar';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { isValidEmail } from '../../src/utils/validators';
import type { ExpiryOption } from '../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

export default function DetailsScreen() {
  const { colors, spacing, radius, typography } = useTheme();

  const amount = useRequestDraftStore((state) => state.amount);
  const description = useRequestDraftStore((state) => state.description);
  const setDescription = useRequestDraftStore((state) => state.setDescription);
  const customerId = useRequestDraftStore((state) => state.customerId);
  const setCustomerId = useRequestDraftStore((state) => state.setCustomerId);
  const expiryOption = useRequestDraftStore((state) => state.expiryOption);
  const setExpiryOption = useRequestDraftStore((state) => state.setExpiryOption);
  const note = useRequestDraftStore((state) => state.note);
  const setNote = useRequestDraftStore((state) => state.setNote);
  const setLastCreatedRequestId = useRequestDraftStore((state) => state.setLastCreatedRequestId);

  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const createRequest = useRequestStore((state) => state.createRequest);
  const isCreating = useRequestStore((state) => state.isCreating);

  const customerSheetRef = useRef<BottomSheet>(null);
  const expirySheetRef = useRef<BottomSheet>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerError, setNewCustomerError] = useState<string | undefined>();

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === expiryOption)?.label ?? '7 days';

  function handleSelectCustomer(id: string) {
    setCustomerId(id);
    customerSheetRef.current?.close();
  }

  function handleAddCustomer() {
    if (newCustomerName.trim().length === 0 || !isValidEmail(newCustomerEmail)) {
      setNewCustomerError('Enter a name and valid email');
      return;
    }
    const customer = addCustomer(newCustomerName.trim(), newCustomerEmail.trim());
    setCustomerId(customer.id);
    setNewCustomerName('');
    setNewCustomerEmail('');
    setNewCustomerError(undefined);
    setIsAddingCustomer(false);
    customerSheetRef.current?.close();
  }

  async function handleCreateRequest() {
    if (isCreating) return;
    const request = await createRequest({
      amount: Number(amount),
      description: description.trim() || undefined,
      customerId,
      expiryOption,
      note: note.trim() || undefined,
    });
    setLastCreatedRequestId(request.id);
    router.replace(`/request/created?id=${request.id}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Request Details" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Amount</Text>
            <View
              style={[
                styles.readonlyRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.xs },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{Number(amount).toFixed(2)}</Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>USDC</Text>
            </View>
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>On</Text>
            <View
              style={[
                styles.readonlyRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginTop: spacing.xs },
              ]}
            >
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Solana</Text>
            </View>
          </View>

          <TextField
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Website design service — May 2026"
          />

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Customer</Text>
            <Pressable
              onPress={() => customerSheetRef.current?.expand()}
              style={[
                styles.customerRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base },
              ]}
            >
              {selectedCustomer ? (
                <>
                  <CustomerAvatar name={selectedCustomer.name} color={selectedCustomer.avatarColor} size={36} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{selectedCustomer.name}</Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{selectedCustomer.email}</Text>
                  </View>
                </>
              ) : (
                <Text style={[typography.body, { color: colors.textMuted, flex: 1 }]}>Select a customer (optional)</Text>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>Expires In</Text>
            <Pressable
              onPress={() => expirySheetRef.current?.expand()}
              style={[
                styles.customerRow,
                { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}>
                {expiryLabel}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <TextField
            label="Note to Customer (Optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Thank you for your business!"
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Create Request" onPress={handleCreateRequest} loading={isCreating} />
      </View>

      {isCreating ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>Creating your request...</Text>
        </View>
      ) : null}

      <AppBottomSheet ref={customerSheetRef}>
        {isAddingCustomer ? (
          <>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Add New Customer</Text>
            <TextField label="Name" value={newCustomerName} onChangeText={setNewCustomerName} />
            <TextField
              label="Email"
              value={newCustomerEmail}
              onChangeText={setNewCustomerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              error={newCustomerError}
            />
            <PrimaryButton label="Add Customer" onPress={handleAddCustomer} />
          </>
        ) : (
          <>
            <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Customer</Text>
            {customers.map((customer) => (
              <Pressable
                key={customer.id}
                onPress={() => handleSelectCustomer(customer.id)}
                style={[styles.customerRow, { paddingVertical: spacing.sm }]}
              >
                <CustomerAvatar name={customer.name} color={customer.avatarColor} size={36} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{customer.name}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{customer.email}</Text>
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setIsAddingCustomer(true)}
              style={[styles.customerRow, { paddingVertical: spacing.md, marginTop: spacing.xs }]}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]}>
                Add new customer
              </Text>
            </Pressable>
          </>
        )}
      </AppBottomSheet>

      <AppBottomSheet ref={expirySheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Expires In</Text>
        {EXPIRY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              setExpiryOption(option.value);
              expirySheetRef.current?.close();
            }}
            style={[styles.customerRow, { paddingVertical: spacing.md }]}
          >
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
            {expiryOption === option.value ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
          </Pressable>
        ))}
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  readonlyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  customerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  overlay: { alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Walk Amount → Details: confirm the amount/network display correctly as read-only, description and note fields don't get hidden behind the keyboard, the customer sheet lists all 5 mock customers plus any added earlier, "Add new customer" flips the sheet into a form and back, the expiry sheet updates the row label, and tapping "Create Request" shows the "Creating your request..." full-screen state for ~1.4s before attempting to navigate to `/request/created` (404 until Task 27 — expected).

- [ ] **Step 3: Commit**

```bash
git add "app/request/details.tsx"
git commit -m "Add Request Details screen with customer and expiry bottom sheets"
```

---

## Task 27: Request Created + Share Payment screen

**Files:**
- Create: `src/components/QRCodeCard.tsx`
- Create: `app/request/created.tsx`

Per the reference mockup, "Request Created" and "Share Payment" are one combined screen (success state, QR card, and share actions together), not two separate screens — implemented here as a single file.

**Scope note on share actions:** the spec lists Copy Link, Share, Show QR, WhatsApp, and More as five icon actions. Since the QR is already always visible in this combined layout, and the OS-native share sheet (triggered by "Share") already surfaces a "more" affordance on both iOS and Android, a separate app-level "More" button that opens the same native share sheet would be redundant chrome. This task implements **Copy Link, Share (native share sheet), Show QR (full-screen scan view), and WhatsApp** as the four quick actions, with **Share Link** as the one primary CTA — preserving every distinct capability from the spec without duplicating the OS's own "more" affordance.

- [ ] **Step 1: Install the QR dependency's peer** (already installed in Task 1, confirm present)

```bash
npx expo install react-native-svg
```

- [ ] **Step 2: Write `src/components/QRCodeCard.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../theme/useTheme';

interface QRCodeCardProps {
  value: string;
  size?: number;
}

export function QRCodeCard({ value, size = 180 }: QRCodeCardProps) {
  const { spacing, radius } = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: spacing.base }]}>
      <QRCode value={value} size={size} color="#050505" backgroundColor="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
```

- [ ] **Step 3: Write `app/request/created.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Share, Linking, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { QRCodeCard } from '../../src/components/QRCodeCard';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

function formatExpiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry';
  const date = new Date(expiresAt);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `Expires ${dateLabel} · ${daysLeft}d`;
}

export default function CreatedScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const resetDraft = useRequestDraftStore((state) => state.reset);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  if (!request) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  function handleClose() {
    resetDraft();
    router.replace('/(app)/home');
  }

  async function handleCopyLink() {
    await Clipboard.setStringAsync(request!.paymentLink);
    Alert.alert('Copied', 'Payment link copied to clipboard.');
  }

  async function handleShare() {
    await Share.share({ message: request!.paymentLink, url: request!.paymentLink });
  }

  async function handleWhatsApp() {
    const message = `You have a payment request for ${formatCurrency(request!.amount)} USDC: ${request!.paymentLink}`;
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <View style={{ width: 40 }} />
        <IconButton name="close" onPress={handleClose} accessibilityLabel="Close" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <View
          style={[
            styles.successIcon,
            { backgroundColor: colors.primaryAction, borderRadius: radius.full, marginTop: spacing.md },
          ]}
        >
          <Ionicons name="checkmark" size={36} color={colors.primaryActionText} />
        </View>

        <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
          Request Created!
        </Text>
        <Text
          style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}
        >
          Your payment request is ready to share.
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xl },
          ]}
        >
          <Text style={[typography.heroNumber, { color: colors.textPrimary, textAlign: 'center' }]}>
            {formatCurrency(request.amount)} <Text style={typography.body}>{request.currency}</Text>
          </Text>
          {customer ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
              To {customer.name}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.lg }}>
            <QRCodeCard value={request.paymentLink} />
          </View>

          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
            Scan to Pay
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
            {formatExpiryLabel(request.expiresAt)} · {request.paymentCode}
          </Text>
        </View>

        <View style={{ width: '100%', marginTop: spacing.xl }}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            Share Payment Link
          </Text>
          <View
            style={[
              styles.linkRow,
              { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.base },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}
            >
              {request.paymentLink}
            </Text>
            <Pressable onPress={handleCopyLink} accessibilityRole="button" accessibilityLabel="Copy link">
              <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={[styles.actionsRow, { marginTop: spacing.base, gap: spacing.md }]}>
            <IconButton name="copy-outline" onPress={handleCopyLink} accessibilityLabel="Copy link" />
            <IconButton name="share-outline" onPress={handleShare} accessibilityLabel="Share" />
            <IconButton name="qr-code-outline" onPress={() => setQrModalVisible(true)} accessibilityLabel="Show QR" />
            <IconButton name="logo-whatsapp" onPress={handleWhatsApp} accessibilityLabel="Share on WhatsApp" />
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Share Link" onPress={handleShare} />
      </View>

      <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
        <Pressable
          style={[styles.qrBackdrop, { backgroundColor: 'rgba(5,5,5,0.85)' }]}
          onPress={() => setQrModalVisible(false)}
        >
          <QRCodeCard value={request.paymentLink} size={260} />
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  successIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', alignItems: 'center', borderWidth: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center' },
  qrBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx expo start
```

Expected: `tsc` passes. Complete the full flow end to end: Home → Request Payment → enter an amount → Continue → fill in Details → Create Request → confirm the "Creating your request..." state appears briefly, then the Created/Share screen renders with a scannable QR code, correct amount/customer/expiry/payment code, and working Copy Link (clipboard + confirmation alert), Share (native share sheet), Show QR (full-screen modal), and WhatsApp (opens WhatsApp or browser fallback) actions. Confirm closing (X) returns to Home and the newly created request now appears in Home's Recent Activity and the Requests list once its status is manually flipped to `paid` for testing, or at minimum appears as a new `pending` entry in the Requests list.

- [ ] **Step 5: Commit**

```bash
git add src/components/QRCodeCard.tsx "app/request/created.tsx"
git commit -m "Add Request Created + Share Payment screen with QR and share actions"
```

---

## Task 28: Final polish and verification pass

**Files:**
- Modify: `app.json` (splash/background color alignment)
- No new screens — this task is verification and small consistency fixes across the app built in Tasks 1–27.

- [ ] **Step 1: Align the native splash background with the brand**

Edit `app.json`, inside `"expo"`, add a `"splash"` block (the native Expo splash shown before `app/index.tsx`'s custom splash takes over — keep it a plain black screen so there's no flash of white before the custom splash renders):

```json
{
  "splash": {
    "backgroundColor": "#050505"
  }
}
```

- [ ] **Step 2: Run the full automated verification suite**

```bash
npx tsc --noEmit
npx jest
```

Expected: zero TypeScript errors across the entire `app/` and `src/` tree; all Task 3/5/7 test suites pass (7 suites, 26 tests total: 4 resolveThemeMode + 1 formatCurrency + 4 formatRelativeTime + 3 ids + 8 validators + 4 expiry + 2 buildPaymentRequest). Fix any failures before proceeding — do not proceed with red tests or type errors.

- [ ] **Step 3: Manual walkthrough — Light mode**

```bash
npx expo start
```

With the simulator/device in Light mode (or theme preference set to Light in Profile → Appearance), walk the entire journey and confirm against the spec's completion criteria (spec §11):

- Splash shows the black hero background, logo, "ThinxPay", and tagline, then routes correctly based on auth/onboarding state
- Welcome → Sign Up → Onboarding (Usage Type → Profile → Wallet Setup) completes without errors and lands on Home
- Home shows the black hero card, Paid/Pending stats, and Recent Activity
- Bottom nav shows black background, white inactive icons, lime active icon, and an elevated lime center button
- Home → Request Payment → Amount → Details → Create Request → Created/Share completes end to end, with the new request appearing in the Requests list
- Requests filters (All/Paid/Pending/Expired) work; Customers list and "Add Customer" bottom sheet work; Profile's Appearance switcher works

- [ ] **Step 4: Manual walkthrough — Dark mode**

In Profile → Appearance, select Dark. Repeat the same walkthrough as Step 3. Confirm every screen re-themes correctly: no hardcoded light-only colors, no illegible text (check `textMuted`/`border` contrast on dark backgrounds especially on `TextField`, `StatusBadge`, and bottom sheets), and the QR code card stays white/scannable (this is intentional — QR codes need a light background with dark modules regardless of app theme).

- [ ] **Step 5: Manual walkthrough — small screen, forms, keyboard**

Using a small-screen simulator profile (e.g. iPhone SE class device or a small Android emulator):

- Confirm Sign Up, Login, Forgot Password, onboarding Profile, and Request Details forms scroll correctly and no field is hidden behind the keyboard
- Confirm no layout overflow/clipping on any screen, especially the Amount screen's keypad and the Created screen's card
- Confirm bottom sheets respect the safe area and the home-indicator/gesture area on devices that have one

- [ ] **Step 6: Fix any issues found**

If Steps 3–5 surface issues (a missed `useTheme()` color, a field hidden by the keyboard, an overflow), fix them directly in the relevant file from the task that created it, re-run the affected verification step, and commit the fix with a message describing what was wrong (e.g. `git commit -m "Fix TextField border contrast in dark mode"`).

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "Phase 1A polish pass: align native splash background, verify Light/Dark/small-screen/forms"
```
