# SperoPay Phase 1B-2B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing screens into one coherent simulated payment product — a real `pending → confirming → paid` lifecycle with runtime `Transaction` creation, synchronized across every screen that already reads live store state, plus a final Phase 1 audit.

**Architecture:** Pure guard/construction logic in `src/utils/paymentSimulation.ts` (TDD-able, no Zustand/AsyncStorage involved), thin `requestStore`/`transactionStore` actions that call it and cross-store `.getState()` like the existing `createRequest`/`cancelRequest` pattern, one simulation entry point (`app/pay/demo.tsx`) driving state that every other screen already reads live.

**Tech Stack:** React Native / Expo Router / TypeScript / Zustand + AsyncStorage (mock/local only).

Design reference: `docs/superpowers/specs/2026-08-20-phase-1b2b-payment-simulation-design.md`

---

### Task 1: Add `'confirming'` status and update every status-map site

**Files:**
- Modify: `src/types/payment.ts`
- Modify: `src/components/StatusBadge.tsx`
- Modify: `src/utils/getDateLabel.ts`
- Modify: `src/utils/getCustomerStats.ts`
- Modify: `src/utils/__tests__/getCustomerStats.test.ts`

- [ ] **Step 1: Add `'confirming'` to `PaymentRequestStatus` — `src/types/payment.ts`**

Change:
```ts
export type PaymentRequestStatus = 'pending' | 'paid' | 'expired' | 'cancelled';
```
to:
```ts
export type PaymentRequestStatus = 'pending' | 'confirming' | 'paid' | 'expired' | 'cancelled';
```

This alone will make `npx tsc --noEmit` fail at `StatusBadge.tsx`'s two `Record<PaymentRequestStatus, ...>` maps until Step 2 is done — that's expected, keep going.

- [ ] **Step 2: Update `src/components/StatusBadge.tsx`**

Change:
```ts
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
```
to:
```ts
const LABELS: Record<PaymentRequestStatus, string> = {
  pending: 'Pending',
  confirming: 'Confirming',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const COLOR_KEYS: Record<PaymentRequestStatus, 'pending' | 'success' | 'expired' | 'error'> = {
  pending: 'pending',
  confirming: 'pending',
  paid: 'success',
  expired: 'expired',
  cancelled: 'error',
};
```

`'confirming'` deliberately reuses the `pending` (amber) color token — no new theme color is introduced.

- [ ] **Step 3: Update `src/utils/getDateLabel.ts`**

Change:
```ts
  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'cancelled') return 'Cancelled';
```
to:
```ts
  if (request.status === 'paid') return `Paid on ${formatDate(request.createdAt)}`;
  if (request.status === 'confirming') return 'Confirming payment…';
  if (request.status === 'cancelled') return 'Cancelled';
```

- [ ] **Step 4: Update `src/utils/getCustomerStats.ts`**

Change:
```ts
  const outstanding = customerRequests
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0);
```
to:
```ts
  const outstanding = customerRequests
    .filter((r) => r.status === 'pending' || r.status === 'confirming')
    .reduce((sum, r) => sum + r.amount, 0);
```

- [ ] **Step 5: Add a test case to `src/utils/__tests__/getCustomerStats.test.ts`**

Add this test inside the existing `describe('getCustomerStats', ...)` block, after the last existing `it(...)`:

```ts
  it('includes confirming requests in outstanding, alongside pending', () => {
    const requests = [
      makeRequest({ id: 'r1', customerId: 'cust-1', amount: 400, status: 'confirming' }),
      makeRequest({ id: 'r2', customerId: 'cust-1', amount: 100, status: 'pending' }),
    ];

    const stats = getCustomerStats('cust-1', requests);

    expect(stats.totalRequests).toBe(2);
    expect(stats.totalReceived).toBe(0);
    expect(stats.outstanding).toBe(500);
  });
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npx jest getCustomerStats
```
Expected: tsc clean; 4 tests pass (3 existing + 1 new).

- [ ] **Step 7: Commit**

```bash
git add src/types/payment.ts src/components/StatusBadge.tsx src/utils/getDateLabel.ts src/utils/getCustomerStats.ts src/utils/__tests__/getCustomerStats.test.ts
git commit -m "Add 'confirming' as a permanent PaymentRequestStatus, update every status-map site"
```

---

### Task 2: `generateTxHash` utility (TDD)

**Files:**
- Modify: `src/utils/ids.ts`
- Test: `src/utils/__tests__/ids.test.ts` (extend existing file)

- [ ] **Step 1: Read the existing `src/utils/__tests__/ids.test.ts`** to match its exact style before adding to it (don't guess the format — read the file first).

- [ ] **Step 2: Add a failing test** for a new `generateTxHash` export, following the same `describe`/`it` structure already used in that file for `generateId`/`generatePaymentCode`. It must assert: the result is a string, has a length of exactly 43 characters, and contains only characters from the base58-style alphabet `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz` (matching the shape of the hand-authored mock hashes already in `src/data/transactions.ts`, e.g. `5LwYkP2vX9mT4qR8jH3nD7fC1sB6uA0oE5wZyN9KxP`). Also assert that two calls produce different values (extremely low collision probability, not a strict guarantee — assert inequality, not any statistical property).

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest ids`
Expected: FAIL — `generateTxHash` is not exported.

- [ ] **Step 4: Add `generateTxHash` to `src/utils/ids.ts`**

Add this to the end of the file:

```ts
const HASH_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function generateTxHash(): string {
  let hash = '';
  for (let i = 0; i < 43; i++) {
    hash += HASH_CHARS[Math.floor(Math.random() * HASH_CHARS.length)];
  }
  return hash;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest ids`
Expected: PASS, all tests in the file including the new one.

- [ ] **Step 6: Commit**

```bash
git add src/utils/ids.ts src/utils/__tests__/ids.test.ts
git commit -m "Add generateTxHash util for mock Transaction hashes (TDD)"
```

---

### Task 3: Pure payment-simulation logic (TDD)

**Files:**
- Create: `src/utils/paymentSimulation.ts`
- Test: `src/utils/__tests__/paymentSimulation.test.ts`

Depends on Task 2 (`generateTxHash`).

- [ ] **Step 1: Write the failing tests — `src/utils/__tests__/paymentSimulation.test.ts`**

```ts
import { canBeginPaymentConfirmation, canCompletePayment, buildTransaction } from '../paymentSimulation';
import type { PaymentRequest } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-x',
    paymentCode: 'SP-XXXXX',
    amount: 750,
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

describe('canBeginPaymentConfirmation', () => {
  it('is true only for a pending request', () => {
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'pending' }))).toBe(true);
  });

  it('is false for confirming, paid, expired, cancelled, and undefined', () => {
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'confirming' }))).toBe(false);
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'paid' }))).toBe(false);
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'expired' }))).toBe(false);
    expect(canBeginPaymentConfirmation(makeRequest({ status: 'cancelled' }))).toBe(false);
    expect(canBeginPaymentConfirmation(undefined)).toBe(false);
  });
});

