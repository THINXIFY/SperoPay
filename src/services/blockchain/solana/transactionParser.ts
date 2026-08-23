import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import type { ParsedPaymentTransaction, ParsedTokenTransfer } from './types.ts';

// Extracts every USDC transfer *into* some account in this transaction, by
// diffing pre/post token balances for the expected mint — not by trying to
// interpret raw instructions (which vary by transfer type: transfer vs
// transferChecked, checked vs unchecked, and can be nested inside a CPI a
// naive instruction scan would miss). This is the standard, defensive way
// to detect an SPL token transfer's real effect regardless of how it was
// constructed on-chain. Returns every matching transfer found, not just
// the first — spec section 11 explicitly warns against assuming position.
export function parsePaymentTransaction(
  signature: string,
  tx: ParsedTransactionWithMeta,
  expectedMint: string
): ParsedPaymentTransaction {
  const meta = tx.meta;
  // Loose `== null` would treat a genuinely MISSING meta (meta is
  // `undefined`/`null` — RPC couldn't produce it) the same as a present
  // meta with `err: null` (a real success) — an unsafe default for a
  // payment check. Missing meta must never read as "succeeded".
  const succeeded = meta != null && meta.err == null;
  const transfers: ParsedTokenTransfer[] = [];

  if (meta) {
    const preByIndex = new Map((meta.preTokenBalances ?? []).map((balance) => [balance.accountIndex, balance]));
    const accountKeys = tx.transaction.message.accountKeys;

    for (const post of meta.postTokenBalances ?? []) {
      if (post.mint !== expectedMint) continue;

      const pre = preByIndex.get(post.accountIndex);
      const preAmount = pre && pre.mint === expectedMint ? BigInt(pre.uiTokenAmount.amount) : 0n;
      const postAmount = BigInt(post.uiTokenAmount.amount);
      const delta = postAmount - preAmount;
      if (delta <= 0n) continue; // this account didn't receive anything in this transaction

      transfers.push({
        mint: post.mint,
        destinationTokenAccount: accountKeys[post.accountIndex]?.pubkey.toBase58() ?? '',
        destinationOwner: post.owner ?? null,
        amountBaseUnits: delta,
      });
    }
  }

  return {
    signature,
    succeeded,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    transfers,
  };
}
