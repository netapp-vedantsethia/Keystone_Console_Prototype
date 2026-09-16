import { ArrowUpRight, X } from 'lucide-react';
import { Button } from '../ui/button';
import { StatusBadge } from '../ui/StatusBadge';
import {
  DataTable,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
} from '../ui/DataTable';
import { getSubscriptionById, type Subscription } from '../../data/mockData';

interface InactiveSubscriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: Subscription[];
  onSelectSubscription: (subscription: Subscription) => void;
}

/** Expired/merged subscriptions moved out of the main list into their own modal (Blueprint centered dialog) — same columns and data as before, just no longer inline. */
export function InactiveSubscriptionsModal({
  isOpen,
  onClose,
  subscriptions,
  onSelectSubscription,
}: InactiveSubscriptionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e0e0e0] px-6 py-4">
          <div>
            <h2 className="text-[20px] font-normal leading-[32px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
              Expired / Merged Subscriptions
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Kept for historical consumption &amp; billing visibility
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-[#404040]" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <DataTable title="Subscriptions" count={subscriptions.length} showSearch={false} showDownload={false} surface="inner">
            <table className="w-full">
              <DataTableHeader>
                <tr>
                  <DataTableHeaderCell>Subscription #</DataTableHeaderCell>
                  <DataTableHeaderCell>Account</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Merged into</DataTableHeaderCell>
                  <DataTableHeaderCell>Merge date</DataTableHeaderCell>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {subscriptions.map((sub) => {
                  const target = sub.mergedInto ? getSubscriptionById(sub.mergedInto.subscriptionId) : undefined;
                  return (
                    <DataTableRow key={sub.id} onClick={() => onSelectSubscription(sub)}>
                      <DataTableCell>
                        <span className="font-medium text-[#0067c5]">{sub.number}</span>
                        <div className="text-[11px] text-gray-400">{sub.trackingId}</div>
                      </DataTableCell>
                      <DataTableCell>{sub.account}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone="purple" label={sub.lifecycleStatus ?? '—'} className="capitalize" />
                      </DataTableCell>
                      <DataTableCell>
                        {target ? (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSubscription(target);
                            }}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            {target.trackingId}
                          </Button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        {sub.mergedInto ? new Date(sub.mergedInto.date).toLocaleDateString() : '—'}
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </table>
          </DataTable>
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-[#e0e0e0] bg-gray-50 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
