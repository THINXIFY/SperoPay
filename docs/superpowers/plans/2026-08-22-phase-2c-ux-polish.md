# Phase 2C: Performance, Responsiveness & UX Polish — Implementation Plan

**Goal:** Fix real interaction/perf bugs (Continue button, Network bottom sheet) and polish buttons, Customers/Customer Detail, loading states, forms, and lists — no business/payment/auth logic changes.

**Architecture:** Direct execution in this session, task-by-task, `tsc`/`jest` checked after each group, one commit per group.

---

## Diagnosed root causes (from codebase survey)

1. **Continue/primary-CTA button "impossible to tap" bug**: In every screen with a `KeyboardAvoidingView` wrapping a form's `ScrollView` (`(onboarding)/profile.tsx`, `(auth)/login.tsx`, `(auth)/sign-up.tsx`, `(auth)/forgot-password.tsx`, `(auth)/reset-password.tsx`, `(onboarding)/wallet-setup.tsx`, `(app)/profile/{wallet,security,edit,business}.tsx`, `request/details.tsx`), the footer `PrimaryButton` is a **sibling** of the `KeyboardAvoidingView`, not a child of it. On iOS, `behavior="padding"` only pads the `KeyboardAvoidingView` itself — the sibling footer below it does not move, so the keyboard can cover it. Fix: move the footer button inside the `KeyboardAvoidingView` (as a non-scrolling footer alongside the `ScrollView`, both children of one flex column) in each of these files.
2. **Double-submit on async Continue**: `(onboarding)/profile.tsx` and `(onboarding)/usage-type.tsx` await a network call in their `handleContinue` with no `loading`/re-entrancy guard on the button — add local `isSubmitting` state wired to `PrimaryButton`'s `loading`/`disabled`.
3. **Network (and every other) bottom sheet "partially opened/clipped"**: `src/components/AppBottomSheet.tsx` passes explicit `snapPoints={['40%','70%']}` but never sets `enableDynamicSizing`, which **defaults to `true`** in `@gorhom/bottom-sheet` v5 (`DEFAULT_DYNAMIC_SIZING = true`, `node_modules/@gorhom/bottom-sheet/src/components/bottomSheet/constants.ts:15`). Dynamic sizing measures content and conflicts with fixed percentage snap points — gorhom's own docs say to disable it when using explicit `snapPoints`. Fix: `enableDynamicSizing={false}` on the shared `AppBottomSheet`. Also add safe-area-aware bottom padding (no `useSafeAreaInsets()` call exists today) and a scrollable content variant for sheets with potentially-long lists (customer picker in `request/details.tsx`).
4. **Customer list stats recomputed per row per render**: `getCustomerStats(id, requests)` is O(requests.length) and is called fresh inside `renderItem` on every render in both `customers/index.tsx` and (for the single detail customer, less severe) `customers/[id].tsx`. Fix: precompute a `Map<customerId, CustomerStats>` once via `useMemo` in the list screen.
5. **`SelectableCard` has zero press feedback** (static `style` array, not the `({pressed}) => …` function form every other Pressable in the app uses).

---

## Task 1 — Bottom sheet: fix clipped/partial-open bug (Section 4)

**File:** `src/components/AppBottomSheet.tsx`

- Add `enableDynamicSizing={false}` to the `<BottomSheet>`.
- Add `useSafeAreaInsets()` and pass `paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.base)` on the inner `BottomSheetView` content style (replacing the current fixed `spacing.xl`).
- Add an optional `scrollable?: boolean` prop: when true, render `BottomSheetScrollView` instead of `BottomSheetView` (import from `@gorhom/bottom-sheet`), so screens with potentially-long option lists can opt in.
- Keep default snap points `['40%', '70%']` as-is (not the reported bug; the dynamic-sizing conflict was).

**File:** `app/request/details.tsx` — pass `scrollable` on the customer-picker `AppBottomSheet` (the one with `customers.map(...)`, lines ~203-245), since that list can grow arbitrarily.

Verify: `npx tsc --noEmit` clean.

## Task 2 — Continue button: fix keyboard-covers-button + add submit guards (Sections 3, 12)

