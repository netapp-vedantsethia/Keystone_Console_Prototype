import type { Subscription, SubscriptionInvoice } from '../data/mockData';

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function download(csv: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const INVOICE_HEADERS = [
  'Invoice',
  'Subscription',
  'Account',
  'Billing period',
  'Committed ($)',
  'Burst billed ($)',
  'Add-ons ($)',
  'Extras ($)',
  'Total ($)',
  'Due date',
  'Status',
  'Purchase order',
];

function invoiceRow(invoice: SubscriptionInvoice, subscription?: Subscription): (string | number)[] {
  return [
    invoice.id.replace(/^inv-/, 'INV-').toUpperCase(),
    subscription?.trackingId ?? invoice.subscriptionId,
    subscription?.account ?? '',
    invoice.period,
    invoice.committed,
    invoice.burstBilled,
    invoice.addOnsCost,
    invoice.extrasCost,
    invoice.amount,
    invoice.dueDate,
    invoice.disputed ? 'Under Review' : invoice.status,
    invoice.purchaseOrderId ?? '',
  ];
}

/** Downloads a single invoice (header + line items) as CSV. */
export function downloadInvoiceCsv(invoice: SubscriptionInvoice, subscription?: Subscription): void {
  const summary = [INVOICE_HEADERS, invoiceRow(invoice, subscription)];

  const lineItemHeaders = ['Service level', 'Committed (TiB)', 'Rate ($/TiB)', 'Committed cost ($)', 'Burst (TiB)', 'Burst cost ($)', 'Subtotal ($)'];
  const lineItemRows = invoice.lineItems.map((li) => [
    li.serviceLevel,
    li.committedTib,
    li.ratePerTib,
    li.committedCost,
    li.burstTib,
    li.burstCost,
    li.subtotal,
  ]);

  const rows = [...summary, [], lineItemHeaders, ...lineItemRows];
  const csv = rows.map((line) => line.map(escapeCsvCell).join(',')).join('\r\n');
  download(csv, `${invoice.id}.csv`);
}

/** Downloads a list of invoices (e.g. all invoices for a subscription, or a filtered fleet-wide view) as CSV. */
export function downloadInvoicesCsv(
  invoices: readonly SubscriptionInvoice[],
  subscription?: Subscription,
  filename = 'invoices.csv',
): void {
  const rows = invoices.map((inv) => invoiceRow(inv, subscription));
  const csv = [INVOICE_HEADERS, ...rows].map((line) => line.map(escapeCsvCell).join(',')).join('\r\n');
  download(csv, filename);
}
