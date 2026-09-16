import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Minus, Plus, ShieldCheck } from 'lucide-react';
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
  buildNewSubscriptionTrackerStages,
  nextServiceRequestId,
  type ConsoleServiceRequest,
} from '../../data/consoleOperationsMock';
import { addServiceRequest, getServiceRequests } from '../../data/serviceRequestsStore';
import { publishRequestToSellerDashboard } from '../../data/catalogSellerHandoff';

/** Committed capacity is ordered in whole increments of this size (TiB). */
const CAPACITY_STEP_TIB = 25;
const MIN_CAPACITY_TIB = 50;
const DEFAULT_CAPACITY_TIB = 200;

type DeploymentTypeId = 'sovereign' | 'dark-site' | 'standard';

/**
 * How the subscription is deployed. This is chosen first because it decides which sites are
 * offered — a sovereign subscription can only land in a sovereign region.
 */
const DEPLOYMENT_TYPES: {
  id: DeploymentTypeId;
  label: string;
  blurb: string;
  typeLabel: string;
}[] = [
  {
    id: 'sovereign',
    label: 'Sovereign site',
    blurb: 'NetApp-operated, data stays in the declared region',
    typeLabel: 'Sovereign',
  },
  {
    id: 'dark-site',
    label: 'Dark site',
    blurb: 'Fully inside your environment, no NetApp connectivity',
    typeLabel: 'Dark Site',
  },
  {
    id: 'standard',
    label: 'Standard subscription',
    blurb: 'NetApp-operated in a standard region',
    typeLabel: 'Standard',
  },
];

/**
 * Each site carries the value the catalog sizing page uses for it, so a submitted request can open
 * there with the right site already picked.
 */
interface SiteOption {
  label: string;
  catalogValue: string;
}

const LOCATIONS_BY_DEPLOYMENT: Record<DeploymentTypeId, SiteOption[]> = {
  sovereign: [
    { label: 'Berlin, Germany', catalogValue: 'EU-Sovereign-Berlin' },
    { label: 'Frankfurt, Germany', catalogValue: 'EU-Sovereign-Frankfurt' },
  ],
  'dark-site': [
    { label: 'Frankfurt, Germany', catalogValue: 'Dark-Site-Frankfurt' },
    { label: 'Munich, Germany', catalogValue: 'Dark-Site-Munich' },
    { label: 'Zurich, Switzerland', catalogValue: 'Dark-Site-Zurich' },
  ],
  standard: [
    { label: 'Santa Clara, California', catalogValue: 'Site-Santa Clara' },
    { label: 'Dallas, Texas', catalogValue: 'Dallas_FW' },
    { label: 'Vancouver, Canada', catalogValue: 'Vancouver_BC' },
    { label: 'Bangalore, India', catalogValue: 'BRL' },
  ],
};

const TERM_LENGTHS = ['1', '2', '3'] as const;
const BILLING_FREQUENCIES = ['Monthly', 'Quarterly', 'Annually'] as const;

/** The three latency-banded workload profiles offered on the catalog sizing page. */
const WORKLOAD_TYPES = [
  { label: 'Mission critical (< 1 ms)', catalogId: 'mission-critical' },
  { label: 'General purpose (2–4 ms)', catalogId: 'general-purpose' },
  { label: 'Secondary (> 5 ms)', catalogId: 'secondary' },
];

const IOPS_UNITS = ['K', 'M'] as const;

/** The two unified tiers that qualify for this profile; sizing review confirms the final fit. */
const RECOMMENDED_PLANS = [
  {
    name: 'Unified Premium',
    catalogPlanName: 'Premium',
    platform: 'AFF A-Series',
    blurb: 'Low latency for business-critical transactional and analytics workloads',
    recommended: true,
  },
  {
    name: 'Unified Extreme',
    catalogPlanName: 'Unified extreme',
    platform: 'AFF A-Series (high-end)',
    blurb: 'Top-tier unified performance for mission-critical workloads',
    recommended: false,
  },
];

/** Who self-service requests are routed to in this prototype. */
const ACCOUNT_REPRESENTATIVE = 'Derek Keller';

