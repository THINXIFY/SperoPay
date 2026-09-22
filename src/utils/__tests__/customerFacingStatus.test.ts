import { deriveCustomerFacingStatus } from '../customerFacingStatus';

const NOW = new Date('2026-09-10T12:00:00.000Z');

describe('deriveCustomerFacingStatus', () => {
  it('shows Paid for a paid request regardless of due date', () => {
    expect(
      deriveCustomerFacingStatus({ status: 'paid', dueAt: '2026-08-01T00:00:00.000Z', verifiedPaidAmount: 500, remainingAmount: 0, now: NOW })
    ).toEqual({ label: 'Paid', tone: 'success' });
  });

  it('translates "confirming" into customer-friendly copy, never the raw word', () => {
    const result = deriveCustomerFacingStatus({ status: 'confirming', dueAt: null, verifiedPaidAmount: 0, remainingAmount: 500, now: NOW });
    expect(result.label).toBe('Payment detected');
    expect(result.subcopy).toBe("We're confirming your payment.");
    expect(result.label).not.toContain('confirming');
  });

  it('shows Cancelled and Expired plainly', () => {
    expect(deriveCustomerFacingStatus({ status: 'cancelled', dueAt: null, verifiedPaidAmount: 0, remainingAmount: 500, now: NOW }).label).toBe('Cancelled');
    expect(deriveCustomerFacingStatus({ status: 'expired', dueAt: null, verifiedPaidAmount: 0, remainingAmount: 500, now: NOW }).label).toBe('Expired');
  });

  it('shows Partially paid when some but not all has been verified-paid', () => {
    const result = deriveCustomerFacingStatus({ status: 'pending', dueAt: null, verifiedPaidAmount: 300, remainingAmount: 700, now: NOW });
    expect(result).toEqual({ label: 'Partially paid', tone: 'warning' });
  });

  it('shows Overdue once the due date has passed with nothing paid yet', () => {
    const result = deriveCustomerFacingStatus({
      status: 'pending',
      dueAt: '2026-09-01T00:00:00.000Z',
      verifiedPaidAmount: 0,
      remainingAmount: 500,
      now: NOW,
    });
    expect(result).toEqual({ label: 'Overdue', tone: 'danger' });
  });

  it('shows Due soon within the 3-day window', () => {
    const result = deriveCustomerFacingStatus({
      status: 'pending',
      dueAt: '2026-09-12T12:00:00.000Z',
      verifiedPaidAmount: 0,
      remainingAmount: 500,
      now: NOW,
    });
    expect(result).toEqual({ label: 'Due soon', tone: 'warning' });
  });

  it('shows plain Pending when due date is far off or absent', () => {
    expect(
      deriveCustomerFacingStatus({ status: 'pending', dueAt: '2026-10-01T00:00:00.000Z', verifiedPaidAmount: 0, remainingAmount: 500, now: NOW })
    ).toEqual({ label: 'Pending', tone: 'neutral' });
    expect(
      deriveCustomerFacingStatus({ status: 'pending', dueAt: null, verifiedPaidAmount: 0, remainingAmount: 500, now: NOW })
    ).toEqual({ label: 'Pending', tone: 'neutral' });
  });

  it('prioritizes Partially paid over Overdue when both would otherwise apply', () => {
    const result = deriveCustomerFacingStatus({
      status: 'pending',
      dueAt: '2026-09-01T00:00:00.000Z',
      verifiedPaidAmount: 300,
      remainingAmount: 700,
      now: NOW,
    });
    expect(result.label).toBe('Partially paid');
  });
});
