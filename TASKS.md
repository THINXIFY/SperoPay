# Premium Web UX Pass — pay.speropay.app root + /p/[token]

Scope: pure presentational redesign of exactly 2 screens. No changes to payment
verification, Supabase RPCs/security, Solana logic, or any other app screen.

## Understood before coding
- `WebLandingScreen.tsx` renders for `/` AND every non-allowlisted web path (the
  catch-all in `app/_layout.tsx` via `webRouteGuard.ts`) — redesigning it in place
  serves both "real root visit" and "broken/unknown link" cases; not splitting this,
  out of scope.
- `/p/[token].tsx`'s data (`PublicCheckoutData`) has **no `customerName` field** — the
  RPC doesn't return one. Cannot show "customer name" without a backend/RPC change,
  which is explicitly out of scope. Flagged in final report, not fabricated.
- Same RPC has **no `txHash`/`paidAt`** — "transaction time" and a working Explorer
  link on the Paid state aren't achievable from checkout data alone. Existing
  `/receipt/[token]` page already has both (its own RPC). Solved by adding a "View
  Receipt" button on Paid that navigates to `/receipt/<token>` (pure navigation, no
  backend change) rather than fabricating a partial in-place Explorer link.
- All state-machine logic (`usePublicCheckoutPolling`, `usePayWithWallet`,
  `canPayRequest`, `recordRequestViewed`, partial-payment amount validation,
  `buildSolanaPayUrl`) stays byte-for-byte — only JSX/styling around it changed.
- `FullScreenQRModal`'s fixed QR size (260) + modal padding could exceed 320px width.
  Fixed responsively; shared with 2 native screens (Request Created, Request Detail),
  strictly additive there too (falls back to the same 260 the instant there's room).

## COMPLETED

### Root page (`src/components/WebLandingScreen.tsx`)
- [x] Reworked copy: tagline, "Secure crypto payments for modern businesses."
- [x] Added 3-step flow (Open payment link → Pay from your wallet → Receive confirmation)
- [x] Added trust points row/grid (Non-custodial / Direct to business wallet / USDC on Solana / Verified on-chain)
- [x] Added subtle "Learn more about Spero" CTA linking to `https://speropay.app`
- [x] Added polished footer
- [x] Preserved existing Google Play CTA / "coming soon" logic untouched

### Checkout page (`app/p/[token].tsx`)
- [x] Header: Spero mark + "Secure checkout" trust pill, separate from merchant identity in the hero
- [x] Payment hero rebuilt as one cohesive card: merchant row, dominant amount, StatusBadge,
      description, network/Devnet badge, reference, expiry — replaces the old split of a bare
      text block + a separate bottom "general details" card repeating some of the same facts
- [x] Primary CTA restructure: dominant Pay with Wallet; secondary row (Show QR / Copy Link);
      wallet address stays the de-emphasized "Manual payment (fallback)" card
- [x] Wired `getPublicPaymentUrl(token)` into FullScreenQRModal's `publicLink` prop
- [x] Paid state: "Verified on-chain" badge + "View Receipt" → `/receipt/<token>`
- [x] Submitted/confirming copy updated to match spec wording exactly
- [x] `payError` (wallet-unavailable) upgraded to a polished inline banner (icon + soft-red background)
- [x] Temporary network error now visually distinct from unavailable-link (blue card + Try Again
      vs. neutral EmptyState) — verified both render correctly, see Verification
- [x] Trust messaging kept near the CTA, restyled with a lock icon

### Shared component fix
- [x] `FullScreenQRModal.tsx`: QR size now clamped to `windowWidth - 2*spacing.xl - 2*spacing.base`
      (min 180, max 260) — can no longer overflow at 320px, unchanged on any wider screen

### Explicitly not implemented (flagged, not silently skipped)
- **Sticky bottom CTA**: attempted, then removed. `position: 'sticky'` inside an RN-Web
  `ScrollView`'s content is genuinely uncertain territory with no existing precedent in this
  codebase, and I have no way to visually verify it wouldn't render broken (floating over
  content, disappearing, etc.). Shipping unverified experimental positioning felt riskier than
  leaving the button in normal flow, which was already working. The CTA sits high in the page
  (right after the hero card), so the scroll distance to it is short regardless.

## Holistic review pass — 3 real bugs found and fixed
- [x] **`WebLandingScreen.tsx`'s `justifyContent: 'center'`** on the new (taller) scroll
      content: on a viewport shorter than the content, this centers overflow
      symmetrically above/below the box — the portion pushed above sits at a negative
      scroll offset the browser never lets the user reach, permanently hiding the
      logo/headline. Fixed by dropping `justifyContent: 'center'` (kept
      `alignItems: 'center'` for horizontal centering), matching the checkout page's
      own already-correct pattern. **Re-verified with an actual short-viewport
      (320×480) screenshot after the fix** — logo/headline now render at the very top,
      fully visible, `scrollY` correctly bottoms out at 0.
- [x] **`adjustsFontSizeToFit` on the checkout amount** — not implemented by
      react-native-web at all (silently ignored); combined with `numberOfLines={1}` it
      would hard-truncate a long amount with an ellipsis on the web build, on exactly
      the platform this pass targets, instead of the auto-shrink the prop implies.
      Removed both props — reverts to natural wrapping, the same safe behavior the
      original code already had before this pass touched it.
- [x] **`Linking.openURL` with no error handling** on the new "Learn more about Spero"
      button (a rejected promise — e.g. a popup blocker — would be an unhandled
      rejection with silent failure). Added a small `openExternal()` helper
      (try/catch, silent swallow — this is a non-critical marketing link, not a
      payment action) and applied it to both the new button and the pre-existing
      Google Play button for consistency within the file.

## Verification

- [x] `npx tsc --noEmit` — clean
- [x] Full Jest suite — 95 suites / 813 tests, unchanged from baseline (no logic touched)
- [x] `npm run export:web` — succeeds
- [x] **Real browser verification performed** (not just code review): installed Playwright +
      headless Chromium (redirected to E: drive, given C: has ~275MB free), started the actual
      Expo web dev server, and screenshotted both pages at 320/360/390/430/1280px. Checked
      `document.body/documentElement.scrollWidth` against viewport width at every size (zero
      overflow anywhere) and browser console for errors (none). Actually looked at every
      screenshot, not just the numbers.
  - Root page: verified at all 5 widths — matches brand, no overflow, reads as premium.
  - Checkout page: verified top bar, the network_error state (blue card, Try Again — confirmed
    working), and the invalid_token state (neutral EmptyState) — confirmed the two are visually
    distinct as required.
  - **Not verified**: the payable/pending/confirming/paid hero states, QR modal, and
    partial-payment UI — this environment has no real payment token from the live database to
    load, and I'm not going to claim these look right without having seen them. Code-reviewed
    carefully (same components/patterns already proven in the states I did see), but that's a
    weaker claim than an actual screenshot — flagged explicitly in the final report.
