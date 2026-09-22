// Phase 6B Reports -- CSV building. Deliberately hand-rolled (no
// papaparse/csv-stringify dependency): the escaping rule is a handful of
// lines and every report's row shape is already a plain, known object, so a
// small dependency-free implementation is easier to trust than pulling in a
// library for it.
import type { PaymentReportRow, OutstandingReportRow, CustomerReportRow, TransactionReportRow, RequestsReportBreakdown } from './reportsCalculations';
import type { AssetSymbol } from '../config/assets';

export type CsvValue = string | number | boolean | null | undefined;

// RFC 4180: a field is quoted if it contains a comma, a double quote, or a
// line break; an embedded double quote is escaped by doubling it. Every
// other field is left bare -- matches how every real spreadsheet app
// (Excel, Sheets, Numbers) both writes and expects to read CSV.
export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvRow(fields: CsvValue[]): string {
  return fields.map(escapeCsvField).join(',');
}

// CRLF line endings -- the RFC 4180 standard and what Excel expects; a bare
// \n still opens correctly in most apps, but CRLF is the one guaranteed to
// render as intended everywhere the exported file might be opened.
export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [buildCsvRow(headers), ...rows.map(buildCsvRow)];
  return lines.join('\r\n') + '\r\n';
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString();
}

export function buildPaymentsCsv(rows: PaymentReportRow[]): string {
  const headers = ['Payment Date', 'Customer', 'Request Number', 'Description', 'Amount', 'Asset', 'Network', 'Status'];
  const dataRows = rows.map((r) => [
    formatDate(r.paidAt),
    r.customerName,
    r.paymentCode,
    r.description ?? '',
    r.amount,
    r.currency,
    r.network,
    r.isPartialContribution ? 'Partial' : 'Paid',
  ]);
  return buildCsv(headers, dataRows);
}

export function buildOutstandingCsv(rows: OutstandingReportRow[]): string {
  const headers = ['Customer', 'Request Number', 'Original Amount', 'Paid Amount', 'Remaining Amount', 'Asset', 'Status', 'Due Date'];
  const statusLabel: Record<OutstandingReportRow['bucket'], string> = {
    overdue: 'Overdue',
    partiallyPaid: 'Partially Paid',
    pending: 'Pending',
  };
  const dataRows = rows.map((r) => [
    r.customerName,
    r.paymentCode,
    r.originalAmount,
    r.paidAmount,
    r.remainingAmount,
    r.currency,
    statusLabel[r.bucket],
    r.dueAt ? formatDate(r.dueAt) : '',
  ]);
  return buildCsv(headers, dataRows);
}

// `currency` is the report's currently-selected asset (see useReportsData)
// -- every row in `rows` is already filtered to that one asset by the
// caller, same as every other Reports screen; CustomerReportRow itself
// carries no per-row currency because a row is a per-customer aggregate,
// not a single transaction (see reportsCalculations.ts).
export function buildCustomersCsv(rows: CustomerReportRow[], currency: AssetSymbol): string {
  const headers = ['Customer', 'Total Received', 'Outstanding', 'Asset', 'Payment Count', 'Last Payment'];
  const dataRows = rows.map((r) => [
    r.customerName,
    r.totalReceived,
    r.outstanding,
    currency,
    r.paymentCount,
    r.lastPaymentAt ? formatDate(r.lastPaymentAt) : '',
  ]);
  return buildCsv(headers, dataRows);
}

export function buildTransactionsCsv(rows: TransactionReportRow[]): string {
  const headers = ['Date', 'Customer', 'Request Number', 'Amount', 'Asset', 'Network', 'Status', 'Transaction Signature'];
  const dataRows = rows.map((r) => [formatDate(r.paidAt), r.customerName, r.paymentCode, r.amount, r.currency, r.network, r.status, r.txHash]);
  return buildCsv(headers, dataRows);
}

export function buildRequestsCsv(breakdown: RequestsReportBreakdown): string {
  const headers = ['Category', 'Count'];
  const dataRows: CsvValue[][] = [
    ['Created', breakdown.created],
    ['Paid', breakdown.paid],
    ['Pending', breakdown.pending],
    ['Partially Paid', breakdown.partiallyPaid],
    ['Expired', breakdown.expired],
    ['Cancelled', breakdown.cancelled],
  ];
  return buildCsv(headers, dataRows);
}