describe('canCompletePayment', () => {
  it('is true only for a confirming request', () => {
    expect(canCompletePayment(makeRequest({ status: 'confirming' }))).toBe(true);
  });

  it('is false for pending, paid, expired, cancelled, and undefined', () => {
    expect(canCompletePayment(makeRequest({ status: 'pending' }))).toBe(false);
    expect(canCompletePayment(makeRequest({ status: 'paid' }))).toBe(false);
    expect(canCompletePayment(makeRequest({ status: 'expired' }))).toBe(false);
    expect(canCompletePayment(makeRequest({ status: 'cancelled' }))).toBe(false);
    expect(canCompletePayment(undefined)).toBe(false);
  });
});

describe('buildTransaction', () => {
  it('builds a Transaction matching the request amount, currency, network, and customer', () => {
    const request = makeRequest({ id: 'req-1', amount: 750, customerId: 'cust-42' });
    const now = new Date('2026-08-20T12:00:00.000Z');

    const transaction = buildTransaction(request, now);

    expect(transaction.requestId).toBe('req-1');
    expect(transaction.amount).toBe(750);
    expect(transaction.currency).toBe('USDC');
    expect(transaction.network).toBe('Solana');
    expect(transaction.fromCustomerId).toBe('cust-42');
    expect(transaction.paidAt).toBe('2026-08-20T12:00:00.000Z');
    expect(transaction.txHash).toHaveLength(43);
    expect(transaction.id).toEqual(expect.any(String));
  });

  it('falls back to an empty fromCustomerId when the request has no customer', () => {
    const request = makeRequest({ customerId: undefined });
    const transaction = buildTransaction(request);
    expect(transaction.fromCustomerId).toBe('');
  });

  it('produces a unique id and txHash on each call', () => {
    const request = makeRequest({});
    const a = buildTransaction(request);
    const b = buildTransaction(request);
    expect(a.id).not.toBe(b.id);
    expect(a.txHash).not.toBe(b.txHash);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest paymentSimulation`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/utils/paymentSimulation.ts`**

```ts
import type { PaymentRequest, Transaction } from '../types';
import { generateId, generateTxHash } from './ids';

export const DEMO_PAYMENT_FAILURE_RATE = 0.12;

export function canBeginPaymentConfirmation(request: PaymentRequest | undefined): boolean {
  return request?.status === 'pending';
}

export function canCompletePayment(request: PaymentRequest | undefined): boolean {
  return request?.status === 'confirming';
}

export function buildTransaction(request: PaymentRequest, now: Date = new Date()): Transaction {
  return {
    id: generateId(),
    requestId: request.id,
    amount: request.amount,
    currency: request.currency,
    network: request.network,
    fromCustomerId: request.customerId ?? '',
    txHash: generateTxHash(),
    paidAt: now.toISOString(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest paymentSimulation`
Expected: PASS, 8 tests total (2 + 2 + 3 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/utils/paymentSimulation.ts src/utils/__tests__/paymentSimulation.test.ts
git commit -m "Add pure payment-simulation guards and Transaction builder (TDD)"
```

---

### Task 4: `transactionStore.addTransaction` action

**Files:**
- Modify: `src/store/transactionStore.ts`

Depends on Task 3 (not a hard code dependency, but logically follows — `addTransaction` will be called with the output of `buildTransaction` from Task 5).

- [ ] **Step 1: Write the new action**

Current file:
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
    (_set, get) => ({
      transactions: mockTransactions,
      getTransactionForRequest: (requestId) => get().transactions.find((t) => t.requestId === requestId),
    }),
    { name: 'speropay/transactions', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

Change to:
```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction } from '../types';
import { mockTransactions } from '../data/transactions';

interface TransactionState {
  transactions: Transaction[];
  getTransactionForRequest: (requestId: string) => Transaction | undefined;
  addTransaction: (transaction: Transaction) => Transaction;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: mockTransactions,
      getTransactionForRequest: (requestId) => get().transactions.find((t) => t.requestId === requestId),
      addTransaction: (transaction) => {
        set((state) => ({ transactions: [transaction, ...state.transactions] }));
        return transaction;
      },
    }),
    { name: 'speropay/transactions', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

Note `_set` is renamed back to `set` since it's now used — this is the exact spot the Phase 1B-2A holistic review flagged as "documenting read-only intent," and this task is precisely the reason that intent is now changing.

`addTransaction` takes an already-fully-built `Transaction` object (not raw input fields) — mirrors how `requestStore.createRequest` takes the output of the pure `buildPaymentRequest` and just inserts it.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/store/transactionStore.ts
git commit -m "Add transactionStore.addTransaction, making the store writable"
```

---

### Task 5: `requestStore` payment-lifecycle actions

**Files:**
- Modify: `src/store/requestStore.ts`
- Test: `src/store/__tests__/requestStore.test.ts` (new — first store-level test in this codebase)

Depends on Tasks 3-4.

- [ ] **Step 1: Add the two new actions to `src/store/requestStore.ts`**

Current file:
```ts
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
      deleteRequest: (id) => {
        set((state) => ({ requests: state.requests.filter((r) => r.id !== id) }));
        useRequestEventStore.getState().removeEventsForRequest(id);
      },
    }),
    { name: 'speropay/requests', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

Change to:
```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaymentRequest, Transaction } from '../types';
import { mockRequests } from '../data/requests';
import { buildPaymentRequest, type CreateRequestInput } from '../utils/buildPaymentRequest';
import {
  canBeginPaymentConfirmation,
  canCompletePayment,
  buildTransaction,
  DEMO_PAYMENT_FAILURE_RATE,
} from '../utils/paymentSimulation';
import { useRequestEventStore } from './requestEventStore';
import { useTransactionStore } from './transactionStore';

interface RequestState {
  requests: PaymentRequest[];
  isCreating: boolean;
  createRequest: (input: CreateRequestInput) => Promise<PaymentRequest>;
  getRequestById: (id: string) => PaymentRequest | undefined;
  cancelRequest: (id: string) => void;
  deleteRequest: (id: string) => void;
  beginPaymentConfirmation: (id: string) => boolean;
  completePayment: (id: string, options?: { forceFailure?: boolean }) => Transaction | null;
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
      deleteRequest: (id) => {
        set((state) => ({ requests: state.requests.filter((r) => r.id !== id) }));
        useRequestEventStore.getState().removeEventsForRequest(id);
      },
      beginPaymentConfirmation: (id) => {
        const request = get().requests.find((r) => r.id === id);
        if (!canBeginPaymentConfirmation(request)) return false;
        set((state) => ({
          requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'confirming' } : r)),
        }));
        useRequestEventStore.getState().addEvent(id, 'payment_detected');
        return true;
      },
      completePayment: (id, options) => {
        const request = get().requests.find((r) => r.id === id);
        if (!canCompletePayment(request)) return null;

        const shouldFail = options?.forceFailure ?? Math.random() < DEMO_PAYMENT_FAILURE_RATE;
        if (shouldFail) {
          set((state) => ({
            requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'pending' } : r)),
          }));
          return null;
        }

        const transaction = useTransactionStore.getState().addTransaction(buildTransaction(request!));
        set((state) => ({
          requests: state.requests.map((r) => (r.id === id ? { ...r, status: 'paid' } : r)),
        }));
        useRequestEventStore.getState().addEvent(id, 'payment_confirmed');
        return transaction;
      },
    }),
    { name: 'speropay/requests', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

Note: `request!` in `completePayment`'s success branch is safe — `canCompletePayment(request)` returning `true` already guarantees `request` is defined (it checks `request?.status === 'confirming'`), but TypeScript can't narrow through the imported pure-function call, so the non-null assertion documents that already-proven fact rather than silencing a real gap. If `npx tsc --noEmit` complains here in a way this reasoning doesn't cover, fix it the same way this codebase has fixed identical narrowing gaps elsewhere (hoist a `const request = ...` guarded by an inline `if (!request) return null;` immediately after the lookup, right before the `canCompletePayment` check, instead of relying on the assertion) — check `app/(app)/requests/[id].tsx`'s established pattern for the precedent if needed.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Write `src/store/__tests__/requestStore.test.ts`**

This is the first store-level test in this codebase. Zustand stores work standalone outside React — `useRequestStore.getState()` and `useRequestStore.setState()` can be called directly in a plain Jest test with no React Testing Library involved. Attempt this directly:

```ts
import { useRequestStore } from '../requestStore';
import { useTransactionStore } from '../transactionStore';
import { useRequestEventStore } from '../requestEventStore';
import type { PaymentRequest } from '../../types';

function makeRequest(overrides: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'req-test',
    paymentCode: 'SP-TEST1',
    amount: 750,
    currency: 'USDC',
    network: 'Solana',
    customerId: 'cust-1',
    expiryOption: '7d',
    expiresAt: null,
    status: 'pending',
    createdAt: '2026-08-18T00:00:00.000Z',
    paymentLink: 'https://pay.speropay.app/r/req-test',
    ...overrides,
  };
}

function resetStores(request: PaymentRequest) {
  useRequestStore.setState({ requests: [request], isCreating: false });
  useTransactionStore.setState({ transactions: [] });
  useRequestEventStore.setState({ events: [] });
}

describe('requestStore payment lifecycle', () => {
  it('transitions pending -> confirming -> paid, creates exactly one transaction, and logs both events once', () => {
    const request = makeRequest({ id: 'req-1', status: 'pending' });
    resetStores(request);

    const began = useRequestStore.getState().beginPaymentConfirmation('req-1');
    expect(began).toBe(true);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-1')?.status).toBe('confirming');
    expect(useRequestEventStore.getState().events.filter((e) => e.type === 'payment_detected')).toHaveLength(1);

    const transaction = useRequestStore.getState().completePayment('req-1', { forceFailure: false });
    expect(transaction).not.toBeNull();
    expect(transaction!.requestId).toBe('req-1');
    expect(transaction!.amount).toBe(750);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-1')?.status).toBe('paid');
    expect(useTransactionStore.getState().transactions).toHaveLength(1);
    expect(useRequestEventStore.getState().events.filter((e) => e.type === 'payment_confirmed')).toHaveLength(1);
  });

  it('a paid request cannot pay twice', () => {
    const request = makeRequest({ id: 'req-2', status: 'paid' });
    resetStores(request);

    expect(useRequestStore.getState().beginPaymentConfirmation('req-2')).toBe(false);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-2')?.status).toBe('paid');
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it('an expired request cannot pay', () => {
    const request = makeRequest({ id: 'req-3', status: 'expired' });
    resetStores(request);

    expect(useRequestStore.getState().beginPaymentConfirmation('req-3')).toBe(false);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-3')?.status).toBe('expired');
  });

  it('a cancelled request cannot pay', () => {
    const request = makeRequest({ id: 'req-4', status: 'cancelled' });
    resetStores(request);

    expect(useRequestStore.getState().beginPaymentConfirmation('req-4')).toBe(false);
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-4')?.status).toBe('cancelled');
  });

  it('completePayment on a request that is not confirming does nothing and creates no transaction', () => {
    const request = makeRequest({ id: 'req-5', status: 'pending' });
    resetStores(request);

    const result = useRequestStore.getState().completePayment('req-5');
    expect(result).toBeNull();
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-5')?.status).toBe('pending');
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
  });

  it('a forced failure reverts confirming back to pending without creating a transaction or logging payment_confirmed', () => {
    const request = makeRequest({ id: 'req-6', status: 'confirming' });
    resetStores(request);

    const result = useRequestStore.getState().completePayment('req-6', { forceFailure: true });

    expect(result).toBeNull();
    expect(useRequestStore.getState().requests.find((r) => r.id === 'req-6')?.status).toBe('pending');
    expect(useTransactionStore.getState().transactions).toHaveLength(0);
    expect(useRequestEventStore.getState().events.filter((e) => e.type === 'payment_confirmed')).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run the new tests**

Run: `npx jest requestStore`

If this hangs, times out, or fails with AsyncStorage/persistence-related errors (rather than genuine assertion failures) rather than passing or failing cleanly on assertions: this is a first-time integration in this codebase (no store has been unit-tested before) and the fallback is acceptable — remove the problematic parts of `resetStores`/the test file, keep only what runs cleanly, and note in your task report exactly what happened and what you removed. Do not spend more than one troubleshooting pass on this before falling back — the pure-function tests in Task 3 already cover the actual guard/construction logic; this test file is a bonus integration check, not the only correctness net.

Expected (if it works cleanly): PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/store/requestStore.ts src/store/__tests__/requestStore.test.ts
git commit -m "Add requestStore.beginPaymentConfirmation/completePayment with lifecycle tests"
```

(If Step 4's fallback was needed, still commit whatever test coverage resulted — note the fallback in your task report, don't block on it.)

---

### Task 6: Request Detail screen — `'confirming'` state and transaction details

**Files:**
- Modify: `app/(app)/requests/[id].tsx`

Depends on Tasks 1, 4.

- [ ] **Step 1: Add `useTransactionStore` import and selector**

Add to the import list (after the `useRequestDraftStore` import):
```ts
import { useTransactionStore } from '../../../src/store/transactionStore';
```

Add this selector alongside the existing ones (after the `wallet` selector):
```ts
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));
```

Note: this line must come after `request` is already computed (it references `request.id`), and since the whole component body runs before the `if (!request) return (...)` guard, the ternary handles the not-yet-known case exactly like the existing `wallet`/`customer` selectors already do elsewhere in this codebase (e.g. `app/pay/[id].tsx`).

- [ ] **Step 2: Add Paid Date / Transaction detail rows**

Insert these two conditional rows into the detail-rows section, right after the existing "Payment Link" row (last row in that `View` block, before its closing tag):

Before:
```tsx
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment Link</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentLink}
            </Text>
          </View>
        </View>
```

After:
```tsx
          <View>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Payment Link</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
              {request.paymentLink}
            </Text>
          </View>
          {transaction ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Paid Date</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {formatEventDate(transaction.paidAt)}
              </Text>
            </View>
          ) : null}
          {transaction ? (
            <View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Transaction Hash</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]} numberOfLines={1}>
                {transaction.txHash.slice(0, 4)}...{transaction.txHash.slice(-4)}
              </Text>
            </View>
          ) : null}
        </View>
```

Reuses the file's own existing `formatEventDate` (already defined at the top of this file) for consistency with the "Created"/"Expiry" rows right above it, rather than importing a second date formatter.

- [ ] **Step 3: Add the `'confirming'` action block**

Insert a new conditional block between the existing "View Invoice" block and the `pending` block:

Before:
```tsx
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="View Invoice" onPress={() => router.push(`/request/invoice?id=${request.id}`)} />
        </View>

        {request.status === 'pending' ? (
```

After:
```tsx
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="View Invoice" onPress={() => router.push(`/request/invoice?id=${request.id}`)} />
        </View>

        {request.status === 'confirming' ? (
          <ThemeAwareCard style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="sync-outline" size={24} color={colors.textSecondary} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              Confirming payment on the network…
            </Text>
          </ThemeAwareCard>
        ) : null}

        {request.status === 'pending' ? (
```

No action buttons are shown while `'confirming'` — this is deliberate (matches the phase's duplicate-payment-protection principle: no cancel/share/reminder actions make sense mid-confirmation).

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/requests/[id].tsx"
git commit -m "Add confirming-state card and transaction detail rows to Request Detail"
```

---

### Task 7: Public Payment page — `'confirming'` branch

**Files:**
- Modify: `app/pay/[id].tsx`

Depends on Task 1.

- [ ] **Step 1: Add the `'confirming'` branch**

Insert a new conditional block between the `pending` and `paid` blocks:

Before:
```tsx
        {request.status === 'paid' ? (
          <ThemeAwareCard style={{ width: '100%', marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
```

After:
```tsx
        {request.status === 'confirming' ? (
          <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="sync-outline" size={32} color={colors.textSecondary} />
            <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.sm, textAlign: 'center' }]}>
              Confirming your payment…
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
              This usually only takes a moment.
            </Text>
          </View>
        ) : null}

        {request.status === 'paid' ? (
          <ThemeAwareCard style={{ width: '100%', marginTop: spacing.xl, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
```

No payment actions render for `'confirming'` — the `pending` block (the only place `PrimaryButton "Pay with Wallet"`/`SecondaryButton "Scan QR"` render) is a separate, mutually exclusive conditional, so this alone hides them for a confirming request. This is the public-page half of duplicate-payment protection.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/pay/[id].tsx"
git commit -m "Add confirming state to the public Payment Request page, hiding pay actions"
```

---

### Task 8: Home screen — live hero card, paid-time-sorted recent activity

**Files:**
- Modify: `app/(app)/home.tsx`

Depends on Task 4 (reads `transactionStore.transactions`).

- [ ] **Step 1: Replace the file's data section**

Change:
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
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../src/store/paymentDefaultsStore';
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
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);

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
```

to:
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
import { useTransactionStore } from '../../src/store/transactionStore';
import { useRequestDraftStore } from '../../src/store/requestDraftStore';
import { usePaymentDefaultsStore } from '../../src/store/paymentDefaultsStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

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
  const transactions = useTransactionStore((state) => state.transactions);
  const startFresh = useRequestDraftStore((state) => state.startFresh);
  const defaultExpiryOption = usePaymentDefaultsStore((state) => state.defaultExpiryOption);

  const paidCount = useMemo(() => requests.filter((r) => r.status === 'paid').length, [requests]);
  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const monthTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((t) => {
      const paidDate = new Date(t.paidAt);
      return paidDate.getFullYear() === now.getFullYear() && paidDate.getMonth() === now.getMonth();
    });
  }, [transactions]);
  const receivedThisMonth = useMemo(
    () => monthTransactions.reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

  const recentActivity = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'paid')
        .map((r) => ({
          request: r,
          activityAt: transactions.find((t) => t.requestId === r.id)?.paidAt ?? r.createdAt,
        }))
        .sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime())
        .slice(0, 4),
    [requests, transactions]
  );

  const firstName = (profile.displayName || 'there').split(' ')[0];
```

- [ ] **Step 2: Replace the hero card's contents**

Change:
```tsx
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
```

to:
```tsx
        <ThemeAwareCard variant="hero">
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Received this month</Text>
          <Text style={[typography.heroNumber, { color: colors.heroSurfaceText, marginTop: spacing.xs }]}>
            {formatCurrency(receivedThisMonth)}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
            {monthTransactions.length} payment{monthTransactions.length === 1 ? '' : 's'} this month
          </Text>
        </ThemeAwareCard>
```

- [ ] **Step 3: Update the Recent Activity render loop**

Change:
```tsx
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
```

to:
```tsx
          {recentActivity.map(({ request, activityAt }) => {
            const customer = customers.find((c) => c.id === request.customerId);
            return (
              <ActivityRow
                key={request.id}
                customerName={customer?.name ?? 'Unknown'}
                avatarColor={customer?.avatarColor ?? 'blue'}
                amount={request.amount}
                currency={request.currency}
                status={request.status}
                createdAt={activityAt}
              />
            );
          })}
```

- [ ] **Step 4: Remove the now-unused styles**

Change:
```ts
const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'baseline' },
  growthPill: { paddingHorizontal: 8, paddingVertical: 2 },
  statsRow: { flexDirection: 'row' },
});
```

to:
```ts
const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row' },
});
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/home.tsx"
git commit -m "Derive Home's hero card and Recent Activity live from transaction state"
```

---

### Task 9: Requests list — "Confirming" filter chip

**Files:**
- Modify: `app/(app)/requests/index.tsx`

Depends on Task 1.

- [ ] **Step 1: Add the filter option**

Change:
```ts
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];
```
to:
```ts
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirming', label: 'Confirming' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/requests/index.tsx"
git commit -m "Add Confirming filter chip to the Requests list"
```

---

### Task 10: Extract shared `truncateHash` util

**Files:**
- Create: `src/utils/truncateHash.ts`
- Modify: `app/request/receipt.tsx`

- [ ] **Step 1: Write `src/utils/truncateHash.ts`**

```ts
export function truncateHash(hash: string): string {
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}
```

- [ ] **Step 2: Update `app/request/receipt.tsx` to use it**

Change:
```ts
import { getReceiptId } from '../../src/utils/documentIds';
import { buildReceiptShareMessage } from '../../src/utils/buildReceiptShareMessage';

