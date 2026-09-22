# Phase 3E (corrected) — Production Web Deployment, integrated onto phase-avatars

## Critical correction from the original plan

The original Phase 3E work was built on a stale `master` branch that turned out to be
47 commits behind `phase-avatars`. Worse: `phase-avatars` itself had 194 uncommitted
files (migrations 0011-0022, the real `/c/[token]` client portal, `checkoutBaseUrl.ts`,
reminders, recurring/partial payments, notifications, multi-currency, archive, reports)
that were never committed — now committed as `dd7ffa7` on `phase-avatars` (user-approved).

**Audited and confirmed already built on phase-avatars — do NOT rebuild these:**
- [x] `/p/[token]` checkout — anonymous-safe, no AuthGate, already web-safe (inline
      "Copied" state, not `Alert.alert`)
- [x] `/c/[token]` client portal — anonymous-safe, superior design (lazy/revocable
      `customers.portal_token`, separate RPCs for requests/payments/recurring, partial
      payment accounting), merchant UI to get/copy/share/regenerate already wired up
- [x] Centralized URL helpers — `checkoutBaseUrl.ts` + `publicPaymentLink.ts` +
      `customerPortalLink.ts`, same pattern already correct
- [x] `webRouteGuard.ts` — separate allowlist gating `(app)`/other routes on web builds
- [x] Vercel hosting config (`vercel.json`) — build command, SPA rewrite, security
      headers already present. **User confirmed: keep Vercel, do not add Netlify config.**

## COMPLETED

### Public documents
- [x] New migration `supabase/migrations/0023_public_invoice_receipt.sql` (next number
      after 0022) — `get_public_invoice` + `get_public_receipt` RPCs, same
      SECURITY DEFINER pattern as the rest of the codebase.
- [x] `app/invoice/[token].tsx` + `_layout.tsx` — public invoice page.
- [x] `app/receipt/[token].tsx` + `_layout.tsx` — public receipt page (one line per
      verified transaction, supports partial payments).
- [x] Registered `invoice`/`receipt` in root `app/_layout.tsx` + `webRouteGuard.ts`
      allowlist (+ tests).
- [x] Added `getPublicInvoiceUrl`/`getPublicReceiptUrl` to the centralized link helper
      (`publicInvoiceLink.ts`/`publicReceiptLink.ts`, mirroring `customerPortalLink.ts`'s
      one-function-per-file convention) — wired into both the public pages' own
      Share/Copy actions and the merchant-facing invoice/receipt screens' share messages
      (neither previously linked back to itself).
- [x] Web-safe Share/Copy — inline confirmation state throughout, `Share.share` failures
      (no Web Share API) fall back to clipboard copy with visible feedback, never
      `Alert.alert` (a no-op on react-native-web).
- [x] `src/services/publicDocuments/` — types + invoiceService + receiptService (composes
      `get_public_invoice`+`get_public_receipt` in parallel, mirroring
      `customerPortalService`'s multi-RPC pattern) + hooks + 22 new tests.
- [x] Extracted `CustomerFacingStatusPill` out of `app/c/[token].tsx`'s inline
      component so the invoice page reuses the same customer-facing status logic.

### Bug fix (flagged by audit, in scope — broken/hardcoded production link)
- [x] `supabase/functions/process-recurring-plans/index.ts:151` hardcoded
      `https://pay.speropay.app/r/${paymentCode}` — now routed through the shared
      `getCheckoutBaseUrl()` instead of a second hardcoded domain copy (the `/r/` path
      itself is an established, deliberately-unused legacy placeholder, same as
      `buildPaymentRequest.ts`'s identical pattern — not a new route to build).

### Hosting verification (Vercel, not Netlify)
- [x] Verified via an actual `expo export -p web` (not assumed): the default
      `expo.web.output` (unset) already produces a single index.html + single JS bundle
      with absolute root-relative paths — exactly what `vercel.json`'s catch-all rewrite
      expects. **No `app.json` change needed.**
- [x] `EXPO_PUBLIC_CHECKOUT_BASE_URL` guidance confirmed for Vercel env vars (see final report).

### Verification
- [x] `npx tsc --noEmit` — clean.
- [x] Full Jest suite — 95 suites / 813 tests (up from the 93/793 baseline).
- [x] `npx expo export -p web` — succeeds.
- [x] Confirmed all 3 Edge Function directories still present (verify-payment,
      process-reminders, process-recurring-plans) — untouched except the one link fix.
- [x] Holistic code-review pass — found and fixed: receipt page's Share had no link back
      to itself, its web fallback gave no "Copied" feedback, and `getPublicInvoiceUrl`
      was dead code (nothing linked to the invoice page itself) — all fixed; deduped
      `isKnownStatus` between invoiceService/receiptService.
- [x] Final report delivered to user.

## Post-report fix: orphaned artifacts from the abandoned old branch

Running migration 0023 against the live database failed: `get_public_invoice(uuid)`
already existed with a different shape. Root cause: the OLD, abandoned
`phase-3e-web-production` branch's migration `0008_phase3e_web_production.sql` (which
independently reinvented the client portal before the real one on `phase-avatars` was
discovered) had already been run against this same database earlier in this session,
before the duplication was caught. Confirmed via grep that nothing in the current
codebase references `customers.public_token` or `get_public_client_portal` — pure
orphaned cruft. Migration 0023 now:
- Drops the orphaned `get_public_client_portal(uuid)` function.
- Drops the orphaned `customers.public_token` column (the real one is
  `customers.portal_token`, from 0014).
- Drop-then-creates `get_public_invoice`/`get_public_receipt` (the established pattern
  this codebase already uses whenever a `RETURNS TABLE` shape changes).
The whole file is idempotent — safe to re-run in full even though part of the original
version may have already executed before erroring.

**Confirmed applied by the user** ("Success. No rows returned") — `get_public_invoice`/
`get_public_receipt` are live with the correct shape, and the orphaned
`get_public_client_portal`/`customers.public_token` artifacts are gone.

## Known, deliberately-not-fixed (flagged, not silently dropped)
- The server-side "verified paid amount" accounting (sum transactions, clamp at 0) is
  now duplicated across 4 SQL functions (`get_public_payment_request` 0012,
  `get_customer_portal_requests` 0014/0022, and this phase's `get_public_invoice`).
  Consolidating into one shared SQL helper would require touching already-applied
  migrations, which is explicitly out of scope for this task ("do not modify
  already-applied migrations") — flagged for a future dedicated migration if desired.
