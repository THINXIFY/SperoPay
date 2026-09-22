// The one shared cron-authorization check, extracted verbatim from what
// process-reminders, process-recurring-plans, and verify-payment's sweep
// mode each independently inlined as
// `!configuredSecret || providedSecret !== configuredSecret` -- same logic,
// three copies, none of it unit-testable before now since it lived inside
// each Deno.serve() handler. Reachable from Deno (Edge Functions) via an
// explicit '.ts'-suffixed relative import, same convention as
// paymentAccounting.ts -- see that file's own header comment for why.
//
// A missing configuredSecret (the function's own env var never set) is
// always unauthorized, never "open" -- the same fail-closed posture as an
// actual mismatch, so a misconfigured deployment can never accidentally
// leave one of these cron-only endpoints callable by anyone who guesses an
// empty/undefined header.
export function isAuthorizedCronRequest(configuredSecret: string | null | undefined, providedSecret: string | null | undefined): boolean {
  return !!configuredSecret && providedSecret === configuredSecret;
}
