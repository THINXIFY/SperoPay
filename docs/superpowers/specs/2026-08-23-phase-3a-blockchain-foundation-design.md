# Phase 3A: Real Solana + USDC Payment Infrastructure Foundation — Design

## Scope

Infrastructure only. No wallet-connect UX, no screens wired to real payments, mock engine untouched and still the active path. This doc records the architectural decisions the spec explicitly delegated ("choose/recommend") so they're reviewable before implementation, not buried across 15 new files.

## What's being built

```
src/services/blockchain/solana/
  config.ts               network config (devnet/mainnet-beta), RPC endpoint resolution
  usdc.ts                 USDC mint addresses + decimals per network
  types.ts                shared types (ParsedTokenTransfer, PaymentVerificationResult, etc.)
  amount.ts                decimal <-> base-unit (bigint) conversion, no floats
  walletValidation.ts     real base58/PublicKey-backed Solana address validation
  client.ts               RPC provider abstraction + a public-endpoint default implementation
  transactionParser.ts    extracts USDC transfers from a fetched transaction
  paymentVerifier.ts      the 8-point check from spec section 12
  paymentMatcher.ts       orchestrates verifier against a specific PaymentRequest + a
                           caller-supplied "signature already used" check
  errors.ts               structured error types (spec section 26)
  paymentMode.ts          mock/real mode flag + fail-safe config guard

supabase/migrations/0005_phase3a_payment_foundation.sql
  - payment_requests.public_token (new opaque public bearer token)
  - transactions.tx_hash unique constraint (duplicate-signature protection)
  - payment_requests.amount / transactions.amount widened to numeric(20,6)
  - get_public_payment_request(p_token) — new SECURITY DEFINER RPC, granted to anon
```

Nothing under `app/` changes. `requestStore.ts`'s mock-driven `beginPaymentConfirmation`/`completePayment` are untouched.

## Decision 1 — RPC provider

Default implementation talks to Solana's public `clusterApiUrl('devnet')` / `mainnet-beta` endpoints — free, no signup required to get this foundation working today. `SolanaRpcProvider` is an interface (`getParsedTransaction`, `getSignatureStatus`), so a paid provider (Helius/QuickNode/Alchemy) can be swapped in later purely via `EXPO_PUBLIC_SOLANA_RPC_URL` — no domain-logic changes needed. Reading public blockchain data requires no secret, so this env var is safe as `EXPO_PUBLIC_*` (client-exposed) — it's just an endpoint URL, not an API key. If a future provider needs an API key in the URL/header, that becomes a server-side-only concern for whichever backend boundary calls it (see Decision 4), not something the mobile client ever holds.

## Decision 2 — Money precision

USDC has 6 decimals on-chain. `payment_requests.amount`/`transactions.amount` are currently `numeric(18,2)` — correct for display but lossy for on-chain matching. The migration widens both to `numeric(20,6)` (safe, non-breaking — existing 2-decimal values are unaffected, just no longer truncated if a future flow needs finer amounts). All on-chain comparisons happen in **base units as `bigint`**, converted via string-safe parsing in `amount.ts` (`"10.50" -> 10_500_000n`) — no `Number` multiplication anywhere near a money comparison. No new dependency needed for this (hand-rolled string-to-bigint conversion is ~15 lines and fully unit-testable, versus pulling in a decimal library for one function).

## Decision 3 — Wallet validation

`isValidWalletAddress` (`src/utils/validators.ts`) is currently a regex shape-check only — accepts base58-*looking* strings without confirming they decode to an actual 32-byte key. `walletValidation.ts` adds a real check via `@solana/web3.js`'s `PublicKey` constructor (throws on decode failure or wrong byte length). `validators.ts`'s existing function starts delegating to it, so every existing caller (onboarding, wallet settings) gets the stronger check for free, with zero API change.

## Decision 4 — Detection architecture & backend authority

Spec section 21 asks me to recommend one of: RPC polling, provider webhooks, or client-submitted-signature-plus-server-verification. **Recommending option C** (signature submitted by payer, independently re-verified server-side) as the Phase 3A target, because:
- It requires no persistent backend process (no polling worker, no webhook receiver) — this project has zero server infrastructure today (confirmed: no `supabase/functions/`, no server directory anywhere), so this is the only option buildable without standing up new infrastructure class.
- It fits the project's existing pattern: state transitions already happen via Postgres RPC calls the client invokes at the right moment (`begin_payment_confirmation`, `complete_payment`) — swapping the mock coin-flip for "fetch this signature from Solana RPC and independently verify it" is an extension of the same shape, not a new one.
- Section 22 requires the mobile client can never unilaterally mark a request paid. This model satisfies that: the client submits *evidence* (a signature), and whatever verifies it re-derives the truth from the chain itself rather than trusting the client's claims about amount/destination/success.

