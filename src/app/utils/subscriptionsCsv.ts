import type { Subscription } from '../data/mockData';
import { formatServiceLevels } from '../data/mockData';

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadSubscriptionsListCsv(
  subscriptions: readonly Subscription[],
  filename = 'subscriptions-list.csv',
): void {
  const headers = [
    'Subscription number',
    'Tracking ID',
    'Customer',
    'Account',
    'Service levels',
    'Region',
    'Version',
    'Account type',
    'Committed (TiB)',
    'Usage (TiB)',
    'Burst (TiB)',
    'Health',
    'SLA',
    'Collector',
    'Billing',
    'Start date',
    'End date',
  ];

  const rows = subscriptions.map((sub) => [
    sub.number,
    sub.trackingId,
    sub.customer,
    sub.account,
    formatServiceLevels(sub),
    sub.region,
    sub.version,
    sub.accountType,
    sub.committed,
    sub.usage,
    sub.burst,
    sub.health,
    sub.sla,
    sub.collectorStatus,
    sub.billingStatus,
    sub.startDate,
    sub.endDate,
  ]);

  const csv = [headers, ...rows]
    .map((line) => line.map(escapeCsvCell).join(','))
    .join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
