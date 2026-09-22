import { buildReminderEmail } from '../buildReminderEmail';

const BASE_CONTEXT = {
  merchantName: 'Acme Studio',
  customerName: 'Alex Morgan',
  amount: 250,
  currency: 'USDC',
  paymentCode: 'SP-AAAAA',
  dueAt: '2026-09-25T00:00:00.000Z',
  message: 'Hi Alex,\n\nYour payment of 250 USDC is due today.\n\nYou can complete it using the payment link below.\nhttps://pay.speropay.app/p/token-1',
  paymentUrl: 'https://pay.speropay.app/p/token-1',
};

describe('buildReminderEmail', () => {
  it('includes the merchant name, amount + currency, reference, and Pay Now link', () => {
    const email = buildReminderEmail(BASE_CONTEXT);

    expect(email.subject).toContain('Acme Studio');
    expect(email.subject).toContain('250.00 USDC');
    expect(email.html).toContain('Acme Studio');
    expect(email.html).toContain('250.00 USDC');
    expect(email.html).toContain('SP-AAAAA');
    expect(email.html).toContain('https://pay.speropay.app/p/token-1');
    expect(email.html).toContain('Pay Now');
    expect(email.text).toContain('250.00 USDC');
    expect(email.text).toContain('SP-AAAAA');
    expect(email.text).toContain('https://pay.speropay.app/p/token-1');
  });

  it('greets the customer by first name when available', () => {
    const email = buildReminderEmail(BASE_CONTEXT);
    expect(email.html).toContain('Hi Alex,');
    expect(email.text).toContain('Hi Alex,');
  });

  it('falls back to a generic greeting when no customer name is available', () => {
    const email = buildReminderEmail({ ...BASE_CONTEXT, customerName: undefined });
    expect(email.html).toContain('Hello,');
    expect(email.html).not.toContain('Hi undefined');
    expect(email.text).toContain('Hello,');
  });

  it('includes a due date line only when dueAt is provided', () => {
    const withDue = buildReminderEmail(BASE_CONTEXT);
    expect(withDue.html).toContain('Due Sep 25, 2026');

    const withoutDue = buildReminderEmail({ ...BASE_CONTEXT, dueAt: null });
    expect(withoutDue.html).not.toContain('Due ');
  });

  // The one place user/merchant-entered free text ever reaches raw HTML --
  // must be escaped, not interpolated verbatim, or a business/customer name
  // containing HTML would inject markup into every reminder email sent.
  it('HTML-escapes merchant and customer names', () => {
    const email = buildReminderEmail({
      ...BASE_CONTEXT,
      merchantName: '<script>alert(1)</script>',
      customerName: '<b>Bob</b>',
    });
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('<b>Bob</b>');
  });

  it('never includes internal identifiers beyond the customer-facing reference/payment code', () => {
    const email = buildReminderEmail(BASE_CONTEXT);
    // Nothing here should ever look like a raw UUID -- only the short,
    // customer-facing payment code (already publicly shown on invoices/
    // receipts/checkout) is included as a reference.
    expect(email.html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
