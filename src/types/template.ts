import type { ExpiryOption } from './payment';

export interface Template {
  id: string;
  name: string;
  // undefined = "flexible amount" -- the user enters it when they actually
  // use the template, rather than the template carrying a fixed price.
  amount?: number;
  // Only 'USDC' is actually offered today (see the Currency/Token field in
  // the create/edit form), but this is a real stored column, not a UI
  // constant -- so a future additional token needs no schema change, only
  // a wider union here and another option in the form.
  currency: 'USDC';
  description?: string;
  expiryOption: ExpiryOption;
  customerId?: string;
  remindersEnabled: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  usageCount: number;
  lastUsedAt?: string;
}
