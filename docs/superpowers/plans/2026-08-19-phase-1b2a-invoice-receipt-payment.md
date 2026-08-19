# SperoPay Phase 1B-2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Invoice, Receipt, a public Payment Request page, a QR payment section, and a Demo Pay-with-Wallet entry flow — all deriving live from existing mock/local state, no new backend.

**Architecture:** Reuse `app/request/`'s existing nested Stack layout for Invoice/Receipt (merchant-facing document views); add one new top-level `app/pay/` Stack group (public page + demo payment), registered in root `app/_layout.tsx`. Wire up the existing-but-dead `Transaction` type via a new read-only `transactionStore`. No new Invoice/Receipt entities — everything derives from `PaymentRequest` + `Customer` + `Profile` + `Wallet` + `Transaction`.

**Tech Stack:** React Native / Expo Router / TypeScript / Zustand + AsyncStorage (mock/local only).

Design reference: `docs/superpowers/specs/2026-08-19-phase-1b2a-invoice-receipt-payment-design.md`

---

### Task 1: Wire up the `Transaction` store

**Files:**
- Create: `src/data/transactions.ts`
- Create: `src/store/transactionStore.ts`
- Modify: `src/store/index.ts`

- [ ] **Step 1: Write `src/data/transactions.ts`**

```ts
import type { Transaction } from '../types';

export const mockTransactions: Transaction[] = [
  {
    id: 'txn-req-1',
    requestId: 'req-1',
    amount: 1250,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-acme-studios',
    txHash: '5LwYkP2vX9mT4qR8jH3nD7fC1sB6uA0oE5wZyN9KxP',
    paidAt: '2026-08-18T10:16:00.000Z',
  },
  {
    id: 'txn-req-5',
    requestId: 'req-5',
    amount: 2000,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-john-doe',
    txHash: '3MvBnQ7xT2kP9jR4hD8fC1sA6uE0oZ5wY9nX3mKxQL',
    paidAt: '2026-08-17T09:01:00.000Z',
  },
  {
    id: 'txn-req-6',
    requestId: 'req-6',
    amount: 150,
    currency: 'USDC',
    network: 'Solana',
    fromCustomerId: 'cust-john-doe',
    txHash: '8KpXwN4vQ2mT7jR9hD3fC6sB1uA5oE0zY8nP4mKxRT',
    paidAt: '2026-08-17T07:41:00.000Z',
  },
];
```

Note: `paidAt` values exactly match the existing `payment_confirmed` `RequestEvent.occurredAt` timestamps for `req-1`, `req-5`, `req-6` in `src/data/requestEvents.ts` — keep them in sync if you look them up, don't invent new timestamps.

- [ ] **Step 2: Write `src/store/transactionStore.ts`**

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction } from '../types';
import { mockTransactions } from '../data/transactions';