function truncateHash(hash: string): string {
  return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
}
```
to:
```ts
import { getReceiptId } from '../../src/utils/documentIds';
import { buildReceiptShareMessage } from '../../src/utils/buildReceiptShareMessage';
import { truncateHash } from '../../src/utils/truncateHash';
```

The rest of the file is unchanged — `truncateHash(transaction.txHash)` at its existing call site now resolves to the imported version.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx jest --silent 2>&1 | tail -8
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/truncateHash.ts app/request/receipt.tsx
git commit -m "Extract shared truncateHash util out of Receipt, for reuse by Payment Success"
```

---

### Task 11: Demo Payment screen — real lifecycle simulation

**Files:**
- Modify: `app/pay/demo.tsx`

Depends on Tasks 1, 5, 10.

- [ ] **Step 1: Replace the entire file**

```tsx
import { useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { IconButton } from '../../src/components/IconButton';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { formatCurrency } from '../../src/utils/formatCurrency';

type Stage = 'idle' | 'detecting' | 'confirming' | 'received' | 'failed';

const STAGE_LABELS: Record<'detecting' | 'confirming' | 'received', string> = {
  detecting: 'Payment detected…',
  confirming: 'Confirming payment…',
  received: 'Payment received!',
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DemoPaymentScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const beginPaymentConfirmation = useRequestStore((state) => state.beginPaymentConfirmation);
  const completePayment = useRequestStore((state) => state.completePayment);
  const [stage, setStage] = useState<Stage>('idle');

  if (!request) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
          <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="alert-circle-outline"
            title="Request unavailable"
            description="This payment request is no longer available."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'idle') {
    if (request.status === 'paid') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
            <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
          </View>
          <View style={[styles.center, { padding: spacing.xl }]}>
            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
              This request has already been paid.
            </Text>
            <View style={{ marginTop: spacing.xl, width: '100%' }}>
              <PrimaryButton
                label="View Receipt"
                onPress={() => router.replace(`/request/receipt?id=${request.id}`)}
              />
            </View>
          </View>
        </SafeAreaView>
      );
    }

    if (request.status === 'confirming') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
            <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
          </View>
          <View style={[styles.center, { padding: spacing.xl }]}>
            <ActivityIndicator size="large" color={colors.primaryAction} />
            <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
              This payment is already being confirmed.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    if (request.status === 'expired' || request.status === 'cancelled') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
          <View style={[styles.topRow, { paddingHorizontal: spacing.base, paddingTop: spacing.sm }]}>
            <IconButton name="chevron-back" onPress={() => router.back()} accessibilityLabel="Go back" />
          </View>
          <View style={{ flex: 1 }}>
            <EmptyState
              icon={request.status === 'expired' ? 'time-outline' : 'close-circle-outline'}
              title={
                request.status === 'expired'
                  ? 'This payment request has expired.'
                  : 'This payment request is no longer active.'
              }
              description={
                request.status === 'expired'
                  ? 'Contact the requester for a new payment link.'
                  : 'Payment is no longer possible for this request.'
              }
            />
          </View>
        </SafeAreaView>
      );
    }
  }

  async function handleContinue() {
    setStage('detecting');
    const started = beginPaymentConfirmation(request!.id);
    if (!started) {
      setStage('failed');
      return;
    }
    await delay(700);

    setStage('confirming');
    await delay(900);

    const transaction = completePayment(request!.id);
    if (!transaction) {
      setStage('failed');
      return;
    }

    setStage('received');
    Alert.alert('Payment received', `${formatCurrency(transaction.amount)} from ${customer?.name ?? 'your customer'}`);
    await delay(500);
    router.replace(`/pay/success?id=${request!.id}`);
  }

  function handleRetry() {
    setStage('idle');
  }

  if (stage === 'detecting' || stage === 'confirming' || stage === 'received') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.center, { padding: spacing.xl }]}>
          <ActivityIndicator size="large" color={colors.primaryAction} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            {STAGE_LABELS[stage]}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }]}>
            This is a simulated payment for the Spero prototype.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (stage === 'failed') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={[styles.center, { padding: spacing.xl }]}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
          <Text style={[typography.h3, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
            We couldn't confirm this payment. Try again.
          </Text>
          <View style={{ marginTop: spacing.xl, width: '100%' }}>
            <PrimaryButton label="Try Again" onPress={handleRetry} />
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
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.softLavender, borderRadius: radius.full, marginBottom: spacing.lg },
          ]}
        >
          <Ionicons name="flask-outline" size={28} color={colors.softLavenderText} />
        </View>
        <Text style={[typography.h1, { color: colors.textPrimary, textAlign: 'center' }]}>Demo Payment</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }]}>
          This is a simulated payment for the Spero prototype. No real funds will move.
        </Text>

        <View
          style={[
            styles.summaryCard,
            { borderColor: colors.border, borderRadius: radius.lg, padding: spacing.base, marginTop: spacing.xl },
          ]}
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>You're paying</Text>
          <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.xs }]}>
            {formatCurrency(request.amount)}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xs / 2 }]}>
            {request.amount} {request.currency} on {request.network}
          </Text>
        </View>

        <View style={{ marginTop: spacing.xl, width: '100%' }}>
          <PrimaryButton label="Continue" onPress={handleContinue} />
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

**Critical structural note — read before implementing:** the four early-return blocks inside `if (stage === 'idle') { ... }` intentionally do NOT have a `return` after the `if (stage === 'idle')` block closes if none of the three inner conditions matched (i.e. `request.status === 'pending'`) — execution falls through to `handleContinue`'s definition and the final `return (...)` (the main "Demo Payment" screen with the Continue button) below. This is correct and deliberate: TypeScript will NOT flag this as unreachable, and the fallthrough IS the intended behavior for a pending request. Do not add a `return` after the `if (stage === 'idle') {...}` block or restructure this into an early-return-only pattern — that would break the fallthrough. Verify this by tracing manually: a pending request with `stage === 'idle'` skips all three inner `if`s (none match `'paid'`/`'confirming'`/`'expired'`/`'cancelled'`), execution continues past the closing `}` of the `if (stage === 'idle')` block, defines `handleContinue`/`handleRetry`, then falls through the `stage === 'detecting' || ...` and `stage === 'failed'` checks (both false, since `stage === 'idle'`), and finally hits the last `return (...)` — the intended main screen.

The **why** this correctly gates re-entry into an in-flight simulation from outside: once `handleContinue` calls `beginPaymentConfirmation`, `request.status` becomes `'confirming'` in the store, which would normally re-trigger the `if (stage === 'idle') { if (request.status === 'confirming') {...} }` block on the next render — except `stage` is no longer `'idle'` at that point (it's `'detecting'`), so that whole `if (stage === 'idle')` block is skipped entirely, and the `stage === 'detecting' || stage === 'confirming' || stage === 'received'` block below renders instead. This is the mechanism that keeps the local staged-animation flow from being clobbered by its own store writes.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

If TypeScript complains about `request!.id` (non-null assertions) inside `handleContinue`/anywhere else referencing `request` after the top-level `if (!request) return (...)` guard — this is the same nested-function-narrowing gap seen repeatedly in Phase 1B-2A (`app/(app)/requests/[id].tsx`, `app/request/invoice.tsx`, `app/request/receipt.tsx`, `app/pay/[id].tsx`). The code above already uses `request!` (non-null assertion) rather than a redundant `if (!request) return;` guard inside `handleContinue`/`handleRetry` — if tsc is unhappy with the assertions specifically, switch to the established `if (!request) return;` guard pattern instead, matching precedent exactly.

- [ ] **Step 3: Commit**

```bash
git add app/pay/demo.tsx
git commit -m "Rewrite Demo Payment: real lifecycle simulation, status guards, failure/retry path"
```

---

### Task 12: Payment Success screen

**Files:**
- Create: `app/pay/success.tsx`
- Modify: `app/pay/_layout.tsx`

Depends on Tasks 4, 10, 11.

- [ ] **Step 1: Write `app/pay/success.tsx`**

```tsx
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { SecondaryButton } from '../../src/components/SecondaryButton';
import { ThemeAwareCard } from '../../src/components/ThemeAwareCard';
import { EmptyState } from '../../src/components/EmptyState';
import { useRequestStore } from '../../src/store/requestStore';
import { useCustomerStore } from '../../src/store/customerStore';
import { useProfileStore } from '../../src/store/profileStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { truncateHash } from '../../src/utils/truncateHash';

