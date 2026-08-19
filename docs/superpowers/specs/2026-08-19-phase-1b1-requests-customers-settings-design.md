# SperoPay — Phase 1B-1: Requests, Customers, Templates, Profile & Settings

Status: Approved
Date: 2026-08-19

## 1. Purpose

Complete the merchant-management side of Spero, continuing directly on top of Phase 1A's architecture (no rebuild, no duplicated stores/components/theme). Still frontend-only with mock/local state — no Supabase, real auth, blockchain APIs, wallet providers, or real payments.

Brand rule carried forward: **Spero** for in-app UX, **SperoPay** for formal/product contexts.

## 2. Scope

- Requests: search, filters (incl. new Cancelled status), request detail with timeline, Share Again / Send Reminder / Cancel / Create Again / Delete actions
- Customers: list, add/edit, detail with history, "Request Payment" from customer
- Request Templates: create/edit/delete/use, prefills Smart Request
- Profile restructured into a settings hub: Business Profile, Wallet Settings, Payment Defaults, Appearance (existing), Notifications, Security UI, Help & Support, About SperoPay, Sign Out (existing)

Explicitly deferred to Phase 1B-2+: invoice UI, full receipt UI, public payment page, payment simulation/success, real QR payment flow, WalletConnect, Solana RPC, Supabase, blockchain monitoring, real payments, real push backend.

## 3. Architecture decisions

### 3.1 Nested Stack layouts (navigation fix)

`app/(app)/requests/`, `app/(app)/customers/`, and `app/(app)/profile/` currently have no `_layout.tsx` of their own, so Expo Router hoists every file inside them (e.g. `requests/[id].tsx`) into the outer Tabs navigator's flat route list as a sibling of the real tabs — a bug Phase 1A discovered and patched around with manual filtering in `BottomNavigation.tsx` (excluding `'requests/[id]'` by name). Phase 1B-1 adds ~9 new nested screens across these three segments; patching the filter list per screen doesn't scale.

**Fix:** give each of the three segments its own `_layout.tsx` (`<Stack screenOptions={{ headerShown: false }} />`). This makes Expo Router treat each segment as a single nested-stack tab route (`'requests'`, `'customers'`, `'profile'`) instead of hoisting children individually. `BottomNavigation.tsx`'s `ICONS`/`LABELS` maps and route-name lookups change from `'requests/index'` → `'requests'` (etc.), and the manual `'requests/[id]'` exclusion is removed entirely — nested screens no longer reach the tab bar's route list at all.

