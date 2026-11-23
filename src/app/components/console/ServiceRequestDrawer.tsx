import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Clock, FileText, Package, RefreshCw, TrendingUp, Sliders, ShieldCheck, PlusCircle } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { getSubscriptionById, formatSubscriptionIdentity, formatServiceLevels, PRICING_ESTIMATE_DISCLAIMER } from '../../data/mockData';
import {
  serviceRequestHasTracker,
  type ConsoleServiceRequest,
  type RequestTrackerStage,
} from '../../data/consoleOperationsMock';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

/** Pause between stages while "Update Status" walks the tracker to completion. */
const STAGE_ADVANCE_MS = 900;

interface ServiceRequestDrawerProps {
  isOpen: boolean;
  /** `allStagesCompleted` lets the caller hand off to whatever the finished request produced. */
  onClose: (allStagesCompleted?: boolean) => void;
  request: ConsoleServiceRequest | null;
}

const TYPE_ICON: Record<ConsoleServiceRequest['type'], typeof FileText> = {
  Renewal: RefreshCw,
  Modification: FileText,
  'Capacity Increase': TrendingUp,
  'Service Level Change': Sliders,
  'New Subscription': Package,
  'SLA Credit Claim': ShieldCheck,
  'Capacity Add (SLA)': PlusCircle,
};

function getStatusTone(status: string): StatusTone {
  switch (status.toLowerCase()) {
    case 'approved':
    case 'completed':
      return 'green';
    case 'in progress':
      return 'blue';
    case 'in review':
      return 'amber';
    case 'pending approval':
      return 'purple';
    default:
      return 'gray';
  }
}

function getPriorityTone(priority: string): StatusTone {
  switch (priority.toLowerCase()) {
    case 'high':
      return 'red';
    case 'medium':
      return 'amber';
    case 'low':
      return 'blue';
    default:
      return 'gray';
  }
}

/**
 * Single right-side drawer for a service request: full request details *and* the lifecycle
 * tracker, combined in one view (no separate "track progress" click needed), the same way a
 * normal order/request placement shows status + details together. Every request type (Renewal,
 * Modification, Capacity Increase, Service Level Change) shows the tracker once it has a
 * populated `stages` timeline.
 */
