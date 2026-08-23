import { supabase } from '../../lib/supabase';

// Best-effort nudge: asks the server-side verify-payment Edge Function to
// independently check Solana for a matching transaction and, if it finds
// one, update the request's status itself. This call's own success/failure
// is never surfaced to the payer and never drives any local state -- the
// polling loop's next fetchPublicCheckout() call is what actually reflects
// whatever the server decided, the same way it always has. A failure here
// (network blip, cold start, temporary RPC outage) just means this
// particular tick didn't get a fresh verification attempt; the next poll
// tries again.
export async function triggerPaymentVerification(publicToken: string): Promise<void> {
  try {
    await supabase.functions.invoke('verify-payment', { body: { public_token: publicToken } });
  } catch {
    // Swallowed by design -- see comment above.
  }
}
