import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { StatusBadge } from '../ui/StatusBadge';
import { BpCheckbox, BpDropdown } from '@netapp/blueprint/react';
import {
  normalizeSubscription,
  usedTibFromBreakdownRow,
  type Subscription,
} from '../../data/mockData';
import {
  buildModificationTrackerStages,
  nextServiceRequestId,
  type ConsoleServiceRequest,
} from '../../data/consoleOperationsMock';
import { addServiceRequest, getServiceRequests } from '../../data/serviceRequestsStore';

/** Minimum increment and step size for committed capacity changes (TiB). */
const CAPACITY_STEP_TIB = 25;

/** Performance tiers available to add (prototype catalog; excludes duplicates already on the subscription). */
const ADDABLE_SERVICE_LEVELS = [
  'Extreme',
  'Premium',
  'Performance',
  'Standard',
  'Value',
] as const;

interface ServiceLevelRow {
  id: string;
  name: string;
  type: string;
  currentCommitted: number;
  newCommitted: number;
  used: number;
  /** New tier requested in this modification (not on subscription yet). */
  isNew: boolean;
}

function alignCommittedToSteps(
  baselineCommitted: number,
  desired: number,
  step = CAPACITY_STEP_TIB,
): number {
  const k = Math.round((desired - baselineCommitted) / step);
  return Math.max(0, baselineCommitted + k * step);
}

function serviceLevelsFromSubscription(sub: Subscription): ServiceLevelRow[] {
  const n = normalizeSubscription(sub);
  return n.serviceLevelBreakdown.map((b) => ({
    id: `existing-${b.level}`,
    name: b.level,
    type: `${n.version.replace(/^v/i, 'V')}_logical`,
    currentCommitted: b.committed,
    newCommitted: alignCommittedToSteps(b.committed, b.committed),
    used: usedTibFromBreakdownRow(b),
    isNew: false,
  }));
}

interface ModificationFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription;
  /** Called with the newly-created, trackable service request right after a successful submit. */
  onSubmitted?: (request: ConsoleServiceRequest) => void;
}

