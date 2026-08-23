# Phase 3A — Devnet Integration Test Procedure

This is a manual procedure for exercising the real blockchain layer
(`src/services/blockchain/solana/`) against actual devnet infrastructure —
the unit tests use fixtures and never touch the network (spec section 28).
This phase doesn't wire any of this into a screen, so the steps below use
`node`/a scratch script, not the app itself.

## Prerequisites

- A Solana CLI installed locally, or use `https://faucet.solana.com` in a browser.
- Two devnet keypairs: a "merchant" (receiving) wallet and a "payer" wallet.

## USDC on devnet — a note before starting

There is no way to "just have" devnet USDC the way you can airdrop devnet
SOL — Circle's devnet USDC (mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`,
configured in `usdc.ts`) requires either using Circle's own devnet faucet
(if currently available — check Circle's developer docs, since devnet
faucet availability changes over time) or minting a **test-only SPL token
you control** and treating it as a mint substitute for this procedure. If
Circle's real devnet mint isn't reachable, the safest approach is:

1. Create your own SPL token mint with `spl-token create-token` (6 decimals, matching real USDC).
2. Temporarily point `usdc.ts`'s devnet mint at your test token for this test run only — do not commit that change.
3. Everything below still exercises the real verification logic identically; only the specific mint address differs from Circle's real devnet USDC.

Do not substitute a different network's mainnet USDC or pretend devnet has the real mainnet mint — they are different tokens (design doc Decision 2 / spec section 8).

## Procedure

1. **Fund both wallets with devnet SOL** (for transaction fees): `solana airdrop 1 <pubkey> --url devnet` for both the merchant and payer keypairs, or use the web faucet.

2. **Create/fund USDC token accounts** for both wallets against the devnet USDC (or your substitute test mint — see above), and mint/transfer some test USDC into the payer's account.

3. **Construct the "payment request" parameters** the app would have generated:
   ```ts
   import { getUsdcConfig } from './src/services/blockchain/solana/usdc';
   import { toBaseUnits } from './src/services/blockchain/solana/amount';

   const usdc = getUsdcConfig('devnet');
   const expectedAmountBaseUnits = toBaseUnits('1.50', usdc.decimals); // pick any test amount
   ```

4. **Send the test payment** — a standard SPL token transfer from the payer's USDC token account to the merchant's USDC token account, for exactly `expectedAmountBaseUnits`. Record the resulting transaction signature.

5. **Wait for confirmation**, then fetch and verify it using this project's actual code:
   ```ts
   import { PublicRpcProvider } from './src/services/blockchain/solana/client';
   import { matchPayment } from './src/services/blockchain/solana/paymentMatcher';

   const provider = new PublicRpcProvider(); // uses devnet by default
   const result = await matchPayment(
     signature,
     {
       network: 'devnet',
       usdcMint: usdc.mint,
       destinationWallet: merchantWalletAddress,
       amountBaseUnits: expectedAmountBaseUnits,
       notAfter: null,
     },
     {
       rpcProvider: provider,
       isSignatureAlreadyUsed: async () => false, // no real DB in this scratch test
     }
   );
   console.log(result);
   ```
   Expect `{ valid: true, signature, amountBaseUnits: expectedAmountBaseUnits, blockTime }`.

6. **Negative-path checks** — repeat step 5 with each of these deliberately wrong and confirm the matching `reason`:
   - A different `amountBaseUnits` than what was actually sent → `wrong_amount`.
   - A different `destinationWallet` than the real recipient → `wrong_destination`.
   - A different `usdcMint` than the one actually used → `wrong_mint`.
   - `isSignatureAlreadyUsed: async () => true` → `already_credited`.
   - A signature that doesn't exist (a random base58 string) → `transaction_not_found`.

7. **This validates the code path this phase actually built** — extraction, verification, and matching against a real devnet transaction. It does **not** validate a deployed server boundary (no Edge Function exists yet — Phase 3D), nor a real `pending -> confirming -> paid` status transition in `payment_requests` (that requires wiring this into `requestStore.ts`'s RPC calls, which is explicitly out of scope for Phase 3A — see spec section 30).
