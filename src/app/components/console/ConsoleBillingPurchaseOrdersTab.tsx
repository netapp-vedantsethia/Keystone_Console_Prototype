import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import { Popover } from 'react-aria-components';
import { BpActionMenu, BpTabGroup, BpCard, BpCardProperty, BpSearch, BpDropdown } from '@netapp/blueprint/react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { UploadPoDrawer } from './UploadPoDrawer';
import { usePoUploads } from '../../context/PoUploadsContext';
import { useConsoleMode } from '../../context/ConsoleModeContext';
import {
  allSubscriptionInvoices,
  mockSubscriptions,
  PLATFORM_REFERENCE_DATE,
  purchaseOrderMetricsList,
  type PoOmStatus,
  type PoUploadEntry,
  type PurchaseOrderMetrics,
  type Subscription,
} from '../../data/mockData';
import { formatUsd, formatUsdCompact } from './billingFormat';

interface ConsoleBillingPurchaseOrdersTabProps {
  onSelectSubscription?: (subscription: Subscription) => void;
}

type StatusFilter = 'all' | 'active' | 'depleting-soon' | 'exhausted' | 'pending' | 'rejected';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'depleting-soon', label: 'Depleting soon' },
  { id: 'exhausted', label: 'Exhausted' },
  { id: 'pending', label: 'Pending review' },
  { id: 'rejected', label: 'Rejected' },
];

const OM_STATUS_META: Record<PoOmStatus, { label: string; tone: StatusTone }> = {
  approved: { label: 'Approved & Mapped', tone: 'green' },
  pending: { label: 'Pending Review', tone: 'amber' },
  rejected: { label: 'Rejected', tone: 'red' },
};

const HEALTH_META: Record<PurchaseOrderMetrics['healthStatus'], { label: string; tone: StatusTone; bar: string }> = {
  healthy: { label: 'Active', tone: 'green', bar: 'bg-green-600' },
  'depleting-soon': { label: 'Depleting soon', tone: 'amber', bar: 'bg-amber-500' },
  exhausted: { label: 'Exhausted', tone: 'red', bar: 'bg-red-600' },
  expired: { label: 'Expired', tone: 'gray', bar: 'bg-gray-400' },
};

function subscriptionLabel(id: string): string {
  const sub = mockSubscriptions.find((s) => s.id === id);
  return sub ? `${sub.trackingId} · ${sub.account}` : id;
}

function serviceLevelsLabel(po: PurchaseOrderMetrics): string {
  const levels = Array.from(new Set(po.coveredSubscriptions.flatMap((s) => s.serviceLevels)));
  if (levels.length === 0) return '—';
  if (levels.length <= 2) return levels.join(', ');
  return `${levels.slice(0, 2).join(', ')} +${levels.length - 2}`;
}

/** Billing cycles this PO has actually been drawn against, out of cycles elapsed since it started. */
function poRunway(po: PurchaseOrderMetrics): { drawn: number; elapsed: number } {
  const invoices = allSubscriptionInvoices(24).filter((inv) => inv.purchaseOrderId === po.id);
  const start = new Date(po.startDate);
  const end = new Date(Math.min(new Date(po.endDate).getTime(), PLATFORM_REFERENCE_DATE.getTime()));
  const elapsed = Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()));
  return { drawn: invoices.length, elapsed: Math.max(invoices.length, elapsed) };
}

function downloadPoReceipt(entry: PoUploadEntry) {
  const lines = [
    `PO Number: ${entry.poNumber}`,
    `File: ${entry.fileName}`,
    `Amount: ${entry.poAmountUsd != null ? formatUsd(entry.poAmountUsd) : 'N/A'}`,
    `Mapped subscription(s): ${entry.mappedSubscriptionIds.map(subscriptionLabel).join(', ') || 'None'}`,
    `Valid: ${entry.validFrom ?? '—'} to ${entry.validTo ?? '—'}`,
    `OM status: ${entry.omStatus}`,
    `Uploaded by: ${entry.uploadedBy} on ${entry.uploadedAt}`,
    entry.reviewedBy ? `Reviewed by: ${entry.reviewedBy} on ${entry.reviewedAt}` : '',
  ].filter(Boolean);
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entry.poNumber}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

interface PoCardVM {
  entry: PoUploadEntry;
  metrics?: PurchaseOrderMetrics;
}