export function ModificationFormDrawer({
  isOpen,
  onClose,
  subscription,
  onSubmitted,
}: ModificationFormDrawerProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [serviceLevels, setServiceLevels] = useState<ServiceLevelRow[]>(() =>
    serviceLevelsFromSubscription(subscription),
  );
  const [reason, setReason] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [reviewAckPriceChange, setReviewAckPriceChange] = useState(false);
  const [reviewAckRackspace, setReviewAckRackspace] = useState(false);
  const [tierToAdd, setTierToAdd] = useState<string>('');
  const newRowSeq = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setServiceLevels(serviceLevelsFromSubscription(subscription));
    setStep(1);
    setReason('');
    setAgreedToTerms(false);
    setReviewAckPriceChange(false);
    setReviewAckRackspace(false);
    setTierToAdd('');
  }, [isOpen, subscription]);

  const versionTypeSuffix = `${normalizeSubscription(subscription).version.replace(/^v/i, 'V')}_logical`;

  const handleCapacityChange = (index: number, delta: number) => {
    setServiceLevels((prev) => {
      const next = [...prev];
      const row = next[index];
      const baseline = row.isNew ? 0 : row.currentCommitted;
      const aligned = alignCommittedToSteps(baseline, row.newCommitted + delta);
      const minCommitted = row.isNew ? CAPACITY_STEP_TIB : 0;
      next[index] = { ...row, newCommitted: Math.max(minCommitted, aligned) };
      return next;
    });
  };

  const levelsInUse = new Set(serviceLevels.map((sl) => sl.name));
  const tiersAvailableToAdd = ADDABLE_SERVICE_LEVELS.filter((t) => !levelsInUse.has(t));

  const handleAddServiceLevel = () => {
    if (!tierToAdd || levelsInUse.has(tierToAdd)) return;
    newRowSeq.current += 1;
    setServiceLevels((prev) => [
      ...prev,
      {
        id: `new-${newRowSeq.current}`,
        name: tierToAdd,
        type: versionTypeSuffix,
        currentCommitted: 0,
        newCommitted: CAPACITY_STEP_TIB,
        used: 0,
        isNew: true,
      },
    ]);
    setTierToAdd('');
  };

  const handleRemoveNewServiceLevel = (id: string) => {
    setServiceLevels((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSubmit = () => {
    const requestDate = new Date().toISOString().slice(0, 10);
    const changeSummary = serviceLevels
      .filter((sl) => sl.isNew || sl.newCommitted !== sl.currentCommitted)
      .map((sl) =>
        sl.isNew
          ? `Add ${sl.name} tier (${sl.newCommitted} TiB)`
          : `${sl.name}: ${sl.currentCommitted} → ${sl.newCommitted} TiB`,
      )
      .join('; ') || 'Capacity adjustment';

    const request: ConsoleServiceRequest = {
      id: nextServiceRequestId(getServiceRequests()),
      subscriptionId: subscription.id,
      type: 'Modification',
      requestedBy: subscription.account,
      requestDate,
      status: 'In Review',
      priority: 'Medium',
      assignedTo: 'NetApp Account Team',
      lastUpdated: 'Just now',
      modification: changeSummary,
      modificationScope: `${subscription.number} · ${subscription.account}`,
      configurationChangeDetail:
        reason.trim() || 'Committed capacity change requested via self-service portal.',
      estimatedCost: 'Pending pricing review',
      implementationDate: new Date(new Date(requestDate).setDate(new Date(requestDate).getDate() + 7))
        .toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      rollbackPlan: 'Revert to prior committed capacity levels if implementation fails validation.',
      stages: buildModificationTrackerStages(1, requestDate),
    };

    addServiceRequest(request);
    onSubmitted?.(request);
    onClose();
  };

  const hasChanges =
    serviceLevels.some((sl) => sl.isNew || sl.currentCommitted !== sl.newCommitted);
  const reviewChecklistComplete = reviewAckPriceChange && reviewAckRackspace;
  const totalCurrentCommitted = serviceLevels.reduce((sum, sl) => sum + sl.currentCommitted, 0);
  const totalNewCommitted = serviceLevels.reduce((sum, sl) => sum + sl.newCommitted, 0);
  const totalChange = totalNewCommitted - totalCurrentCommitted;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[800px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[800px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 pb-4 pr-14 pt-2">
          {/* Top grab affordance: larger hit area for touch; decorative for SR (dialog title is primary). */}
          <div className="-mx-2 flex justify-center py-2" aria-hidden="true">
            <span className="pointer-events-none h-1.5 w-10 rounded-full bg-gray-300 shadow-sm ring-1 ring-gray-200/90" />
          </div>
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">
              Modify Subscription
            </SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {subscription.number} · {subscription.trackingId} · {subscription.account}
            </SheetDescription>
          </SheetHeader>

          {/* Step Indicator */}
          <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 1 ? 'bg-[#0067c5] text-white' : 'bg-green-100 text-green-700'
              }`}>
                <span className="text-[14px] font-[590]">1</span>
              </div>
              <span className={`text-[14px] font-[590] font-['SF_Pro',sans-serif] ${
                step === 1 ? 'text-[#0067c5]' : 'text-gray-500'
              }`}>
                Edit Capacity
              </span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-4">
              <div className={`h-full bg-[#0067c5] transition-all ${step === 2 ? 'w-full' : 'w-0'}`}></div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === 2 ? 'bg-[#0067c5] text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                <span className="text-[14px] font-[590]">2</span>
              </div>
              <span className={`text-[14px] font-[590] font-['SF_Pro',sans-serif] ${
                step === 2 ? 'text-[#0067c5]' : 'text-gray-500'
              }`}>
                Review & Submit
              </span>
            </div>
          </div>
        </div>
        </div>

        <SheetBody className="px-6 py-4">
        {/* Step 1: Edit Capacity */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-[16px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-4">
                Subscribed Performance Service Levels
              </h3>
              
              <div className="space-y-4">
                {serviceLevels.map((sl, index) => (
                  <div key={sl.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-[16px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                          {sl.name} ({sl.type})
                          {sl.isNew && <StatusBadge tone="blue" label="New tier" className="ml-2" />}
                        </h4>
                        <p className="text-[14px] font-normal text-[#0067c5] font-['SF_Pro',sans-serif]">
                          {subscription.trackingId}
                        </p>
                      </div>
                      {sl.isNew && (
                        <button
                          type="button"
                          onClick={() => handleRemoveNewServiceLevel(sl.id)}
                          className="text-[13px] font-[590] text-red-600 hover:underline"
                        >
                          Remove tier
                        </button>
                      )}
                    </div>

                    {/* Current Usage */}
                    {!sl.isNew && (
                    <div className="mb-4">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[14px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                          Used / Committed capacity
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[16px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                            {sl.used}
                          </span>
                          <span className="text-[16px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">/</span>
                          <span className="text-[16px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                            {sl.currentCommitted}
                          </span>
                          <span className="text-[14px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">TiB</span>
                          <span className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-[13px] font-[590] rounded-full">
                            {sl.currentCommitted > 0
                              ? Math.min(100, Math.round((sl.used / sl.currentCommitted) * 100))
                              : 0}
                            %
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-500 h-2 rounded-full"
                          style={{
                            width: `${
                              sl.currentCommitted > 0
                                ? Math.min((sl.used / sl.currentCommitted) * 100, 100)
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    )}

                    {sl.isNew && (
                      <p className="mb-4 text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                        Set initial committed capacity for this tier. Minimum {CAPACITY_STEP_TIB} TiB; further changes in {CAPACITY_STEP_TIB} TiB steps.
                      </p>
                    )}

                    {/* Capacity Adjustment */}
                    <div className="rounded-lg bg-gray-50 p-3">
                      <label className="mb-2 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                        {sl.isNew ? 'Committed capacity for new tier' : 'New Committed Capacity'}
                      </label>
                      <p className="mb-3 text-[12px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                        {sl.isNew
                          ? `Values are in ${CAPACITY_STEP_TIB} TiB steps (minimum ${CAPACITY_STEP_TIB} TiB).`
                          : `Adjustments are in ${CAPACITY_STEP_TIB} TiB steps from current commitment (minimum change per step: ${CAPACITY_STEP_TIB} TiB).`}
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleCapacityChange(index, -CAPACITY_STEP_TIB)}
                          className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-white transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <div className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 rounded">
                          <input
                            type="number"
                            step={CAPACITY_STEP_TIB}
                            min={0}
                            value={sl.newCommitted}
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value);
                              setServiceLevels((prev) => {
                                const next = [...prev];
                                const row = next[index];
                                next[index] = {
                                  ...row,
                                  newCommitted: Number.isFinite(raw)
                                    ? Math.max(0, raw)
                                    : row.newCommitted,
                                };
                                return next;
                              });
                            }}
                            onBlur={() => {
                              setServiceLevels((prev) => {
                                const next = [...prev];
                                const row = next[index];
                                const baseline = row.isNew ? 0 : row.currentCommitted;
                                const minC = row.isNew ? CAPACITY_STEP_TIB : 0;
                                next[index] = {
                                  ...row,
                                  newCommitted: Math.max(
                                    minC,
                                    alignCommittedToSteps(baseline, row.newCommitted),
                                  ),
                                };
                                return next;
                              });
                            }}
                            className="w-24 text-[20px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] text-center border-none focus:outline-none"
                          />
                          <span className="text-[16px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">TiB</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCapacityChange(index, CAPACITY_STEP_TIB)}
                          className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded hover:bg-white transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {sl.newCommitted !== sl.currentCommitted && (
                        <div className={`mt-2 text-[13px] font-[590] font-['SF_Pro',sans-serif] ${
                          sl.newCommitted > sl.currentCommitted ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {sl.newCommitted > sl.currentCommitted ? '+' : ''}
                          {sl.newCommitted - sl.currentCommitted} TiB change
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add another service level */}
              <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-4">
                <h4 className="mb-2 text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                  Add a new performance service level
                </h4>
                {tiersAvailableToAdd.length === 0 ? (
                  <p className="text-[13px] text-gray-500 font-['SF_Pro',sans-serif]">
                    All catalog service levels are already included in this modification or on the subscription.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[180px] flex-1">
                      <BpDropdown
                        value={tierToAdd || undefined}
                        onValueChange={(value) => setTierToAdd(value ?? '')}
                        placeholder="Select service level"
                        options={tiersAvailableToAdd.map((t) => ({ value: t, label: t }))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!tierToAdd}
                      onClick={handleAddServiceLevel}
                      className="border-[#0067c5] text-[#0067c5] hover:bg-blue-50"
                    >
                      Add tier
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Information Notice */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                    Capacity Modification Notice
                  </p>
                  <p className="text-[13px] font-normal text-gray-700 font-['SF_Pro',sans-serif]">
                    Changes to committed capacity will be reflected in your next billing cycle.
                    Increases apply in {CAPACITY_STEP_TIB} TiB increments from your current commitment; decreases use the same step size.
                    Capacity increases may take effect immediately once approved, while decreases may be subject to contract terms.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review & Submit */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-[16px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-4">
                Modification Summary
              </h3>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    Current Total Committed
                  </span>
                  <div className="text-[24px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mt-1">
                    {totalCurrentCommitted} TiB
                  </div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    New Total Committed
                  </span>
                  <div className="text-[24px] font-[590] text-blue-700 font-['SF_Pro',sans-serif] mt-1">
                    {totalNewCommitted} TiB
                  </div>
                  <div className={`text-[14px] font-[590] font-['SF_Pro',sans-serif] mt-1 ${
                    totalChange > 0 ? 'text-green-700' : totalChange < 0 ? 'text-red-700' : 'text-gray-600'
                  }`}>
                    {totalChange > 0 ? '+' : ''}{totalChange} TiB change
                  </div>
                </div>
              </div>

              {/* Service Level Changes */}
              <div className="space-y-3">
                {serviceLevels.map((sl) => (
                  <div key={sl.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                          {sl.name} ({sl.type})
                          {sl.isNew && <StatusBadge tone="blue" label="New tier" className="ml-2" />}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                          {sl.currentCommitted} TiB
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-[14px] font-[590] text-[#0067c5] font-['SF_Pro',sans-serif]">
                          {sl.newCommitted} TiB
                        </span>
                        {(sl.isNew || sl.newCommitted !== sl.currentCommitted) && (
                          <StatusBadge
                            tone={sl.newCommitted >= sl.currentCommitted ? 'green' : 'red'}
                            label={
                              sl.isNew
                                ? `+${sl.newCommitted} TiB new`
                                : `${sl.newCommitted > sl.currentCommitted ? '+' : ''}${sl.newCommitted - sl.currentCommitted} TiB`
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Review checklist */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h4 className="mb-3 text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Modification review checklist
              </h4>
              <p className="mb-3 text-[12px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                Confirm the following before submitting. All items are required.
              </p>
              <ul className="space-y-3">
                <li>
                  <BpCheckbox
                    checked={reviewAckPriceChange}
                    onChange={(e) => setReviewAckPriceChange(e.target.checked)}
                    label="Price change — I understand this modification may change subscription pricing and billing."
                  />
                </li>
                <li>
                  <BpCheckbox
                    checked={reviewAckRackspace}
                    onChange={(e) => setReviewAckRackspace(e.target.checked)}
                    label="Rack space availability — I confirm rack / data-center capacity has been considered for this change."
                  />
                </li>
              </ul>
            </div>

            {/* Reason for Modification */}
            <div>
              <label className="block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-2">
                Reason for Modification (Optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide details about why you're modifying this subscription..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-[14px] font-normal font-['SF_Pro',sans-serif] focus:outline-none focus:ring-2 focus:ring-[#0067c5] resize-none"
              />
            </div>

            {/* Terms and Conditions */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <BpCheckbox
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                label="I acknowledge that this modification may impact billing and service availability"
                details={
                  <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    Changes will be reviewed by the operations team and may take 3-5 business days to complete
                  </p>
                }
              />
            </div>
          </div>
        )}
        </SheetBody>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-background px-6 py-4">
          {step === 2 && (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-[14px] font-[590]"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          {step === 1 && <div></div>}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="text-[14px] font-[590]"
            >
              Cancel
            </Button>
            {step === 1 ? (
              <Button
                onClick={() => setStep(2)}
                disabled={!hasChanges}
                className="bg-[#0067c5] hover:bg-[#0056a6] text-white text-[14px] font-[590] flex items-center gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!agreedToTerms || !reviewChecklistComplete}
                className="bg-[#0067c5] hover:bg-[#0056a6] text-white text-[14px] font-[590]"
              >
                Submit Modification Request
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}