interface TransactionState {
  transactions: Transaction[];
  getTransactionForRequest: (requestId: string) => Transaction | undefined;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: mockTransactions,
      getTransactionForRequest: (requestId) => get().transactions.find((t) => t.requestId === requestId),
    }),
    { name: 'speropay/transactions', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

`getTransactionForRequest` uses `.find()`, which returns a referentially-stable existing array element (not a new array/object) — it is therefore SAFE to call directly inside a component-level Zustand selector (e.g. `useTransactionStore((state) => state.getTransactionForRequest(id))`), unlike `.filter()`/`.map()`-based store methods which must never be called inside a selector (that exact anti-pattern caused an infinite-render-loop crash in Phase 1B-1's Request Detail screen — do not reintroduce it). Do not add a `.filter()`-based method to this store without hoisting it out of any selector via `useMemo`, following the fixed pattern in `app/(app)/requests/[id].tsx`.

- [ ] **Step 3: Add to barrel — `src/store/index.ts`**

Add one line at the end of the existing file:

```ts
export * from './transactionStore';
```

(The file currently ends with `export * from './securityStore';` — add the new line directly after it.)

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/data/transactions.ts src/store/transactionStore.ts src/store/index.ts
git commit -m "Wire up Transaction store with mock records for existing paid requests"
```

---

### Task 2: Document ID utilities (TDD)

**Files:**
- Create: `src/utils/documentIds.ts`
- Test: `src/utils/__tests__/documentIds.test.ts`

- [ ] **Step 1: Write the failing test — `src/utils/__tests__/documentIds.test.ts`**

```ts
import { getInvoiceId, getReceiptId } from '../documentIds';
import type { PaymentRequest } from '../../types';

const request: PaymentRequest = {
  id: 'req-test',
  paymentCode: 'SP-A82KD',
  amount: 750,
  currency: 'USDC',
  network: 'Solana',
  description: 'Website Development',
  customerId: 'cust-1',
  expiryOption: '7d',
  expiresAt: '2026-08-26T00:00:00.000Z',
  status: 'pending',
  createdAt: '2026-08-19T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-test',
};

describe('getInvoiceId', () => {
  it('prefixes the payment code with INV-', () => {
    expect(getInvoiceId(request)).toBe('INV-SP-A82KD');
  });
});

describe('getReceiptId', () => {
  it('prefixes the payment code with RCP-', () => {
    expect(getReceiptId(request)).toBe('RCP-SP-A82KD');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest documentIds -t ""`
Expected: FAIL with "Cannot find module '../documentIds'"

- [ ] **Step 3: Write `src/utils/documentIds.ts`**

```ts
import type { PaymentRequest } from '../types';

export function getInvoiceId(request: PaymentRequest): string {
  return `INV-${request.paymentCode}`;
}

export function getReceiptId(request: PaymentRequest): string {
  return `RCP-${request.paymentCode}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest documentIds`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentIds.ts src/utils/__tests__/documentIds.test.ts
git commit -m "Add getInvoiceId/getReceiptId document ID utils (TDD)"
```

---

### Task 3: Invoice/Receipt share message builders (TDD)

**Files:**
- Create: `src/utils/buildInvoiceShareMessage.ts`
- Create: `src/utils/buildReceiptShareMessage.ts`
- Test: `src/utils/__tests__/buildInvoiceShareMessage.test.ts`
- Test: `src/utils/__tests__/buildReceiptShareMessage.test.ts`

Depends on Task 2 (`getInvoiceId`/`getReceiptId`).

- [ ] **Step 1: Write the failing tests**

`src/utils/__tests__/buildInvoiceShareMessage.test.ts`:

```ts
import { buildInvoiceShareMessage } from '../buildInvoiceShareMessage';
import type { PaymentRequest, Profile } from '../../types';

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

const profile: Profile = {
  usageType: 'business',
  displayName: 'Farhan Z.',
  businessName: 'THINXIFY',
  country: 'United Arab Emirates',
  website: undefined,
};

describe('buildInvoiceShareMessage', () => {
  it('includes the invoice ID, business name, amount, description, and payment link', () => {
    const message = buildInvoiceShareMessage(request, profile);

    expect(message).toContain('Invoice INV-SP-A82KD');
    expect(message).toContain('THINXIFY requested 750 USDC for Website Development.');
    expect(message).toContain('Pay with Spero:');
    expect(message).toContain(request.paymentLink);
  });

  it('falls back to the display name when there is no business name', () => {
    const message = buildInvoiceShareMessage(request, { ...profile, businessName: undefined });
    expect(message).toContain('Farhan Z. requested 750 USDC');
  });

  it('omits the description clause when the request has none', () => {
    const message = buildInvoiceShareMessage({ ...request, description: undefined }, profile);
    expect(message).toContain('THINXIFY requested 750 USDC.');
  });
});
```

`src/utils/__tests__/buildReceiptShareMessage.test.ts`:

```ts
import { buildReceiptShareMessage } from '../buildReceiptShareMessage';
import type { PaymentRequest } from '../../types';

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
  status: 'paid',
  createdAt: '2026-08-18T00:00:00.000Z',
  paymentLink: 'https://pay.speropay.app/r/req-1',
};

describe('buildReceiptShareMessage', () => {
  it('includes the receipt ID, amount, and description', () => {
    const message = buildReceiptShareMessage(request);

    expect(message).toContain('Payment Receipt RCP-SP-A82KD');
    expect(message).toContain('750 USDC received for Website Development.');
  });

  it('omits the description clause when the request has none', () => {
    const message = buildReceiptShareMessage({ ...request, description: undefined });
    expect(message).toContain('750 USDC received.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest buildInvoiceShareMessage buildReceiptShareMessage`
Expected: FAIL, modules not found

- [ ] **Step 3: Write `src/utils/buildInvoiceShareMessage.ts`**

```ts
import type { PaymentRequest, Profile } from '../types';
import { getInvoiceId } from './documentIds';

export function buildInvoiceShareMessage(request: PaymentRequest, profile: Profile): string {
  const businessName = profile.businessName?.trim() || profile.displayName || 'Your business';
  const invoiceId = getInvoiceId(request);
  const serviceClause = request.description ? ` for ${request.description}` : '';

  return `Invoice ${invoiceId}\n\n${businessName} requested ${request.amount} ${request.currency}${serviceClause}.\n\nPay with Spero:\n${request.paymentLink}`;
}
```

- [ ] **Step 4: Write `src/utils/buildReceiptShareMessage.ts`**

```ts
import type { PaymentRequest } from '../types';
import { getReceiptId } from './documentIds';

export function buildReceiptShareMessage(request: PaymentRequest): string {
  const receiptId = getReceiptId(request);
  const serviceClause = request.description ? ` for ${request.description}` : '';

  return `Payment Receipt ${receiptId}\n\n${request.amount} ${request.currency} received${serviceClause}.`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest buildInvoiceShareMessage buildReceiptShareMessage`
Expected: PASS, 5 tests total

- [ ] **Step 6: Commit**

```bash
git add src/utils/buildInvoiceShareMessage.ts src/utils/buildReceiptShareMessage.ts src/utils/__tests__/buildInvoiceShareMessage.test.ts src/utils/__tests__/buildReceiptShareMessage.test.ts
git commit -m "Add buildInvoiceShareMessage/buildReceiptShareMessage utils (TDD)"
```

---

### Task 4: Invoice screen

**Files:**
- Create: `app/request/invoice.tsx`
- Modify: `app/request/_layout.tsx`

Depends on Tasks 1-3.

- [ ] **Step 1: Write `app/request/invoice.tsx`**

```tsx
import { View, Text, ScrollView, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { Logo } from '../../src/components/Logo';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { getInvoiceId } from '../../src/utils/documentIds';
import { buildInvoiceShareMessage } from '../../src/utils/buildInvoiceShareMessage';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function InvoiceScreen() {
  const { colors, spacing, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Invoice" onBackPress={() => router.back()} />
        <EmptyState
          icon="document-text-outline"
          title="We couldn't load this invoice."
          description="This invoice is no longer available."
        />
      </SafeAreaView>
    );
  }

  const invoiceId = getInvoiceId(request);
  const businessName = profile.businessName?.trim() || profile.displayName || 'Your business';

  async function handleShare() {
    await Share.share({ message: buildInvoiceShareMessage(request, profile) });
  }

  async function handleCopyLink() {
    await Clipboard.setStringAsync(request.paymentLink);
    Alert.alert('Copied', 'Payment link copied to clipboard.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Invoice" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Logo size={48} />
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>SperoPay</Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>Invoice</Text>
        </View>

        <ThemeAwareCard>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Invoice ID</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{invoiceId}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>From</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{businessName}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>To</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {customer?.name ?? 'No customer'}
            </Text>
          </View>
          {customer?.email ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Email</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{customer.email}</Text>
            </View>
          ) : null}
          {request.description ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Service</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {request.description}
              </Text>
            </View>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Amount</Text>
            <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.amount} {request.currency}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
              Display Value: {formatCurrency(request.amount)}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{request.network}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Issue Date</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {formatDate(request.createdAt)}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Due / Expiry</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.expiresAt ? formatDate(request.expiresAt) : 'No expiry'}
            </Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Status</Text>
            <View style={{ marginTop: spacing.xs / 2 }}>
              <StatusBadge status={request.status} />
            </View>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment Request</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentCode}
            </Text>
          </View>
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="Share Invoice" onPress={handleShare} />
          <SecondaryButton label="Copy Payment Link" onPress={handleCopyLink} />
          <SecondaryButton label="View Payment Request" onPress={() => router.push(`/pay/${request.id}`)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Register the screen in `app/request/_layout.tsx`**

Current file:

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

Change the `<Stack>` body to:

```tsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="amount" />
      <Stack.Screen name="details" />
      <Stack.Screen name="created" />
      <Stack.Screen name="invoice" />
    </Stack>
```

(Only add `invoice` for now — `receipt` is added in Task 5.)

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/request/invoice.tsx app/request/_layout.tsx
git commit -m "Add Invoice screen, deriving all fields from request/customer/profile state"
```

---

### Task 5: Receipt screen

**Files:**
- Create: `app/request/receipt.tsx`
- Modify: `app/request/_layout.tsx`

Depends on Tasks 1-3.

- [ ] **Step 1: Write `app/request/receipt.tsx`**

```tsx
import { View, Text, ScrollView, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { AppHeader } from '../../src/components/AppHeader';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { Logo } from '../../src/components/Logo';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { getReceiptId } from '../../src/utils/documentIds';
import { buildReceiptShareMessage } from '../../src/utils/buildReceiptShareMessage';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}

export default function ReceiptScreen() {
  const { colors, spacing, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));

  if (!request || request.status !== 'paid') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <AppHeader title="Receipt" onBackPress={() => router.back()} />
        <EmptyState
          icon="receipt-outline"
          title="We couldn't load this receipt."
          description="Receipts are only available for completed payments."
        />
      </SafeAreaView>
    );
  }

  const receiptId = getReceiptId(request);
  const businessName = profile.businessName?.trim() || profile.displayName || 'Your business';

  async function handleShare() {
    await Share.share({ message: buildReceiptShareMessage(request) });
  }

  async function handleViewTransaction() {
    if (!transaction) return;
    await Clipboard.setStringAsync(transaction.txHash);
    Alert.alert('Copied', 'Transaction hash copied to clipboard.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <AppHeader title="Receipt" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Logo size={48} />
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>SperoPay</Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            Payment Receipt
          </Text>
        </View>

        <ThemeAwareCard variant="hero">
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {request.amount} {request.currency}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs }]}>
            Display Value: {formatCurrency(request.amount)}
          </Text>
        </ThemeAwareCard>

        <ThemeAwareCard style={{ marginTop: spacing.lg }}>
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Receipt ID</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{receiptId}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Merchant</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{businessName}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Customer</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {customer?.name ?? 'No customer'}
            </Text>
          </View>
          {request.description ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Description</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {request.description}
              </Text>
            </View>
          ) : null}
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Network</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>{request.network}</Text>
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Status</Text>
            <Text style={[typography.bodyMedium, { color: colors.success, marginTop: spacing.xs / 2 }]}>Paid</Text>
          </View>
          {transaction ? (
            <>
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Paid Date</Text>
                <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                  {formatDate(transaction.paidAt)}
                </Text>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Transaction</Text>
                <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                  {truncateHash(transaction.txHash)}
                </Text>
              </View>
            </>
          ) : null}
        </ThemeAwareCard>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="Share Receipt" onPress={handleShare} />
          {transaction ? <SecondaryButton label="View Transaction" onPress={handleViewTransaction} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Note: `request.status !== 'paid'` guards the whole screen — this is the "Receipt should only be accessible for Paid requests" rule from the phase spec, enforced at the screen level regardless of how the screen was reached.

- [ ] **Step 2: Register the screen in `app/request/_layout.tsx`**

Add `receipt` to the enumerated list (now includes both screens added this phase):

```tsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="amount" />
      <Stack.Screen name="details" />
      <Stack.Screen name="created" />
      <Stack.Screen name="invoice" />
      <Stack.Screen name="receipt" />
    </Stack>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/request/receipt.tsx app/request/_layout.tsx
git commit -m "Add Receipt screen, gated to paid requests, deriving from Transaction store"
```

---

### Task 6: Wire Invoice/Receipt entry points into existing screens

**Files:**
- Modify: `app/request/created.tsx`
- Modify: `app/(app)/requests/[id].tsx`

Depends on Tasks 4-5.

- [ ] **Step 1: Add "View Invoice" to `app/request/created.tsx`**

Add an import:

```tsx
import { SecondaryButton } from '../../src/components/SecondaryButton';
```

(add it directly below the existing `import { PrimaryButton } from '../../src/components/PrimaryButton';` line)

Change the bottom-pinned button block from:

```tsx
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
        <PrimaryButton label="Share Link" onPress={handleShare} />
      </View>
```

to:

```tsx
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm }}>
        <PrimaryButton label="Share Link" onPress={handleShare} />
        <SecondaryButton label="View Invoice" onPress={() => router.push(`/request/invoice?id=${request.id}`)} />
      </View>
```

- [ ] **Step 2: Add "View Invoice" and wire real "View Receipt" navigation in `app/(app)/requests/[id].tsx`**

Insert a new, always-rendered block immediately before the existing `{request.status === 'pending' ? (` conditional block (i.e. right after the closing `</ThemeAwareCard>` of the TIMELINE card, before the pending/paid/expired-cancelled conditionals):

```tsx
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="View Invoice" onPress={() => router.push(`/request/invoice?id=${request.id}`)} />
        </View>

        {request.status === 'pending' ? (
```

Then replace the existing paid-status stub block:

```tsx
        {request.status === 'paid' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <SecondaryButton
              label="View Receipt"
              onPress={() => Alert.alert('Receipt', 'Receipts are coming in a future update.')}
            />
          </View>
        ) : null}
```

with:

```tsx
        {request.status === 'paid' ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <SecondaryButton
              label="View Receipt"
              onPress={() => router.push(`/request/receipt?id=${request.id}`)}
            />
          </View>
        ) : null}
```

`Alert` is still used elsewhere in this file (`handleCopyReminder`) — do not remove its import.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/request/created.tsx "app/(app)/requests/[id].tsx"
git commit -m "Wire Invoice/Receipt entry points into Request Created and Request Detail"
```

---

### Task 7: New `pay` route group

**Files:**
- Create: `app/pay/_layout.tsx`
- Modify: `app/_layout.tsx`
- Modify: `src/components/index.ts`

- [ ] **Step 1: Write `app/pay/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';

export default function PayLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="demo" />
    </Stack>
  );
}
```

- [ ] **Step 2: Register the `pay` group in root `app/_layout.tsx`**

In the `RootNavigator` function, change:

```tsx
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
      </Stack>
```

to:

```tsx
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pay" />
      </Stack>
```

(`pay` is a regular push, not a modal — it should feel like navigating to a distinct page, matching how a customer would experience an actual public link.)

- [ ] **Step 3: Add `QRCodeCard` to the components barrel — `src/components/index.ts`**

Add one line at the end of the existing file:

```ts
export * from './QRCodeCard';
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/pay/_layout.tsx app/_layout.tsx src/components/index.ts
git commit -m "Add pay route group (public payment page + demo payment), export QRCodeCard from barrel"
```

---

### Task 8: Public Payment Request page

**Files:**
- Create: `app/pay/[id].tsx`

Depends on Task 7.

- [ ] **Step 1: Write `app/pay/[id].tsx`**

```tsx
import { useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { EmptyState } from '../../src/components/EmptyState';
import { AppBottomSheet } from '../../src/components/AppBottomSheet';
import { QRCodeCard } from '../../src/components/QRCodeCard';
import { Logo } from '../../src/components/Logo';
import { useRequestStore } from '../../src/store/requestStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useWalletStore } from '../../src/store/walletStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PublicPaymentScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const profile = useProfileStore((state) => state.profile);
  const wallet = useWalletStore((state) => state.wallet);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));
  const qrSheetRef = useRef<BottomSheet>(null);

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
          <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Request unavailable"
          description="This payment request is no longer available."
        />
      </SafeAreaView>
    );
  }

  const businessName = profile.businessName?.trim() || profile.displayName || 'Spero merchant';

  async function handleCopyWallet() {
    if (!wallet) return;
    await Clipboard.setStringAsync(wallet.address);
    Alert.alert('Copied', 'Wallet address copied to clipboard.');
  }

  async function handleCopyAmount() {
    await Clipboard.setStringAsync(String(request.amount));
    Alert.alert('Copied', 'Amount copied to clipboard.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <Logo size={44} />
        <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.md }]}>{businessName}</Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
          Payment Request
        </Text>

        <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.lg }]}>
          {formatCurrency(request.amount)}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {request.amount} {request.currency}
        </Text>
        {request.description ? (
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
            {request.description}
          </Text>
        ) : null}

        {request.status === 'pending' ? (
          <>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.lg }]}>
              Network: <Text style={{ color: colors.textPrimary }}>{request.network}</Text>
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Requested by {profile.displayName || 'Spero merchant'}
            </Text>
            {request.expiresAt ? (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
                Expires {formatDate(request.expiresAt)}
              </Text>
            ) : null}

            <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
              <PrimaryButton label="Pay with Wallet" onPress={() => router.push(`/pay/demo?id=${request.id}`)} />
              <SecondaryButton label="Scan QR" onPress={() => qrSheetRef.current?.expand()} />
            </View>
          </>
        ) : null}

        {request.status === 'paid' ? (
          <ThemeAwareCard style={{ width: '100%', marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm }]}>
              Payment already completed
            </Text>
            <View style={{ marginTop: spacing.md, width: '100%', gap: spacing.sm }}>
              <View style={styles.summaryRow}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
                <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{formatCurrency(request.amount)}</Text>
              </View>
              {transaction ? (
                <View style={styles.summaryRow}>
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Paid Date</Text>
                  <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{formatDate(transaction.paidAt)}</Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Merchant</Text>
                <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{businessName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Payment ID</Text>
                <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{request.paymentCode}</Text>
              </View>
            </View>
            <View style={{ width: '100%', marginTop: spacing.lg }}>
              <SecondaryButton label="View Receipt" onPress={() => router.push(`/request/receipt?id=${request.id}`)} />
            </View>
          </ThemeAwareCard>
        ) : null}

        {request.status === 'expired' ? (
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="time-outline" size={32} color={colors.textMuted} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              This payment request has expired.
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
              Contact the requester for a new payment link.
            </Text>
          </View>
        ) : null}

        {request.status === 'cancelled' ? (
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="close-circle-outline" size={32} color={colors.textMuted} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              This payment request is no longer active.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <AppBottomSheet ref={qrSheetRef}>
        <Text style={[typography.h3, { color: colors.textPrimary, marginBottom: spacing.md, textAlign: 'center' }]}>
          Scan to Pay
        </Text>
        <QRCodeCard value={request.paymentLink} />
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <View style={styles.summaryRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Amount</Text>
            <Pressable onPress={handleCopyAmount} style={styles.copyRow} accessibilityRole="button" accessibilityLabel="Copy amount">
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {request.amount} {request.currency}
              </Text>
              <Ionicons name="copy-outline" size={16} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
            </Pressable>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Network</Text>
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{request.network}</Text>
          </View>
          {wallet ? (
            <View>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Receiving Wallet</Text>
              <Pressable
                onPress={handleCopyWallet}
                style={[styles.copyRow, { marginTop: spacing.xs / 2 }]}
                accessibilityRole="button"
                accessibilityLabel="Copy wallet address"
              >
                <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                  {wallet.address}
                </Text>
                <Ionicons name="copy-outline" size={16} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
              </Pressable>
            </View>
          ) : null}
        </View>
        <View
          style={{
            backgroundColor: colors.softRed,
            borderRadius: radius.md,
            padding: spacing.base,
            marginTop: spacing.lg,
          }}
        >
          <Text style={[typography.bodySmall, { color: colors.softRedText }]}>
            Only send USDC using the Solana network. Using another asset or network may result in loss of funds.
          </Text>
        </View>
      </AppBottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyRow: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual route sanity check**

The route file is `app/pay/[id].tsx`; the internal link constructed elsewhere in this codebase is `router.push(\`/pay/${request.id}\`)` (Task 4's Invoice screen, Task 6's not applicable here) — confirm the `id` here refers to the request's internal `id` field (e.g. `req-1`), NOT its `paymentCode` (e.g. `SP-A82KD`). Every mock request's `id` is unique and stable, so this is safe.

- [ ] **Step 4: Commit**

```bash
git add "app/pay/[id].tsx"
git commit -m "Add public Payment Request page with pending/paid/expired/cancelled states and QR sheet"
```

---

### Task 9: Demo Pay with Wallet flow

**Files:**
- Create: `app/pay/demo.tsx`

Depends on Task 7.

- [ ] **Step 1: Write `app/pay/demo.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

export default function DemoPaymentScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const [isProcessing, setIsProcessing] = useState(false);

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
          <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Request unavailable"
          description="This payment request is no longer available."
        />
      </SafeAreaView>
    );
  }

  if (isProcessing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.center, { padding: spacing.xl }]}>
          <ActivityIndicator size="large" color={colors.primaryAction} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            Preparing your payment…
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            In the full version, this would confirm your payment on Solana.
          </Text>
          <View style={{ marginTop: spacing.xl, width: '100%' }}>
            <PrimaryButton label="Back to Payment Request" onPress={() => router.back()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
        <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
      </View>
      <View style={[styles.center, { padding: spacing.xl }]}>
        <View style={[styles.badge, { backgroundColor: colors.softLavender, borderRadius: radius.full, marginBottom: spacing.lg }]}>
          <Ionicons name="flask-outline" size={28} color={colors.softLavenderText} />
        </View>
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center' }]}>Demo Payment</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          This is a simulated payment for the Spero prototype. No real funds will move.
        </Text>

        <View style={[styles.summaryCard, { borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base, marginTop: spacing.xl }]}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>You're paying</Text>
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {formatCurrency(request.amount)}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            {request.amount} {request.currency} on {request.network}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl, width: '100%' }}>
          <PrimaryButton label="Continue" onPress={() => setIsProcessing(true)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { width: '100%', borderWidth: 1, alignItems: 'center' },
});
```

Note: tapping "Continue" only flips local `isProcessing` state — it does **not** call any store action, does not create a `Transaction`, and does not change `request.status`. This is the explicit Phase 1B-2A boundary; the real progression is Phase 1B-2B's job.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/pay/demo.tsx
git commit -m "Add Demo Pay with Wallet flow, stopping at a prepared processing-entry state"
```

---

### Task 10: Final regression check and verification pass

**Files:** None created — this task audits and, if needed, fixes issues found across Tasks 1-9.

- [ ] **Step 1: Full `tsc`/`jest` run**

```bash
npx tsc --noEmit
npx jest
```

Expect: 0 TypeScript errors; all pre-existing 32 tests plus the 7 new tests from Tasks 2-3 (39 total) passing.

- [ ] **Step 2: Route-tree verification**

Write a throwaway script (do not commit it) that calls expo-router's real `getRoutes()` (`node_modules/expo-router/build/getRoutes.js`) against the live `app/` tree, same technique used in Phase 1B-1's Task 22. Confirm:
- The root group's children now include `pay` alongside `index`, `(auth)`, `(onboarding)`, `(app)`, `request`.
- `pay` collapses to a single nested-stack route with children `[id]` and `demo` (not hoisted as flat siblings).
- `request` still collapses correctly with children `amount`, `details`, `created`, `invoice`, `receipt`.
- The `(app)` Tabs group's children are **unchanged** — still exactly `home`, `requests`, `request-action`, `customers`, `profile`. `pay` and the new `request` children must NOT appear there.

- [ ] **Step 3: Code-level audit**

- Grep `app/pay/`, `app/request/invoice.tsx`, `app/request/receipt.tsx` for hardcoded hex colors (`#[0-9a-fA-F]{3,8}`) or `rgba?\(` — none should exist outside of intentional, already-established exceptions (there should be none new in this phase; `QRCodeCard`'s existing hardcoded white/black is pre-existing and out of scope).
- Confirm every new screen wraps in `SafeAreaView` with explicit `edges`.
- Confirm every new interactive element (copy buttons, Scan QR, Pay with Wallet, Continue, Share actions) has an `accessibilityLabel` or is a `PrimaryButton`/`SecondaryButton`/`IconButton` (which already provide one).
- Confirm `app/pay/demo.tsx`'s "Continue" and "Back to Payment Request" buttons cannot be double-tapped into a broken state — trace whether rapid double-tap could fire `setIsProcessing(true)` twice or navigate twice; if this is the same "no explicit guard" pattern already accepted elsewhere in this codebase (see Phase 1B-1's Security screen precedent), it does not need a new fix here, just confirm it matches that established, already-accepted pattern rather than introducing something worse.

- [ ] **Step 4: Regression check against Phase 1A / 1B-1**

Read through (do not need to run — no device in this environment) `app/request/amount.tsx`, `app/request/details.tsx`, `app/(app)/home.tsx`, `src/components/BottomNavigation.tsx`, `app/(app)/_layout.tsx` and confirm none of them were touched by this phase's diff (`git diff <task-1-commit>^..HEAD -- <path>` should be empty for each). Confirm the only files touched outside of new files are: `app/request/_layout.tsx`, `app/request/created.tsx`, `app/(app)/requests/[id].tsx`, `app/_layout.tsx`, `src/components/index.ts`, `src/store/index.ts`.

- [ ] **Step 5: Bundle export verification**

```bash
npx expo export --platform ios --output-dir .tmp-verify-1b2a
```

Grep the output bundle for evidence the new phase's content is actually reachable: `"Invoice"`, `"Payment Receipt"`, `"Pay with Wallet"`, `"Demo Payment"`, `"INV-"`, `"RCP-"`. Delete `.tmp-verify-1b2a` afterward and confirm `git status` is clean (the directory should already match the existing `.tmp-*` gitignore pattern added in Phase 1B-1 — verify it does, don't re-add it if already present).

- [ ] **Step 6: Fix anything found**

If the audit finds real issues, fix them directly with small, targeted changes only. If something is ambiguous or large in scope, report it rather than expanding scope.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "Phase 1B-2A final verification pass"
```

(Only if Step 6 produced changes — if the audit found nothing to fix, skip this commit and report that explicitly.)

---

## Post-plan

After Task 10, do a final holistic review across the whole branch diff (base = the commit before Task 1, i.e. `HEAD` of `master` at worktree creation), following the same process used at the end of Phase 1B-1: look specifically for cross-task issues (navigation completeness, consistency across the new screens, duplicate logic, orphaned code) that per-task spec review can't catch. Fix anything found, then use `superpowers:finishing-a-development-branch` to merge.

Do **not** start Phase 1B-2B. Wait for explicit user approval.
