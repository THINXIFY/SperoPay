export type ThemePreference = 'light' | 'dark' | 'system';

// Phase 6C: mirrors NOTIFICATION_FILTER_OPTIONS's 5 non-"all" categories
// exactly (src/utils/notificationFilters.ts) -- the same category vocabulary
// used to filter the Notifications screen also governs what's HIDDEN when
// a category is turned off here, so the two concepts (filter, preference)
// can never drift into two different category lists. Deliberately minimal:
// no per-type granularity, no delivery-channel settings -- 5 on/off
// switches, matching the spec's "do not build overly complex notification
// settings".
export interface NotificationPreferences {
  payments: boolean;
  requests: boolean;
  reminders: boolean;
  recurring: boolean;
  customers: boolean;
}
