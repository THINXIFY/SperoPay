# SperoPay Phase 1B-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the merchant-management side of Spero — Requests search/filters/detail/timeline/reminders/cancel/create-again, Customers add/edit/detail/history, Request Templates, and a Profile/Settings hub (business profile, wallet, payment defaults, notifications, security) — on top of the existing Phase 1A architecture, frontend-only with mock/local state.

**Architecture:** Continues Phase 1A's Expo Router + Zustand + AsyncStorage-persist pattern exactly. One structural fix precedes everything else: `app/(app)/requests/`, `customers/`, and `profile/` get their own nested `Stack` layouts, so new screens nest properly instead of leaking into the bottom tab bar's route list (the "phantom tab" bug Phase 1A hit once with `requests/[id]` and patched around manually — this fixes the root cause instead of extending the patch). Customer stats (request count, amount received) are computed live from `requestStore` rather than stored as separate fields, eliminating a staleness class of bug Phase 1A's review already caught once.

**Tech Stack:** Same as Phase 1A — React Native, Expo (managed), TypeScript, Expo Router, Zustand, AsyncStorage, `@gorhom/bottom-sheet`, `@expo/vector-icons`. No new dependencies required.

**Testing scope note:** Following the same approach as Phase 1A — TDD for pure logic (the new `getCustomerStats`/`buildReminderMessage` utils), `tsc --noEmit` + `npx jest` + headless bundle export as the verification method for screens (no device/simulator available in this environment).

**Review process note:** Per the user's established preference, execution uses spec-compliance review only after each task (not the full two-stage spec+code-quality review) — see `docs/superpowers/plans/2026-08-18-phase-1a-foundation.md`'s execution history for why. Still do a final holistic review across the whole diff before merge.

---

## Task 1: Nested Stack layouts (navigation fix)

**Files:**
- Create: `app/(app)/requests/_layout.tsx`
- Create: `app/(app)/customers/_layout.tsx`
- Create: `app/(app)/profile/_layout.tsx`
- Modify: `src/components/BottomNavigation.tsx`

This must land first and be verified empirically — every other task in this plan adds a screen nested inside one of these three segments.

- [ ] **Step 1: Write `app/(app)/requests/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';

export default function RequestsLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
```

- [ ] **Step 2: Write `app/(app)/customers/_layout.tsx`** (identical shape, different function name)

```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';

export default function CustomersLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
```

- [ ] **Step 3: Write `app/(app)/profile/_layout.tsx`** (identical shape, different function name)

```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';

export default function ProfileLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
  );
}
```

- [ ] **Step 4: Verify the route tree changed as expected**

Write a throwaway script (not committed) that calls expo-router's route builder directly against the real `app/` tree — the same technique used in Phase 1A's Task 22 review to empirically confirm route hoisting. Confirm the `(app)` Tabs layout's children are now exactly `home`, `requests`, `request-action`, `customers`, `profile` (5 entries, not 6+) — i.e. `requests`/`customers`/`profile` each collapse to ONE entry now that they have their own `_layout.tsx`, instead of hoisting `requests/index` and `requests/[id]` as separate siblings.

- [ ] **Step 5: Update `src/components/BottomNavigation.tsx`**

Replace the `ICONS`/`LABELS` maps and the route-name filter to match the new collapsed route names:

```tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useTheme } from '../theme/useTheme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  requests: 'document-text-outline',
  customers: 'people-outline',
  profile: 'person-outline',
};

const LABELS: Record<string, string> = {
  home: 'Home',
  requests: 'Requests',
  customers: 'Customers',
  profile: 'Profile',
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

Note the `'requests/[id]'` exclusion from Phase 1A is gone — no longer needed since nested files don't reach this list at all anymore.

- [ ] **Step 6: Full verification**

```bash
npx tsc --noEmit
npx jest
npx expo export --platform ios --output-dir .tmp-verify-task1
```

Expected: zero tsc errors, all existing tests still pass, bundle exports cleanly. Manually confirm (via the Step 4 route-tree check) that tapping each of the 4 tabs still navigates correctly and the elevated center button still works. Delete `.tmp-verify-task1` afterward.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/requests/_layout.tsx" "app/(app)/customers/_layout.tsx" "app/(app)/profile/_layout.tsx" src/components/BottomNavigation.tsx
git commit -m "Add nested Stack layouts for requests/customers/profile tabs, fixing route-hoisting into the tab bar"
```

---

## Task 2: Type additions

**Files:**
- Modify: `src/types/payment.ts`
- Modify: `src/types/user.ts`
- Create: `src/types/template.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Modify `src/types/payment.ts`**

Change the status union and redefine the event-type union to match the actual timeline stages this phase needs:

```typescript
export type PaymentRequestStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

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

export type RequestEventType =
  | 'created'
  | 'shared'
  | 'payment_detected'
  | 'payment_confirmed'
  | 'reminder_sent'
  | 'cancelled'
  | 'expired';

export interface RequestEvent {
  id: string;
  requestId: string;
  type: RequestEventType;
  occurredAt: string;
}
```

- [ ] **Step 2: Modify `src/types/user.ts`** — add optional business fields to `Profile`

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
  businessEmail?: string;
  businessDescription?: string;
  businessLogoUri?: string;
}

export interface Wallet {
  stablecoin: 'USDC';
  network: 'Solana';
  address: string;
}
```

- [ ] **Step 3: Write `src/types/template.ts`**

```typescript
import type { ExpiryOption } from './payment';

export interface Template {
  id: string;
  name: string;
  amount: number;
  description?: string;
  expiryOption: ExpiryOption;
}
```

- [ ] **Step 4: Modify `src/types/index.ts`** — add the new barrel export

```typescript
export * from './user';
export * from './customer';
export * from './payment';
export * from './preferences';
export * from './template';
```

- [ ] **Step 5: Verify — expect real compile errors, and fix them in the SAME commit**

```bash
npx tsc --noEmit
```

Adding `'cancelled'` to `PaymentRequestStatus` will break `src/components/StatusBadge.tsx`'s two `Record<PaymentRequestStatus, ...>` maps (`LABELS` and `COLOR_KEYS`), since both are exhaustive records that must now cover 4 statuses, not 3. Fix `StatusBadge.tsx` in this same task (it's a direct, required consequence of the type change, not scope creep):

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { PaymentRequestStatus } from '../types';

const LABELS: Record<PaymentRequestStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const COLOR_KEYS: Record<PaymentRequestStatus, 'pending' | 'success' | 'expired' | 'error'> = {
  pending: 'pending',
  paid: 'success',
  expired: 'expired',
  cancelled: 'error',
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

`ActivityRow.tsx` imports `COLOR_KEYS` from `StatusBadge` too (Phase 1A wired it that way) — it will pick up the new `cancelled` entry automatically with no changes needed there, but re-run `npx tsc --noEmit` after this fix and confirm it's clean everywhere, not just in `StatusBadge.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/types src/components/StatusBadge.tsx
git commit -m "Add cancelled status, redefine RequestEventType, add business Profile fields and Template type"
```

---

## Task 3: `getCustomerStats` and `buildReminderMessage` utils (TDD)

**Files:**
- Test: `src/utils/__tests__/getCustomerStats.test.ts`
- Create: `src/utils/getCustomerStats.ts`
- Test: `src/utils/__tests__/buildReminderMessage.test.ts`
- Create: `src/utils/buildReminderMessage.ts`

### Unit 1: getCustomerStats

- [ ] **Step 1: Write the failing test**

```typescript
// src/utils/__tests__/getCustomerStats.test.ts
import { getCustomerStats } from '../getCustomerStats';
import type { PaymentRequest } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-x',
    paymentCode: 'SP-XXXXX',
    amount: 100,
    currency: 'USDC',
    network: 'Solana',
    customerId: 'cust-1',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: '2026-08-18T00:00:00.000Z',
    paymentLink: 'https://pay.speropay.app/r/req-x',
    ...overrides,
  };
}

describe('getCustomerStats', () => {
  it('sums paid requests into totalReceived, counts all requests for that customer', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 500, status: 'paid' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 250, status: 'pending' }),
      makeRequest({ id: 'r3', customerId: 'cust-2', amount: 999, status: 'paid' }),
    ];

    const stats = getCustomerStats('cust-1', requests);

    expect(stats.totalRequests).toBe(2);
    expect(stats.totalReceived).toBe(500);
    expect(stats.outstanding).toBe(250);
  });

  it('returns zeros for a customer with no requests', () => {
    const stats = getCustomerStats('cust-none', []);
    expect(stats).toEqual({ totalRequests: 0, totalReceived: 0, outstanding: 0 });
  });

  it('excludes cancelled and expired requests from outstanding', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 100, status: 'cancelled' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 200, status: 'expired' }),
      makeRequest({ id: 'r3', customerId: 'cust-1', amount: 300, status: 'pending' }),
    ];

    const stats = getCustomerStats('cust-1', requests);

    expect(stats.totalRequests).toBe(3);
    expect(stats.totalReceived).toBe(0);
    expect(stats.outstanding).toBe(300);
  });
});
```

- [ ] **Step 2: Run test, verify it fails** — `npx jest src/utils/__tests__/getCustomerStats.test.ts` — expect FAIL, module not found.

- [ ] **Step 3: Implement `src/utils/getCustomerStats.ts`**

```typescript
import type { PaymentRequest } from '../types';

export interface CustomerStats {
  totalRequests: number;
  totalReceived: number;
  outstanding: number;
}

