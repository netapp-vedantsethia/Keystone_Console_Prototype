import { ArrowUpRight } from 'lucide-react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import {
  purchaseOrdersForSubscription,
  type PlatformNavigateOptions,
  type PurchaseOrderMetrics,
  type Subscription,
} from '../../data/mockData';
import { formatUsdCompact } from './billingFormat';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

interface SubscriptionPurchaseOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}

const STATUS_META: Record<PurchaseOrderMetrics['healthStatus'], { label: string; tone: StatusTone }> = {
  healthy: { label: 'Healthy', tone: 'green' },
  'depleting-soon': { label: 'Depleting soon', tone: 'amber' },
  exhausted: { label: 'Exhausted', tone: 'red' },
  expired: { label: 'Expired', tone: 'gray' },
};

export function SubscriptionPurchaseOrdersDrawer({
  isOpen,
  onClose,
  subscription,
  onNavigate,
}: SubscriptionPurchaseOrdersDrawerProps) {
  const purchaseOrders = purchaseOrdersForSubscription(subscription.id);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">Purchase orders</SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {subscription.number} · {subscription.trackingId} · {subscription.account}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-5">
          {purchaseOrders.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
              No purchase orders on file for this subscription.
            </div>
          ) : (
            <div className="space-y-3">
              {purchaseOrders.map((po) => {
                const meta = STATUS_META[po.healthStatus];
                const pct = Math.round(po.consumedPct * 100);
                return (
                  <div key={po.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-semibold text-gray-900">{po.id}</span>
                      <StatusBadge tone={meta.tone} label={meta.label} />
                    </div>
                    <div className="mb-2 text-xs text-gray-500">{po.name}</div>
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                      <span>
                        {formatUsdCompact(po.consumedUsd)} of {formatUsdCompact(po.totalValueUsd)}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mb-3 h-1.5 w-full rounded-full bg-gray-200">
                      <div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        Term: {po.startDate} → {po.endDate}
                      </div>
                      <div className="text-right">Remaining: {formatUsdCompact(po.remainingUsd)}</div>
                    </div>
                    {po.coveredSubscriptionIds.length > 1 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Also covers {po.coveredSubscriptionIds.length - 1} other subscription
                        {po.coveredSubscriptionIds.length - 1 === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SheetBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Close
          </Button>
          <Button
            onClick={() => onNavigate?.('billing-cost', undefined, { billingCostTab: 'purchase-orders' })}
            className="flex items-center gap-2 bg-[#0067c5] text-[14px] font-[590] text-white hover:bg-[#0056a6]"
          >
            Go to PO Management
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
