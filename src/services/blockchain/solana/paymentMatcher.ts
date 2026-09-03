import type { SolanaRpcProvider } from './client.ts';
import { parsePaymentTransaction } from './transactionParser.ts';
import { verifyPayment } from './paymentVerifier.ts';
import { REQUIRED_CONFIRMATION_LEVEL } from './config.ts';
import { getUsdcConfig } from './usdc.ts';
import type { ConfirmationLevel, ExpectedPayment, PaymentVerificationResult } from './types.ts';

const RPC_TIMEOUT_MS = 15_000;
const RPC_MAX_ATTEMPTS = 2; // one retry — spec section 27: not indefinite, no request storms
const RPC_RETRY_BACKOFF_MS = 400; // brief pause before the one retry, not an immediate hammer

const KNOWN_CONFIRMATION_LEVELS: ReadonlySet<string> = new Set(['processed', 'confirmed', 'finalized']);

// The RPC's confirmationStatus is an arbitrary string from whatever endpoint
// EXPO_PUBLIC_SOLANA_RPC_URL points at (user-configurable, could be a third
// party). An unrecognized value must fail closed, not compare as "less than
// every real level" by accident — an unchecked cast plus a Record lookup
// would silently do exactly that (undefined < N is false, so an unknown
// status would have cleared the confirmation gate entirely).
function toConfirmationLevel(value: string | null | undefined): ConfirmationLevel | null {
  return value != null && KNOWN_CONFIRMATION_LEVELS.has(value) ? (value as ConfirmationLevel) : null;
}

// Exported so the Phase 3D discovery step (finding candidate signatures
// via getSignaturesForAddress, which runs before matchPayment even has a
// signature to work with) gets the same timeout/retry discipline as every
// other RPC call here, instead of a second, slightly-different copy.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`RPC call timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number = RPC_TIMEOUT_MS,
  backoffMs: number = RPC_RETRY_BACKOFF_MS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RPC_MAX_ATTEMPTS; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < RPC_MAX_ATTEMPTS) {
        await delay(backoffMs);
      }
    }
  }
  throw lastError;
}

export interface PaymentMatcherDeps {
  rpcProvider: SolanaRpcProvider;
  /**
   * Must check server-side state (e.g. `transactions.tx_hash` in Supabase),
   * never the mobile client's own claim — this is what makes
   * "already_credited" an actual guarantee rather than a client-reported
   * hint. See spec section 22 / design doc Decision 4.
   */
  isSignatureAlreadyUsed: (signature: string) => Promise<boolean>;
  requiredConfirmationLevel?: ConfirmationLevel;
}

// Orchestrates a signature -> verified-or-not decision: fetch the
// transaction + its confirmation status from the chain, check whether it's
// already been credited, parse it for USDC transfers, and hand everything
// to the pure verifier. This is the function a server-side boundary
// (Phase 3D's eventual Edge Function) calls with a client-submitted
// signature — it never trusts anything the client claims about the
// transaction's contents, only the signature itself.
export async function matchPayment(
  signature: string,
  expected: ExpectedPayment,
  deps: PaymentMatcherDeps
): Promise<PaymentVerificationResult> {
  // Catches a caller-construction bug (mismatched network/mint) immediately
  // and loudly, rather than letting mismatched config quietly depend on
  // "wrong_mint" happening to be the eventual verifier outcome. Deliberately
  // not part of PaymentVerificationResult's fail-closed reasons — this is a
  // programming error in the caller, not a property of the transaction.
  const expectedMintForNetwork = getUsdcConfig(expected.network).mint;
  if (expected.usdcMint !== expectedMintForNetwork) {
    throw new Error(
      `matchPayment: expected.usdcMint ("${expected.usdcMint}") does not match the USDC mint configured for "${expected.network}" ("${expectedMintForNetwork}")`
    );
  }

  let rawTx;
  let status;
  let alreadyCredited: boolean;
  try {
    [rawTx, status, alreadyCredited] = await Promise.all([
      withRetry(() => deps.rpcProvider.getParsedTransaction(signature)),
      withRetry(() => deps.rpcProvider.getSignatureStatus(signature)),
      deps.isSignatureAlreadyUsed(signature),
    ]);
  } catch {
    return { valid: false, reason: 'rpc_unavailable' };
  }

  const tx = rawTx ? parsePaymentTransaction(signature, rawTx, expected.usdcMint) : null;
  const confirmationLevel = toConfirmationLevel(status?.confirmationStatus);

  return verifyPayment({
    tx,
    expected,
    confirmationLevel,
    requiredConfirmationLevel: deps.requiredConfirmationLevel ?? REQUIRED_CONFIRMATION_LEVEL,
    alreadyCredited,
  });
}