export function getCustomerStats(customerId: string, requests: PaymentRequest[]): CustomerStats {
  const customerRequests = requests.filter((r) => r.customerId === customerId);

  const totalReceived = customerRequests
    .filter((r) => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);

  const outstanding = customerRequests
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    totalRequests: customerRequests.length,
    totalReceived,
    outstanding,
  };
}
```

- [ ] **Step 4: Run test, verify it passes** — expect PASS, 3 tests.

### Unit 2: buildReminderMessage

- [ ] **Step 5: Write the failing test**

```typescript
// src/utils/__tests__/buildReminderMessage.test.ts
import { buildReminderMessage } from '../buildReminderMessage';
import type { PaymentRequest, Customer } from '../../types';

const request: PaymentRequest = {
  id: 'req-1',
  paymentCode: 'SP-A82KD',
  amount: 750,
  currency: 'USDC',
  network: 'Solana',
  description: 'Website Development',
  customerId: 'cust-1',
  expiryOption: '7d',
  expiresAt: null,
  status: 'pending',
  createdAt: '2026-08-18T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-1',
};

const customer: Customer = {
  id: 'cust-1',
  name: 'John Doe',
  email: 'john@doe.com',
  avatarColor: 'blue',
};

describe('buildReminderMessage', () => {
  it('produces a friendly reminder referencing the customer first name, amount, description, and Spero', () => {
    const message = buildReminderMessage(request, customer);

    expect(message).toContain('Hi John,');
    expect(message).toContain('750 USDC');
    expect(message).toContain('Website Development');
    expect(message).toContain('Spero');
    expect(message).toContain(request.paymentLink);
  });

  it('falls back to a generic greeting when there is no customer', () => {
    const message = buildReminderMessage(request, undefined);
    expect(message).toContain('Hi there,');
    expect(message).toContain('750 USDC');
  });

  it('omits the description clause when the request has none', () => {
    const message = buildReminderMessage({ ...request, description: undefined }, customer);
    expect(message).not.toContain('for  is');
    expect(message).toContain('750 USDC payment is still pending');
  });
});
```

- [ ] **Step 6: Run test, verify it fails** — expect FAIL, module not found.

- [ ] **Step 7: Implement `src/utils/buildReminderMessage.ts`**

```typescript
import type { PaymentRequest, Customer } from '../types';

export function buildReminderMessage(request: PaymentRequest, customer: Customer | undefined): string {
  const firstName = customer ? customer.name.split(' ')[0] : 'there';
  const descriptionClause = request.description ? ` for ${request.description}` : '';

  return `Hi ${firstName},\n\nJust a quick reminder that your ${request.amount} ${request.currency} payment${descriptionClause} is still pending.\n\nYou can complete it using your Spero payment link below.\n${request.paymentLink}`;
}
```

Note: this must satisfy the type shape from `Customer` (`src/types/customer.ts`) — `avatarColor` is required, so the test's mock `Customer` includes it.

- [ ] **Step 8: Run test, verify it passes** — expect PASS, 3 tests.

- [ ] **Step 9: Run the full suite and commit**

```bash
npx jest
npx tsc --noEmit
git add src/utils/getCustomerStats.ts src/utils/buildReminderMessage.ts src/utils/__tests__/getCustomerStats.test.ts src/utils/__tests__/buildReminderMessage.test.ts
git commit -m "Add getCustomerStats and buildReminderMessage pure utils (TDD)"
```

Expected: 9 suites passing (7 from Phase 1A + these 2), 32 tests total (26 + 6).

---

## Task 4: New stores — requestEventStore, templateStore, notificationStore, paymentDefaultsStore, securityStore

**Files:**
- Create: `src/data/requestEvents.ts`
- Create: `src/store/requestEventStore.ts`
- Create: `src/data/templates.ts`
- Create: `src/store/templateStore.ts`
- Modify: `src/types/preferences.ts`
- Create: `src/store/notificationStore.ts`
- Create: `src/store/paymentDefaultsStore.ts`
- Create: `src/store/securityStore.ts`
- Modify: `src/store/index.ts`

- [ ] **Step 1: Write `src/data/requestEvents.ts`** — mock timeline events for the 6 existing mock requests

```typescript
import type { RequestEvent } from '../types';

export const mockRequestEvents: RequestEvent[] = [
  // req-1: paid — full lifecycle
  { id: 'evt-r1-1', requestId: 'req-1', type: 'created', occurredAt: '2026-08-18T09:58:00.000Z' },
  { id: 'evt-r1-2', requestId: 'req-1', type: 'shared', occurredAt: '2026-08-18T09:59:00.000Z' },
  { id: 'evt-r1-3', requestId: 'req-1', type: 'payment_detected', occurredAt: '2026-08-18T10:15:00.000Z' },
  { id: 'evt-r1-4', requestId: 'req-1', type: 'payment_confirmed', occurredAt: '2026-08-18T10:16:00.000Z' },

  // req-2: pending
  { id: 'evt-r2-1', requestId: 'req-2', type: 'created', occurredAt: '2026-08-18T09:45:00.000Z' },
  { id: 'evt-r2-2', requestId: 'req-2', type: 'shared', occurredAt: '2026-08-18T09:46:00.000Z' },

  // req-3: expired
  { id: 'evt-r3-1', requestId: 'req-3', type: 'created', occurredAt: '2026-05-11T09:00:00.000Z' },
  { id: 'evt-r3-2', requestId: 'req-3', type: 'shared', occurredAt: '2026-05-11T09:05:00.000Z' },
  { id: 'evt-r3-3', requestId: 'req-3', type: 'expired', occurredAt: '2026-05-18T09:00:00.000Z' },

  // req-4: pending
  { id: 'evt-r4-1', requestId: 'req-4', type: 'created', occurredAt: '2026-08-18T08:00:00.000Z' },
  { id: 'evt-r4-2', requestId: 'req-4', type: 'shared', occurredAt: '2026-08-18T08:02:00.000Z' },

  // req-5: paid, never expiry
  { id: 'evt-r5-1', requestId: 'req-5', type: 'created', occurredAt: '2026-08-17T08:26:00.000Z' },
  { id: 'evt-r5-2', requestId: 'req-5', type: 'shared', occurredAt: '2026-08-17T08:27:00.000Z' },
  { id: 'evt-r5-3', requestId: 'req-5', type: 'payment_detected', occurredAt: '2026-08-17T09:00:00.000Z' },
  { id: 'evt-r5-4', requestId: 'req-5', type: 'payment_confirmed', occurredAt: '2026-08-17T09:01:00.000Z' },

  // req-6: paid
  { id: 'evt-r6-1', requestId: 'req-6', type: 'created', occurredAt: '2026-08-17T07:10:00.000Z' },
  { id: 'evt-r6-2', requestId: 'req-6', type: 'shared', occurredAt: '2026-08-17T07:12:00.000Z' },
  { id: 'evt-r6-3', requestId: 'req-6', type: 'payment_detected', occurredAt: '2026-08-17T07:40:00.000Z' },
  { id: 'evt-r6-4', requestId: 'req-6', type: 'payment_confirmed', occurredAt: '2026-08-17T07:41:00.000Z' },
];
```

- [ ] **Step 2: Write `src/store/requestEventStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RequestEvent, RequestEventType } from '../types';
import { mockRequestEvents } from '../data/requestEvents';
import { generateId } from '../utils/ids';

interface RequestEventState {
  events: RequestEvent[];
  addEvent: (requestId: string, type: RequestEventType) => RequestEvent;
  getEventsForRequest: (requestId: string) => RequestEvent[];
}

