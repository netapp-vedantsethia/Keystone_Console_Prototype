import { useState } from 'react';
import type { ComponentType } from 'react';
import { FileText, Receipt, TrendingUp } from 'lucide-react';
import { BpTabGroup } from '@netapp/blueprint/react';
import { ConsolePageHeader } from './ConsolePageHeader';
import { ConsoleBillingInvoicesTab } from './ConsoleBillingInvoicesTab';
import { ConsoleBillingPurchaseOrdersTab } from './ConsoleBillingPurchaseOrdersTab';
import { ConsoleBillingCostExplorerTab } from './ConsoleBillingCostExplorerTab';
import type { PlatformNavigateOptions, Subscription } from '../../data/mockData';

export type BillingCostTab = 'invoices' | 'purchase-orders' | 'cost-explorer';

interface ConsoleBillingCostProps {
  initialTab?: BillingCostTab;
  onSelectSubscription?: (subscription: Subscription) => void;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}

const TABS: { id: BillingCostTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: Receipt },
  { id: 'cost-explorer', label: 'Cost Explorer', icon: TrendingUp },
];

export function ConsoleBillingCost({
  initialTab = 'invoices',
  onSelectSubscription,
  onNavigate,
}: ConsoleBillingCostProps) {
  const [activeTab, setActiveTab] = useState<BillingCostTab>(initialTab);
  const [showNotice, setShowNotice] = useState(true);

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <ConsolePageHeader title="Billing & Cost" onRefresh={() => {}} />

      <div className="p-5">
        {activeTab !== 'cost-explorer' && showNotice && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-sm text-amber-900">
              <span className="font-semibold">Billed items only (tax &amp; invoice PDF pending).</span>{' '}
              We&apos;re showing committed, burst, add-on, and extra line items so you can reconcile spend. Tax is not
              included, and finalized invoice documents will be available in a later release.
            </div>
            <button
              type="button"
              onClick={() => setShowNotice(false)}
              className="shrink-0 text-xs font-medium text-amber-900 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-gray-200 bg-white px-2">
          <BpTabGroup
            tabs={TABS.map((tab) => ({ id: tab.id, label: tab.label, icon: tab.icon }))}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as BillingCostTab)}
            horizontalResizing="hug"
            tablistAriaLabel="Billing & Cost sections"
          />
        </div>

        {activeTab === 'invoices' && (
          <ConsoleBillingInvoicesTab onSelectSubscription={onSelectSubscription} onNavigate={onNavigate} />
        )}
        {activeTab === 'purchase-orders' && (
          <ConsoleBillingPurchaseOrdersTab onSelectSubscription={onSelectSubscription} />
        )}
        {activeTab === 'cost-explorer' && <ConsoleBillingCostExplorerTab />}
      </div>
    </div>
  );
}
