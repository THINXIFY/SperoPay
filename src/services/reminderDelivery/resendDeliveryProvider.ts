import { buildReminderEmail } from '../../utils/buildReminderEmail.ts';
import type { ReminderDeliveryContext, ReminderDeliveryProvider, ReminderDeliveryResult } from './types.ts';

// Deliberately NOT reading Deno.env.get(...) itself -- apiKey/fromEmail are
// passed in by the caller (process-reminders/index.ts, the only place that
// should ever touch Deno.env), which is what keeps this class free of any
// Deno-specific global and therefore fully unit-testable under Jest/Node
// the same way every other dual-runtime file in this project already is.
// fetchImpl defaults to the platform global (present natively in both Deno
// and modern Node) but can be swapped for a mock in tests.
export interface ResendDeliveryProviderConfig {
  apiKey: string;
  fromEmail: string;
  fetchImpl?: typeof fetch;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUsableEmail(value: string | null | undefined): value is string {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

// A 429 (rate limited) or 5xx (Resend-side outage) is plausibly transient
// -- worth letting the existing attempt-count/retry mechanism try again on
// a later scheduled run. Any other 4xx (bad request, invalid recipient,
// unauthorized) means retrying the exact same request can never succeed.
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class ResendDeliveryProvider implements ReminderDeliveryProvider {
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ResendDeliveryProviderConfig) {
    this.apiKey = config.apiKey;
    this.fromEmail = config.fromEmail;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async send(context: ReminderDeliveryContext): Promise<ReminderDeliveryResult> {
    if (context.channel !== 'email') {
      return { delivered: false, reason: 'unsupported_channel', retryable: false };
    }
    if (!isUsableEmail(context.customerEmail)) {
      return { delivered: false, reason: 'no_customer_email', retryable: false };
    }

    const email = buildReminderEmail({
      merchantName: context.merchantName,
      customerName: context.customerName,
      amount: context.amount,
      currency: context.currency,
      paymentCode: context.paymentCode,
      dueAt: context.dueAt,
      message: context.message,
      paymentUrl: context.paymentLink,
    });

    try {
      const response = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: context.customerEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });

      if (response.ok) {
        return { delivered: true, channel: 'email' };
      }

      // Never store the raw response body (may echo back request content or
      // provider-internal detail) -- only a short, stable category plus the
      // HTTP status, which is already public/non-sensitive information.
      return {
        delivered: false,
        reason: `resend_http_${response.status}`,
        retryable: isRetryableStatus(response.status),
      };
    } catch {
      // A network failure (DNS, timeout, connection reset) is exactly the
      // "plausibly transient" case -- never surfaces the raw error object
      // (which could contain request details), only a stable category.
      return { delivered: false, reason: 'resend_network_error', retryable: true };
    }
  }
}