export const useRequestEventStore = create<RequestEventState>()(
  persist(
    (set, get) => ({
      events: mockRequestEvents,
      addEvent: (requestId, type) => {
        const event: RequestEvent = {
          id: generateId(),
          requestId,
          type,
          occurredAt: new Date().toISOString(),
        };
        set((state) => ({ events: [...state.events, event] }));
        return event;
      },
      getEventsForRequest: (requestId) =>
        get()
          .events.filter((e) => e.requestId === requestId)
          .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()),
    }),
    { name: 'speropay/requestEvents', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 3: Write `src/data/templates.ts`**

```typescript
import type { Template } from '../types';

export const mockTemplates: Template[] = [
  { id: 'tmpl-website', name: 'Website Development', amount: 1000, expiryOption: '7d' },
  { id: 'tmpl-seo', name: 'SEO Retainer', amount: 500, expiryOption: '7d' },
  { id: 'tmpl-consultation', name: 'Consultation', amount: 150, expiryOption: '24h' },
];
```

- [ ] **Step 4: Write `src/store/templateStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Template } from '../types';
import { mockTemplates } from '../data/templates';
import { generateId } from '../utils/ids';

interface TemplateState {
  templates: Template[];
  addTemplate: (input: Omit<Template, 'id'>) => Template;
  updateTemplate: (id: string, patch: Partial<Omit<Template, 'id'>>) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: mockTemplates,
      addTemplate: (input) => {
        const template: Template = { id: generateId(), ...input };
        set((state) => ({ templates: [template, ...state.templates] }));
        return template;
      },
      updateTemplate: (id, patch) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      deleteTemplate: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
    }),
    { name: 'speropay/templates', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 5: Modify `src/types/preferences.ts`** — replace the unused placeholder fields with the 4 toggles this phase's Notifications screen actually needs (spec §15: Payment Received, Payment Detected, Request Expired, Request Reminder). `NotificationPreferences` has zero consumers anywhere in the codebase today, so this is a safe field-shape change, not a breaking one.

```typescript
export type ThemePreference = 'light' | 'dark' | 'system';

export interface NotificationPreferences {
  paymentReceived: boolean;
  paymentDetected: boolean;
  requestExpired: boolean;
  requestReminder: boolean;
}
```

- [ ] **Step 6: Write `src/store/notificationStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationPreferences } from '../types';

interface NotificationState {
  preferences: NotificationPreferences;
  updatePreferences: (patch: Partial<NotificationPreferences>) => void;
}

const defaultPreferences: NotificationPreferences = {
  paymentReceived: true,
  paymentDetected: true,
  requestExpired: true,
  requestReminder: true,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      updatePreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),
    }),
    { name: 'speropay/notifications', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 7: Write `src/store/paymentDefaultsStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpiryOption } from '../types';

interface PaymentDefaultsState {
  defaultExpiryOption: ExpiryOption;
  setDefaultExpiryOption: (option: ExpiryOption) => void;
}

export const usePaymentDefaultsStore = create<PaymentDefaultsState>()(
  persist(
    (set) => ({
      defaultExpiryOption: '7d',
      setDefaultExpiryOption: (defaultExpiryOption) => set({ defaultExpiryOption }),
    }),
    { name: 'speropay/paymentDefaults', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 8: Write `src/store/securityStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SecurityState {
  biometricLockEnabled: boolean;
  appLockEnabled: boolean;
  setBiometricLockEnabled: (value: boolean) => void;
  setAppLockEnabled: (value: boolean) => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set) => ({
      biometricLockEnabled: false,
      appLockEnabled: false,
      setBiometricLockEnabled: (biometricLockEnabled) => set({ biometricLockEnabled }),
      setAppLockEnabled: (appLockEnabled) => set({ appLockEnabled }),
    }),
    { name: 'speropay/security', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 9: Modify `src/store/index.ts`** — add the 5 new barrel exports

```typescript
export * from './themeStore';
export * from './authStore';
export * from './onboardingStore';
export * from './profileStore';
export * from './walletStore';
export * from './customerStore';
export * from './requestStore';
export * from './requestDraftStore';
export * from './requestEventStore';
export * from './templateStore';
export * from './notificationStore';
export * from './paymentDefaultsStore';
export * from './securityStore';
```

- [ ] **Step 10: Verify and commit**

```bash
npx tsc --noEmit
npx jest
git add src/data/requestEvents.ts src/store/requestEventStore.ts src/data/templates.ts src/store/templateStore.ts src/types/preferences.ts src/store/notificationStore.ts src/store/paymentDefaultsStore.ts src/store/securityStore.ts src/store/index.ts
git commit -m "Add requestEvent, template, notification, paymentDefaults, and security stores"
```

---

## Task 5: Store extensions and mock data consistency (customer stats derivation)

**Files:**
- Modify: `src/types/customer.ts`
- Modify: `src/data/customers.ts`
- Modify: `src/store/customerStore.ts`
- Modify: `src/store/requestStore.ts`

- [ ] **Step 1: Modify `src/types/customer.ts`** — remove the stored stats fields (now derived via `getCustomerStats`, built in Task 3), add optional `company`/`notes` fields per spec §7

```typescript
export interface Customer {
  id: string;
  name: string;
  email: string;
  avatarColor: 'mint' | 'lavender' | 'blue' | 'red';
  company?: string;
  notes?: string;
}
```

- [ ] **Step 2: Modify `src/data/customers.ts`** — drop `totalRequests`/`totalAmount`, add a couple of `company` values for realism

```typescript
import type { Customer } from '../types';

export const mockCustomers: Customer[] = [
  {
    id: 'cust-john-doe',
    name: 'John Doe',
    email: 'john@doe.com',
    avatarColor: 'blue',
    company: 'Doe Consulting',
  },
  {
    id: 'cust-acme-studios',
    name: 'Acme Studios',
    email: 'billing@acmestudios.com',
    avatarColor: 'mint',
    company: 'Acme Studios',
  },
  {
    id: 'cust-web3-labs',
    name: 'Web3 Labs',
    email: 'hello@web3labs.io',
    avatarColor: 'lavender',
    company: 'Web3 Labs',
  },
  {
    id: 'cust-design-collective',
    name: 'Design Collective',
    email: 'pay@designcollective.co',
    avatarColor: 'red',
    company: 'Design Collective',
  },
  {
    id: 'cust-mike-harrison',
    name: 'Mike Harrison',
    email: 'mike@harrison.co',
    avatarColor: 'blue',
  },
];
```

- [ ] **Step 3: Modify `src/store/customerStore.ts`** — drop stat fields from `addCustomer`, add `updateCustomer`, accept optional company/notes on creation

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Customer } from '../types';
import { mockCustomers } from '../data/customers';
import { generateId } from '../utils/ids';

export interface AddCustomerInput {
  name: string;
  email: string;
  company?: string;
  notes?: string;
}

interface CustomerState {
  customers: Customer[];
  addCustomer: (input: AddCustomerInput) => Customer;
  updateCustomer: (id: string, patch: Partial<Omit<Customer, 'id'>>) => void;
  getCustomerById: (id: string) => Customer | undefined;
}

const AVATAR_COLORS: Customer['avatarColor'][] = ['mint', 'lavender', 'blue', 'red'];

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set, get) => ({
      customers: mockCustomers,
      addCustomer: (input) => {
        const customer: Customer = {
          id: generateId(),
          name: input.name,
          email: input.email,
          company: input.company,
          notes: input.notes,
          avatarColor: AVATAR_COLORS[get().customers.length % AVATAR_COLORS.length],
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return customer;
      },
      updateCustomer: (id, patch) =>
        set((state) => ({
          customers: state.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      getCustomerById: (id) => get().customers.find((c) => c.id === id),
    }),
    { name: 'speropay/customers', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

**Breaking change to trace:** `addCustomer`'s signature changed from `(name: string, email: string) => Customer` to `(input: AddCustomerInput) => Customer`. Two existing Phase 1A call sites break and must be fixed in this same task (not deferred — leaving them broken would fail `tsc`):
- `app/(app)/customers/index.tsx`: `addCustomer(name.trim(), email.trim())` → `addCustomer({ name: name.trim(), email: email.trim() })`
- `app/request/details.tsx`: `addCustomer(newCustomerName.trim(), newCustomerEmail.trim())` → `addCustomer({ name: newCustomerName.trim(), email: newCustomerEmail.trim() })`

Make both one-line call-site fixes now; Task 10 will do the fuller rework of `customers/index.tsx` anyway, but the file must compile at every commit boundary.

- [ ] **Step 4: Modify `src/store/requestStore.ts`** — add `cancelRequest`, `deleteRequest`; `createRequest` now also logs a `'created'` timeline event

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaymentRequest } from '../types';
import { mockRequests } from '../data/requests';
import { buildPaymentRequest, type CreateRequestInput } from '../utils/buildPaymentRequest';
import { useRequestEventStore } from './requestEventStore';

interface RequestState {
  requests: PaymentRequest[];
  isCreating: boolean;
  createRequest: (input: CreateRequestInput) => Promise<PaymentRequest>;
  getRequestById: (id: string) => PaymentRequest | undefined;
  cancelRequest: (id: string) => void;
  deleteRequest: (id: string) => void;
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
        useRequestEventStore.getState().addEvent(request.id, 'created');
        return request;
      },
      getRequestById: (id) => get().requests.find((r) => r.id === id),
      cancelRequest: (id) => {
        set((state) => ({
          requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)),
        }));
        useRequestEventStore.getState().addEvent(id, 'cancelled');
      },
      deleteRequest: (id) => set((state) => ({ requests: state.requests.filter((r) => r.id !== id) })),
    }),
    { name: 'speropay/requests', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npx jest
git add src/types/customer.ts src/data/customers.ts src/store/customerStore.ts src/store/requestStore.ts "app/(app)/customers/index.tsx" app/request/details.tsx
git commit -m "Derive customer stats from requestStore, add updateCustomer/cancelRequest/deleteRequest, wire created-event logging"
```

Expected: zero tsc errors (this is the step that proves the `addCustomer` signature change didn't break anything), all 9 suites still passing.

---

## Task 6: Requests list — search and Cancelled filter

**Files:**
- Modify: `app/(app)/requests/index.tsx`

- [ ] **Step 1: Replace `app/(app)/requests/index.tsx` in full**

```tsx
import { useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  { value: 'cancelled', label: 'Cancelled' },
];

function getDateLabel(request: PaymentRequest): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'cancelled') return 'Cancelled';
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
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const byStatus = filter === 'all' ? sorted : sorted.filter((r) => r.status === filter);

    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length === 0) return byStatus;

    return byStatus.filter((r) => {
      const customer = customers.find((c) => c.id === r.customerId);
      const haystacks = [
        customer?.name,
        r.description,
        r.paymentCode,
        String(r.amount),
      ];
      return haystacks.some((value) => value?.toLowerCase().includes(trimmedQuery));
    });
  }, [requests, customers, filter, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
        <Text style={[typography.h1, { color: colors.textPrimary }]}>Requests</Text>

        <View
          style={[
            styles.searchRow,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.base },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search customer, description, ID, or amount"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
            accessibilityLabel="Search requests"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.filterRow, { marginTop: spacing.base, gap: spacing.sm }]}>
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
            title={query.length > 0 ? 'No matching requests' : 'No requests yet'}
            description={
              query.length > 0
                ? 'Try a different search term or filter.'
                : 'Create your first payment request and share it with a customer.'
            }
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
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, paddingHorizontal: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: { paddingVertical: 8, borderWidth: 1 },
});
```

Note `FlatList`'s horizontal filter row will wrap onto a second line now that there are 5 chips instead of 4 (`flexWrap: 'wrap'` added to `filterRow`) — this is a deliberate, minimal layout adjustment to fit the new Cancelled chip without cramming, not a redesign.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/requests/index.tsx"
git commit -m "Add search and Cancelled filter to Requests list"
```

