export type ThemePreference = 'light' | 'dark' | 'system';

export interface NotificationPreferences {
  paymentReceived: boolean;
  requestExpiring: boolean;
  productUpdates: boolean;
}
