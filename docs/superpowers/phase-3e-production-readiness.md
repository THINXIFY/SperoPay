# Phase 3E — Production Readiness Notes

This is documentation only — no code here. It consolidates every configuration variable the real payment system (Phase 3A-3D) reads, and what's worth watching once this is handling real traffic. Nothing in this doc requires action now; it's a reference for when production deployment (a real domain, mainnet, a paid RPC provider) actually happens.

## Configuration reference

### Client (Expo app — `.env`, see `.env.example`)
| Variable | Default if unset | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | — (required) | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | — (required) | Supabase anon key |
| `EXPO_PUBLIC_SOLANA_NETWORK` | `devnet` | Which cluster "Pay with Wallet" targets |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | Solana's public devnet/mainnet endpoint | Only needed for a paid RPC provider |
| `EXPO_PUBLIC_PAYMENT_MODE` | `mock` | Gates the mock payment engine; unrelated to the real checkout path, which never reads this |
| `EXPO_PUBLIC_CHECKOUT_BASE_URL` | `https://pay.speropay.app` (aspirational — not deployed) | Domain used to build `/p/<token>` links |

### Server (Supabase Edge Function secrets — set via `supabase secrets set`, never in `.env`)
| Variable | Default if unset | Purpose |
|---|---|---|
| `SUPABASE_URL` | injected automatically | Not set manually |
| `SUPABASE_SERVICE_ROLE_KEY` | injected automatically | Not set manually — never expose this anywhere client-side |
| `SOLANA_NETWORK` | `devnet` | Which cluster `verify-payment` checks against |
| `SOLANA_RPC_URL` | Solana's public devnet/mainnet endpoint | Only needed for a paid RPC provider |

**The one thing to get right when this eventually goes to production**: `EXPO_PUBLIC_SOLANA_NETWORK` (client) and `SOLANA_NETWORK` (server) must be changed to `mainnet-beta` **together**. Both independently default to devnet, so a half-updated deploy just fails to match transactions (safe) rather than doing anything dangerous — but it'll look like "payments aren't confirming" with no obvious error, so it's worth checking first if that's ever reported.

## What to monitor once this handles real traffic

Supabase's Edge Function logs (Dashboard → Edge Functions → verify-payment → Logs) are the only monitoring surface right now — deliberately so; this phase did not build a dashboard or alerting pipeline. What's worth watching, in order of how urgent a spike would be:

1. **`verify-payment: complete_verified_payment failed`** (`console.error`) — a payment was independently verified as fully valid but the database write failed. Should be extremely rare (the underlying RPC only fails on a genuine DB error, not a normal "already processed" case, which returns cleanly). Any occurrence is worth investigating immediately — it means a real, confirmed payment isn't reflected as paid.
2. **`verify-payment: Solana RPC unavailable`** (`console.warn`) — the configured RPC endpoint is failing. Occasional entries are normal (the free public endpoint rate-limits under load); a sustained run of these for the same request means payments aren't being detected at all. This is the strongest signal for "time to move to a paid RPC provider."
3. **`verify-payment: unexpected error`** (`console.error`, from the outer catch-all) — anything not already handled above. Should be rare; any pattern here points at a real bug, not normal operation.
4. **Requests stuck in `confirming` for an unusually long time** — not currently logged as its own event. If this becomes a real operational concern, the simplest addition (not built in this phase, to avoid speculative scope) would be a scheduled query: `select id, updated_at from payment_requests where status = 'confirming' and updated_at < now() - interval '10 minutes'`.
5. **Verification failure rate** (candidates found but not matching — `wrong_amount`/`wrong_mint`/`wrong_destination` in the `no_match` log line) — a sustained pattern here across many different requests (as opposed to an occasional one-off, which just means someone sent an unrelated transaction referencing the account) could indicate a client-side bug in how the Solana Pay URI is being built.

None of the above requires new code today — the logging added in this phase already produces the lines described. A real alerting pipeline (e.g. forwarding these logs to a monitoring service) is exactly the kind of "complex monitoring platform" this phase deliberately did not build, per its own scope.

## Deferred (confirmed still deferred by this phase)

- Real Devnet end-to-end test — not run in this phase (no live device/wallet available in this environment); still the release gate before Mainnet per Phase 3D.
- Public checkout domain/hosting (`pay.speropay.app`) — `EXPO_PUBLIC_CHECKOUT_BASE_URL` stays configurable, no domain required.
- A production (paid) Solana RPC provider — the free public endpoint remains the default; nothing in this phase requires switching.
- Mainnet — both `EXPO_PUBLIC_SOLANA_NETWORK` and `SOLANA_NETWORK` remain devnet-default; nothing in this phase touches that.
- Real-money testing — not performed.