---

## Task 7: Request detail — timeline

**Files:**
- Modify: `app/(app)/requests/[id].tsx`

- [ ] **Step 1: Add a timeline section to `app/(app)/requests/[id].tsx`**

Insert timeline rendering after the existing Customer/Description/Payment Link fields, using `requestEventStore.getEventsForRequest`. Full replacement of the file (the Actions section referenced here is added in Tasks 8-9; for this task, add just the timeline and the additional detail fields — USDC/Solana/created date/expiry/receiving wallet — that spec §4 asks for):

```tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { useRequestStore } from '../../../src/store/requestStore';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestEventStore } from '../../../src/store/requestEventStore';
import { useWalletStore } from '../../../src/store/walletStore';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import type { RequestEventType } from '../../../src/types';

const EVENT_LABELS: Record<RequestEventType, string> = {
  created: 'Request created',
  shared: 'Request shared',
  payment_detected: 'Payment detected',
  payment_confirmed: 'Payment confirmed',
  reminder_sent: 'Reminder sent',
  cancelled: 'Request cancelled',
  expired: 'Request expired',
};

const EVENT_ICONS: Record<RequestEventType, keyof typeof Ionicons.glyphMap> = {
  created: 'add-circle-outline',
  shared: 'share-outline',
  payment_detected: 'eye-outline',
  payment_confirmed: 'checkmark-circle-outline',
  reminder_sent: 'notifications-outline',
  cancelled: 'close-circle-outline',
  expired: 'time-outline',
};

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RequestDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const events = useRequestEventStore((state) => (id ? state.getEventsForRequest(id) : []));
  const wallet = useWalletStore((state) => state.wallet);

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
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment ID</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentCode}
            </Text>
          </View>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Stablecoin & Network</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.currency} on {request.network}
            </Text>
          </View>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Created</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {formatEventDate(request.createdAt)}
            </Text>
          </View>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Expiry</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.expiresAt ? formatEventDate(request.expiresAt) : 'Never'}
            </Text>
          </View>
          {wallet ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Receiving Wallet</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                {wallet.address}
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

        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          TIMELINE
        </Text>
        <ThemeAwareCard>
          {events.length === 0 ? (
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>No activity recorded yet.</Text>
          ) : (
            events.map((event, index) => (
              <View
                key={event.id}
                style={[styles.timelineRow, { marginTop: index === 0 ? 0 : spacing.md }]}
              >
                <Ionicons name={EVENT_ICONS[event.type]} size={18} color={colors.textSecondary} />
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{EVENT_LABELS[event.type]}</Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{formatEventDate(event.occurredAt)}</Text>
                </View>
              </View>
            ))
          )}
        </ThemeAwareCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
});
```

Note: `request.paymentLink` field remains shown (kept from Phase 1A) alongside the new `paymentCode` field (labeled "Payment ID" now, matching spec §4's exact wording) — these are two different pieces of information (the shareable URL vs. the human-readable code), both worth surfacing.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Manually reason through: for `req-1` (paid, 4 events seeded in Task 4), does the timeline render all 4 events in chronological order (created → shared → payment_detected → payment_confirmed)? `getEventsForRequest` sorts by `occurredAt` ascending — confirm the seed data's timestamps are already in that order for every mock request (they are, per Task 4's seed data).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/requests/[id].tsx"
git commit -m "Add timeline and extended detail fields to Request Detail screen"
```

---

## Task 8: Request detail — Pending actions (Share Again, Send Reminder, Cancel)

**Files:**
- Modify: `app/(app)/requests/[id].tsx`

- [ ] **Step 1: Add an Actions section for `status === 'pending'` requests**

Add these imports to the top of `app/(app)/requests/[id].tsx`:

```tsx
import { useState } from 'react';
import { Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SecondaryButton } from '../../../src/components/SecondaryButton';
import { ConfirmationModal } from '../../../src/components/ConfirmationModal';
import { buildReminderMessage } from '../../../src/utils/buildReminderMessage';
```

(`View, Text, ScrollView, StyleSheet` from `react-native` and the rest of Task 7's imports stay as they are — add to the same import statements rather than duplicating them.)

Inside `RequestDetailScreen`, after the existing hooks, add:

```tsx
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const cancelRequest = useRequestStore((state) => state.cancelRequest);
  const addEvent = useRequestEventStore((state) => state.addEvent);

  async function handleShareAgain() {
    if (!request) return;
    await Share.share({ message: request.paymentLink, url: request.paymentLink });
  }

  async function handleSendReminder() {
    if (!request) return;
    const message = buildReminderMessage(request, customer);
    await Share.share({ message });
    addEvent(request.id, 'reminder_sent');
  }

  async function handleCopyReminder() {
    if (!request) return;
    const message = buildReminderMessage(request, customer);
    await Clipboard.setStringAsync(message);
    Alert.alert('Copied', 'Reminder message copied to clipboard.');
  }

  function handleConfirmCancel() {
    if (!request) return;
    cancelRequest(request.id);
    setCancelModalVisible(false);
  }
```

Add the Actions section to the JSX, after the Timeline `ThemeAwareCard` and before the closing `</ScrollView>`:

```tsx
        {request.status === 'pending' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Share Again" onPress={handleShareAgain} />
            <SecondaryButton label="Send Reminder" onPress={handleSendReminder} />
            <SecondaryButton label="Copy Reminder Message" onPress={handleCopyReminder} />
            <SecondaryButton label="Cancel Request" onPress={() => setCancelModalVisible(true)} />
          </View>
        ) : null}
```

Add the confirmation modal just before the closing `</SafeAreaView>` (as a sibling of `ScrollView`, matching how `ConfirmationModal` is used elsewhere — it renders its own `Modal` overlay):

```tsx
      <ConfirmationModal
        visible={cancelModalVisible}
        title="Cancel this request?"
        description="The customer will no longer be able to pay this request. This can't be undone."
        confirmLabel="Cancel Request"
        cancelLabel="Keep Request"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelModalVisible(false)}
      />
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Trace through: after `handleConfirmCancel` runs, `cancelRequest(request.id)` updates `requestStore` (status → `'cancelled'`) and logs a `'cancelled'` `RequestEvent`. Since `request` is derived via a live Zustand selector (`useRequestStore((state) => state.requests.find(...))`), the screen re-renders automatically with the new status — the Pending action buttons should disappear (since `request.status === 'pending'` is now false) without needing manual navigation away. Confirm this reactive-update reasoning holds by reading the selector code, not just assuming it.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/requests/[id].tsx"
git commit -m "Add Share Again, Send Reminder, and Cancel actions for pending requests"
```

---

## Task 9: Request detail — Paid/Expired/Cancelled actions (Receipt placeholder, Create Again, Delete)

**Files:**
- Modify: `app/(app)/requests/[id].tsx`
- Modify: `src/store/requestDraftStore.ts`

- [ ] **Step 1: Add a `prefillFrom` action to `requestDraftStore`** — used by both Create Again (this task) and Use Template (Task 13)

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
  prefillFrom: (values: { amount?: string; description?: string; customerId?: string; expiryOption?: ExpiryOption; note?: string }) => void;
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
  prefillFrom: (values) =>
    set((state) => ({
      ...initialState,
      ...values,
      amount: values.amount ?? initialState.amount,
    })),
  reset: () => set({ ...initialState }),
}));
```

`prefillFrom` resets to a clean slate first (so a stale `customerId`/`note` from a previous draft never leaks into a new prefilled one), then applies only the provided fields, leaving the rest at their initial defaults.

- [ ] **Step 2: Add Create Again / Delete actions to `app/(app)/requests/[id].tsx`**

Add to the imports:

```tsx
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
```

Add inside `RequestDetailScreen`:

```tsx
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const deleteRequest = useRequestStore((state) => state.deleteRequest);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);

  function handleCreateAgain() {
    if (!request) return;
    prefillDraft({
      amount: String(request.amount),
      description: request.description,
      customerId: request.customerId,
      expiryOption: request.expiryOption,
      note: request.note,
    });
    router.push('/request/amount');
  }

  function handleConfirmDelete() {
    if (!request) return;
    deleteRequest(request.id);
    setDeleteModalVisible(false);
    router.replace('/(app)/requests');
  }
```

Add to the JSX, replacing the single pending-only actions block from Task 8 with a status-branched version:

```tsx
        {request.status === 'pending' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Share Again" onPress={handleShareAgain} />
            <SecondaryButton label="Send Reminder" onPress={handleSendReminder} />
            <SecondaryButton label="Copy Reminder Message" onPress={handleCopyReminder} />
            <SecondaryButton label="Cancel Request" onPress={() => setCancelModalVisible(true)} />
          </View>
        ) : null}

        {request.status === 'paid' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <SecondaryButton
              label="View Receipt"
              onPress={() => Alert.alert('Receipt', 'Receipts are coming in a future update.')}
            />
          </View>
        ) : null}

        {request.status === 'expired' || request.status === 'cancelled' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <PrimaryButton label="Create Again" onPress={handleCreateAgain} />
            <SecondaryButton label="Delete" onPress={() => setDeleteModalVisible(true)} />
          </View>
        ) : null}
```

Add a second `ConfirmationModal` instance alongside the cancel one:

