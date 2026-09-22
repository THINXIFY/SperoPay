// Takes a plain payment code rather than a full PaymentRequest -- both the
// merchant-facing screens and the public invoice/receipt pages (which never
// have a full PaymentRequest, only sanitized RPC fields) need to derive the
// same document id from the same code.
export function getInvoiceId(paymentCode: string): string {
  return `INV-${paymentCode}`;
}

export function getReceiptId(paymentCode: string): string {
  return `RCP-${paymentCode}`;
}
