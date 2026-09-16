import { useMemo, useState } from 'react';
import { AlertTriangle, Download, Eye, Mail, Receipt, Settings, ShieldCheck } from 'lucide-react';
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
  buildInvoicesForSubscription,
  invoiceDeliveryPreferenceForSubscription,
  isDarkSite,
  mockSubscriptions,
  purchaseOrdersForSubscription,
  type PlatformNavigateOptions,
  type Subscription,
  type SubscriptionInvoice,
} from '../../data/mockData';
import { formatUsd, invoiceStatusMeta } from '../console/billingFormat';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { downloadInvoiceCsv, downloadInvoicesCsv } from '../../utils/invoiceCsv';
import { InvoiceDetailDrawer } from '../console/InvoiceDetailDrawer';
import { InvoiceDeliveryPreferencesDrawer } from '../console/InvoiceDeliveryPreferencesDrawer';
import { InvoiceDeliveryFailuresDrawer } from '../console/InvoiceDeliveryFailuresDrawer';
import { SubscriptionPurchaseOrdersDrawer } from '../console/SubscriptionPurchaseOrdersDrawer';

interface BillingTabProps {
  subscription?: Subscription;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}

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

export function BillingTab({ subscription, onNavigate }: BillingTabProps = {}) {
  const sub = subscription ?? mockSubscriptions[0];
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showDeliveryPrefs, setShowDeliveryPrefs] = useState(false);
  const [showDeliveryFailures, setShowDeliveryFailures] = useState(false);
  const [showPurchaseOrders, setShowPurchaseOrders] = useState(false);

  const invoices = useMemo(() => buildInvoicesForSubscription(sub), [sub]);
  const selectedIndex = selectedInvoiceId ? invoices.findIndex((i) => i.id === selectedInvoiceId) : -1;
  const selectedInvoice = selectedIndex >= 0 ? invoices[selectedIndex] : null;
  const previousInvoice = selectedIndex >= 0 ? invoices[selectedIndex + 1] : undefined;

  const purchaseOrders = useMemo(() => purchaseOrdersForSubscription(sub.id), [sub.id]);
  const deliveryPreference = useMemo(() => invoiceDeliveryPreferenceForSubscription(sub.id), [sub.id]);

  const summary = useMemo(() => {
    const amounts = invoices.map((i) => i.amount);
    const avgMonthly = amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : 0;

    const due = invoices.filter((i) => i.status === 'pending');
    const pastDue = invoices.filter((i) => i.status === 'overdue');
    const dueTotal = due.reduce((s, i) => s + i.amount, 0);
    const pastDueTotal = pastDue.reduce((s, i) => s + i.amount, 0);

    const activePo = purchaseOrders.find((po) => po.status === 'active');
    const poConsumedPct = activePo ? Math.round(activePo.consumedPct * 100) : null;

    const failedEmailCount = deliveryPreference.emails.filter((e) => e.status === 'failed').length;
    const deliveryIssueCount = deliveryPreference.portalDeliveryErrors.length;

    return {
      avgMonthly,
      due,
      pastDue,
      dueTotal,
      pastDueTotal,
      unpaidTotal: dueTotal + pastDueTotal,
      activePo,
      poConsumedPct,
      failedEmailCount,
      deliveryIssueCount,
    };
  }, [invoices, purchaseOrders, deliveryPreference]);

  const invoicePg = useTablePagination(invoices.length, TABLE_PAGE_SIZE, [sub.id]);
  const pageInvoices = slicePage(invoices, invoicePg.currentPage, invoicePg.pageSize);

  return (
    <div className="space-y-6">
      {isDarkSite(sub) && (
        <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
          <div className="text-sm text-purple-900">
            <span className="font-semibold">Committed-capacity billing only.</span> Dark Site
            subscriptions are billed on committed capacity alone — burst can't be
            measured without visibility into your environment, so it's never charged.
          </div>
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-xs text-gray-600">Avg monthly cost</div>
          <div className="text-2xl font-semibold text-gray-900">{formatUsd(summary.avgMonthly)}</div>
          <div className="mt-1 text-xs text-gray-500">Last {invoices.length} invoice(s) on file</div>
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
          {summary.activePo ? (
            <>
              <div className="text-2xl font-semibold text-gray-900">{summary.poConsumedPct}% used</div>
              <div className="mb-2 mt-1 h-1.5 w-full rounded-full bg-gray-200">
                <div
                  className="h-1.5 rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, summary.poConsumedPct ?? 0)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500">
                {purchaseOrders.length} PO{purchaseOrders.length === 1 ? '' : 's'} linked
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">No active PO on file</div>
          )}
          <button
            type="button"
            onClick={() => setShowPurchaseOrders(true)}
            className="mt-2 text-xs font-medium text-[#0067c5] hover:underline"
          >
            View POs →
          </button>
        </div>

        <div
          className={`rounded-lg border p-4 ${
            summary.deliveryIssueCount > 0 || summary.failedEmailCount > 0
              ? 'border-amber-200 bg-amber-50'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-600">Delivery status</span>
            <Mail className="h-3.5 w-3.5 text-gray-400" />
          </div>
          {summary.deliveryIssueCount > 0 ? (
            <>
              <div className="flex items-center gap-1 text-2xl font-semibold text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                {summary.deliveryIssueCount}
              </div>
              <div className="mt-1 text-xs text-amber-800">Partial delivery failure on file</div>
              <button
                type="button"
                onClick={() => setShowDeliveryFailures(true)}
                className="mt-2 block text-xs font-medium text-amber-900 hover:underline"
              >
                View delivery failures →
              </button>
            </>
          ) : (
            <>
              <div className="text-2xl font-semibold text-green-700">Healthy</div>
              <div className="mt-1 text-xs text-gray-500">
                Delivering via {deliveryPreference.primaryMethod === 'ap-portal' ? deliveryPreference.apPortalProvider : 'email'}
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

      {/* Invoice List */}
      <DataTable
        title="Invoices"
        count={invoices.length}
        showSearch={false}
        showDownload
        onDownload={() => downloadInvoicesCsv(invoices, sub)}
      >
        <table className="w-full">
          <DataTableHeader>
            <tr>
              <DataTableHeaderCell>Billing Period</DataTableHeaderCell>
              <DataTableHeaderCell>Committed</DataTableHeaderCell>
              <DataTableHeaderCell>Burst Billed</DataTableHeaderCell>
              <DataTableHeaderCell>Total Amount</DataTableHeaderCell>
              <DataTableHeaderCell>Due Date</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell sticky="end">Actions</DataTableHeaderCell>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {pageInvoices.map((invoice) => {
              const statusMeta = invoiceStatusMeta(invoice);
              return (
                <DataTableRow key={invoice.id}>
                  <DataTableCell>
                    {invoice.period}
                    {invoice.isFinalInvoice && (
                      <StatusBadge tone="purple" label="Final invoice" className="ml-2" />
                    )}
                  </DataTableCell>
                  <DataTableCell>{formatUsd(invoice.committed)}</DataTableCell>
                  <DataTableCell>
                    {invoice.burstBilled > 0 ? (
                      <span className="text-red-600 font-medium">{formatUsd(invoice.burstBilled)}</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <span className="font-semibold text-gray-900">{formatUsd(invoice.amount)}</span>
                  </DataTableCell>
                  <DataTableCell>{new Date(invoice.dueDate).toLocaleDateString()}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={invoiceStatusTone(statusMeta.label)} label={statusMeta.label} />
                  </DataTableCell>
                  <DataTableCell sticky="end">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="View details"
                        title="View details"
                        onClick={() => setSelectedInvoiceId(invoice.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Download CSV"
                        title="Download CSV"
                        onClick={() => downloadInvoiceCsv(invoice, sub)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </table>
        <DataTableFooter
          currentPage={invoicePg.currentPage}
          totalPages={invoicePg.totalPages}
          totalItems={invoices.length}
          itemsPerPage={invoicePg.pageSize}
          onPageChange={invoicePg.setCurrentPage}
        />
      </DataTable>

      {selectedInvoice && (
        <InvoiceDetailDrawer
          isOpen
          onClose={() => setSelectedInvoiceId(null)}
          invoice={selectedInvoice}
          previousInvoice={previousInvoice}
          subscription={sub}
          onNavigate={onNavigate}
        />
      )}

      <InvoiceDeliveryPreferencesDrawer
        isOpen={showDeliveryPrefs}
        onClose={() => setShowDeliveryPrefs(false)}
        subscription={sub}
      />

      <InvoiceDeliveryFailuresDrawer
        isOpen={showDeliveryFailures}
        onClose={() => setShowDeliveryFailures(false)}
        subscription={sub}
        onManagePreferences={() => {
          setShowDeliveryFailures(false);
          setShowDeliveryPrefs(true);
        }}
      />

      <SubscriptionPurchaseOrdersDrawer
        isOpen={showPurchaseOrders}
        onClose={() => setShowPurchaseOrders(false)}
        subscription={sub}
        onNavigate={onNavigate}
      />
    </div>
  );
}