```tsx
      <ConfirmationModal
        visible={deleteModalVisible}
        title="Delete this request?"
        description="This will permanently remove the request from your history. This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Trace: `handleCreateAgain` calls `prefillDraft`, then `router.push('/request/amount')`. `app/request/amount.tsx` (unmodified by this task) reads `requestDraftStore.amount` directly via its existing selector — confirm it will display the prefilled amount correctly, and that the user can still edit it before submitting (the draft store's setters are unchanged, so yes — editing continues to work exactly as it does for a fresh request).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/requests/[id].tsx" src/store/requestDraftStore.ts
git commit -m "Add Create Again, Delete, and paid-receipt-placeholder actions to Request Detail"
```

---

## Task 10: Customers list — derived stats, search, route to detail

**Files:**
- Modify: `app/(app)/customers/index.tsx`

- [ ] **Step 1: Replace `app/(app)/customers/index.tsx` in full**

```tsx
import { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidEmail } from '../../../src/utils/validators';

export default function CustomersScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const customers = useCustomerStore((state) => state.customers);
  const addCustomer = useCustomerStore((state) => state.addCustomer);
  const requests = useRequestStore((state) => state.requests);

  const sheetRef = useRef<BottomSheet>(null);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | undefined>();

  const filtered = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.length === 0) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.company].some((value) => value?.toLowerCase().includes(trimmedQuery))
    );
  }, [customers, query]);

  function handleAdd() {
    if (name.trim().length === 0 || !isValidEmail(email)) {
      setError('Enter a name and valid email');
      return;
    }
    addCustomer({ name: name.trim(), email: email.trim(), company: company.trim() || undefined });
    setName('');
    setEmail('');
    setCompany('');
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

      <View style={{ paddingHorizontal: spacing.xl }}>
        <View
          style={[
            styles.searchRow,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.base },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search customers"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, { color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }]}
            accessibilityLabel="Search customers"
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.base }}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={query.length > 0 ? 'No matching customers' : 'No customers yet'}
            description={
              query.length > 0 ? 'Try a different search term.' : 'Add a customer to start requesting payments from them.'
            }
          />
        }
        renderItem={({ item }) => {
          const stats = getCustomerStats(item.id, requests);
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/(app)/customers/${item.id}`)}>
              <CustomerAvatar name={item.name} color={item.avatarColor} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{item.company || item.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {stats.totalRequests} {stats.totalRequests === 1 ? 'Request' : 'Requests'}
                </Text>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                  {formatCurrency(stats.totalReceived)}
                </Text>
              </View>
            </Pressable>
          );
        }}
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
        <TextField label="Company (Optional)" value={company} onChangeText={setCompany} />
        <PrimaryButton label="Add Customer" onPress={handleAdd} />
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/customers/index.tsx"
git commit -m "Use derived customer stats, add search and empty state, route rows to Customer Detail"
```

---

## Task 11: Customer detail screen

**Files:**
- Create: `app/(app)/customers/[id].tsx`

- [ ] **Step 1: Write `app/(app)/customers/[id].tsx`**

```tsx
import { useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { CustomerAvatar } from '../../../src/components/CustomerAvatar';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { RequestCard } from '../../../src/components/RequestCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useCustomerStore } from '../../../src/store/customerStore';
import { useRequestStore } from '../../../src/store/requestStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { getCustomerStats } from '../../../src/utils/getCustomerStats';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import type { PaymentRequest } from '../../../src/types';

function getDateLabel(request: PaymentRequest): string {
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'cancelled') return 'Cancelled';
  if (request.status === 'expired') return `Expired on ${request.expiresAt ? formatDate(request.expiresAt) : formatDate(request.createdAt)}`;
  return `Requested ${formatDate(request.createdAt)}`;
}

