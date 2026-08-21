export type DataDomain = 'customers' | 'requests' | 'templates' | 'wallet' | 'profile';
export type DataAction = 'load' | 'save';

const DOMAIN_LABELS: Record<DataDomain, string> = {
  customers: 'your customers',
  requests: 'this request',
  templates: 'your templates',
  wallet: 'your wallet',
  profile: 'your profile',
};

// Never surfaces the raw Postgres/Supabase error to the UI — only a calm,
// domain- and action-flavored fallback. Mirrors authErrors.ts's established
// pattern for this codebase.
export function getDataErrorMessage(error: unknown, domain: DataDomain, action: DataAction = 'load'): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('timeout')) {
    return "We couldn't connect right now. Check your internet connection and try again.";
  }

  const label = DOMAIN_LABELS[domain];
  return action === 'save' ? `We couldn't save ${label}. Try again.` : `We couldn't load ${label}. Try again.`;
}
