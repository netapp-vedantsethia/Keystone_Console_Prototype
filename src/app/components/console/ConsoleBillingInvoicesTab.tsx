import { useMemo, useState } from 'react';
import { AlertTriangle, Eye, Mail, Receipt, Settings } from 'lucide-react';
import {
  DataTable,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableFooter,
} from '../ui/DataTable';
import { Button } from '../ui/button';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { slicePage, useTablePagination } from '../../hooks/useTablePagination';
import {
  allSubscriptionInvoices,
  fleetInvoiceDeliverySummary,
  getSubscriptionById,
  purchaseOrderMetricsList,
  purchaseOrdersSummary,
  type PlatformNavigateOptions,
  type Subscription,
  type SubscriptionInvoice,
} from '../../data/mockData';
import { useConsoleMode } from '../../context/ConsoleModeContext';
import { formatUsd, formatUsdCompact, invoiceStatusMeta } from './billingFormat';
import { downloadInvoicesCsv } from '../../utils/invoiceCsv';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';
import { InvoiceDeliveryPreferencesDrawer } from './InvoiceDeliveryPreferencesDrawer';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { BpDropdown } from '@netapp/blueprint/react';

interface ConsoleBillingInvoicesTabProps {
  onSelectSubscription?: (subscription: Subscription) => void;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}

