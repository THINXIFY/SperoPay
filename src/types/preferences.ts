export type ThemePreference = 'light' | 'dark' | 'system';

export interface NotificationPreferences {
  paymentReceived: boolean;
  paymentDetected: boolean;
  requestExpired: boolean;
  requestReminder: boolean;
}
