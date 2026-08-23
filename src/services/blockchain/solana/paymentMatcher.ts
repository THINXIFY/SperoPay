import type { SolanaRpcProvider } from './client';
import { parsePaymentTransaction } from './transactionParser';
import { verifyPayment } from './paymentVerifier';
import { REQUIRED_CONFIRMATION_LEVEL } from './config';
import type { ConfirmationLevel, ExpectedPayment, PaymentVerificationResult } from './types';

const RPC_TIMEOUT_MS = 15_000;
const RPC_MAX_ATTEMPTS = 2; // one retry — spec section 27: not indefinite, no request storms

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RPC_MAX_ATTEMPTS; attempt++) {
    try {
      return await withTimeout(fn(), RPC_TIMEOUT_MS);
    } catch (error) {
      lastError = error;
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
  const confirmationLevel = (status?.confirmationStatus as ConfirmationLevel | undefined) ?? null;

  return verifyPayment({
    tx,
    expected,
    confirmationLevel,
    requiredConfirmationLevel: deps.requiredConfirmationLevel ?? REQUIRED_CONFIRMATION_LEVEL,
    alreadyCredited,
  });
}