For each of these files, move the footer `PrimaryButton`'s wrapping `View` to be the last child *inside* `KeyboardAvoidingView` (sibling of the `ScrollView`, both under one `style={{flex:1}}` wrapper), so iOS `padding` behavior shifts the whole column including the footer:
- `app/(onboarding)/profile.tsx`
- `app/(auth)/login.tsx`
- `app/(auth)/sign-up.tsx`
- `app/(auth)/forgot-password.tsx`
- `app/(auth)/reset-password.tsx` (the `Update Password` form branch only — the post-success `Continue` branch has no keyboard involved, leave as-is)
- `app/(onboarding)/wallet-setup.tsx`
- `app/(app)/profile/wallet.tsx`, `security.tsx`, `edit.tsx`, `business.tsx`
- `app/request/details.tsx`

Add re-entrancy guards:
- `app/(onboarding)/profile.tsx`: add `const [isSubmitting, setIsSubmitting] = useState(false)`; guard top of `handleContinue` with `if (isSubmitting) return;`, set true before the `try`, false in `finally`; pass `loading={isSubmitting}` to the `PrimaryButton`.
- `app/(onboarding)/usage-type.tsx`: same pattern around `handleContinue`'s `await setUsageType(...)`.

Verify: `npx tsc --noEmit` clean; manually confirm no other screen's `handleContinue`/`handleSubmit` needs the same guard (grep for `async function handle` near a `PrimaryButton` without `loading`/`isCreating`/`isLoading` wired — `pay/demo.tsx` already can't double-submit per the stage-based re-render; `request/amount.tsx`'s Continue is synchronous, no guard needed; `request/details.tsx` already uses `isCreating` from the store).

## Task 3 — Button/card press feedback (Sections 2, 11, 13)

**File:** `src/components/SelectableCard.tsx` — convert `style={[...]}` (static array) to `style={({ pressed }) => [...]}`, add `opacity: pressed ? 0.85 : 1` and `transform: [{ scale: pressed ? 0.98 : 1 }]` to the existing style object. **Do not touch `styles.card` (`width: '100%'`)** — that was a deliberate fix for a height-collapse bug (commit `b9bfa47`).

**File:** `src/components/SecondaryButton.tsx` — add the same `transform: [{ scale: pressed ? 0.98 : 1 }]` used by `PrimaryButton`, alongside its existing opacity change, for consistency.

**File:** `src/components/IconButton.tsx` — add `transform: [{ scale: pressed ? 0.92 : 1 }]` (icon buttons read better with a slightly larger scale delta than full buttons).

Verify: `npx tsc --noEmit` clean.

## Task 4 — Loading experience (Sections 8, 16)

**File:** `src/components/SkeletonLoader.tsx` already exists (pulse animation, `Animated.timing`, unused anywhere today) — wire it in:
- `app/(app)/customers/index.tsx`: when `status === 'loading'`, render 4-5 `SkeletonLoader` rows shaped like a customer row instead of the current bare `ActivityIndicator`.
- `app/(app)/requests/index.tsx`: same treatment for its loading state (read the file first to find the equivalent `status === 'loading'` branch).

**Copy pass** (Section 16) — replace verbose copy with short/calm equivalents where found:
- `request/details.tsx:199` — `"Creating your request..."` → `"Creating request…"` (already close; keep as reference, adjust only if a longer variant is found elsewhere via grep for `Please wait`, `has been`, `successfully`, `in progress`).
- Grep `app/` for `Please wait`, `successfully`, `has been` and shorten any hits found to match the two-to-four-word pattern the spec models (`"Creating request…"`, `"Saved"`).

Verify: `npx tsc --noEmit` clean; `npx jest` still green (no store logic touched).

## Task 5 — Customers screen redesign (Sections 5, 1)

**File:** `app/(app)/customers/index.tsx`