export function ServiceRequestDrawer({ isOpen, onClose, request }: ServiceRequestDrawerProps) {
  /** Local copy so "Update Status" can walk the timeline without mutating the stored request. */
  const [stages, setStages] = useState<RequestTrackerStage[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    setStages(request && serviceRequestHasTracker(request) ? request.stages.map((s) => ({ ...s })) : []);
    setIsAdvancing(false);
  }, [request]);

  useEffect(() => {
    if (!isAdvancing) return;
    const timer = window.setInterval(() => {
      setStages((prev) => {
        const next = prev.map((s) => ({ ...s }));
        const index = next.findIndex((s) => s.status !== 'completed');
        if (index === -1) return prev;
        next[index].status = 'completed';
        next[index].completedDate = next[index].estimatedDate ?? next[index].completedDate;
        next[index].estimatedDate = undefined;
        if (index + 1 < next.length) {
          next[index + 1].status = 'in-progress';
        }
        return next;
      });
    }, STAGE_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [isAdvancing]);

  const allCompleted = stages.length > 0 && stages.every((s) => s.status === 'completed');

  useEffect(() => {
    if (allCompleted) setIsAdvancing(false);
  }, [allCompleted]);

  if (!request) {
    return null;
  }

  const hasTracker = stages.length > 0;
  const completedStages = stages.filter((s) => s.status === 'completed').length;
  const totalStages = stages.length;
  const progressPercentage = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;
  const isDone = allCompleted;
  const currentStage = stages.find((s) => s.status === 'in-progress');
  const displayStatus = isDone ? 'Completed' : request.status;

  const sub = getSubscriptionById(request.subscriptionId);
  const Icon = TYPE_ICON[request.type];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(isDone); }}>
      <SheetContent
        side="right"
        className="flex w-[640px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]"
      >
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <Icon className="h-4 w-4 text-blue-700" />
              </div>
              <SheetTitle className="font-['SF_Pro',sans-serif]">
                {request.type} Request · {request.id}
              </SheetTitle>
            </div>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {request.type === 'New Subscription' && !sub
                ? `${request.siteLocation} · ${request.serviceLevel} · ${request.committedCapacity}`
                : sub
                  ? `${formatSubscriptionIdentity(sub)} · ${formatServiceLevels(sub)} · ${sub.region} · ${sub.version}`
                  : request.subscriptionId}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-4">
          {/* Progress Overview (tracked requests) or simple status row (others) */}
          {hasTracker ? (
            <div className={`rounded-lg border px-6 py-4 ${isDone ? 'border-green-100 bg-green-50' : 'border-blue-100 bg-blue-50'}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                  Overall Progress
                </span>
                <span
                  className={`text-[14px] font-semibold font-['SF_Pro',sans-serif] ${isDone ? 'text-green-700' : 'text-blue-700'}`}
                >
                  {completedStages} of {totalStages} stages completed
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-200">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${isDone ? 'bg-green-600' : 'bg-blue-600'}`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[13px] text-gray-600 font-['SF_Pro',sans-serif]">
                <StatusBadge tone={isDone ? 'green' : 'blue'} label={displayStatus} />
                {!isDone && currentStage?.estimatedDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Est. next update by {currentStage.estimatedDate}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-6 py-4">
              <StatusBadge tone={getStatusTone(displayStatus)} label={displayStatus} />
              <StatusBadge tone={getPriorityTone(request.priority)} label={`${request.priority} priority`} />
            </div>
          )}

          {/* Request summary */}
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-4">
            <div>
              <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Requested by</div>
              <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.requestedBy}</div>
            </div>
            <div>
              <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Request date</div>
              <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.requestDate}</div>
            </div>
            <div>
              <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Assigned to</div>
              <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.assignedTo}</div>
            </div>
            <div>
              <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Priority</div>
              <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.priority}</div>
            </div>
          </div>

          {/* What was requested */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-[15px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
              What was requested
            </h3>

            {request.type === 'New Subscription' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Site location</div>
                    <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.siteLocation}</div>
                  </div>
                  <div className="rounded-md border border-blue-200 bg-white p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Subscription type</div>
                    <div className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">{request.subscriptionType}</div>
                  </div>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Primary workload</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.workload}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Service level</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.serviceLevel}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Committed capacity</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.committedCapacity}</span>
                </div>
                <div className="flex justify-between gap-4 text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="shrink-0 text-gray-600">Performance</span>
                  <span className="text-right font-[590] text-[#1c1c1c]">{request.performanceProfile}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Term length</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.termLength}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Billing frequency</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.billingFrequency}</span>
                </div>
                <div className="flex justify-between gap-4 text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="shrink-0 text-gray-600">Add-ons</span>
                  <span className="text-right font-[590] text-[#1c1c1c]">{request.addOns}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Estimated cost</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.estimatedCost}</span>
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Business justification</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.businessJustification}</p>
                </div>
              </div>
            )}

            {request.type === 'Renewal' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white border border-gray-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Current term</div>
                    <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.currentTerm}</div>
                  </div>
                  <div className="rounded-md bg-white border border-blue-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Requested term</div>
                    <div className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">{request.requestedTerm}</div>
                  </div>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">New expiration date</span>
                  <span className="font-[590] text-[#1c1c1c]">
                    {getSubscriptionById(request.subscriptionId)?.endDate ?? request.expirationDate}
                  </span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Estimated cost</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.estimatedCost}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Billing contact</span>
                  <span className="break-all text-right font-[590] text-[#1c1c1c]">{request.billingContact}</span>
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Notes</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.renewalNotes}</p>
                </div>
              </div>
            )}

            {request.type === 'Modification' && (
              <div className="space-y-3">
                <div>
                  <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Change summary</div>
                  <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.modification}</div>
                </div>
                <div>
                  <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Scope</div>
                  <div className="text-[14px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.modificationScope}</div>
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Configuration detail</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.configurationChangeDetail}</p>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Target implementation date</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.implementationDate}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Estimated cost</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.estimatedCost}</span>
                </div>
                <p className="text-[12px] italic text-gray-500 font-['SF_Pro',sans-serif]">{PRICING_ESTIMATE_DISCLAIMER}</p>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Rollback plan</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.rollbackPlan}</p>
                </div>
              </div>
            )}

            {request.type === 'Capacity Increase' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white border border-gray-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Current commit</div>
                    <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.currentCommit}</div>
                  </div>
                  <div className="rounded-md bg-white border border-blue-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Requested commit</div>
                    <div className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">{request.requestedCommit}</div>
                  </div>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Estimated cost</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.estimatedCost}</span>
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Justification</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.justification}</p>
                </div>
              </div>
            )}

            {request.type === 'Service Level Change' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white border border-gray-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Current level</div>
                    <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.currentServiceLevel}</div>
                  </div>
                  <div className="rounded-md bg-white border border-green-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Requested level</div>
                    <div className="text-[14px] font-[590] text-green-700 font-['SF_Pro',sans-serif]">{request.requestedServiceLevel}</div>
                  </div>
                </div>
                <div className="flex justify-between gap-4 text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600 shrink-0">Affected volumes</span>
                  <span className="text-right font-[590] text-[#1c1c1c]">{request.affectedVolumes}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Estimated cost delta</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.estimatedCost}</span>
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Implementation window</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.implementationWindow}</p>
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Business justification</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.businessJustification}</p>
                </div>
              </div>
            )}

            {request.type === 'SLA Credit Claim' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white border border-gray-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">SLA category</div>
                    <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.slaCategory} SLA</div>
                  </div>
                  <div className="rounded-md bg-white border border-blue-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Service level</div>
                    <div className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">{request.serviceLevel}</div>
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-[590] text-gray-600 font-['SF_Pro',sans-serif]">Breach summary</div>
                  <p className="text-[14px] text-gray-700 font-['SF_Pro',sans-serif]">{request.breachSummary}</p>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Downloaded report</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.reportFileName}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Estimated credit</span>
                  <span className="font-[590] text-green-700">{request.estimatedCreditAmount}</span>
                </div>
              </div>
            )}

            {request.type === 'Capacity Add (SLA)' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white border border-gray-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">Current committed</div>
                    <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{request.currentCommittedTib}</div>
                  </div>
                  <div className="rounded-md bg-white border border-blue-200 p-3">
                    <div className="text-[12px] text-gray-500 font-['SF_Pro',sans-serif]">New committed</div>
                    <div className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">{request.newCommittedTib}</div>
                  </div>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Service level</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.serviceLevel}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Capacity added</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.addedTib}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Blended rate ($/TiB)</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.blendedRatePerTibUsd}</span>
                </div>
                <div className="flex justify-between text-[14px] font-['SF_Pro',sans-serif]">
                  <span className="text-gray-600">Estimated incremental cost</span>
                  <span className="font-[590] text-[#1c1c1c]">{request.estimatedCost}</span>
                </div>
                <p className="text-[12px] italic text-gray-500 font-['SF_Pro',sans-serif]">{PRICING_ESTIMATE_DISCLAIMER}</p>
              </div>
            )}
          </div>

          {/* Stages Timeline (tracked requests only) */}
          {hasTracker && (
            <div className="mt-6 space-y-6 px-2">
              {stages.map((stage, index) => (
                <div key={index} className="relative flex gap-4">
                  {index < stages.length - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-200" />
                  )}

                  <div className="flex-shrink-0 pt-1">
                    {stage.status === 'completed' && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                    )}
                    {stage.status === 'in-progress' && (
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                        <Circle className="h-6 w-6 text-blue-600" />
                        <span className="absolute h-3 w-3 animate-pulse rounded-full bg-blue-600" />
                      </div>
                    )}
                    {stage.status === 'pending' && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                        <Circle className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 pb-2">
                    <h3
                      className={`text-[16px] font-[590] font-['SF_Pro',sans-serif] ${
                        stage.status === 'completed'
                          ? 'text-[#1c1c1c]'
                          : stage.status === 'in-progress'
                            ? 'text-blue-700'
                            : 'text-gray-500'
                      }`}
                    >
                      {stage.name}
                    </h3>
                    {stage.details && (
                      <p className="mt-1 text-[14px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">{stage.details}</p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-[13px] text-gray-500 font-['SF_Pro',sans-serif]">
                      {stage.completedDate && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed: {stage.completedDate}
                        </span>
                      )}
                      {stage.estimatedDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Est. Completion: {stage.estimatedDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetBody>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-background px-6 py-4">
          <div className="text-[14px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
            {hasTracker &&
              (isDone ? (
                <span className="font-[590] text-green-700">Request completed</span>
              ) : (
                <>
                  <span className="font-[590]">Current stage:</span> {currentStage?.name ?? stages[0]?.name}
                </>
              ))}
          </div>
          <button
            type="button"
            onClick={() => setIsAdvancing(true)}
            disabled={!hasTracker || isDone || isAdvancing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAdvancing ? 'Updating…' : isDone ? 'Completed' : 'Update Status'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
