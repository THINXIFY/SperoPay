import type { ExpiryOption } from './payment';
import type { ReminderPreset, ReminderRule } from './reminder';
import type { AssetSymbol } from '../config/assets';

export interface Template {
  id: string;
  name: string;
  // undefined = "flexible amount" -- the user enters it when they actually
  // use the template, rather than the template carrying a fixed price.
  amount?: number;
  // Phase 7: 'USDC' | 'EURC'. Creating a request from this template always
  // preserves this currency, regardless of the business's current default.
  currency: AssetSymbol;
  description?: string;
  expiryOption: ExpiryOption;
  customerId?: string;
  remindersEnabled: boolean;
  // Which schedule to apply when remindersEnabled is true -- only
  // meaningful together with that flag, kept as its own column (rather
  // than an "off" value here) so the on/off switch stays a single source
  // of truth.
  reminderPreset: ReminderPreset;
  reminderCustomRules?: ReminderRule[];
  isFavorite: boolean;
  isArchived: boolean;
  usageCount: number;
  lastUsedAt?: string;
}