export default function PaymentSuccessScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useRequestStore((state) => state.requests.find((r) => r.id === id));
  const customer = useCustomerStore((state) => state.customers.find((c) => c.id === request?.customerId));
  const profile = useProfileStore((state) => state.profile);
  const transaction = useTransactionStore((state) => (request ? state.getTransactionForRequest(request.id) : undefined));

  if (!request || request.status !== 'paid') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="alert-circle-outline"
            title="Request unavailable"
            description="This payment request is no longer available."
          />
        </View>
      </SafeAreaView>
    );
  }

  const businessName = profile.businessName?.trim() || profile.displayName || 'Spero merchant';

  function handleDone() {
    router.replace('/(app)/home');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl, alignItems: 'center' }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: radius.full,
            backgroundColor: colors.primaryAction,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: spacing.xl,
          }}
        >
          <Ionicons name="checkmark" size={48} color={colors.primaryActionText} />
        </View>

        <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
          Payment Received
        </Text>
        <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>
          {request.amount} {request.currency}
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
          Your payment was completed successfully.
        </Text>

        <ThemeAwareCard style={{ width: '100%', marginTop: spacing.xl }}>
          <View>
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
          {transaction ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Transaction</Text>
              <Text style={[typography.body, { color: colors.textPrimary, marginTop: spacing.xs / 2 }]}>
                {truncateHash(transaction.txHash)}
              </Text>
            </View>
          ) : null}
        </ThemeAwareCard>

        <View style={{ width: '100%', marginTop: spacing.xl, gap: spacing.sm }}>
          <SecondaryButton label="View Receipt" onPress={() => router.push(`/request/receipt?id=${request.id}`)} />
          <PrimaryButton label="Done" onPress={handleDone} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

