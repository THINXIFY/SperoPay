import {
  escapeCsvField,
  buildCsvRow,
  buildCsv,
  buildPaymentsCsv,
  buildOutstandingCsv,
  buildCustomersCsv,
  buildTransactionsCsv,
  buildRequestsCsv,
} from '../csvExport';
import type { PaymentReportRow, OutstandingReportRow, CustomerReportRow, TransactionReportRow } from '../reportsCalculations';

describe('escapeCsvField', () => {
  it('leaves a plain value bare', () => {
    expect(escapeCsvField('Alex Morgan')).toBe('Alex Morgan');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvField('Doe, Jane')).toBe('"Doe, Jane"');
  });

  it('quotes and doubles embedded double quotes', () => {
    expect(escapeCsvField('Say "hello"')).toBe('"Say ""hello"""');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null/undefined as an empty field', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('renders numbers as machine-readable plain digits, never locale-formatted', () => {
    expect(escapeCsvField(1234.5)).toBe('1234.5');
  });
});

describe('buildCsvRow / buildCsv', () => {
  it('joins fields with commas and escapes each independently', () => {
    expect(buildCsvRow(['a', 'b, c', 'd'])).toBe('a,"b, c",d');
  });

  it('builds a full CSV with a header row and CRLF line endings', () => {
    const csv = buildCsv(['A', 'B'], [[1, 2], [3, 4]]);
    expect(csv).toBe('A,B\r\n1,2\r\n3,4\r\n');
  });
});

describe('buildPaymentsCsv', () => {
  it('uses the exact spec column order and marks partial vs full payments', () => {
    const rows: PaymentReportRow[] = [
      {
        transactionId: 't1',
        requestId: 'r1',
        paymentCode: 'SP-ABCDE',
        description: 'Website Maintenance',
        customerId: 'c1',
        customerName: 'Alex Morgan',
        amount: 250,
        currency: 'USDC',
        paidAt: new Date(2026, 8, 8).toISOString(),
        network: 'Solana',
        isPartialContribution: false,
      },
    ];
    const csv = buildPaymentsCsv(rows);
    expect(csv.split('\r\n')[0]).toBe('Payment Date,Customer,Request Number,Description,Amount,Asset,Network,Status');
    expect(csv).toContain('Alex Morgan,SP-ABCDE,Website Maintenance,250,USDC,Solana,Paid');
  });

  // Phase 7: the Asset column must reflect the row's OWN currency, never a
  // hardcoded literal -- a EURC payment's CSV row must say EURC.
  it('exports the row\'s real currency, not a hardcoded USDC', () => {
    const rows: PaymentReportRow[] = [
      {
        transactionId: 't1',
        requestId: 'r1',
        paymentCode: 'SP-ABCDE',
        description: 'Retainer',
        customerId: 'c1',
        customerName: 'Alex Morgan',
        amount: 250,
        currency: 'EURC',
        paidAt: new Date(2026, 8, 8).toISOString(),
        network: 'Solana',
        isPartialContribution: false,
      },
    ];
    const csv = buildPaymentsCsv(rows);
    expect(csv).toContain('250,EURC,Solana,Paid');
  });

  it('a comma in a customer name or description does not corrupt the row', () => {
    const rows: PaymentReportRow[] = [
      {
        transactionId: 't1',
        requestId: 'r1',
        paymentCode: 'SP-ABCDE',
        description: 'Logo, banner, and social kit',
        customerId: 'c1',
        customerName: 'Doe, Jane',
        amount: 100,
        currency: 'USDC',
        paidAt: new Date(2026, 8, 8).toISOString(),
        network: 'Solana',
        isPartialContribution: true,
      },
    ];
    const csv = buildPaymentsCsv(rows);
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('"Doe, Jane"');
    expect(dataLine).toContain('"Logo, banner, and social kit"');
    expect(dataLine.endsWith('Partial')).toBe(true);
  });
});

describe('buildOutstandingCsv', () => {
  it('uses the exact spec column order with correct paid/remaining amounts', () => {
    const rows: OutstandingReportRow[] = [
      {
        requestId: 'r1',
        paymentCode: 'SP-XYZ',
        customerId: 'c1',
        customerName: 'Jamie Lee',
        currency: 'USDC',
        originalAmount: 1000,
        paidAmount: 400,
        remainingAmount: 600,
        bucket: 'partiallyPaid',
        dueAt: null,
      },
    ];
    const csv = buildOutstandingCsv(rows);
    expect(csv.split('\r\n')[0]).toBe('Customer,Request Number,Original Amount,Paid Amount,Remaining Amount,Asset,Status,Due Date');
    expect(csv).toContain('Jamie Lee,SP-XYZ,1000,400,600,USDC,Partially Paid,');
  });
});

describe('buildCustomersCsv', () => {
  it('renders an empty last-payment field for a customer with no payments, and the given currency', () => {
    const rows: CustomerReportRow[] = [
      {
        customerId: 'c1',
        customerName: 'No Payments Yet',
        avatarColor: 'blue',
        totalReceived: 0,
        outstanding: 200,
        paymentCount: 0,
        lastPaymentAt: null,
      },
    ];
    const csv = buildCustomersCsv(rows, 'USDC');
    expect(csv.split('\r\n')[0]).toBe('Customer,Total Received,Outstanding,Asset,Payment Count,Last Payment');
    expect(csv).toContain('No Payments Yet,0,200,USDC,0,\r\n');
  });

  it('uses the passed currency for EURC rows too', () => {
    const rows: CustomerReportRow[] = [
      { customerId: 'c1', customerName: 'Jamie Lee', avatarColor: 'blue', totalReceived: 500, outstanding: 0, paymentCount: 1, lastPaymentAt: null },
    ];
    const csv = buildCustomersCsv(rows, 'EURC');
    expect(csv).toContain('Jamie Lee,500,0,EURC,1,\r\n');
  });
});

describe('buildTransactionsCsv', () => {
  it('includes the transaction signature column', () => {
    const rows: TransactionReportRow[] = [
      {
        transactionId: 't1',
        paidAt: new Date(2026, 8, 8).toISOString(),
        customerId: 'c1',
        customerName: 'Alex Morgan',
        requestId: 'r1',
        paymentCode: 'SP-ABCDE',
        amount: 250,
        currency: 'USDC',
        network: 'Solana',
        status: 'Confirmed',
        txHash: '5x7z...signature',
      },
    ];
    const csv = buildTransactionsCsv(rows);
    expect(csv).toContain('5x7z...signature');
    expect(csv.split('\r\n')[0]).toBe('Date,Customer,Request Number,Amount,Asset,Network,Status,Transaction Signature');
  });
});

describe('buildRequestsCsv', () => {
  it('exports every breakdown category as its own row', () => {
    const csv = buildRequestsCsv({ created: 10, paid: 4, pending: 2, partiallyPaid: 1, expired: 2, cancelled: 1 });
    expect(csv).toBe(
      'Category,Count\r\nCreated,10\r\nPaid,4\r\nPending,2\r\nPartially Paid,1\r\nExpired,2\r\nCancelled,1\r\n'
    );
  });
});
