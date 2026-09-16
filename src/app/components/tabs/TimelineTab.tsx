import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowUpDown,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  Eye,
  FilePlus2,
  FileText,
  GitMerge,
  Pencil,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  mockConsoleServiceRequests,
  getSubscriptionTimeline,
  type ConsoleServiceRequest,
  type PlatformNavigateOptions,
  type Subscription,
  type SubscriptionTimelineEvent,
  type SubscriptionTimelineEventType,
} from '../../data/mockData';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

type RenewalServiceRequest = Extract<ConsoleServiceRequest, { type: 'Renewal' }>;

function isRenewalRequest(r: ConsoleServiceRequest): r is RenewalServiceRequest {
  return r.type === 'Renewal';
}

interface TimelineTabProps {
  subscription: Subscription;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TYPE_META: Record<
  SubscriptionTimelineEventType,
  { label: string; tone: StatusTone; iconBg: string; iconColor: string; Icon: typeof FilePlus2 }
> = {
  signed: { label: 'Signed', tone: 'green', iconBg: 'bg-green-100', iconColor: 'text-green-600', Icon: FilePlus2 },
  modified: { label: 'Modified', tone: 'blue', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', Icon: Pencil },
  renewed: { label: 'Renewed', tone: 'purple', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', Icon: RefreshCw },
  merged: { label: 'Merged', tone: 'purple', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', Icon: GitMerge },
  upcoming: { label: 'Upcoming', tone: 'gray', iconBg: 'bg-gray-100', iconColor: 'text-gray-400', Icon: Circle },
};

export function TimelineTab({ subscription, onNavigate }: TimelineTabProps) {
  const events = useMemo(() => getSubscriptionTimeline(subscription), [subscription]);

  const pendingRenewal = useMemo(
    () =>
      mockConsoleServiceRequests.find(
        (r): r is RenewalServiceRequest => isRenewalRequest(r) && r.subscriptionId === subscription.id,
      ),
    [subscription.id],
  );

  const [newestFirst, setNewestFirst] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const current = events.find((e) => e.isCurrent && e.orderForm);
    return current?.id ?? null;
  });

  const orderFormCount = events.filter((e) => e.orderForm).length;
  const displayedEvents = newestFirst ? [...events].reverse() : events;

  return (
    <div className="bg-white border border-[#e0e0e0] rounded">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e0e0e0] p-6">
        <div>
          <h3 className="text-[16px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Subscription Timeline</h3>
          <p className="mt-0.5 text-[13px] text-[#737373] font-['SF_Pro',sans-serif]">
            {orderFormCount} order form{orderFormCount !== 1 ? 's' : ''} on file
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            className="flex items-center gap-1.5 rounded border border-[#e0e0e0] px-3 py-1.5 text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] hover:bg-gray-50"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {newestFirst ? 'Newest first' : 'Oldest first'}
          </button>
          <div className="text-right text-[12px] font-['SF_Pro',sans-serif] leading-[18px]">
            <div className="text-[#737373]">
              Signed <span className="font-[590] text-[#1c1c1c]">{formatDate(subscription.startDate)}</span>
            </div>
            <div className="text-[#737373]">
              Ends <span className="font-[590] text-[#1c1c1c]">{formatDate(subscription.endDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="p-6">
        {displayedEvents.map((event, idx) => (
          <TimelineEventRow
            key={event.id}
            event={event}
            isLast={idx === displayedEvents.length - 1}
            isExpanded={expandedId === event.id}
            onToggle={() =>
              setExpandedId((prev) => (prev === event.id ? null : event.orderForm ? event.id : prev))
            }
            onNavigate={onNavigate}
            pendingRenewalNote={
              event.type === 'upcoming' && pendingRenewal
                ? `Renewal request pending: ${pendingRenewal.requestedTerm} term requested ${formatDate(pendingRenewal.requestDate)} · ${pendingRenewal.status}`
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function TimelineEventRow({
  event,
  isLast,
  isExpanded,
  onToggle,
  onNavigate,
  pendingRenewalNote,
}: {
  event: SubscriptionTimelineEvent;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
  pendingRenewalNote?: string;
}) {
  const meta = TYPE_META[event.type];
  const Icon = meta.Icon;
  const expandable = Boolean(event.orderForm);
  const isUpcoming = event.type === 'upcoming';
  const isMerged = event.type === 'merged';

  return (
    <div className="relative flex gap-4">
      {!isLast && <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />}

      {/* Icon */}
      <div className="flex-shrink-0 pt-0.5">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full ${meta.iconBg} ${
            isUpcoming ? 'border-2 border-dashed border-gray-300 bg-white' : ''
          }`}
        >
          <Icon className={`h-5 w-5 ${meta.iconColor}`} />
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
        <button
          type="button"
          onClick={expandable ? onToggle : undefined}
          className={`w-full text-left ${expandable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-['SF_Pro',sans-serif]">
                <StatusBadge tone={meta.tone} label={meta.label} className="uppercase tracking-wide" />
                {event.isCurrent && (
                  <StatusBadge tone="blue" label="Current" className="uppercase tracking-wide" />
                )}
                <span className="text-[#737373]">{formatDate(event.date)}</span>
                {event.orderForm && (
                  <>
                    <span className="text-[#c7c7c7]">·</span>
                    <span className="text-[#737373]">{event.orderForm.id}</span>
                  </>
                )}
              </div>
              <div className="mt-1.5 text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                {event.title}
              </div>
              <div className="mt-0.5 text-[13px] text-[#737373] font-['SF_Pro',sans-serif]">
                {event.description}
              </div>
              {pendingRenewalNote && (
                <div className="mt-1 text-[12px] font-[590] text-[#0067c5] font-['SF_Pro',sans-serif]">
                  {pendingRenewalNote}
                </div>
              )}
              {isMerged && event.whatChanged && event.whatChanged.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {event.whatChanged.map((change) => (
                    <li key={change} className="text-[12px] text-[#737373] font-['SF_Pro',sans-serif]">
                      • {change}
                    </li>
                  ))}
                </ul>
              )}
              {isMerged && event.linkedSubscriptionId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.('subscription-detail', event.linkedSubscriptionId);
                  }}
                  className="mt-1.5 flex items-center gap-1 text-[12px] font-[590] text-[#0067c5] font-['SF_Pro',sans-serif] hover:underline"
                >
                  Go to subscription
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
              {expandable && !isExpanded && (
                <div className="mt-1.5 text-[12px] text-[#0067c5] font-['SF_Pro',sans-serif]">
                  {event.whatChanged?.length
                    ? `${event.whatChanged.length} change${event.whatChanged.length !== 1 ? 's' : ''} · click to view order form`
                    : 'Click to view order form'}
                </div>
              )}
            </div>
            {expandable && (
              <ChevronDown
                className={`mt-1 h-4 w-4 flex-shrink-0 text-[#737373] transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            )}
          </div>
        </button>

        {isExpanded && event.orderForm && (
          <div className="mt-4 space-y-4">
            {event.whatChanged && event.whatChanged.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-[12px] font-[590] uppercase tracking-wide text-blue-900 font-['SF_Pro',sans-serif]">
                  <Sparkles className="h-3.5 w-3.5" />
                  What changed
                </div>
                <ul className="space-y-1.5">
                  {event.whatChanged.map((change) => (
                    <li key={change} className="flex items-start gap-2 text-[13px] text-blue-900 font-['SF_Pro',sans-serif]">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <OrderFormCard orderForm={event.orderForm} />
          </div>
        )}
      </div>
    </div>
  );
}

function OrderFormCard({ orderForm }: { orderForm: NonNullable<SubscriptionTimelineEvent['orderForm']> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e0e0e0]">
      <div className="flex items-start justify-between gap-3 border-b border-[#e0e0e0] bg-gray-50 p-4">
        <div className="flex items-start gap-2.5">
          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0067c5]" />
          <div>
            <div className="text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
              Signed Order Form · {orderForm.id}
            </div>
            <div className="mt-0.5 text-[12px] text-[#737373] font-['SF_Pro',sans-serif]">
              Signed {formatDate(orderForm.signedDate)} by {orderForm.signerName}, {orderForm.signerTitle} ·{' '}
              {orderForm.signerOrg}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <a
            href={orderForm.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded border border-[#e0e0e0] bg-white px-3 py-1.5 text-[12px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </a>
          <a
            href={orderForm.pdfUrl}
            download
            className="flex items-center gap-1.5 rounded border border-[#e0e0e0] bg-white px-3 py-1.5 text-[12px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-4 sm:grid-cols-2">
        <DetailSection title="Addresses">
          <DetailRow label="Bill-to" value={orderForm.billTo} />
          <DetailRow label="Ship-to" value={orderForm.shipTo} />
        </DetailSection>

        <DetailSection title="Sales motion">
          <DetailRow label="Channel" value={orderForm.channel} />
          <DetailRow label="Contract value" value={`$${orderForm.contractValueUsd.toLocaleString()} / ${orderForm.termMonths / 12}yr`} />
        </DetailSection>

        <DetailSection title="Term">
          <DetailRow label="Length" value={orderForm.termLabel} />
          <DetailRow label="Effective" value={formatDate(orderForm.effectiveDate)} />
        </DetailSection>

        <DetailSection title="Committed capacity">
          <DetailRow label="Total" value={`${orderForm.committedTotalTib} TiB`} bold />
          {orderForm.committedBreakdown.map((row) => (
            <DetailRow key={row.level} label={row.level} value={`${row.committed} TiB`} />
          ))}
        </DetailSection>

        <DetailSection title="Additional services">
          <ul className="space-y-1">
            {orderForm.additionalServices.map((service) => (
              <li key={service} className="flex items-center gap-1.5 text-[13px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                {service}
              </li>
            ))}
          </ul>
        </DetailSection>

        <DetailSection title="Special conditions">
          <ul className="space-y-1">
            {orderForm.specialConditions.map((condition) => (
              <li key={condition} className="text-[13px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                • {condition}
              </li>
            ))}
          </ul>
        </DetailSection>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-[590] uppercase tracking-wide text-[#737373] font-['SF_Pro',sans-serif]">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px] font-['SF_Pro',sans-serif]">
      <span className="text-[#737373]">{label}</span>
      <span className={`text-right text-[#1c1c1c] ${bold ? 'font-[590]' : ''}`}>{value}</span>
    </div>
  );
}