export default function CustomerDetailScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === id));
  const requests = useRequestStore((state) => state.requests);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);

  const history = useMemo(
    () =>
      requests
        .filter((r) => r.customerId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [requests, id]
  );

  if (!customer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Customer" onBackPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const stats = getCustomerStats(customer.id, requests);

  function handleRequestPayment() {
    prefillDraft({ customerId: customer.id });
    router.push('/request/amount');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Customer" onBackPress={() => router.back()} />
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.xl }}>
            <View style={styles.headerRow}>
              <CustomerAvatar name={customer.name} color={customer.avatarColor} size={56} />
              <View style={{ marginLeft: spacing.md, flex: 1 }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>{customer.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{customer.email}</Text>
                {customer.company ? (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{customer.company}</Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.statsRow, { marginTop: spacing.xl, gap: spacing.md }]}>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Total Received</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {formatCurrency(stats.totalReceived)}
                </Text>
              </ThemeAwareCard>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Payments</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {stats.totalRequests}
                </Text>
              </ThemeAwareCard>
              <ThemeAwareCard style={{ flex: 1 }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Outstanding</Text>
                <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  {formatCurrency(stats.outstanding)}
                </Text>
              </ThemeAwareCard>
            </View>

            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton label="Request Payment" onPress={handleRequestPayment} />
            </View>

            <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
              HISTORY
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title="No requests yet" description="Requests sent to this customer will show up here." />
        }
        renderItem={({ item }) => (
          <RequestCard
            title={item.description || item.paymentCode}
            amount={item.amount}
            currency={item.currency}
            status={item.status}
            dateLabel={getDateLabel(item)}
            onPress={() => router.push(`/(app)/requests/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row' },
});
```

Note: `FlatList`'s `ListHeaderComponent` carries the avatar/stats/CTA block so the whole screen (header + history) scrolls together as one list, matching the `FlatList`-based-screen pattern already used elsewhere (`requests/index.tsx`, `customers/index.tsx`) rather than nesting a `FlatList` inside a `ScrollView` (which RN disallows without extra configuration).

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Trace: `handleRequestPayment` calls `prefillDraft({ customerId: customer.id })` — per Task 9's `prefillFrom` implementation, this resets every other field to its default and sets only `customerId`. Confirm `app/request/details.tsx` (unmodified so far) will correctly show this customer as pre-selected via its existing `selectedCustomer = customers.find((c) => c.id === customerId)` logic, reading from the same `requestDraftStore`.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/customers/[id].tsx"
git commit -m "Add Customer Detail screen: stats, Request Payment CTA, history"
```

---

## Task 12: Edit customer

**Files:**
- Modify: `app/(app)/customers/[id].tsx`

- [ ] **Step 1: Add an edit bottom sheet to the Customer Detail screen**

Add to the imports:

```tsx
import { useRef, useState } from 'react';
import type BottomSheet from '@gorhom/bottom-sheet';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { isValidEmail } from '../../../src/utils/validators';
```

(`useMemo` from Task 11 stays; add `useRef`/`useState` to the same React import line.)

Add state and handlers inside `CustomerDetailScreen`, after the existing hooks (note: these must be declared before the `if (!customer)` early return, since Hooks can't be conditional — the edit sheet's local input state should initialize once `customer` is confirmed non-null on first successful render; use empty-string fallbacks and a "seed on open" pattern instead of relying on `customer` inside `useState`'s initializer):

```tsx
  const editSheetRef = useRef<BottomSheet>(null);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | undefined>();

  function openEditSheet() {
    if (!customer) return;
    setEditName(customer.name);
    setEditEmail(customer.email);
    setEditCompany(customer.company ?? '');
    setEditNotes(customer.notes ?? '');
    setEditError(undefined);
    editSheetRef.current?.expand();
  }

  function handleSaveEdit() {
    if (!customer) return;
    if (editName.trim().length === 0 || !isValidEmail(editEmail)) {
      setEditError('Enter a name and valid email');
      return;
    }
    updateCustomer(customer.id, {
      name: editName.trim(),
      email: editEmail.trim(),
      company: editCompany.trim() || undefined,
      notes: editNotes.trim() || undefined,
    });
    editSheetRef.current?.close();
  }
```

Add an edit action to the header via `AppHeader`'s existing `rightIcon`/`onRightPress` props (already supported by the component, unused until now):

```tsx
      <AppHeader title="Customer" onBackPress={() => router.back()} rightIcon="create-outline" onRightPress={openEditSheet} />
```

(Replace the two existing `<AppHeader title="Customer" onBackPress={() => router.back()} />` occurrences — the early-return one for `!customer` stays as a plain header with no edit action since there's nothing to edit yet; only the main render's `AppHeader` gets the `rightIcon`/`onRightPress` props.)

Add the edit bottom sheet just before the closing `</SafeAreaView>`:

```tsx
      <AppBottomSheet ref={editSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Edit Customer</Text>
        <TextField label="Name" value={editName} onChangeText={setEditName} error={editError} />
        <TextField label="Email" value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Company (Optional)" value={editCompany} onChangeText={setEditCompany} />
        <TextField label="Notes (Optional)" value={editNotes} onChangeText={setEditNotes} multiline />
        <PrimaryButton label="Save Changes" onPress={handleSaveEdit} />
      </AppBottomSheet>
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Trace data consistency (spec §18): after `handleSaveEdit` calls `updateCustomer`, does the Customers list screen (Task 10, reads `customerStore.customers` via a live selector) reflect the new name/email/company on next visit without any extra wiring? Yes — same store, same reactive-selector pattern used throughout this codebase; confirm by reading `customerStore.updateCustomer`'s implementation from Task 5 (replaces the customer object in the array via `.map()`, triggering all subscribers).

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/customers/[id].tsx"
git commit -m "Add Edit Customer bottom sheet on Customer Detail screen"
```

---

## Task 13: Templates screen

**Files:**
- Create: `app/(app)/profile/templates.tsx`

- [ ] **Step 1: Write `app/(app)/profile/templates.tsx`**

```tsx
import { useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { EmptyState } from '../../../src/components/EmptyState';
import { useTemplateStore } from '../../../src/store/templateStore';
import { useRequestDraftStore } from '../../../src/store/requestDraftStore';
import { formatCurrency } from '../../../src/utils/formatCurrency';
import { isValidAmount } from '../../../src/utils/validators';
import type { ExpiryOption, Template } from '../../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

export default function TemplatesScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const templates = useTemplateStore((state) => state.templates);
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const updateTemplate = useTemplateStore((state) => state.updateTemplate);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const prefillDraft = useRequestDraftStore((state) => state.prefillFrom);

  const formSheetRef = useRef<BottomSheet>(null);
  const expirySheetRef = useRef<BottomSheet>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('7d');
  const [error, setError] = useState<string | undefined>();

  function openCreateForm() {
    setEditingId(null);
    setName('');
    setAmount('');
    setDescription('');
    setExpiryOption('7d');
    setError(undefined);
    formSheetRef.current?.expand();
  }

  function openEditForm(template: Template) {
    setEditingId(template.id);
    setName(template.name);
    setAmount(String(template.amount));
    setDescription(template.description ?? '');
    setExpiryOption(template.expiryOption);
    setError(undefined);
    formSheetRef.current?.expand();
  }

  function handleSave() {
    const numericAmount = Number(amount);
    if (name.trim().length === 0 || !isValidAmount(numericAmount)) {
      setError('Enter a name and a valid amount');
      return;
    }
    const input = {
      name: name.trim(),
      amount: numericAmount,
      description: description.trim() || undefined,
      expiryOption,
    };
    if (editingId) {
      updateTemplate(editingId, input);
    } else {
      addTemplate(input);
    }
    formSheetRef.current?.close();
  }

  function handleDelete(id: string) {
    deleteTemplate(id);
  }

  function handleUseTemplate(template: Template) {
    prefillDraft({
      amount: String(template.amount),
      description: template.description,
      expiryOption: template.expiryOption,
    });
    router.push('/request/amount');
  }

  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === expiryOption)?.label ?? '7 days';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Templates" onBackPress={() => router.back()} rightIcon="add" onRightPress={openCreateForm} />
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        ListEmptyComponent={
          <EmptyState
            icon="copy-outline"
            title="No templates yet"
            description="Create a template for payments you request often, like a fixed-price service."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleUseTemplate(item)}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base },
            ]}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                  {formatCurrency(item.amount)} USDC
                </Text>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => openEditForm(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  hitSlop={8}
                  style={{ marginRight: spacing.md }}
                >
                  <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
      />

      <AppBottomSheet ref={formSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          {editingId ? 'Edit Template' : 'New Template'}
        </Text>
        <TextField label="Name" value={name} onChangeText={setName} error={error} placeholder="Website Development" />
        <TextField label="Amount (USDC)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1000" />
        <TextField label="Description (Optional)" value={description} onChangeText={setDescription} />
        <Pressable
          onPress={() => expirySheetRef.current?.expand()}
          style={[
            styles.expiryRow,
            { borderColor: colors.border, borderRadius: radius.md, padding: spacing.base, marginBottom: spacing.base },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>Expires In</Text>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{expiryLabel}</Text>
        </Pressable>
        <PrimaryButton label={editingId ? 'Save Changes' : 'Create Template'} onPress={handleSave} />
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
            style={[styles.expiryOptionRow, { paddingVertical: spacing.md }]}
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
  card: { borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  expiryRow: { borderWidth: 1 },
  expiryOptionRow: { flexDirection: 'row', alignItems: 'center' },
});
```

Two nested `Pressable`s per row (the card itself = Use Template, the edit/delete icons = their own actions) is intentional — RN resolves touches to the innermost `Pressable` under the finger, so tapping an icon triggers only that icon's handler, not the card's. `hitSlop={8}` on the icons gives them a comfortable tap target without visually growing them, consistent with the `IconButton` pattern used elsewhere.

Per spec §9, Templates is deliberately NOT added to `BottomNavigation` — it's reached only via the Profile screen's Payments group (wired in Task 15).

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile/templates.tsx"
git commit -m "Add Templates screen: create/edit/delete/use"
```

---

## Task 14: Default expiry at fresh-request entry points

**Files:**
- Modify: `src/store/requestDraftStore.ts`
- Modify: `src/components/BottomNavigation.tsx`
- Modify: `app/(app)/home.tsx`

- [ ] **Step 1: Add a `startFresh` action to `requestDraftStore`**

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
  prefillFrom: (values: { amount?: string; description?: string; customerId?: string; expiryOption?: ExpiryOption; note?: string }) => void;
  startFresh: (defaultExpiryOption: ExpiryOption) => void;
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
  prefillFrom: (values) =>
    set((state) => ({
      ...initialState,
      ...values,
      amount: values.amount ?? initialState.amount,
    })),
  startFresh: (defaultExpiryOption) => set({ ...initialState, expiryOption: defaultExpiryOption }),
  reset: () => set({ ...initialState }),
}));
```

- [ ] **Step 2: Modify `src/components/BottomNavigation.tsx`** — the center "+" button starts fresh with the configured default expiry instead of leaving whatever expiry was left over from the last draft

Add imports:

```tsx
import { useRequestDraftStore } from '../store/requestDraftStore';
import { usePaymentDefaultsStore } from '../store/paymentDefaultsStore';
```

Inside `BottomNavigation`, add:

```tsx
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
```

Change the center button's `onPress`:

```tsx
        <Pressable
          onPress={() => {
            startFresh(defaultExpiryOption);
            router.push('/request/amount');
          }}
          style={[styles.centerButton, { backgroundColor: colors.primaryAction, borderRadius: radius.full }]}
          accessibilityRole="button"
          accessibilityLabel="Request payment"
        >
```

- [ ] **Step 3: Modify `app/(app)/home.tsx`** — same treatment for the "Request Payment →" button

Read the current file first (it has other content — greeting, hero card, stats, activity — untouched by this task). Add the same two store imports/hooks, and change only the `PrimaryButton`'s `onPress`:

```tsx
onPress={() => {
  startFresh(defaultExpiryOption);
  router.push('/request/amount');
}}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Trace: does `startFresh` correctly override a leftover `expiryOption` from an abandoned Create-Again/Use-Template/Request-from-Customer draft? Yes — it resets every field to `initialState` and only then applies the passed default, same reset-then-apply pattern as `prefillFrom`.

- [ ] **Step 5: Commit**

```bash
git add src/store/requestDraftStore.ts src/components/BottomNavigation.tsx "app/(app)/home.tsx"
git commit -m "Seed fresh Smart Request drafts with the configured default expiry"
```

---

## Task 15: Profile screen restructure

**Files:**
- Modify: `app/(app)/profile/index.tsx`

- [ ] **Step 1: Replace `app/(app)/profile/index.tsx` in full** — regroup into Account / Payments / Preferences / Support / Session (spec §10), wire real navigation to every new screen from Tasks 13, 16-21, add a Currency Display bottom sheet (mock, single-option, matching the existing Stablecoin/Network sheet pattern from `request/amount.tsx`)

```tsx
import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { useProfileStore } from '../../../src/store/profileStore';
import { useAuthStore } from '../../../src/store/authStore';
import { useOnboardingStore } from '../../../src/store/onboardingStore';
import { useThemeStore } from '../../../src/store/themeStore';
import { useWalletStore } from '../../../src/store/walletStore';
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

function SectionLabel({ children }: { children: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.xs }]}>
      {children}
    </Text>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function ProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const resetOnboarding = useOnboardingStore((state) => state.resetOnboarding);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const wallet = useWalletStore((state) => state.wallet);
  const appearanceSheetRef = useRef<BottomSheet>(null);
  const currencySheetRef = useRef<BottomSheet>(null);

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

  const themeLabel = THEME_OPTIONS.find((opt) => opt.value === (preference ?? 'light'))?.label ?? 'Light';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <Text style={[typography.h1, { color: colors.textPrimary, marginBottom: spacing.xl }]}>Profile</Text>

        <ThemeAwareCard>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: colors.softMint, borderRadius: radius.full }]}>
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

        <SectionLabel>ACCOUNT</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="person-outline" label="Edit Profile" onPress={() => router.push('/(app)/profile/edit')} />
          <Row icon="briefcase-outline" label="Business Profile" onPress={() => router.push('/(app)/profile/business')} />
          <Row icon="lock-closed-outline" label="Security" onPress={() => router.push('/(app)/profile/security')} />
        </ThemeAwareCard>

        <SectionLabel>PAYMENTS</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row
            icon="wallet-outline"
            label="Receiving Wallet"
            value={wallet ? truncateAddress(wallet.address) : 'Not set'}
            onPress={() => router.push('/(app)/profile/wallet')}
          />
          <Row icon="options-outline" label="Payment Defaults" onPress={() => router.push('/(app)/profile/payment-defaults')} />
          <Row icon="copy-outline" label="Templates" onPress={() => router.push('/(app)/profile/templates')} />
        </ThemeAwareCard>

        <SectionLabel>PREFERENCES</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="color-palette-outline" label="Appearance" value={themeLabel} onPress={() => appearanceSheetRef.current?.expand()} />
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/(app)/profile/notifications')} />
          <Row icon="cash-outline" label="Currency Display" value="USD" onPress={() => currencySheetRef.current?.expand()} />
        </ThemeAwareCard>

        <SectionLabel>SUPPORT</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="help-circle-outline" label="Help & Support" onPress={() => router.push('/(app)/profile/help')} />
          <Row icon="information-circle-outline" label="About SperoPay" onPress={() => router.push('/(app)/profile/about')} />
        </ThemeAwareCard>

        <SectionLabel>SESSION</SectionLabel>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          <Row icon="log-out-outline" label="Sign Out" onPress={handleSignOut} />
        </ThemeAwareCard>
      </ScrollView>

      <AppBottomSheet ref={appearanceSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Appearance</Text>
        {THEME_OPTIONS.map((option) => {
          const isActive = (preference ?? 'light') === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setPreference(option.value);
                appearanceSheetRef.current?.close();
              }}
              style={[styles.row, { paddingVertical: spacing.md }]}
            >
              <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
              {isActive ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
            </Pressable>
          );
        })}
      </AppBottomSheet>

      <AppBottomSheet ref={currencySheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Currency Display</Text>
        <View style={[styles.row, { paddingVertical: spacing.md }]}>
          <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>USD — US Dollar</Text>
          <Ionicons name="checkmark" size={20} color={colors.primaryAction} />
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>
          More display currencies are coming in a future update.
        </Text>
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
```

Expected: this introduces `router.push` calls to 7 routes that don't exist yet (`profile/edit`, `profile/business`, `profile/security`, `profile/wallet`, `profile/payment-defaults`, `profile/notifications`, `profile/help`, `profile/about` — 8 actually) — since this project doesn't have Expo Router's typed-routes experiment enabled (confirmed in Phase 1A), these are plain strings and won't cause a `tsc` error; they'll 404 at runtime until Tasks 16-21 add the files. This matches the same "expected 404 until a later task" pattern used throughout Phase 1A's plan.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile/index.tsx"
git commit -m "Restructure Profile into Account/Payments/Preferences/Support/Session groups"
```

---

## Task 16: Edit Profile + Business Profile screens

**Files:**
- Create: `app/(app)/profile/edit.tsx`
- Create: `app/(app)/profile/business.tsx`

- [ ] **Step 1: Write `app/(app)/profile/edit.tsx`** — personal identity fields, mirrors the onboarding profile step's shell but bound to `profileStore` for post-onboarding edits

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useProfileStore } from '../../../src/store/profileStore';

export default function EditProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);

  const [hasMockAvatar, setHasMockAvatar] = useState(Boolean(profile.avatarUri));
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [country, setCountry] = useState(profile.country);
  const [website, setWebsite] = useState(profile.website ?? '');
  const [error, setError] = useState<string | undefined>();

  function handleSave() {
    if (displayName.trim().length === 0) {
      setError('Enter a display name');
      return;
    }
    updateProfile({
      displayName: displayName.trim(),
      country: country.trim(),
      website: website.trim() || undefined,
      avatarUri: hasMockAvatar ? 'mock-avatar' : undefined,
    });
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Edit Profile" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }} keyboardShouldPersistTaps="handled">
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
          <TextField label="Country" value={country} onChangeText={setCountry} />
          <TextField label="Website (Optional)" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Save Changes" onPress={handleSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'center' },
});
```

- [ ] **Step 2: Write `app/(app)/profile/business.tsx`** — business identity fields per spec §11

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { useProfileStore } from '../../../src/store/profileStore';
import { isValidEmail } from '../../../src/utils/validators';

export default function BusinessProfileScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);

  const [hasMockLogo, setHasMockLogo] = useState(Boolean(profile.businessLogoUri));
  const [businessName, setBusinessName] = useState(profile.businessName ?? '');
  const [website, setWebsite] = useState(profile.website ?? '');
  const [businessEmail, setBusinessEmail] = useState(profile.businessEmail ?? '');
  const [description, setDescription] = useState(profile.businessDescription ?? '');
  const [error, setError] = useState<string | undefined>();

  function handleSave() {
    if (businessEmail.trim().length > 0 && !isValidEmail(businessEmail)) {
      setError('Enter a valid business email');
      return;
    }
    updateProfile({
      businessName: businessName.trim() || undefined,
      website: website.trim() || undefined,
      businessEmail: businessEmail.trim() || undefined,
      businessDescription: description.trim() || undefined,
      businessLogoUri: hasMockLogo ? 'mock-logo' : undefined,
    });
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Business Profile" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.xl }]}>
            This will appear on your customer-facing payment pages in a future update.
          </Text>
          <Pressable
            onPress={() => setHasMockLogo((prev) => !prev)}
            style={[
              styles.logo,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, marginBottom: spacing.xl },
            ]}
          >
            {hasMockLogo ? (
              <Text style={[typography.h2, { color: colors.textPrimary }]}>
                {businessName.trim().slice(0, 1).toUpperCase() || 'S'}
              </Text>
            ) : (
              <Ionicons name="image-outline" size={24} color={colors.textMuted} />
            )}
          </Pressable>
          <TextField label="Business Name" value={businessName} onChangeText={setBusinessName} />
          <TextField label="Website (Optional)" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
          <TextField
            label="Business Email (Optional)"
            value={businessEmail}
            onChangeText={setBusinessEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField label="Short Description (Optional)" value={description} onChangeText={setDescription} multiline />
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Save Changes" onPress={handleSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logo: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'center' },
});
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/profile/edit.tsx" "app/(app)/profile/business.tsx"
git commit -m "Add Edit Profile and Business Profile screens"
```

---

## Task 17: Wallet Settings screen

**Files:**
- Create: `app/(app)/profile/wallet.tsx`

- [ ] **Step 1: Write `app/(app)/profile/wallet.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { TextField } from '../../../src/components/TextField';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { SecondaryButton } from '../../../src/components/SecondaryButton';
import { useWalletStore } from '../../../src/store/walletStore';
import { isValidWalletAddress } from '../../../src/utils/validators';

export default function WalletSettingsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const wallet = useWalletStore((state) => state.wallet);
  const setWalletAddress = useWalletStore((state) => state.setWalletAddress);

  const [isEditing, setIsEditing] = useState(false);
  const [address, setAddress] = useState(wallet?.address ?? '');
  const [error, setError] = useState<string | undefined>();

  function handleCopy() {
    if (!wallet) return;
    Clipboard.setStringAsync(wallet.address);
    Alert.alert('Copied', 'Wallet address copied to clipboard.');
  }

  function handleStartEdit() {
    setAddress(wallet?.address ?? '');
    setError(undefined);
    setIsEditing(true);
  }

  function handleSave() {
    if (!isValidWalletAddress(address.trim())) {
      setError('Enter a valid Solana wallet address');
      return;
    }
    setWalletAddress(address.trim());
    setIsEditing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Wallet Settings" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.base }}>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Stablecoin</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>USDC</Text>
            </ThemeAwareCard>
            <ThemeAwareCard style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>Solana</Text>
            </ThemeAwareCard>
          </View>

          {isEditing ? (
            <>
              <TextField
                label="Receiving Wallet Address"
                value={address}
                onChangeText={setAddress}
                error={error}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label="Cancel" onPress={() => setIsEditing(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Save" onPress={handleSave} />
                </View>
              </View>
            </>
          ) : (
            <ThemeAwareCard>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Receiving Wallet</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs }]} numberOfLines={1}>
                {wallet?.address ?? 'Not set'}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base }}>
                <Pressable
                  onPress={handleCopy}
                  style={[styles.actionRow, { borderColor: colors.border, borderRadius: radius.md }]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy wallet address"
                >
                  <Ionicons name="copy-outline" size={16} color={colors.textPrimary} />
                  <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}>Copy</Text>
                </Pressable>
                <Pressable
                  onPress={handleStartEdit}
                  style={[styles.actionRow, { borderColor: colors.border, borderRadius: radius.md }]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit wallet address"
                >
                  <Ionicons name="create-outline" size={16} color={colors.textPrimary} />
                  <Text style={[typography.bodySmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}>Edit</Text>
                </Pressable>
              </View>
            </ThemeAwareCard>
          )}

          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.softBlue,
              borderRadius: radius.md,
              padding: spacing.base,
              marginTop: spacing.base,
              gap: spacing.sm,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.softBlueText} />
            <Text style={[typography.bodySmall, { color: colors.softBlueText, flex: 1 }]}>
              Spero never asks for your seed phrase or private key. Payments are designed to go directly to your receiving wallet.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile/wallet.tsx"
git commit -m "Add Wallet Settings screen with copy/edit and security notice"
```

---

## Task 18: Payment Defaults screen

**Files:**
- Create: `app/(app)/profile/payment-defaults.tsx`

- [ ] **Step 1: Write `app/(app)/profile/payment-defaults.tsx`**

```tsx
import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { AppBottomSheet } from '../../../src/components/AppBottomSheet';
import { usePaymentDefaultsStore } from '../../../src/store/paymentDefaultsStore';
import { useWalletStore } from '../../../src/store/walletStore';
import type { ExpiryOption } from '../../../src/types';

const EXPIRY_OPTIONS: { value: ExpiryOption; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: 'never', label: 'Never' },
];

export default function PaymentDefaultsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);
  const setDefaultExpiryOption = usePaymentDefaultsStore((state) => state.setDefaultExpiryOption);
  const wallet = useWalletStore((state) => state.wallet);
  const expirySheetRef = useRef<BottomSheet>(null);

  const expiryLabel = EXPIRY_OPTIONS.find((opt) => opt.value === defaultExpiryOption)?.label ?? '7 days';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Payment Defaults" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Stablecoin</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>USDC</Text>
          </ThemeAwareCard>
          <ThemeAwareCard style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Network</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>Solana</Text>
          </ThemeAwareCard>
        </View>

        <Pressable
          onPress={() => expirySheetRef.current?.expand()}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Expiry</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]}>{expiryLabel}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/profile/wallet')}
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Default Receiving Wallet</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.xs }]} numberOfLines={1}>
              {wallet?.address ?? 'Not set'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </ScrollView>

      <AppBottomSheet ref={expirySheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md }]}>Default Expiry</Text>
        {EXPIRY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              setDefaultExpiryOption(option.value);
              expirySheetRef.current?.close();
            }}
            style={[styles.optionRow, { paddingVertical: spacing.md }]}
          >
            <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{option.label}</Text>
            {defaultExpiryOption === option.value ? <Ionicons name="checkmark" size={20} color={colors.primaryAction} /> : null}
          </Pressable>
        ))}
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
});
```

Stablecoin/network are read-only display cards, not pressable — matching design §3.4 ("stablecoin/network stay fixed... no multi-wallet/multi-asset concept introduced").

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile/payment-defaults.tsx"
git commit -m "Add Payment Defaults screen"
```