This must be verified empirically (call expo-router's `getRoutes()` directly against the real `app/` tree, same technique used in Phase 1A) before any other Phase 1B-1 screen work begins, since every subsequent screen nests inside one of these three segments.

### 3.2 Customer stats: derived, not stored

`Customer.totalRequests`/`totalAmount` are removed from the type and mock data. A new pure utility, `getCustomerStats(customerId, requests): { totalRequests: number; totalReceived: number; outstanding: number }`, computes stats live from `requestStore.requests` wherever needed (Customers list, Customer detail). This removes the staleness risk Phase 1A's review already caught once with hardcoded totals that didn't match seeded requests.

### 3.3 Data model additions (`src/types/`)

- `PaymentRequestStatus`: add `'cancelled'`
- `RequestEventType`: redefined to `'created' | 'shared' | 'payment_detected' | 'payment_confirmed' | 'reminder_sent' | 'cancelled' | 'expired'` (replaces the old unused `'viewed'|'paid'` variants, matches the actual timeline stages requested)
- `Profile`: add optional `businessEmail?: string`, `businessDescription?: string`, `businessLogoUri?: string` — extends the existing type rather than introducing a separate `BusinessProfile` type/store, avoiding duplicated identity data
- New `Template`: `{ id: string; name: string; amount: number; description?: string; expiryOption: ExpiryOption }`
- `NotificationPreferences` and `RequestEvent`/`Transaction` (already defined in Phase 1A, unused) now get real consumers

### 3.4 New stores (persisted via the existing `persist` + AsyncStorage pattern, key namespace `speropay/*`)

- `requestEventStore` — `events: RequestEvent[]`, seeded with mock timeline entries for existing mock requests (created for all; shared + payment_detected + payment_confirmed for paid ones; created + shared for pending ones); actions: `addEvent(requestId, type)`, `getEventsForRequest(requestId)`
- `templateStore` — `templates: Template[]`, seeded with the 3 example templates from the spec; actions: `addTemplate`, `updateTemplate`, `deleteTemplate`
- `notificationStore` — `preferences: NotificationPreferences`; action: `updatePreferences(patch)`
- `paymentDefaultsStore` — `{ defaultExpiryOption: ExpiryOption }`; action: `setDefaultExpiryOption`. Stablecoin/network stay fixed (USDC/Solana, matching existing scope); "default wallet" is just `walletStore`'s single wallet — no multi-wallet concept introduced.
- `securityStore` — `{ biometricLockEnabled: boolean; appLockEnabled: boolean }`; mock toggle actions only, no real biometric API integration

### 3.5 Store extensions

- `requestStore`: add `updateRequestStatus(id, status: PaymentRequestStatus)` (used by Cancel). Search/filter stays a derived `useMemo` selector inside the screen, matching the existing Requests-list pattern — not a store method.
- `customerStore`: add `updateCustomer(id, patch: Partial<Omit<Customer, 'id'>>)`

## 4. Screens

| Route | Change |
|---|---|
| `app/(app)/requests/_layout.tsx` | New — Stack layout |
| `app/(app)/requests/index.tsx` | Modify — add search field, add Cancelled filter chip |
| `app/(app)/requests/[id].tsx` | Modify — add timeline (from `requestEventStore`), status-appropriate actions: Pending → Share Again / Send Reminder / Cancel; Paid → Receipt placeholder entry point; Expired/Cancelled → Create Again / Delete |
| `app/(app)/customers/_layout.tsx` | New — Stack layout |
| `app/(app)/customers/index.tsx` | Modify — use `getCustomerStats`, route rows to detail, add search, add `EmptyState` |
| `app/(app)/customers/[id].tsx` | New — avatar/contact/stats, "Request Payment" CTA (opens Smart Request with customer preselected), history list (tapping an item opens that request) |
| `app/(app)/profile/_layout.tsx` | New — Stack layout |
| `app/(app)/profile/index.tsx` | Modify — regroup into Account / Payments / Preferences / Support / Session sections per spec §10, wire real navigation to the new sub-screens, Currency Display becomes a bottom sheet (matching the existing Appearance pattern) |
| `app/(app)/profile/business.tsx` | New — business name/logo(mock)/website/email/description form |
| `app/(app)/profile/wallet.tsx` | New — display + copy + edit receiving wallet |
| `app/(app)/profile/payment-defaults.tsx` | New — default expiry picker, read-only stablecoin/network/wallet display |
| `app/(app)/profile/templates.tsx` | New — list/create/edit/delete templates (not in bottom nav, per spec) |
| `app/(app)/profile/notifications.tsx` | New — 4 toggles bound to `notificationStore` |
| `app/(app)/profile/security.tsx` | New — mock Change Password flow, Biometric Lock toggle, App Lock toggle |
| `app/(app)/profile/about.tsx` | New — "About SperoPay" formal-brand screen |
| `app/(app)/profile/help.tsx` | New — Help & Support (static content) |

### Request flow integration

- **Create Again**: reads a cancelled/expired request's fields, writes them into `requestDraftStore`, navigates to `/request/amount` for editing before resubmission.
- **Use Template**: reads a `Template`, writes its fields into `requestDraftStore`, same entry point.
- **Request from Customer**: writes `customerId` into `requestDraftStore` before navigating to `/request/amount`.
- `request/amount.tsx`'s draft initialization reads `paymentDefaultsStore.defaultExpiryOption` instead of the hardcoded `'7d'` when starting a fresh (non-prefilled) request.

### Reminder message

Generated via a new pure utility `buildReminderMessage(request, customer): string`, following the tone in spec §5, referencing "Spero" (in-app brand). Reused by both "Share Reminder" (native `Share.share`) and "Copy Message" (`expo-clipboard`) actions — same pattern as the existing Created-screen share actions.

## 5. Explicitly out of scope (per spec §19)

Invoice UI, full receipt UI (only a placeholder entry point on Paid requests), public payment page, payment simulation/success, real QR payment flow, WalletConnect, Solana RPC, Supabase, blockchain monitoring, real payments, real push backend.

## 6. Completion criteria

Matches spec §21 verbatim: Requests search/filter/detail/timeline/reminder/cancel/create-again; Customers add/edit/detail/history/request-from-customer; Templates create/edit/delete/use; Profile business/wallet/defaults/appearance/notifications/security; Light/Dark consistency; local persistence; TypeScript passes; no Phase 1A regression.

## 7. Verification plan

- `npx tsc --noEmit`, `npx jest` after each task and at the end
- Headless bundle export (`npx expo export`) at key integration points (after the nested-layout fix, and at the end), following the same verification approach established in Phase 1A
- Manual regression pass (code-level audit, no device available in this environment — same limitation as Phase 1A) against spec §20's explicit list
- Final holistic review across the full diff before merge, per the established process