const ADDON_OPTIONS = [
  { id: 'dii', name: 'Data infrastructure insights', catalogValue: 'dii' },
  { id: 'tiering', name: 'Data tiering', catalogValue: 'tiering' },
  { id: 'metro-cluster', name: 'Metro Cluster', catalogValue: 'advanced-protection' },
];

interface NewSubscriptionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Account the request is raised against, shown in the drawer subtitle. */
  accountName: string;
  /** Called with the newly-created, trackable service request right after a successful submit. */
  onSubmitted?: (request: ConsoleServiceRequest) => void;
}

/**
 * Right-side drawer for ordering a new subscription, matching the Modify/Renew drawers so every
 * self-service action in the Console happens in the same surface. Deliberately shows no pricing —
 * the account team returns commercial terms after sizing review.
 */
export function NewSubscriptionDrawer({
  isOpen,
  onClose,
  accountName,
  onSubmitted,
}: NewSubscriptionDrawerProps) {
  const [deploymentType, setDeploymentType] = useState<DeploymentTypeId>('sovereign');
  const [location, setLocation] = useState<string>(LOCATIONS_BY_DEPLOYMENT.sovereign[0].label);
  const [termLength, setTermLength] = useState<(typeof TERM_LENGTHS)[number]>('3');
  const [billingFrequency, setBillingFrequency] =
    useState<(typeof BILLING_FREQUENCIES)[number]>('Annually');
  const [workload, setWorkload] = useState<string>(WORKLOAD_TYPES[1].label);
  const [capacityTib, setCapacityTib] = useState(DEFAULT_CAPACITY_TIB);
  const [iops, setIops] = useState('1');
  const [iopsUnit, setIopsUnit] = useState<(typeof IOPS_UNITS)[number]>('M');
  const [latencyMs, setLatencyMs] = useState('1');
  const [serviceLevel, setServiceLevel] = useState<string>(RECOMMENDED_PLANS[0].name);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setDeploymentType('sovereign');
    setLocation(LOCATIONS_BY_DEPLOYMENT.sovereign[0].label);
    setTermLength('3');
    setBillingFrequency('Annually');
    setWorkload(WORKLOAD_TYPES[1].label);
    setCapacityTib(DEFAULT_CAPACITY_TIB);
    setIops('1');
    setIopsUnit('M');
    setLatencyMs('1');
    setServiceLevel(RECOMMENDED_PLANS[0].name);
    setAddOns([]);
    setAgreedToTerms(false);
  }, [isOpen]);

  const deployment = DEPLOYMENT_TYPES.find((d) => d.id === deploymentType)!;
  const isSovereign = deploymentType === 'sovereign' || deploymentType === 'dark-site';
  const locationOptions = LOCATIONS_BY_DEPLOYMENT[deploymentType];

  /** Switching deployment type re-scopes the site list, so land on that list's first site. */
  const handleDeploymentTypeChange = (id: DeploymentTypeId) => {
    setDeploymentType(id);
    setLocation(LOCATIONS_BY_DEPLOYMENT[id][0].label);
  };

  const toggleAddOn = (name: string) => {
    setAddOns((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  };

  const handleCapacityChange = (delta: number) => {
    setCapacityTib((prev) => Math.max(MIN_CAPACITY_TIB, prev + delta));
  };

  const handleSubmit = () => {
    const site = locationOptions.find((option) => option.label === location);
    const plan = RECOMMENDED_PLANS.find((option) => option.name === serviceLevel);
    const workloadOption = WORKLOAD_TYPES.find((option) => option.label === workload);

    // Mirror the request into the catalog prototype so it lands on the seller's dashboard.
    publishRequestToSellerDashboard({
      customerName: accountName,
      siteValue: site?.catalogValue ?? location,
      siteLabel: `${deployment.typeLabel} — ${location}`,
      subscriptionType: isSovereign ? 'Sovereign' : 'USPS',
      workloadId: workloadOption?.catalogId ?? 'general-purpose',
      capacityTib,
      iops,
      iopsUnit,
      latencyMs,
      catalogPlanName: plan?.catalogPlanName ?? 'Premium',
      termYears: termLength,
      billingValue: billingFrequency.toLowerCase(),
      addonValues: ADDON_OPTIONS.filter((option) => addOns.includes(option.name)).map(
        (option) => option.catalogValue,
      ),
    });

    const requestDate = '2026-09-29';
    const existing = getServiceRequests();
    const id = nextServiceRequestId(existing);

    const request: ConsoleServiceRequest = {
      id,
      subscriptionId: `PENDING-${id}`,
      type: 'New Subscription',
      requestedBy: accountName,
      requestDate,
      status: 'In Review',
      priority: 'Medium',
      assignedTo: ACCOUNT_REPRESENTATIVE,
      lastUpdated: 'Just now',
      siteLocation: location,
      subscriptionType: deployment.typeLabel,
      workload,
      serviceLevel,
      committedCapacity: `${capacityTib} TiB`,
      performanceProfile: `${iops}${iopsUnit} IOPS · ${latencyMs} ms max latency`,
      termLength: `${termLength} year${termLength !== '1' ? 's' : ''}`,
      billingFrequency,
      addOns: addOns.length ? addOns.join(', ') : 'None',
      estimatedCost: 'Pending pricing review',
      businessJustification: 'New subscription requested via the self-service console.',
      stages: buildNewSubscriptionTrackerStages(1, requestDate),
    };

    addServiceRequest(request);
    onSubmitted?.(request);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[800px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[800px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 pb-4 pr-14 pt-2">
          <div className="-mx-2 flex justify-center py-2" aria-hidden="true">
            <span className="pointer-events-none h-1.5 w-10 rounded-full bg-gray-300 shadow-sm ring-1 ring-gray-200/90" />
          </div>
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">Order New Subscription</SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {accountName} · Request reviewed by your NetApp account team
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-4">
          <div className="space-y-6">
            {/* 1. Deployment type */}
            <div>
              <label className="mb-3 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Deployment type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {DEPLOYMENT_TYPES.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleDeploymentTypeChange(option.id)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      deploymentType === option.id
                        ? 'border-[#0067c5] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                        {option.label}
                      </span>
                      {deploymentType === option.id && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0067c5]" />
                      )}
                    </div>
                    <p className="mt-1 text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                      {option.blurb}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Location */}
            <div>
              <BpDropdown
                label="Location"
                value={location}
                onValueChange={(value) => setLocation(value ?? '')}
                placeholder="Select a location"
                options={locationOptions.map((l) => ({ value: l.label, label: l.label }))}
              />
              <p className="mt-2 text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                Locations available for a {deployment.label.toLowerCase()}.
              </p>
            </div>

            {isSovereign && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600" />
                  <div>
                    <p className="mb-1 text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                      {deployment.typeLabel} deployment
                    </p>
                    <p className="text-[13px] font-normal text-gray-700 font-['SF_Pro',sans-serif]">
                      Data stays within the declared region for the life of the subscription. Once
                      active, this subscription appears under your dedicated local Console view.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Term length */}
            <div>
              <label className="mb-3 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Term length
              </label>
              <div className="grid grid-cols-3 gap-3">
                {TERM_LENGTHS.map((term) => (
                  <div
                    key={term}
                    onClick={() => setTermLength(term)}
                    className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                      termLength === term
                        ? 'border-[#0067c5] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-[20px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                      {term}
                    </div>
                    <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                      Year{term !== '1' ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Billing frequency */}
            <div>
              <label className="mb-3 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Billing frequency
              </label>
              <div className="grid grid-cols-3 gap-3">
                {BILLING_FREQUENCIES.map((option) => (
                  <div
                    key={option}
                    onClick={() => setBillingFrequency(option)}
                    className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-all ${
                      billingFrequency === option
                        ? 'border-[#0067c5] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                      {option}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Workload type */}
            <div>
              <label className="mb-3 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Workload type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {WORKLOAD_TYPES.map((option) => (
                  <div
                    key={option.catalogId}
                    onClick={() => setWorkload(option.label)}
                    className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                      workload === option.label
                        ? 'border-[#0067c5] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                      {option.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Capacity and performance */}
            <div>
              <label className="mb-3 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Capacity and performance
              </label>
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div>
                  <span className="mb-2 block text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    Committed capacity ({CAPACITY_STEP_TIB} TiB increments)
                  </span>
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <button
                      type="button"
                      onClick={() => handleCapacityChange(-CAPACITY_STEP_TIB)}
                      disabled={capacityTib <= MIN_CAPACITY_TIB}
                      className="flex h-10 w-10 items-center justify-center rounded border border-gray-300 transition-colors hover:bg-white disabled:opacity-40"
                      aria-label="Decrease committed capacity"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-[24px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                        {capacityTib}
                      </span>
                      <span className="ml-1 text-[14px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                        TiB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCapacityChange(CAPACITY_STEP_TIB)}
                      className="flex h-10 w-10 items-center justify-center rounded border border-gray-300 transition-colors hover:bg-white"
                      aria-label="Increase committed capacity"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="new-sub-iops"
                      className="mb-2 block text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]"
                    >
                      IOPS
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="new-sub-iops"
                        type="number"
                        min="1"
                        value={iops}
                        onChange={(e) => setIops(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[14px] font-normal font-['SF_Pro',sans-serif] focus:outline-none focus:ring-2 focus:ring-[#0067c5]"
                      />
                      <select
                        value={iopsUnit}
                        onChange={(e) => setIopsUnit(e.target.value as (typeof IOPS_UNITS)[number])}
                        aria-label="IOPS unit"
                        className="rounded-lg border border-gray-300 px-3 py-2 text-[14px] font-normal font-['SF_Pro',sans-serif] focus:outline-none focus:ring-2 focus:ring-[#0067c5]"
                      >
                        {IOPS_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="new-sub-latency"
                      className="mb-2 block text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]"
                    >
                      Maximum latency
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="new-sub-latency"
                        type="number"
                        min="0"
                        step="0.5"
                        value={latencyMs}
                        onChange={(e) => setLatencyMs(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-[14px] font-normal font-['SF_Pro',sans-serif] focus:outline-none focus:ring-2 focus:ring-[#0067c5]"
                      />
                      <span className="text-[14px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                        ms
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 7. Recommended plans */}
            <div>
              <label className="mb-3 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Recommended service levels
              </label>
              <div className="space-y-3">
                {RECOMMENDED_PLANS.map((plan) => (
                  <div
                    key={plan.name}
                    onClick={() => setServiceLevel(plan.name)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      serviceLevel === plan.name
                        ? 'border-[#0067c5] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                            {plan.name}
                          </span>
                          {plan.recommended && <StatusBadge tone="green" label="Recommended" />}
                        </div>
                        <p className="mt-1 text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                          {plan.blurb}
                        </p>
                        <p className="mt-2 text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                          Platform: <span className="font-[590] text-[#1c1c1c]">{plan.platform}</span>
                        </p>
                      </div>
                      {serviceLevel === plan.name && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0067c5]" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Add-ons */}
            <div>
              <label className="mb-3 block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                Add-ons (optional)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {ADDON_OPTIONS.map((addon) => (
                  <div
                    key={addon.id}
                    onClick={() => toggleAddOn(addon.name)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      addOns.includes(addon.name)
                        ? 'border-[#0067c5] bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                        {addon.name}
                      </span>
                      {addOns.includes(addon.name) && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0067c5]" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What happens next */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                <div>
                  <p className="mb-1 text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                    What happens next
                  </p>
                  <p className="text-[13px] font-normal text-gray-700 font-['SF_Pro',sans-serif]">
                    Your request goes to {ACCOUNT_REPRESENTATIVE}, who validates the sizing and
                    returns commercial terms for approval. You can follow every stage from the
                    request tracker.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <BpCheckbox
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                label="I understand this is a request, not a confirmed order"
                details={
                  <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    Pricing and availability are confirmed by your account team before activation
                  </p>
                }
              />
            </div>
          </div>
        </SheetBody>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!location || !agreedToTerms}
            className="bg-[#0067c5] text-[14px] font-[590] text-white hover:bg-[#0056a6]"
          >
            Submit Subscription Request
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