---

## Task 19: Notifications screen

**Files:**
- Create: `app/(app)/profile/notifications.tsx`

- [ ] **Step 1: Write `app/(app)/profile/notifications.tsx`**

```tsx
import { View, Text, ScrollView, Switch, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';
import { useNotificationStore } from '../../../src/store/notificationStore';
import type { NotificationPreferences } from '../../../src/types';

const TOGGLES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'paymentReceived', label: 'Payment Received', description: 'When a customer completes a payment.' },
  { key: 'paymentDetected', label: 'Payment Detected', description: 'When a payment is seen but not yet confirmed.' },
  { key: 'requestExpired', label: 'Request Expired', description: 'When an unpaid request passes its expiry.' },
  { key: 'requestReminder', label: 'Request Reminder', description: 'Reminders you send to customers about pending requests.' },
];

export default function NotificationsScreen() {
  const { colors, spacing, typography } = useTheme();
  const preferences = useNotificationStore((state) => state.preferences);
  const updatePreferences = useNotificationStore((state) => state.updatePreferences);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Notifications" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <ThemeAwareCard style={{ paddingVertical: 0 }}>
          {TOGGLES.map((toggle, index) => (
            <View
              key={toggle.key}
              style={[
                styles.row,
                { paddingVertical: spacing.md, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.border },
              ]}
            >
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={[typography.body, { color: colors.textPrimary }]}>{toggle.label}</Text>
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
                  {toggle.description}
                </Text>
              </View>
              <Switch
                value={preferences[toggle.key]}
                onValueChange={(value) => updatePreferences({ [toggle.key]: value })}
                trackColor={{ true: colors.primaryAction, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel={toggle.label}
              />
            </View>
          ))}
        </ThemeAwareCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile/notifications.tsx"
git commit -m "Add Notifications settings screen"
```