**What Phase 3A actually builds toward this**: the pure verification/parsing/matching logic (`transactionParser.ts`, `paymentVerifier.ts`, `paymentMatcher.ts`), fully unit-tested against fixture transaction data, with no dependency on where it eventually runs. **What Phase 3A does not build**: the actual server-side boundary that calls this logic with a real network connection (a Supabase Edge Function, most likely, since that's the natural extension point for "needs to run server-side, close to the database, no new hosting"). Standing up and deploying a real Edge Function needs Supabase CLI/project-linking access this session doesn't have confirmed (same constraint that's applied to every DB migration so far — prepared, not applied, until the user runs it), and building one now would mean writing code that can't be tested end-to-end anyway. This is explicitly **Phase 3D** work per the user's own roadmap (section 31: "Real transaction detection + server verification"). Documented here so it's not silently dropped.

## Decision 5 — Public checkout access

`payment_code` (`SP-XXXXX`) is ~25 bits of entropy from `Math.random()` (audit finding) — nowhere near enough to gate a public payment page; a scripted enumeration of the ~39M possible codes is trivial. Two changes:

1. New `payment_requests.public_token` column — `uuid not null default gen_random_uuid() unique` (122 bits, CSPRNG-backed at the Postgres level). This is what a real payment link would encode, never `payment_code` or the internal `id`.
2. New RPC `get_public_payment_request(p_token uuid)` — the project's **first `SECURITY DEFINER` function**, since this is the first-ever anonymous/cross-user access path. Scoped as tightly as possible:
   - `set search_path = ''` (same discipline as every existing function).
   - Returns an explicit, narrow column list — never `select *`, never the row's `id`, `user_id`, `customer_id`, or merchant `note`. Only: `payment_code`, `amount`, `currency`, `network`, `description` (already merchant-authored and intended to be shown to the payer), `status`, `expires_at`, the merchant's display name (joined from `profiles`/`business_profiles`), and the merchant's receiving wallet address (joined from `wallets` — this is the one piece of "private" data that has to become public by definition, since the payer needs to know where to send funds).
   - `grant execute ... to anon` is added for **this function only** — no new RLS policy is added anywhere, and no existing policy is loosened. `payment_requests`/`wallets`/`profiles` stay exactly as owner-only as before; `SECURITY DEFINER` deliberately steps around RLS *inside this one function's narrow return shape*, which is the standard, correct Postgres pattern for "expose a computed, sanitized view of privileged data" — the alternative (a public RLS policy) would expose the whole row shape to any anonymous query, which is explicitly what the spec forbids.

Not built in Phase 3A: the actual `/pay/[id]` screen calling this RPC. That's Phase 3B ("Secure real public payment page") per the user's roadmap — this phase only makes the backend path exist and be independently testable/reviewable.

## Decision 6 — New dependencies

| Package | Why |
|---|---|
| `@solana/web3.js` | `Connection`, `PublicKey`, parsed-transaction types — the standard official SDK. |
| `buffer` | React Native/Hermes has no global `Buffer`; `@solana/web3.js` requires one. Standard, well-known RN+Solana shim. |
| `react-native-get-random-values` | `@solana/web3.js`'s crypto dependencies need `crypto.getRandomValues`, not present by default in Hermes. Also standard for this stack. |
| `bs58` (devDependency only) | Used only by the Jest mock below to give `PublicKey` real base58 decode behavior in tests — not part of the app's runtime bundle. |

**`@solana/spl-token` was evaluated and deliberately not added.** The original plan was to use it for `getAssociatedTokenAddress` (computing the expected destination token account from wallet+mint), but `transactionParser.ts` ended up reading the destination owner directly from the RPC's parsed token-balance data (`postTokenBalances[i].owner`) instead — the chain already reports who received the funds, so there's no need to independently pre-compute where they *should* have gone. This is also more correct: a merchant could plausibly control more than one USDC token account, and comparing against the specific "standard" ATA would incorrectly reject a payment sent to a different, still-legitimately-owned account. No overlapping SDKs; exactly one official Solana package plus the two polyfills it requires to run in React Native at all.

**Jest tooling note**: `@solana/web3.js`'s dependency chain (`jayson`, `rpc-websockets`, `uuid`, `@solana/codecs-numbers`, ...) ships package.json `exports` conditions that Metro (the real bundler) resolves correctly but Jest's default resolver does not — the package is genuinely unloadable under plain `jest` even though it works in an actual Expo/RN build. Rather than fight Jest's resolver through an increasingly fragile chain of `transformIgnorePatterns`/`browser: true` workarounds, `@solana/web3.js` is mocked at the Jest level (`__mocks__/@solana/web3.js.js`) with a **faithful** `PublicKey` reimplementation (real base58 decode + 32-byte check, via `bs58`) so wallet-validation tests exercise genuine behavior, and a `Connection` that throws if actually constructed (tests must inject a fake `SolanaRpcProvider` instead — see `client.ts`'s interface, which exists partly *for* this testability reason).

## Decision 7 — Mock/real separation

`src/services/blockchain/solana/paymentMode.ts` exports `getPaymentMode(): 'mock' | 'real'` reading `EXPO_PUBLIC_PAYMENT_MODE` (default `'mock'` if unset), plus `assertRealPaymentConfigured()` — throws with a clear message if mode is `'real'` but Solana config is incomplete, so a misconfigured production build fails loudly instead of silently falling back to the mock path. Nothing currently reads this flag (no screen is wired to real payments yet) — it exists so Phase 3B+ has a single source of truth to gate on, per the spec's explicit "do not silently fall back" requirement.

## Explicitly not in scope (per spec section 30, restated for this doc's own tracking)

Wallet-connect/Phantom/WalletConnect UX, real transaction submission, the actual `/pay/[id]` public page rewiring, a deployed Edge Function, webhooks, any UI screen change.