Guard mirrors Receipt's exactly (`!request || request.status !== 'paid'`) — this screen can only ever be reached in a coherent state, but the guard exists defensively (e.g. direct deep-link, or back-navigation after some other change).

- [ ] **Step 2: Register in `app/pay/_layout.tsx`**

Change:
```tsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="demo" />
    </Stack>
```
to:
```tsx
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="demo" />
      <Stack.Screen name="success" />
    </Stack>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/pay/success.tsx app/pay/_layout.tsx
git commit -m "Add Payment Success screen"
```

---

### Task 13: Final regression check, full audit, and verification pass

**Files:** None created — this task audits and, if needed, fixes issues found across Tasks 1-12.

This task directly covers phase spec §20-27 (Light/Dark/UX/Forms/Accessibility/Navigation/Brand/Regression audits). Work through each subsection below in order.

- [ ] **Step 1: Full `tsc`/`jest` run**

```bash
npx tsc --noEmit
npx jest
```
Expect 0 TypeScript errors. Expect all prior tests plus new ones from Tasks 1-3 and 5 passing (exact count depends on whether Task 5's store test suite survived intact — check the task's own commit message/report for the actual final count and treat that as the baseline, not a guessed number).

- [ ] **Step 2: Full mock payment lifecycle trace (code-level, no device)**

