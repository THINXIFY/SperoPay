// Phase 5B: the single source of truth for Spero's canonical public web
// domain -- every place that builds a shareable /p/<publicToken> or
// /c/<portalToken> link (or buildPaymentRequest's legacy, deprecated
// cosmetic paymentLink field) reads from here, so the domain is ever only
// defined in one place. Previously publicPaymentLink.ts and
// customerPortalLink.ts each hardcoded their own identical copy of this
// constant and its env-lookup logic -- exactly the "different screens could
// drift to different domains" risk this file exists to close off.
//
// EXPO_PUBLIC_CHECKOUT_BASE_URL is unset in local/dev environments -- the
// fallback below is the app's real intended production domain, NOT
// necessarily a verified, deployed URL until DNS/hosting is configured.
//
// React Native/Metro inlines process.env.EXPO_PUBLIC_* at build time, but
// this file is also imported (transitively, via publicPaymentLink.ts),
// unbundled, from Deno-based Supabase Edge Functions (e.g.
// process-reminders), which have no global `process` by default -- guarding
// here keeps this the one real source of truth for the public web domain in
// both runtimes instead of crashing one of them with "process is not defined".
const DEFAULT_CHECKOUT_BASE_URL = 'https://pay.speropay.app';

export function getCheckoutBaseUrl(): string {
  const configured = typeof process !== 'undefined' && process.env ? process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL : undefined;
  const base = configured || DEFAULT_CHECKOUT_BASE_URL;
  return base.replace(/\/+$/, '');
}

// True only once EXPO_PUBLIC_CHECKOUT_BASE_URL is actually set to a real,
// deployed domain. DEFAULT_CHECKOUT_BASE_URL above is aspirational -- not a
// live production URL -- so any /p or /c link built while this is false is
// a placeholder that won't resolve outside this app. UI that surfaces a
// public link should check this and say so, rather than presenting the
// fallback domain as if it were already deployed.
export function isCheckoutBaseUrlConfigured(): boolean {
  return Boolean(typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_CHECKOUT_BASE_URL);
}
