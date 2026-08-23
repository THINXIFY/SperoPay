// Phase 3D's trusted server-side verification boundary. Runs as a Supabase
// Edge Function (Deno), invoked by the anonymous public checkout page via
// supabase.functions.invoke('verify-payment', { body: { public_token } }).
//
// The client sends only the public_token -- the same opaque bearer value
// the checkout page already uses to read a request's public data. It is
// NEVER trusted for amount, wallet, status, or anything else: this
// function loads the payment_requests row itself (via the service-role
// key, which bypasses RLS -- there is no anon/authenticated grant on the
// two completion RPCs this function calls, so nothing else can reach
// them) and independently derives the truth from Solana before ever
// writing anything.
//
// Every actual verification check (mint, destination wallet, exact
// amount, transaction success, confirmation level, expiry,
// already-credited) lives in ../../../src/services/blockchain/solana/ --
// paymentVerifier.ts / transactionParser.ts / paymentMatcher.ts /
// findPaymentForRequest.ts -- imported here unchanged. This file only
// does Deno/HTTP/Supabase plumbing around that shared logic; it never
// re-implements or bypasses any of it.
import { createClient } from '@supabase/supabase-js';
import { clusterApiUrl } from '@solana/web3.js';
import { PublicRpcProvider } from '../../../src/services/blockchain/solana/client.ts';
import { findPaymentForRequest } from '../../../src/services/blockchain/solana/findPaymentForRequest.ts';
import { getUsdcConfig } from '../../../src/services/blockchain/solana/usdc.ts';
import { toBaseUnits } from '../../../src/services/blockchain/solana/amount.ts';
import type { ExpectedPayment, SolanaEnvironment } from '../../../src/services/blockchain/solana/types.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Deliberately NOT reusing src/services/blockchain/solana/config.ts's
// getSolanaEnvironment()/getSolanaRpcUrl(): those read EXPO_PUBLIC_*
// client-bundle env vars, which is the wrong namespace for a server
// secret/config boundary. This server has its own independent config --
// SOLANA_NETWORK/SOLANA_RPC_URL, never exposed to any client bundle.
// Same fail-safe default as the client side: devnet unless mainnet-beta
// is explicitly configured, so a misconfigured deploy never silently
// verifies against real money.
function getServerSolanaNetwork(): SolanaEnvironment {
  return Deno.env.get('SOLANA_NETWORK') === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
}

function getServerSolanaRpcUrl(network: SolanaEnvironment): string {
  return Deno.env.get('SOLANA_RPC_URL') || clusterApiUrl(network);
}

interface PaymentRequestRow {
  id: string;
  user_id: string;
  amount: number | string;
  status: string;
  expires_at: string | null;
  solana_reference: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    let body: { public_token?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: 'invalid_request' }, 400);
    }

    const token = body.public_token;
    if (typeof token !== 'string' || !UUID_PATTERN.test(token)) {
      return json({ ok: false, error: 'invalid_request' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('verify-payment: missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY');
      return json({ ok: false, error: 'server_misconfigured' }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: requestRow, error: requestError } = await supabase
      .from('payment_requests')
      .select('id, user_id, amount, status, expires_at, solana_reference')
      .eq('public_token', token)
      .maybeSingle();

    if (requestError) {
      console.error('verify-payment: failed to load payment_requests row', requestError);
      return json({ ok: false, error: 'server_error' }, 500);
    }
    if (!requestRow) {
      return json({ ok: true, status: 'not_found' });
    }
    const request = requestRow as unknown as PaymentRequestRow;

    // Nothing to verify for a request that isn't (still) open. This also
    // covers 'paid' -- once paid, verify-payment never re-touches it.
    if (request.status !== 'pending' && request.status !== 'confirming') {
      return json({ ok: true, status: request.status });
    }

    // 'expired' is never actually written to payment_requests.status
    // anywhere in this app today (it's a client-computed display concept
    // -- see expiry.ts). Guard on the real expires_at column directly so
    // a request whose time has passed can never be moved to confirming/paid
    // here, regardless of what its status column still says.
    if (request.expires_at && new Date(request.expires_at).getTime() <= Date.now()) {
      return json({ ok: true, status: request.status });
    }

    if (!request.solana_reference) {
      // Pre-Phase-3C request with no reference to look up -- nothing this
      // function can do for it.
      return json({ ok: true, status: request.status });
    }

    const { data: walletRow } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', request.user_id)
      .maybeSingle();
    const wallet = walletRow as { address: string } | null;

    if (!wallet?.address) {
      // No receiving wallet configured -- same as Phase 3B/3C's public
      // checkout page, which already hides Pay controls in this case.
      return json({ ok: true, status: request.status });
    }

    const network = getServerSolanaNetwork();
    const { mint, decimals } = getUsdcConfig(network);
    const expected: ExpectedPayment = {
      network,
      usdcMint: mint,
      destinationWallet: wallet.address,
      amountBaseUnits: toBaseUnits(String(request.amount), decimals),
      notAfter: request.expires_at ? new Date(request.expires_at) : null,
    };

    const provider = new PublicRpcProvider(getServerSolanaRpcUrl(network));
    const isSignatureAlreadyUsed = async (signature: string): Promise<boolean> => {
      const { data } = await supabase.from('transactions').select('id').eq('tx_hash', signature).maybeSingle();
      return !!data;
    };

    const outcome = await findPaymentForRequest(request.solana_reference, expected, {
      discoveryProvider: provider,
      rpcProvider: provider,
      isSignatureAlreadyUsed,
    });

    switch (outcome.kind) {
      case 'paid': {
        const { data: transactions, error: completeError } = await supabase.rpc('complete_verified_payment', {
          p_request_id: request.id,
          p_tx_hash: outcome.result.signature,
        });
        if (completeError) {
          console.error(`verify-payment: complete_verified_payment failed for ${request.id}`, completeError);
          return json({ ok: true, status: request.status });
        }
        const completed = Array.isArray(transactions) && transactions.length > 0;
        return json({ ok: true, status: completed ? 'paid' : request.status });
      }

      case 'confirming': {
        const { error: detectError } = await supabase.rpc('mark_payment_detected', { p_request_id: request.id });
        if (detectError) {
          console.error(`verify-payment: mark_payment_detected failed for ${request.id}`, detectError);
          return json({ ok: true, status: request.status });
        }
        return json({ ok: true, status: 'confirming' });
      }

      case 'rpc_unavailable':
        console.warn(`verify-payment: Solana RPC unavailable while checking request ${request.id}`);
        return json({ ok: true, status: request.status, note: 'rpc_unavailable' });

      case 'no_match':
      default:
        return json({ ok: true, status: request.status });
    }
  } catch (error) {
    // Never let an unexpected exception leak a stack trace or internal
    // detail to the payer -- log server-side, respond generically.
    console.error('verify-payment: unexpected error', error);
    return json({ ok: false, error: 'server_error' }, 500);
  }
});