const STATUS_OPTIONS = ['all', 'paid', 'pending', 'overdue'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

/** `invoiceStatusMeta` (billingFormat.ts) is a formatting util this migration must not touch;
 *  derive the Blueprint tone here from its stable label text instead. */
function invoiceStatusTone(label: string): StatusTone {
  switch (label) {
    case 'Under Review':
      return 'purple';
    case 'Past Due':
      return 'red';
    case 'Ready for Payment':
      return 'blue';
    default:
      return 'green';
  }
}

export function ConsoleBillingInvoicesTab({ onSelectSubscription, onNavigate }: ConsoleBillingInvoicesTabProps) {
  const { scopedSubscriptions, isInScope } = useConsoleMode();
  const allInvoices = useMemo(() => allSubscriptionInvoices(6, scopedSubscriptions), [scopedSubscriptions]);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showDeliveryPrefs, setShowDeliveryPrefs] = useState(false);

  const periodOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const inv of allInvoices) {
      if (!seen.has(inv.periodDate)) seen.set(inv.periodDate, inv.period);
    }
    return Array.from(seen.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [allInvoices]);

  const filteredInvoices = useMemo(
    () =>
      allInvoices.filter((inv) => {
        if (periodFilter !== 'all' && inv.periodDate !== periodFilter) return false;
        if (subscriptionFilter !== 'all' && inv.subscriptionId !== subscriptionFilter) return false;
        if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
        return true;
      }),
    [allInvoices, periodFilter, subscriptionFilter, statusFilter],
  );

  const selectedInvoice = useMemo(
    () => (selectedInvoiceId ? allInvoices.find((i) => i.id === selectedInvoiceId) ?? null : null),
    [allInvoices, selectedInvoiceId],
  );
  const previousInvoiceForSelected = useMemo(() => {
    if (!selectedInvoice) return undefined;
    const siblings = allInvoices
      .filter((i) => i.subscriptionId === selectedInvoice.subscriptionId)
      .sort((a, b) => (a.periodDate < b.periodDate ? 1 : -1));
    const idx = siblings.findIndex((i) => i.id === selectedInvoice.id);
    return idx >= 0 ? siblings[idx + 1] : undefined;
  }, [allInvoices, selectedInvoice]);

  const scopedPurchaseOrders = useMemo(
    () => purchaseOrderMetricsList().filter((po) => po.coveredSubscriptionIds.some((id) => isInScope(id))),
    [isInScope],
  );
  const poSummary = useMemo(() => purchaseOrdersSummary(scopedPurchaseOrders), [scopedPurchaseOrders]);
  const deliverySummary = useMemo(() => fleetInvoiceDeliverySummary(scopedSubscriptions), [scopedSubscriptions]);

  const summary = useMemo(() => {
    const perPeriod = new Map<string, number>();
    for (const inv of allInvoices) {
      perPeriod.set(inv.periodDate, (perPeriod.get(inv.periodDate) ?? 0) + inv.amount);
    }
    const periodTotals = Array.from(perPeriod.values());
    const avgMonthly = periodTotals.length
      ? Math.round(periodTotals.reduce((a, b) => a + b, 0) / periodTotals.length)
      : 0;

    const due = allInvoices.filter((i) => i.status === 'pending');
    const pastDue = allInvoices.filter((i) => i.status === 'overdue');
    const dueTotal = due.reduce((s, i) => s + i.amount, 0);
    const pastDueTotal = pastDue.reduce((s, i) => s + i.amount, 0);

    const poConsumedPct = poSummary.totalValueUsd > 0 ? Math.round((poSummary.consumedUsd / poSummary.totalValueUsd) * 100) : 0;

    return { avgMonthly, due, pastDue, dueTotal, pastDueTotal, poConsumedPct };
  }, [allInvoices, poSummary]);

  const pagination = useTablePagination(filteredInvoices.length, TABLE_PAGE_SIZE, [
    periodFilter,
    subscriptionFilter,
    statusFilter,
  ]);
  const pageInvoices = slicePage(filteredInvoices, pagination.currentPage, pagination.pageSize);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-xs text-gray-600">Avg monthly cost</div>
          <div className="text-2xl font-semibold text-gray-900">{formatUsd(summary.avgMonthly)}</div>
          <div className="mt-1 text-xs text-gray-500">Across all subscriptions, last {periodOptions.length} period(s)</div>
        </div>

        <div
          className={`rounded-lg border p-4 ${
            summary.pastDue.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-1 text-xs text-gray-600">Unpaid invoices</div>
          <div className={`text-2xl font-semibold ${summary.pastDue.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {summary.due.length + summary.pastDue.length}
          </div>
          <div className="mt-1 space-y-0.5 text-xs">
            <div className="text-gray-600">
              Due ({summary.due.length}): <span className="font-medium text-gray-900">{formatUsd(summary.dueTotal)}</span>
            </div>
            <div className={summary.pastDue.length > 0 ? 'text-red-600' : 'text-gray-500'}>
              Past due ({summary.pastDue.length}):{' '}
              <span className="font-medium">{formatUsd(summary.pastDueTotal)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-600">PO health</span>
            <Receipt className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{summary.poConsumedPct}% used</div>
          <div className="mb-2 mt-1 h-1.5 w-full rounded-full bg-gray-200">
            <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.min(100, summary.poConsumedPct)}%` }} />
          </div>
          <div className="text-xs text-gray-500">
            {poSummary.activeCount} active PO{poSummary.activeCount === 1 ? '' : 's'} ·{' '}
            {formatUsdCompact(poSummary.remainingUsd)} remaining
          </div>
        </div>

        <div
          className={`rounded-lg border p-4 ${
            deliverySummary.subscriptionsWithIssues > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-600">Delivery status</span>
            <Mail className="h-3.5 w-3.5 text-gray-400" />
          </div>
          {deliverySummary.subscriptionsWithIssues > 0 ? (
            <>
              <div className="flex items-center gap-1 text-2xl font-semibold text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                {deliverySummary.subscriptionsWithIssues}
              </div>
              <div className="mt-1 text-xs text-amber-800">
                subscription{deliverySummary.subscriptionsWithIssues === 1 ? '' : 's'} with delivery issues
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold text-green-700">Healthy</div>
              <div className="mt-1 text-xs text-gray-500">
                {deliverySummary.apPortalCount} AP portal · {deliverySummary.emailCount} email
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowDeliveryPrefs(true)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-[#0067c5] hover:underline"
          >
            <Settings className="h-3 w-3" />
            Manage delivery preferences
          </button>
        </div>
      </div>

      <DataTable
        title="All Invoices"
        count={filteredInvoices.length}
        showSearch={false}
        showDownload
        onDownload={() => downloadInvoicesCsv(filteredInvoices, undefined, 'fleet-invoices.csv')}
        actions={
          <>
            <div className="w-44">
              <BpDropdown
                value={periodFilter}
                onValueChange={(value) => setPeriodFilter(value ?? 'all')}
                showClearButton={false}
                options={[
                  { value: 'all', label: 'All periods' },
                  ...periodOptions.map(([iso, label]) => ({ value: iso, label })),
                ]}
              />
            </div>
            <div className="w-56">
              <BpDropdown
                value={subscriptionFilter}
                onValueChange={(value) => setSubscriptionFilter(value ?? 'all')}
                showClearButton={false}
                searchable
                options={[
                  { value: 'all', label: 'All subscriptions' },
                  ...scopedSubscriptions.map((s) => ({ value: s.id, label: `${s.trackingId} · ${s.account}` })),
                ]}
              />
            </div>
            <div className="w-40">
              <BpDropdown
                value={statusFilter}
                onValueChange={(value) => setStatusFilter((value ?? 'all') as StatusFilter)}
                showClearButton={false}
                options={STATUS_OPTIONS.map((s) => ({
                  value: s,
                  label: s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1),
                }))}
              />
            </div>
          </>
        }
      >
        <table className="w-full">
          <DataTableHeader>
            <tr>
              <DataTableHeaderCell>Invoice</DataTableHeaderCell>
              <DataTableHeaderCell>Subscription</DataTableHeaderCell>
              <DataTableHeaderCell>Period</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Committed</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Burst</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Total</DataTableHeaderCell>
              <DataTableHeaderCell>PO</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell sticky="end">Actions</DataTableHeaderCell>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {pageInvoices.map((inv) => {
              const sub = getSubscriptionById(inv.subscriptionId);
              const statusMeta = invoiceStatusMeta(inv);
              return (
                <DataTableRow key={inv.id} onClick={() => setSelectedInvoiceId(inv.id)}>
                  <DataTableCell>
                    {inv.id.replace(/^inv-/, 'INV-').toUpperCase()}
                    {inv.isFinalInvoice && <StatusBadge tone="purple" label="Final" className="ml-2" />}
                  </DataTableCell>
                  <DataTableCell>
                    {sub ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSubscription?.(sub);
                        }}
                      >
                        {sub.trackingId}
                      </Button>
                    ) : (
                      '—'
                    )}
                    <div className="text-xs text-gray-500">{sub?.account}</div>
                  </DataTableCell>
                  <DataTableCell>
                    {inv.period}
                    <div className="text-xs text-gray-500">Due {new Date(inv.dueDate).toLocaleDateString()}</div>
                  </DataTableCell>
                  <DataTableCell align="right">{formatUsd(inv.committed)}</DataTableCell>
                  <DataTableCell align="right">
                    {inv.burstBilled > 0 ? (
                      <span className="font-medium text-red-600">{formatUsd(inv.burstBilled)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell align="right">
                    <span className="font-semibold text-gray-900">{formatUsd(inv.amount)}</span>
                  </DataTableCell>
                  <DataTableCell>
                    {inv.purchaseOrderId ? (
                      <span className="font-medium text-[#0067c5]">{inv.purchaseOrderId}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={invoiceStatusTone(statusMeta.label)} label={statusMeta.label} />
                  </DataTableCell>
                  <DataTableCell sticky="end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="View details"
                      title="View details"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInvoiceId(inv.id);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </table>
        <DataTableFooter
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={filteredInvoices.length}
          itemsPerPage={pagination.pageSize}
          onPageChange={pagination.setCurrentPage}
        />
      </DataTable>

      {selectedInvoice && (
        <InvoiceDetailDrawer
          isOpen
          onClose={() => setSelectedInvoiceId(null)}
          invoice={selectedInvoice}
          previousInvoice={previousInvoiceForSelected}
          subscription={getSubscriptionById(selectedInvoice.subscriptionId)}
          onNavigate={onNavigate}
        />
      )}

      <InvoiceDeliveryPreferencesDrawer
        isOpen={showDeliveryPrefs}
        onClose={() => setShowDeliveryPrefs(false)}
        allowScopeSelection
      />
    </div>
  );
}
