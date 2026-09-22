// The customer-facing HTML/text a real reminder delivery provider actually
// sends. Deliberately reuses buildAutomaticReminderMessage's own tone-aware
// wording verbatim (never re-derives "is this before/on/after due" copy a
// second time) -- this only wraps that already-correct message plus the
// structured fields (merchant/customer name, amount, reference, due date)
// into a clean, mobile-friendly HTML shell with a real Pay Now button,
// since the in-app/plain-text message alone has no button to render.
//
// No relative imports beyond plain string/number formatting, so this file
// needs no '.ts'-suffixed-import treatment for Deno -- kept that way
// deliberately (formatCurrency.ts itself isn't yet dual-runtime-safe, and
// duplicating its one-line Intl.NumberFormat call here is cheaper and
// lower-risk than changing a widely-used shared file for this).
export interface ReminderEmailContext {
  merchantName: string;
  customerName?: string;
  amount: number;
  currency: string;
  paymentCode: string;
  dueAt?: string | null;
  /** The exact tone-aware body from buildAutomaticReminderMessage -- reused, never re-derived. */
  message: string;
  paymentUrl: string;
}

export interface ReminderEmail {
  subject: string;
  html: string;
  text: string;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function formatDueDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

// HTML-escapes anything sourced from merchant/customer-entered free text
// (business name, customer name, description embedded in `message`) --
// this is the one place that text is ever interpolated into an HTML
// document, so it's the one place that must escape it.
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function buildReminderEmail(context: ReminderEmailContext): ReminderEmail {
  const amountLabel = `${formatAmount(context.amount)} ${context.currency}`;
  const merchantName = context.merchantName.trim() || 'Spero';
  const greetingName = context.customerName?.trim().split(' ')[0];
  const subject = `Payment reminder: ${amountLabel} for ${merchantName}`;
  const dueLine = context.dueAt ? `Due ${formatDueDate(context.dueAt)}` : null;

  // The plain-text message already ends with its own "here's the link"
  // line/URL (buildAutomaticReminderMessage's own trailing line) -- kept
  // as-is in both the HTML body copy and the text part, since a raw
  // fallback link alongside the styled button is good email practice
  // (some clients/screen readers don't render styled buttons reliably).
  const messageHtml = escapeHtml(context.message)
    .split('\n')
    .map((line) => (line ? `<p style="margin:0 0 12px;color:#3a3a3a;font-size:15px;line-height:1.55;">${line}</p>` : ''))
    .join('');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F5F6F4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F6F4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0 0 4px;color:#A1A1A1;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Payment reminder</p>
                <p style="margin:0 0 20px;color:#0A0A0A;font-size:18px;font-weight:700;">${escapeHtml(merchantName)}</p>
                <p style="margin:0 0 4px;color:#707070;font-size:14px;">${greetingName ? `Hi ${escapeHtml(greetingName)},` : 'Hello,'}</p>
                <p style="margin:0 0 20px;color:#0A0A0A;font-size:32px;font-weight:800;">${amountLabel}</p>
                ${messageHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:100px;background-color:#C7F500;">
                      <a href="${context.paymentUrl}" style="display:inline-block;padding:14px 28px;color:#050505;font-size:15px;font-weight:700;text-decoration:none;border-radius:100px;">Pay Now</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;border-top:1px solid #E7E7E4;">
                <p style="margin:16px 0 0;color:#A1A1A1;font-size:12px;">Reference ${escapeHtml(context.paymentCode)}${dueLine ? ` &middot; ${dueLine}` : ''}</p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#A1A1A1;font-size:12px;">Powered by Spero</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Payment reminder from ${merchantName}`,
    '',
    greetingName ? `Hi ${greetingName},` : 'Hello,',
    '',
    `Amount: ${amountLabel}`,
    `Reference: ${context.paymentCode}`,
    dueLine ?? '',
    '',
    context.message,
    '',
    `Pay now: ${context.paymentUrl}`,
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');

  return { subject, html, text };
}
