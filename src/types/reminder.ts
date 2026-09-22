export type ReminderPreset = 'gentle' | 'standard' | 'frequent' | 'custom';

export type ReminderRuleType = 'before_due' | 'on_due' | 'after_due';

export interface ReminderRule {
  type: ReminderRuleType;
  // 0 for 'on_due' (there's no "how many days" for exactly-on-the-due-date).
  offsetValue: number;
  offsetUnit: 'days' | 'weeks';
}

export type ReminderStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'skipped' | 'cancelled';

// 'manual' covers both a real send (Share/WhatsApp/copy -- the merchant
// genuinely did something) and is recorded in payment_reminders as a
// completed-history row, not a future scheduled one.
export type ReminderType = ReminderRuleType | 'manual';

export interface ReminderSchedule {
  id: string;
  paymentRequestId: string;
  enabled: boolean;
  preset: ReminderPreset;
  customRules?: ReminderRule[];
  sendHour: number;
  sendMinute: number;
  timezone: string;
}

export interface Reminder {
  id: string;
  paymentRequestId: string;
  scheduleId?: string;
  reminderType: ReminderType;
  offsetValue: number;
  offsetUnit: 'days' | 'weeks';
  scheduledFor: string;
  status: ReminderStatus;
  deliveryChannel?: string;
  sentAt?: string;
  attemptCount: number;
  lastError?: string;
}
