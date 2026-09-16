import { AlertTriangle, ArrowUpRight, Download, GitMerge } from 'lucide-react';
import { BpCard, BpCardProperty } from '@netapp/blueprint/react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import {
  ADDON_MONTHLY_RATE_USD,
  getSubscriptionById,
  type PlatformNavigateOptions,
  type Subscription,
  type SubscriptionInvoice,
} from '../../data/mockData';
import { formatUsd, invoiceStatusMeta } from './billingFormat';
import { downloadInvoiceCsv } from '../../utils/invoiceCsv';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

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

interface InvoiceDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SubscriptionInvoice;
  previousInvoice?: SubscriptionInvoice;
  subscription?: Subscription;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function InvoiceDetailDrawer({
  isOpen,
  onClose,
  invoice,
  previousInvoice,
  subscription,
  onNavigate,
}: InvoiceDetailDrawerProps) {
  const sub = subscription ?? getSubscriptionById(invoice.subscriptionId);
  const statusMeta = invoiceStatusMeta(invoice);
  const delta = previousInvoice ? pctDelta(invoice.amount, previousInvoice.amount) : null;

  const whatChanged: { label: string; value: string; positive: boolean }[] = [];
  if (previousInvoice) {
    const committedDelta = invoice.committed - previousInvoice.committed;
    if (Math.abs(committedDelta) >= 1) {
      whatChanged.push({
        label: 'Committed cost',
        value: `${committedDelta > 0 ? '+' : ''}${formatUsd(committedDelta)}`,
        positive: committedDelta <= 0,
      });
    }
    const burstDelta = invoice.burstBilled - previousInvoice.burstBilled;
    if (Math.abs(burstDelta) >= 1) {
      whatChanged.push({
        label: 'Burst cost',
        value: `${burstDelta > 0 ? '+' : ''}${formatUsd(burstDelta)}`,
        positive: burstDelta <= 0,
      });
    }
    const addOnsDelta = invoice.addOnsCost - previousInvoice.addOnsCost;
    if (Math.abs(addOnsDelta) >= 1) {
      whatChanged.push({
        label: 'Add-ons cost',
        value: `${addOnsDelta > 0 ? '+' : ''}${formatUsd(addOnsDelta)}`,
        positive: addOnsDelta <= 0,
      });
    }
    const extrasDelta = invoice.extrasCost - previousInvoice.extrasCost;
    if (Math.abs(extrasDelta) >= 1) {
      whatChanged.push({
        label: 'Extras cost',
        value: `${extrasDelta > 0 ? '+' : ''}${formatUsd(extrasDelta)}`,
        positive: extrasDelta <= 0,
      });
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[640px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="font-['SF_Pro',sans-serif]">
                {invoice.id.replace(/^inv-/, 'INV-').toUpperCase()}
              </SheetTitle>
              {invoice.isFinalInvoice && <StatusBadge tone="purple" label="Final invoice" />}
              <StatusBadge tone={invoiceStatusTone(statusMeta.label)} label={statusMeta.label} />
            </div>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {invoice.period} · {sub ? `${sub.trackingId} · ${sub.account}` : invoice.subscriptionId}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-5">
          <div className="space-y-5">
            {invoice.disputed && (
              <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
                <div className="text-sm text-purple-900">
                  <div className="font-semibold">Invoice under review</div>
                  <p className="mt-1">
                    This invoice is being disputed and is not yet due for payment.
                    {invoice.disputeSupportCaseId && (
                      <>
                        {' '}
                        Tracked by support case{' '}
                        <button
                          type="button"
                          className="font-semibold underline hover:no-underline"
                          onClick={() =>
                            onNavigate?.('support', undefined, {
                              supportTab: 'cases',
                              highlightSupportCaseId: invoice.disputeSupportCaseId,
                            })
                          }
                        >
                          {invoice.disputeSupportCaseId}
                        </button>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {sub?.lifecycleStatus === 'merged' && sub.mergedInto && (
              <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <GitMerge className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
                <div className="text-sm text-indigo-900">
                  <div className="font-semibold">Subscription merged</div>
                  <p className="mt-1">
                    This subscription was merged on {new Date(sub.mergedInto.date).toLocaleDateString()}. Billing continues
                    on the surviving subscription.
                  </p>
                  <button
                    type="button"
                    className="mt-1.5 inline-flex items-center gap-1 font-semibold underline hover:no-underline"
                    onClick={() => onNavigate?.('subscription-detail', sub.mergedInto!.subscriptionId)}
                  >
                    Go to surviving subscription <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="invoice-summary-grid grid grid-cols-3 gap-3">
              <BpCard>
                <BpCardProperty direction="vertical" value={formatUsd(invoice.amount)} property="Total amount" />
                {delta !== null && (
                  <div className={`mt-0.5 text-xs ${delta <= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {delta <= 0 ? '↓' : '↑'} {Math.abs(delta).toFixed(1)}% vs previous
                  </div>
                )}
              </BpCard>
              <BpCard>
                <BpCardProperty
                  direction="vertical"
                  value={new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  property="Due date"
                />
              </BpCard>
              <BpCard>
                <BpCardProperty direction="vertical" value={invoice.purchaseOrderId ?? '—'} property="Purchase order" />
              </BpCard>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-900">Line items</h4>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Service level</th>
                      <th className="px-3 py-2 text-right">Committed</th>
                      <th className="px-3 py-2 text-right">Burst</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.lineItems.map((li) => (
                      <tr key={li.serviceLevel} className={li.burstCost > 0 ? 'bg-red-50/50' : undefined}>
                        <td className="px-3 py-2 font-medium text-gray-900">{li.serviceLevel}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {li.committedTib} TiB · {formatUsd(li.committedCost)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {li.burstTib > 0 ? (
                            <span className="font-medium text-red-600">
                              {li.burstTib} TiB · {formatUsd(li.burstCost)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatUsd(li.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {sub && sub.addOns.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">Add-ons ({formatUsd(invoice.addOnsCost)})</h4>
                <div className="space-y-1 rounded-lg border border-gray-200 p-3">
                  {sub.addOns.map((name) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{name}</span>
                      <span className="text-gray-900">{formatUsd(ADDON_MONTHLY_RATE_USD[name] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.extraItems.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">Extras ({formatUsd(invoice.extrasCost)})</h4>
                <div className="space-y-1 rounded-lg border border-gray-200 p-3">
                  {invoice.extraItems.map((item, i) => (
                    <div key={`${item.label}-${i}`} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.label}</span>
                      <span className="text-gray-900">{formatUsd(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {whatChanged.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">What changed vs. previous period</h4>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {whatChanged.map((row) => (
                        <tr key={row.label}>
                          <td className="px-3 py-2 text-gray-700">{row.label}</td>
                          <td className={`px-3 py-2 text-right font-medium ${row.positive ? 'text-green-600' : 'text-amber-600'}`}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </SheetBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Close
          </Button>
          <Button
            onClick={() => downloadInvoiceCsv(invoice, sub)}
            className="flex items-center gap-2 bg-[#0067c5] text-[14px] font-[590] text-white hover:bg-[#0056a6]"
          >
            <Download className="h-4 w-4" />
            Download invoice
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