interface ActionMenuItem {
  label: string;
  icon: typeof Eye;
  onSelect: () => void;
}

export function ConsoleBillingPurchaseOrdersTab({ onSelectSubscription }: ConsoleBillingPurchaseOrdersTabProps) {
  const { uploads, addUpload, updateUpload, remapUpload } = usePoUploads();
  const { scopedSubscriptions, isInScope } = useConsoleMode();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PoUploadEntry | null>(null);
  const [remapEntry, setRemapEntry] = useState<PoUploadEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<PoUploadEntry | null>(null);

  const purchaseOrders = useMemo(
    () => purchaseOrderMetricsList().filter((po) => po.coveredSubscriptionIds.some((id) => isInScope(id))),
    [isInScope],
  );
  const activePos = useMemo(() => purchaseOrders.filter((po) => po.status === 'active'), [purchaseOrders]);

  const scopedUploads = useMemo(
    () => uploads.filter((u) => u.mappedSubscriptionIds.length === 0 || u.mappedSubscriptionIds.some((id) => isInScope(id))),
    [uploads, isInScope],
  );

  const cards = useMemo<PoCardVM[]>(
    () =>
      scopedUploads.map((entry) => ({
        entry,
        metrics: entry.purchaseOrderId ? purchaseOrders.find((po) => po.id === entry.purchaseOrderId) : undefined,
      })),
    [scopedUploads, purchaseOrders],
  );

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cards.filter(({ entry, metrics }) => {
      if (statusFilter === 'pending' && entry.omStatus !== 'pending') return false;
      if (statusFilter === 'rejected' && entry.omStatus !== 'rejected') return false;
      if (statusFilter === 'active' && metrics?.healthStatus !== 'healthy') return false;
      if (statusFilter === 'depleting-soon' && metrics?.healthStatus !== 'depleting-soon') return false;
      if (statusFilter === 'exhausted' && metrics?.healthStatus !== 'exhausted') return false;
      if (!q) return true;
      const haystack = [
        entry.poNumber,
        entry.fileName,
        ...entry.mappedSubscriptionIds.map(subscriptionLabel),
        metrics?.account ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [cards, statusFilter, searchQuery]);

  const summary = useMemo(() => {
    const totalValueUsd = activePos.reduce((s, po) => s + po.totalValueUsd, 0);
    const consumedUsd = activePos.reduce((s, po) => s + po.consumedUsd, 0);
    const insufficientCount = activePos.filter((po) => po.healthStatus === 'exhausted' || po.healthStatus === 'depleting-soon').length;
    const pendingCount = scopedUploads.filter((u) => u.omStatus === 'pending').length;
    const rejectedCount = scopedUploads.filter((u) => u.omStatus === 'rejected').length;
    return {
      activeCount: activePos.length,
      totalValueUsd,
      consumedUsd,
      remainingUsd: Math.max(0, totalValueUsd - consumedUsd),
      insufficientCount,
      pendingCount,
      rejectedCount,
    };
  }, [activePos, scopedUploads]);

  const handleUploadSubmit = (entry: PoUploadEntry) => {
    addUpload(entry);
    setUploadDrawerOpen(false);
  };

  const handleEditSubmit = (updated: PoUploadEntry) => {
    updateUpload(updated);
    setEditingEntry(null);
  };

  const handleRemapConfirm = (entry: PoUploadEntry, newSubscriptionId: string) => {
    remapUpload(entry.id, newSubscriptionId);
    setRemapEntry(null);
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BpCard>
          <BpCardProperty value={summary.activeCount} property="Active POs" />
          <div className="mt-1 text-xs text-gray-500">Approved &amp; mapped</div>
        </BpCard>
        <BpCard>
          <BpCardProperty value={formatUsdCompact(summary.totalValueUsd)} property="Total PO value" />
          <div className="mt-1 text-xs text-gray-500">Consumed {formatUsdCompact(summary.consumedUsd)}</div>
        </BpCard>
        <BpCard>
          <div className="mb-1 text-xs text-green-700">Remaining Value</div>
          <div className="text-2xl font-semibold text-green-700">{formatUsdCompact(summary.remainingUsd)}</div>
          <div className="mt-1 text-xs text-green-600">
            {summary.totalValueUsd > 0 ? Math.round((summary.remainingUsd / summary.totalValueUsd) * 100) : 0}% of total
          </div>
        </BpCard>
        <BpCard>
          <div className="mb-1 text-xs text-gray-600">PO Sufficiency</div>
          {summary.insufficientCount === 0 ? (
            <div className="flex items-center gap-1.5 text-lg font-semibold text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              All sufficient
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-lg font-semibold text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {summary.insufficientCount} need attention
            </div>
          )}
        </BpCard>
      </div>

      {/* Toolbar: search, status filter, upload */}
      <div className="flex flex-nowrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-3 overflow-x-auto">
          <BpTabGroup
            tabs={STATUS_FILTERS.map((f) => ({
              id: f.id,
              label:
                f.label +
                (f.id === 'pending' && summary.pendingCount > 0 ? ` (${summary.pendingCount})` : '') +
                (f.id === 'rejected' && summary.rejectedCount > 0 ? ` (${summary.rejectedCount})` : ''),
            }))}
            value={statusFilter}
            onValueChange={(id) => setStatusFilter(id as StatusFilter)}
            variant="card"
            horizontalResizing="hug"
            tablistAriaLabel="Purchase order status filters"
          />
          <div className="w-56 shrink-0">
            <BpSearch
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search PO number, subscription, account…"
              expandable={false}
            />
          </div>
        </div>
        <Button onClick={() => setUploadDrawerOpen(true)} className="shrink-0">
          <Upload className="h-4 w-4" />
          Upload &amp; Map PO
        </Button>
      </div>

      {/* PO list */}
      {filteredCards.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No purchase orders match this filter.
        </div>
      ) : (
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {filteredCards.map(({ entry, metrics }) =>
            metrics ? (
              <ApprovedPoRow
                key={entry.id}
                entry={entry}
                po={metrics}
                isExpanded={expandedCardId === entry.id}
                onToggleExpand={() => setExpandedCardId((cur) => (cur === entry.id ? null : entry.id))}
                onSelectSubscription={onSelectSubscription}
                onView={() => setViewingEntry(entry)}
                onDownload={() => downloadPoReceipt(entry)}
                onRemap={() => setRemapEntry(entry)}
                onEdit={() => setEditingEntry(entry)}
              />
            ) : (
              <PendingOrRejectedPoRow
                key={entry.id}
                entry={entry}
                onView={() => setViewingEntry(entry)}
                onDownload={() => downloadPoReceipt(entry)}
                onRemap={() => setRemapEntry(entry)}
                onEdit={() => setEditingEntry(entry)}
              />
            ),
          )}
        </div>
      )}

      <UploadPoDrawer isOpen={uploadDrawerOpen} onClose={() => setUploadDrawerOpen(false)} onSubmit={handleUploadSubmit} />
      <UploadPoDrawer
        isOpen={Boolean(editingEntry)}
        entry={editingEntry ?? undefined}
        onClose={() => setEditingEntry(null)}
        onSubmit={handleEditSubmit}
      />
      <RemapPoDrawer
        entry={remapEntry}
        subscriptions={scopedSubscriptions}
        onClose={() => setRemapEntry(null)}
        onConfirm={handleRemapConfirm}
      />
      <ViewPoDocumentDrawer entry={viewingEntry} onClose={() => setViewingEntry(null)} />
    </div>
  );
}

function ApprovedPoRow({
  entry,
  po,
  isExpanded,
  onToggleExpand,
  onSelectSubscription,
  onView,
  onDownload,
  onRemap,
  onEdit,
}: {
  entry: PoUploadEntry;
  po: PurchaseOrderMetrics;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectSubscription?: (subscription: Subscription) => void;
  onView: () => void;
  onDownload: () => void;
  onRemap: () => void;
  onEdit: () => void;
}) {
  const meta = HEALTH_META[po.healthStatus];
  const pct = Math.round(po.consumedPct * 100);
  const runway = poRunway(po);
  const visibleSubs = po.coveredSubscriptions.slice(0, 2);
  const extraSubCount = po.coveredSubscriptions.length - visibleSubs.length;
  const actionItems: ActionMenuItem[] = [
    { label: 'View document', icon: Eye, onSelect: onView },
    { label: 'Download', icon: Download, onSelect: onDownload },
    { label: 'Re-map PO', icon: RefreshCw, onSelect: onRemap },
    { label: 'Edit PO', icon: Pencil, onSelect: onEdit },
  ];

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggleExpand();
        }}
        className="flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 hover:bg-gray-50"
      >
        <div className="flex w-36 shrink-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">{po.id}</span>
        </div>

        <div className="w-[112px] shrink-0 text-center">
          <StatusBadge tone={meta.tone} label={meta.label} />
        </div>

        <div className="flex w-40 shrink-0 items-center gap-2">
          <div className="h-1.5 w-20 shrink-0 rounded-full bg-gray-100">
            <div className={`h-1.5 rounded-full ${meta.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <span className="w-9 shrink-0 text-xs font-semibold text-gray-900">{pct}%</span>
        </div>

        <div className="w-36 shrink-0 text-xs text-gray-600">
          {formatUsdCompact(po.consumedUsd)} <span className="text-gray-400">/</span> {formatUsdCompact(po.totalValueUsd)}
        </div>

        <div className="w-28 shrink-0 text-xs text-gray-600">
          Rem. <span className="font-semibold text-gray-900">{formatUsdCompact(po.remainingUsd)}</span>
        </div>

        <div className={`w-24 shrink-0 text-xs font-medium ${runway.drawn < runway.elapsed ? 'text-amber-600' : 'text-gray-500'}`}>
          {runway.drawn}/{runway.elapsed} cycles
        </div>

        <div className="flex min-w-[140px] flex-1 flex-wrap items-center gap-1">
          {visibleSubs.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSubscription?.(sub);
              }}
              className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#0067c5] hover:bg-blue-100"
            >
              {sub.trackingId}
            </button>
          ))}
          {extraSubCount > 0 && <span className="text-xs text-gray-400">+{extraSubCount} more</span>}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <RowActionMenu items={actionItems} />
          <button
            type="button"
            onClick={onToggleExpand}
            className="rounded p-1.5 hover:bg-gray-200"
            aria-label={isExpanded ? 'Collapse purchase order details' : 'Expand purchase order details'}
            title={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-600">
            <span>
              Vendor: <span className="font-medium text-gray-900">{po.account}</span>
            </span>
            <span>
              Term: <span className="font-medium text-gray-900">{po.startDate} → {po.endDate}</span>
            </span>
            <span>
              Service level: <span className="font-medium text-gray-900">{serviceLevelsLabel(po)}</span>
            </span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Drawdown by subscription</div>
          <div className="mt-1.5 space-y-1.5">
            {po.coveredSubscriptions.length === 0 ? (
              <div className="text-xs text-gray-500">No drawdown data available</div>
            ) : (
              po.coveredSubscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs">
                  <button type="button" onClick={() => onSelectSubscription?.(sub)} className="font-medium text-[#0067c5] hover:underline">
                    {sub.trackingId} · {sub.account}
                  </button>
                  <span className="text-gray-600">
                    {allSubscriptionInvoices(24).filter((i) => i.purchaseOrderId === po.id && i.subscriptionId === sub.id).length} billed cycle(s)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingOrRejectedPoRow({
  entry,
  onView,
  onDownload,
  onRemap,
  onEdit,
}: {
  entry: PoUploadEntry;
  onView: () => void;
  onDownload: () => void;
  onRemap: () => void;
  onEdit: () => void;
}) {
  const meta = OM_STATUS_META[entry.omStatus];
  const isRejected = entry.omStatus === 'rejected';
  const actionItems: ActionMenuItem[] = [
    { label: 'View document', icon: Eye, onSelect: onView },
    { label: 'Download', icon: Download, onSelect: onDownload },
    ...(entry.mappedSubscriptionIds.length > 0 && !isRejected ? [{ label: 'Re-map PO', icon: RefreshCw, onSelect: onRemap }] : []),
    { label: isRejected ? 'Edit & resubmit' : 'Edit PO', icon: Pencil, onSelect: onEdit },
  ];

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 ${isRejected ? 'bg-red-50/40' : 'bg-amber-50/40'}`}>
      <div className="flex w-44 shrink-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-gray-400" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{entry.poNumber}</div>
          <div className="truncate text-xs text-gray-500" title={entry.fileName}>
            {entry.fileName}
          </div>
        </div>
      </div>

      <div className="w-[112px] shrink-0 text-center">
        <StatusBadge tone={meta.tone} label={meta.label} />
      </div>

      <div className="w-28 shrink-0 text-xs text-gray-600">
        {entry.poAmountUsd != null ? <span className="font-semibold text-gray-900">{formatUsd(entry.poAmountUsd)}</span> : <span className="text-gray-400">—</span>}
      </div>

      <div className="min-w-[160px] flex-1 text-xs text-gray-600">
        {entry.mappedSubscriptionIds.length > 0 ? (
          entry.mappedSubscriptionIds.map((id) => <div key={id}>{subscriptionLabel(id)}</div>)
        ) : (
          <span className="font-medium text-red-600">Needs resubmission — no subscription mapped</span>
        )}
        {isRejected && entry.rejectionReason && (
          <div className="mt-0.5 flex items-start gap-1 text-red-600" title={entry.rejectionReason}>
            <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="truncate">{entry.rejectionReason}</span>
          </div>
        )}
      </div>

      <div className="w-40 shrink-0 text-xs text-gray-500">
        Uploaded {entry.uploadedAt}
        <div>by {entry.uploadedBy}</div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <RowActionMenu items={actionItems} />
      </div>
    </div>
  );
}

function RowActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="rounded-full border border-[#1f5fbf] bg-white px-2 py-1 text-[#1f5fbf] hover:bg-blue-50"
        aria-label="Open purchase order actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((open) => !open);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <Popover
        triggerRef={triggerRef}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom end"
        offset={8}
        className="z-50 outline-none"
      >
        <div onClick={(e) => e.stopPropagation()}>
          <BpActionMenu
            ariaLabel="Purchase order actions"
            items={items.map((item) => ({
              label: item.label,
              onSelect: () => {
                item.onSelect();
                setIsOpen(false);
              },
            }))}
          />
        </div>
      </Popover>
    </>
  );
}

function RemapPoDrawer({
  entry,
  subscriptions,
  onClose,
  onConfirm,
}: {
  entry: PoUploadEntry | null;
  subscriptions: Subscription[];
  onClose: () => void;
  onConfirm: (entry: PoUploadEntry, newSubscriptionId: string) => void;
}) {
  const [newSubscriptionId, setNewSubscriptionId] = useState('');

  useEffect(() => {
    if (entry) setNewSubscriptionId('');
  }, [entry?.id]);

  return (
    <Sheet
      key={entry?.id ?? 'remap'}
      open={Boolean(entry)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-[440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">Re-map {entry?.poNumber}</SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">Move this PO to a different subscription</SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-5">
          <div className="space-y-4">
            <div>
              <BpDropdown
                label="New subscription"
                value={newSubscriptionId || undefined}
                onValueChange={(value) => setNewSubscriptionId(value ?? '')}
                placeholder="Select new subscription"
                searchable
                options={subscriptions
                  .filter((s) => !entry?.mappedSubscriptionIds.includes(s.id))
                  .map((s) => ({ value: s.id, label: `${s.trackingId} · ${s.account}` }))}
              />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div className="font-medium">Re-mapping requires OM re-approval</div>
                <p className="mt-1">
                  This PO will be re-submitted for Order Management review after changing the subscription mapping. Once
                  re-approved, the updated mapping appears back on its PO card.
                </p>
              </div>
            </div>
          </div>
        </SheetBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Cancel
          </Button>
          <Button
            onClick={() => entry && onConfirm(entry, newSubscriptionId)}
            disabled={!newSubscriptionId}
            className="bg-[#0067c5] text-[14px] font-[590] text-white hover:bg-[#0056a6]"
          >
            Confirm re-map &amp; resubmit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ViewPoDocumentDrawer({ entry, onClose }: { entry: PoUploadEntry | null; onClose: () => void }) {
  return (
    <Sheet
      key={entry?.id ?? 'view'}
      open={Boolean(entry)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-[440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[440px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">{entry?.fileName}</SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">{entry?.poNumber}</SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-5">
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12">
            <FileText className="h-10 w-10 text-gray-400" />
            <div className="text-sm font-medium text-gray-700">{entry?.fileName}</div>
            <div className="text-xs text-gray-500">Purchase order document preview</div>
            {entry?.omStatus === 'rejected' && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                <XCircle className="h-3.5 w-3.5" />
                Rejected — {entry.rejectionReason}
              </div>
            )}
          </div>
        </SheetBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