Trace through the code (don't just read — actually mentally execute) this exact sequence and confirm each step is correct:
1. Start with mock request `req-2` (`SP-B71LM`, status `'pending'`, customer `cust-web3-labs`, no existing transaction).
2. Navigate to `/pay/req-2` → confirm the `pending` branch renders (`Pay with Wallet` visible).
3. Tap "Pay with Wallet" → navigates to `/pay/demo?id=req-2` → confirm `stage === 'idle'`, `request.status === 'pending'` → falls through to the main Demo Payment screen.
4. Tap "Continue" → confirm `beginPaymentConfirmation('req-2')` returns `true`, `req-2.status` becomes `'confirming'`, a `payment_detected` event is logged.
5. After the `confirming` stage delay, confirm `completePayment('req-2')` is called — trace both outcomes:
   - **Success path:** a `Transaction` is created via `addTransaction`, `req-2.status` becomes `'paid'`, a `payment_confirmed` event is logged, `stage` becomes `'received'`, the merchant-confirmation `Alert.alert` fires, then `router.replace('/pay/success?id=req-2')`.
   - **Failure path** (force it by temporarily reading the code as if `completePayment` returned `null`): `req-2.status` reverts to `'pending'`, no transaction, no `payment_confirmed` event, `stage` becomes `'failed'`, "Try Again" is shown, tapping it sets `stage` back to `'idle'` and correctly falls through to the main screen again since `req-2.status` is genuinely `'pending'` again.
6. On the success path, confirm Payment Success (`/pay/success?id=req-2`) renders correctly: `request.status === 'paid'` passes its guard, `transaction` is found via `getTransactionForRequest`, all fields display.
7. Confirm **every other screen** now reflects `req-2` as paid with zero additional code: `app/(app)/requests/[id].tsx` (paid action block, new transaction rows), `app/request/invoice.tsx` (StatusBadge shows Paid), `app/request/receipt.tsx` (now passes its `status === 'paid'` guard, shows paid date/tx hash), `app/(app)/customers/[id].tsx` (Web3 Labs' `totalReceived` increases by 750, `outstanding` decreases by 750), `app/(app)/home.tsx` (`paidCount`/`pendingCount` shift by one each, `receivedThisMonth` increases by 750, `req-2` appears at the top of Recent Activity since its `activityAt` is now).

If any step in this trace reveals an actual bug, fix it (small, targeted fix only) before proceeding.

- [ ] **Step 3: Duplicate/expired/cancelled protection — explicit trace**

- Using `req-1` (already `'paid'` in seed data): confirm `/pay/demo?id=req-1` shows the "already been paid" blocked state, not the Continue screen. Confirm `beginPaymentConfirmation('req-1')` returns `false` if called directly (guard test from Task 5 already covers this at the store level — confirm the UI-level guard matches).
- Using `req-3` (already `'expired'`): confirm `/pay/demo?id=req-3` shows the expired blocked state.
- Cancel a pending mock request via the existing Cancel Request flow, then confirm `/pay/demo?id=<that request>` shows the cancelled blocked state.
- Confirm the public page (`/pay/[id].tsx`) also hides pay actions for all four non-pending statuses (pending is the only branch with `Pay with Wallet`/`Scan QR`).

- [ ] **Step 4: State-integrity audit**

- Grep `app/pay/demo.tsx` for any code path that could call `completePayment` more than once per `handleContinue` invocation, or call `beginPaymentConfirmation` without the `stage === 'idle'` gate — confirm there is exactly one call site for each.
- Confirm `useTransactionStore.getState().addTransaction` is only ever called from `requestStore.completePayment` (grep the whole `app/` and `src/` tree) — no screen should construct or insert a `Transaction` directly.
- Confirm no screen mutates `request.status` directly (grep for `status:` assignments outside `requestStore.ts`) — all transitions must go through `cancelRequest`/`beginPaymentConfirmation`/`completePayment`.
- Confirm `deleteRequest` still cascades to `removeEventsForRequest` (unchanged from Phase 1B-1) — a deleted request shouldn't leave orphaned events OR a dangling `Transaction`. If `deleteRequest` does NOT also remove the deleted request's `Transaction` (check `src/store/requestStore.ts`'s current `deleteRequest` — it was never updated in this phase to know about `transactionStore`), this is a genuine orphan-data gap introduced by this phase (Transactions didn't exist as deletable data before now). Fix it: add a call to remove any transaction for that request id when deleting, mirroring the existing `removeEventsForRequest` pattern. Add a `removeTransactionForRequest` (or similar) action to `transactionStore` if one doesn't exist, following the same minimal, single-purpose style as `requestEventStore.removeEventsForRequest`.

- [ ] **Step 5: Home/Customer totals — targeted re-derivation check**

Manually recompute, from the current (post-simulation-trace) mock data, what `getCustomerStats('cust-web3-labs', requests)` should return after `req-2` becomes paid, and confirm it matches what `app/(app)/customers/[id].tsx` would render. Do the same for Home's `paidCount`/`pendingCount`/`receivedThisMonth`. This is a manual cross-check of Step 2's trace, not new code.

- [ ] **Step 6: Light theme audit**

Re-read every screen touched or created since Phase 1A began (all of `app/pay/`, `app/request/invoice.tsx`, `app/request/receipt.tsx`, and every file modified in Tasks 1-12) for: hardcoded colors (grep `#[0-9a-fA-F]{3,8}` and `rgba?\(` — zero matches expected outside the pre-existing, already-accepted `QRCodeCard` exception), consistent card/spacing hierarchy (compare `ThemeAwareCard` usage patterns across Invoice/Receipt/Payment Success — they should feel like siblings), Lime (`colors.primaryAction`) reserved for primary CTAs and the Payment Success checkmark circle (not overused elsewhere), sufficient empty space (no cramped `marginTop` chains from Task 6/7's insertions).

- [ ] **Step 7: Dark theme audit**

Confirm every new/modified screen's colors resolve correctly in dark mode by reading `src/theme/colors.ts`'s `darkColors` for every token used: `heroSurfaceText`, `primaryActionText`, `success`, `textSecondary`, `softLavender`/`softLavenderText`, `error`. Confirm the Payment Success screen's lime circle + `primaryActionText` icon reads correctly against `darkColors.background` (`#050505`). Confirm Invoice/Receipt/Public Payment (already dark-audited in 1B-2A) weren't accidentally broken by this phase's edits (they should have zero diff from 1B-2A except the additive `'confirming'` branches, which reuse the same `colors.textSecondary`/`textMuted` tokens already used elsewhere on those screens).

- [ ] **Step 8: Forms/keyboard audit**

This phase added no new forms — confirm by grep that none of Tasks 1-12 touched any `TextField`/`TextInput`/`KeyboardAvoidingView` usage anywhere. If true, this section requires no action; state that explicitly in your report rather than silently skipping it.

- [ ] **Step 9: Accessibility audit**

Confirm every new interactive element (all `PrimaryButton`/`SecondaryButton`/`IconButton` usages in Tasks 11-12 — "Continue", "Try Again", "View Receipt", "Done", the back `IconButton`s) has an accessible label, which all three of those components already provide internally by design (no manual `accessibilityLabel` needed on the buttons themselves, only on raw `Pressable`s — confirm none were added in this phase). Confirm touch targets on the new blocked-state screens are full-width buttons (already true by construction, no new small tap targets introduced).

- [ ] **Step 10: Navigation audit**

Run the same expo-router `getRoutes()` throwaway-script technique used at the end of Phase 1B-1 and 1B-2A (do not commit the script). Confirm:
- `pay` group children are now exactly `[id]`, `demo`, `success` — all still correctly collapsed under `app/pay/_layout.tsx`, none hoisted.
- The `(app)` Tabs group's children are UNCHANGED — still exactly `home`, `requests`, `request-action`, `customers`, `profile`. Neither `success` nor any other new route may appear there.

- [ ] **Step 11: Brand audit**

Grep case-insensitive across every file touched in Tasks 1-12 for `thinx`/`thinxpay.app` — expect zero matches. Confirm "SperoPay" (formal) appears where appropriate (this phase added no new formal-branding headers — Payment Success uses "Payment Received" per the phase spec's own example, not a SperoPay/Spero heading — confirm this matches the literal spec example in phase spec §12, which does NOT show a SperoPay/Spero header on that screen, unlike Invoice/Receipt).

- [ ] **Step 12: Full regression audit against Phase 1A / 1B-1 / 1B-2A**

Confirm via `git diff <task-1-commit>^..HEAD -- <path>` that these remain untouched: `app/(auth)/*`, `app/(onboarding)/*`, `app/request/amount.tsx`, `app/request/details.tsx`, `app/request/created.tsx`, `src/components/BottomNavigation.tsx`, `app/(app)/_layout.tsx`, `app/(app)/customers/*`, `app/(app)/profile/*`, `app/request/invoice.tsx` (should have zero diff — Invoice needed no changes per the design doc's own analysis; if it turns out something DID need to change there and wasn't caught by an earlier task, note it now rather than silently patching around it).

- [ ] **Step 13: Bundle export verification**

```bash
npx expo export --platform ios --output-dir .tmp-verify-1b2b
```
Grep for: `"Payment Received"`, `"Demo Payment"`, `"Confirming"`, `"Try Again"`, `"payment received"` (merchant-confirmation alert text). Delete `.tmp-verify-1b2b` afterward, confirm `git status` clean (the `.tmp-*` gitignore pattern already exists from Phase 1B-1).

- [ ] **Step 14: Fix anything found, final commit**

Small, targeted fixes only for anything genuinely broken found in Steps 2-13. If nothing needs fixing, state that explicitly and skip the commit.

```bash
git add -A
git commit -m "Phase 1B-2B final verification pass"
```
(Only if fixes were made.)

---

## Post-plan

After Task 13, do a final holistic review across the whole branch diff (base = the commit before Task 1), following the same process used at the end of Phase 1B-1 and 1B-2A: look specifically for cross-task issues (the orphaned-Transaction-on-delete class of bug from Step 4 is exactly the kind of thing worth a second, independent look). Fix anything found, then use `superpowers:finishing-a-development-branch` to merge.

This is the final stage of Phase 1. Do **not** start Phase 2. Wait for explicit user approval.
