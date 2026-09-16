/** Shared currency formatting for the Billing & Cost screen (Invoices / Purchase Orders / Cost Explorer). */

export function formatUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/** Compact form for summary cards / dense chart labels, e.g. $1.85M, $412.0K, $980. */
export function formatUsdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * Customer-facing status for an invoice: base `status` (paid / pending / overdue) is overridden by
 * `disputed` to surface "Under Review" — used consistently by every invoice list/drawer.
 */
export function invoiceStatusMeta(invoice: {
  status: 'paid' | 'pending' | 'overdue';
  disputed?: boolean;
}): { label: string; badgeClassName: string } {
  if (invoice.disputed) {
    return { label: 'Under Review', badgeClassName: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
  switch (invoice.status) {
    case 'overdue':
      return { label: 'Past Due', badgeClassName: 'bg-red-50 text-red-700 border-red-200' };
    case 'pending':
      return { label: 'Ready for Payment', badgeClassName: 'bg-blue-50 text-blue-700 border-blue-200' };
    default:
      return { label: 'Paid', badgeClassName: 'bg-green-50 text-green-700 border-green-200' };
  }
}