- Precompute stats once: `const statsById = useMemo(() => { const map = new Map<string, CustomerStats>(); for (const c of customers) map.set(c.id, getCustomerStats(c.id, requests)); return map; }, [customers, requests]);` — `renderItem` reads `statsById.get(item.id)` instead of calling `getCustomerStats` inline.
- Wrap `renderItem` in `useCallback`; extract the row into its own `React.memo`'d function component (`CustomerRow`) in the same file (small, single-use — not worth a separate file) so unrelated re-renders of the screen don't re-render every row.
- Visual polish of the row: compact avatar (32px, down from default), tighter row padding (`spacing.sm` vertical instead of implicit default), hairline `borderBottomWidth: 1, borderBottomColor: colors.border` between rows instead of `gap`-separated implicit whitespace, secondary line reads `{count} payments` (lowercase, matches spec's example) instead of `"Requests"`.
- Search field: reduce height slightly (44 instead of 48) and confirm `returnKeyType="search"` is set (add if missing).
- Add button: keep circular, confirm 40px hit target already meets the 44px-comfortable guideline — bump to 44 if not already.

Verify: `npx tsc --noEmit` clean; `npx jest` green.

## Task 6 — Customer stats + Customer Detail layout (Sections 6, 7)

**New file:** `src/components/StatTile.tsx` — a compact stat tile (label + value), no shadow, hairline border only, small height, used for the 3-stat row. Props: `label: string`, `value: string`, `style?: ViewProps['style']`.

**File:** `app/(app)/customers/[id].tsx`
- Replace the 3 `ThemeAwareCard`s in the stats row with `StatTile`.
- Use `useWindowDimensions()` to check width; if `width < 360`, render as a 2-column wrap (first two tiles in a row, third full-width below) instead of 3-in-a-row — implement via `flexWrap: 'wrap'` with each tile at `width: width < 360 ? '48%' : undefined, flex: width < 360 ? undefined : 1`.
- `stats` computation stays as-is (already computed once outside the list, not per-row).
- Keep structure order per spec: identity → compact stats → primary CTA (`Request Payment`, already present) → history caption → list.

Verify: `npx tsc --noEmit` clean.

## Task 7 — List rendering perf (Sections 1, 10)

- `app/(app)/customers/[id].tsx`: wrap `renderItem` (history `RequestCard`) in `useCallback`; the `transactions.find(...)` per row stays (small local list, not worth a map for a single customer's history) but move it to be memoized per visible item via `React.memo` on a small inline row wrapper, OR precompute a `Map<requestId, Transaction>` once via `useMemo` from `transactions` (prefer this — same pattern as Task 5, consistent).
- `app/(app)/requests/index.tsx`: read the file, apply the same `useCallback`-wrapped `renderItem` + `React.memo` pattern if `renderItem` is currently inline (per survey, yes).
- `RequestCard` (`src/components/RequestCard.tsx`): wrap the export in `React.memo`.

Verify: `npx tsc --noEmit` clean; `npx jest` green.

## Task 8 — Navigation feel + footer recheck (Sections 9, 14)

- Read `app/(app)/_layout.tsx` and `src/components/BottomNavigation.tsx` in full; per the survey this already looks correct (circular button, safe-area insets handled, instant press feedback) — this task is a **verification pass**, not a rewrite. Only change something if an actual defect is found (e.g. layout shift between screens, tap latency). Do not redesign.
- Check `request/details.tsx`'s `handleCreateRequest` and any other post-mutation navigation for unnecessary sequential awaits that could be reordered (local-state-first, then navigate, background persistence) — but do **not** change ordering where it would let the user navigate away before a request row that later screens depend on (`created.tsx`, `invoice.tsx`) actually exists in the store. Given `createRequest` already returns the created row synchronously into the store before `router.replace`, no change is needed here — document the finding, don't force a change.

## Task 9 — Forms & keyboard pass (Section 12)

- Re-verify each file touched in Task 2 for: correct `keyboardType`, `returnKeyType="next"` chaining into the next field's `onSubmitEditing` where it's missing, and `keyboardShouldPersistTaps="handled"` on every form `ScrollView` (already present in the files surveyed — confirm for the additional ones: `sign-up.tsx`, `forgot-password.tsx`, `wallet-setup.tsx`, `profile/{wallet,security,edit,business}.tsx`).

Verify: `npx tsc --noEmit` clean.

## Task 10 — Theme audit of touched components (Sections 15, 17)

- Grep every file touched in Tasks 1-9 for hardcoded hex colors (`#` literals outside `theme/colors.ts`) — fix any found to use `colors.*` tokens.
- Confirm `StatTile` (Task 6) and any new styles read colors/spacing from `useTheme()` only.

## Final steps

1. Run full `npx tsc --noEmit` and `npx jest` — must be clean/green.
2. Dispatch a holistic review agent (opus) against the full branch diff vs. `master`, focused on: keyboard-avoiding restructuring not breaking existing layouts, the bottom-sheet `enableDynamicSizing` change not clipping existing content in the *other* 8 `AppBottomSheet` consumers, no accidental business-logic changes.
3. Fix findings, re-verify tsc/jest.
4. Use `finishing-a-development-branch` skill.
5. Deliver the final report in the format the spec's "Final Report" section requested.