---

## Task 20: Security screen

**Files:**
- Create: `app/(app)/profile/security.tsx`

- [ ] **Step 1: Write `app/(app)/profile/security.tsx`** — mock Change Password flow (no real backend), Biometric Lock / App Lock toggles

```tsx
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
import { isValidPassword } from '../../../src/utils/validators';

export default function SecurityScreen() {
  const { colors, spacing, typography } = useTheme();
  const biometricLockEnabled = useSecurityStore((state) => state.biometricLockEnabled);
  const setBiometricLockEnabled = useSecurityStore((state) => state.setBiometricLockEnabled);
  const appLockEnabled = useSecurityStore((state) => state.appLockEnabled);
  const setAppLockEnabled = useSecurityStore((state) => state.setAppLockEnabled);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleUpdatePassword() {
    if (currentPassword.trim().length === 0) {
      setError('Enter your current password');
      return;
    }
    if (!isValidPassword(newPassword)) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setError(undefined);
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsSaving(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('Password Updated', 'Your password has been changed.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Security" onBackPress={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <Text style={[typography.caption, { color: colors.textMuted }]}>CHANGE PASSWORD</Text>
          <TextField label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          <TextField label="New Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry error={error} />
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

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/profile/security.tsx"
git commit -m "Add Security screen: mock change password, biometric/app lock toggles"
```

---

## Task 21: About SperoPay + Help & Support screens

**Files:**
- Create: `app/(app)/profile/about.tsx`
- Create: `app/(app)/profile/help.tsx`

- [ ] **Step 1: Write `app/(app)/profile/about.tsx`** — formal-brand context, uses "SperoPay" per the brand rule

```tsx
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { Logo } from '../../../src/components/Logo';

const APP_VERSION = '1.0.0';

export default function AboutScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="About SperoPay" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, alignItems: 'center' }}>
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
          <Logo size={64} />
        </View>
        <Text style={[typography.h2, { color: colors.textPrimary }]}>SperoPay</Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs }]}>Version {APP_VERSION}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xl, textAlign: 'center' }]}>
          SperoPay helps freelancers, agencies, and small businesses request stablecoin payments and get paid faster,
          with a simple link or QR code.
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xxl, textAlign: 'center' }]}>
          Terms of Service and Privacy Policy are coming in a future update.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Write `app/(app)/profile/help.tsx`**

```tsx
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../src/theme/useTheme';
import { AppHeader } from '../../../src/components/AppHeader';
import { ThemeAwareCard } from '../../../src/components/ThemeAwareCard';

export default function HelpScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Help & Support" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}>
        <ThemeAwareCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Contact Support</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            support@speropay.app
          </Text>
        </ThemeAwareCard>
        <ThemeAwareCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>How do I get paid?</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Create a request from the Home tab or the center Request button, then share the link or QR code with your
            customer.
          </Text>
        </ThemeAwareCard>
        <ThemeAwareCard>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Where do payments go?</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Payments are designed to go directly to the receiving wallet configured in Profile → Wallet Settings.
          </Text>
        </ThemeAwareCard>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/profile/about.tsx" "app/(app)/profile/help.tsx"
git commit -m "Add About SperoPay and Help & Support screens"
```

---

## Task 22: Final regression check and verification pass

**Files:**
- No new screens — this task is verification and any fixes it turns up.

- [ ] **Step 1: Full automated verification**

```bash
npx tsc --noEmit
npx jest
```

Expected: zero TypeScript errors across the entire tree; all 9 test suites passing (32 tests: the 26 from Phase 1A + 6 new from Task 3's `getCustomerStats`/`buildReminderMessage`).

- [ ] **Step 2: Re-verify the nested-layout route fix now that ~13 new files exist under `requests/`, `customers/`, `profile/`**

Repeat Task 1 Step 4's empirical `getRoutes()` check. Confirm the `(app)` Tabs layout's children are STILL exactly `home`, `requests`, `request-action`, `customers`, `profile` (5 entries) — despite `profile/` alone now containing 9 files (`index`, `edit`, `business`, `wallet`, `payment-defaults`, `templates`, `notifications`, `security`, `about`, `help`), none of them should appear as a sibling tab route. This is the single most important structural check in this phase — if it fails, the bottom tab bar is broken across the whole app.

- [ ] **Step 3: Code-level audit — hardcoded colors**

Grep every file touched in this phase for hex codes, `rgba(...)`, and named colors bypassing `useTheme()`. Known acceptable exceptions (carried from Phase 1A, still valid): `QRCodeCard.tsx`'s white/black, `ConfirmationModal`/QR-modal backdrops' `rgba(5,5,5,...)`, `ThemeAwareCard`'s `shadowColor: '#000'`. Flag anything else.

- [ ] **Step 4: Code-level audit — safe areas, keyboard handling, duplicate-submit guards**

Confirm every new top-level screen wraps in `SafeAreaView` from `react-native-safe-area-context`. Confirm every new form screen with multiple text inputs (`profile/edit.tsx`, `profile/business.tsx`, `profile/wallet.tsx` (edit mode), `profile/security.tsx`, the Templates create/edit sheet, the Customer add/edit sheets) wraps in `KeyboardAvoidingView` or is short enough not to need it. Confirm async actions (`handleUpdatePassword` in Security, any future async additions) guard against double-tap the same way Phase 1A's forms do (loading-state disable).

- [ ] **Step 5: Regression check against Phase 1A (spec §20)**

Code-level re-read (no device available in this environment, same limitation as Phase 1A's Task 28) of: Splash, Welcome, Auth UI, Forgot Password, Onboarding, Wallet Setup, Home, Navigation, Smart Request, Request Created, QR, Native Share, WhatsApp, Clipboard, Theme switching, Sign Out. Specifically confirm:
- `app/request/amount.tsx` and `app/request/details.tsx` — untouched by this phase except `details.tsx`'s one-line `addCustomer` call-site fix (Task 5) — still compile and their control flow is otherwise identical to Phase 1A.
- `app/request/created.tsx` — untouched by this phase, still references `request.paymentLink`/`request.paymentCode` fields that still exist on `PaymentRequest` (Task 2 only added a new status value and didn't remove/rename any existing field).
- Onboarding's `wallet-setup.tsx` still compiles against `walletStore.setWalletAddress` (unchanged signature).

- [ ] **Step 6: Bundle export verification**

```bash
npx expo export --platform ios --output-dir .tmp-verify-final
```

Expected: clean export, no bundling errors. Grep the compiled bundle for evidence of new-phase content (`"Templates"`, `"Business Profile"`, `"Payment Defaults"`, `"SP-"` pattern still present from `ids.ts`) to confirm the new screens are actually reachable in the compiled app, not just type-correct. Delete `.tmp-verify-final` afterward.

- [ ] **Step 7: Fix anything found in Steps 3-6**

Fix directly, re-run `npx tsc --noEmit` + `npx jest`, note each fix.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "Phase 1B-1 final verification: route-tree re-check, theme/safe-area/keyboard audit, Phase 1A regression check"
```

