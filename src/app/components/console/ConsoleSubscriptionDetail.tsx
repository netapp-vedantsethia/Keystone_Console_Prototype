import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUpRight, ChevronDown, User, Calendar, FileText, Download, GitMerge, Clock, ShieldCheck } from 'lucide-react';
import { BpTabGroup, BpTag } from '@netapp/blueprint/react';
import { ConsolePageHeader } from './ConsolePageHeader';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import {
  Subscription,
  getRecommendationsForSubscription,
  getSovereigntyMeta,
  getSubscriptionById,
  isDarkSite,
  mockSubscriptions,
  type PlatformNavigateOptions,
} from '../../data/mockData';
import { CurrentConsumptionTab } from '../tabs/CurrentConsumptionTab';
import { ConsumptionTrendsTab } from '../tabs/ConsumptionTrendsTab';
import { VolumesTab } from '../tabs/VolumesTab';
import { SLATab } from '../tabs/SLATab';
import { BillingTab } from '../tabs/BillingTab';
import { RecommendationsTab } from '../tabs/RecommendationsTab';
import { TimelineTab } from '../tabs/TimelineTab';
import { AddonsTab } from '../tabs/AddonsTab';
import { SovereignCommitmentsTab } from '../tabs/SovereignCommitmentsTab';
import { SovereignAssetsTab } from '../tabs/SovereignAssetsTab';
import { RenewalFormDrawer } from './RenewalFormDrawer';
import { ModificationFormDrawer } from './ModificationFormDrawer';
import { OpenSupportCaseModal } from './OpenSupportCaseModal';
import { ServiceRequestDrawer } from './ServiceRequestDrawer';
import { useIsSubscriptionActivated } from '../../data/activatedSubscriptionsStore';
import { downloadSubscriptionsListCsv } from '../../utils/subscriptionsCsv';
import { serviceRequestHasTracker, type ConsoleServiceRequest } from '../../data/consoleOperationsMock';
import { useServiceRequests } from '../../data/serviceRequestsStore';

const OPEN_TRACKER_STATUSES = new Set(['In Review', 'Pending Approval', 'In Progress', 'Approved']);

interface ConsoleSubscriptionDetailProps {
  subscription: Subscription;
  onBack: () => void;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
  /** Landed here straight from a completed request — show the activation confirmation. */
  justActivated?: boolean;
}

export function ConsoleSubscriptionDetail({
  subscription,
  onBack,
  onNavigate,
  justActivated = false,
}: ConsoleSubscriptionDetailProps) {
  const [activeTab, setActiveTab] = useState('recommendations');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showRenewalForm, setShowRenewalForm] = useState(false);
  const [showModificationForm, setShowModificationForm] = useState(false);
  const [showSupportCaseModal, setShowSupportCaseModal] = useState(false);
  const [trackerRequest, setTrackerRequest] = useState<ConsoleServiceRequest | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const serviceRequests = useServiceRequests();
  const openTrackableRequests = useMemo(
    () =>
      serviceRequests.filter(
        (r) =>
          r.subscriptionId === subscription.id &&
          serviceRequestHasTracker(r) &&
          OPEN_TRACKER_STATUSES.has(r.status),
      ),
    [serviceRequests, subscription.id],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const hasRecommendations =
    getRecommendationsForSubscription(subscription.id).length > 0;

  const isMergedAway = subscription.lifecycleStatus === 'merged' && Boolean(subscription.mergedInto);
  const mergeTarget = subscription.mergedInto ? getSubscriptionById(subscription.mergedInto.subscriptionId) : undefined;
  const sovereigntyMeta = getSovereigntyMeta(subscription);
  /* Activation is permanent, so the banner shows on every later visit, not just the hand-off. */
  const wasActivated = useIsSubscriptionActivated(subscription.id);
  const showActivatedBanner = justActivated || wasActivated;
  const isPrivateSovereign = isDarkSite(subscription);

  const tabs = useMemo(() => {
    if (isPrivateSovereign) {
      // No NetApp connectivity into the environment: usage, consumption trends, and volumes can
      // never be measured, so those tabs are replaced with commitment- and shipment-only views.
      const sovereignTabs = [
        { id: 'sla', label: 'Service Level' },
        { id: 'billing', label: 'Billing & Invoices' },
        { id: 'sovereign-assets', label: 'Assets' },
        { id: 'addons', label: 'Add-ons' },
        { id: 'timeline', label: 'Timeline' },
      ] as const;
      return hasRecommendations
        ? [{ id: 'recommendations', label: 'Recommendations' }, ...sovereignTabs]
        : [...sovereignTabs];
    }
    const all = [
      { id: 'recommendations', label: 'Recommendations' },
      { id: 'current-consumption', label: 'Current Consumption' },
      { id: 'consumption-trends', label: 'Consumption Trends' },
      { id: 'billing', label: 'Billing & Invoices' },
      { id: 'sla', label: 'SLA' },
      { id: 'volumes', label: 'Volumes' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'addons', label: 'Add-ons' },
    ] as const;
    if (isMergedAway) {
      const allowed = new Set(['current-consumption', 'consumption-trends', 'billing', 'timeline']);
      return all.filter((t) => allowed.has(t.id));
    }
    if (!hasRecommendations) {
      return all.filter((t) => t.id !== 'recommendations');
    }
    return [...all];
  }, [hasRecommendations, isMergedAway, isPrivateSovereign]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? 'current-consumption');
    }
  }, [tabs, activeTab, subscription.id]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'current-consumption':
        return <CurrentConsumptionTab subscription={subscription} />;
      case 'consumption-trends':
        return <ConsumptionTrendsTab subscription={subscription} onNavigate={onNavigate} />;
      case 'volumes':
        return <VolumesTab subscription={subscription} />;
      case 'sla':
        return isPrivateSovereign ? (
          <SovereignCommitmentsTab subscription={subscription} />
        ) : (
          <SLATab subscription={subscription} />
        );
      case 'sovereign-assets':
        return <SovereignAssetsTab subscription={subscription} />;
      case 'billing':
        return <BillingTab subscription={subscription} onNavigate={onNavigate} />;
      case 'timeline':
        return <TimelineTab subscription={subscription} onNavigate={onNavigate} />;
      case 'addons':
        return <AddonsTab subscription={subscription} />;
      case 'recommendations':
        return (
          <RecommendationsTab
            subscriptionId={subscription.id}
            uiContext="console"
            onNavigateToTab={setActiveTab}
          />
        );
      default:
        return (
          <div className="p-6 bg-white border border-[#e0e0e0] rounded">
            <div className="text-center text-[#404040]">
              Content for this tab coming soon
            </div>
          </div>
        );
    }
  };

  const daysUntilExpiry = Math.floor((new Date(subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  // Health status badge
  const getHealthBadgeTone = (status: string): StatusTone => {
    const tones: Record<string, StatusTone> = {
      'healthy': 'green',
      'warning': 'amber',
      'critical': 'red',
      'unknown': 'gray',
    };
    return tones[status] ?? 'gray';
  };

  const getSLABadgeTone = (status: string): StatusTone => {
    const tones: Record<string, StatusTone> = {
      'compliant': 'green',
      'at-risk': 'amber',
      'breached': 'red',
    };
    return tones[status] ?? 'gray';
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {showActivatedBanner && (
        <div className="border-b border-green-200 bg-green-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="relative mt-0.5 flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-600" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                  Subscription activated
                </p>
                {sovereigntyMeta && (
                  <BpTag color={sovereigntyMeta.tagColor}>{sovereigntyMeta.shortLabel}</BpTag>
                )}
                <StatusBadge tone="green" label="Active" />
              </div>
              <p className="mt-1 text-[13px] font-normal text-gray-700 font-['SF_Pro',sans-serif]">
                {subscription.number} is live in {subscription.region}
                {sovereigntyMeta ? ` as a ${sovereigntyMeta.label} subscription` : ''} and appears
                under your dedicated local Console view.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Page Header with Breadcrumbs */}
      <ConsolePageHeader
        breadcrumbs={[
          { label: 'Subscriptions', onClick: onBack },
          { label: subscription.number }
        ]}
        title={subscription.number}
        subtitle={`Tracking ID: ${subscription.trackingId}`}
        onRefresh={() => {}}
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowSupportCaseModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[#e0e0e0] rounded bg-white hover:bg-gray-50 text-[14px] font-[590] text-[#1c1c1c]"
            >
              <FileText className="w-4 h-4" />
              <span>Create case</span>
            </button>
            <button
              type="button"
              onClick={() =>
                downloadSubscriptionsListCsv(mockSubscriptions, 'health-report.csv')
              }
              className="flex items-center gap-2 px-4 py-2 border border-[#e0e0e0] rounded bg-white hover:bg-gray-50 text-[14px] font-[590] text-[#1c1c1c]"
            >
              <Download className="w-4 h-4" />
              <span>Health Report</span>
            </button>
            {!isMergedAway && (
              <div ref={dropdownRef} className="relative">
                <button
                  className="flex items-center gap-2 px-6 py-2 bg-[#0067c5] text-white rounded hover:bg-[#0056a6] transition-colors"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span className="text-[14px] font-[590] leading-[24px]">Modify subscription</span>
                  <div className="w-px h-4 bg-white opacity-50" />
                  <ChevronDown className="w-4 h-4" />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-[#e0e0e0] rounded shadow-lg z-10">
                    <button
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-[14px] font-[590] text-[#1c1c1c] hover:bg-gray-50 text-left transition-colors"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setShowModificationForm(true);
                      }}
                    >
                      Modify Subscription
                    </button>
                    <div className="border-t border-[#e0e0e0]" />
                    <button
                      className="flex items-center gap-2 w-full px-4 py-2.5 text-[14px] font-[590] text-[#1c1c1c] hover:bg-gray-50 text-left transition-colors"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setShowRenewalForm(true);
                      }}
                    >
                      Renew Subscription
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      {isMergedAway && (
        <div className="flex items-start gap-3 border-b border-indigo-200 bg-indigo-50 px-5 py-3">
          <GitMerge className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div className="text-sm text-indigo-900">
            <span className="font-semibold">This subscription was merged</span>
            {subscription.mergedInto && (
              <>
                {' '}
                on {new Date(subscription.mergedInto.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                . Its commitments now roll up into{' '}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-semibold underline hover:no-underline"
                  onClick={() => onNavigate?.('subscription-detail', subscription.mergedInto!.subscriptionId)}
                >
                  {mergeTarget?.trackingId ?? subscription.mergedInto.subscriptionId}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
                . Historical consumption and billing remain available below.
              </>
            )}
          </div>
        </div>
      )}

      {sovereigntyMeta && (
        <div className="flex items-start gap-3 border-b border-purple-200 bg-purple-50 px-5 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
          <div className="text-sm text-purple-900">
            <span className="font-semibold">{sovereigntyMeta.bannerTitle}.</span> {sovereigntyMeta.bannerDescription}
          </div>
        </div>
      )}

      {openTrackableRequests.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-blue-200 bg-blue-50 px-5 py-3">
          <Clock className="h-5 w-5 shrink-0 text-blue-600" />
          <div className="flex-1 text-sm text-blue-900">
            <span className="font-semibold">
              {openTrackableRequests.length === 1
                ? `You have an open ${openTrackableRequests[0].type.toLowerCase()} request`
                : `You have ${openTrackableRequests.length} open requests`}
            </span>{' '}
            for this subscription — track progress below.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {openTrackableRequests.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setTrackerRequest(r)}
                className="flex items-center gap-1.5 rounded border border-blue-300 bg-white px-3 py-1.5 text-[13px] font-[590] text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Track {r.id} ({r.status})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subscription Info Bar */}
      <div className="bg-white border-b border-[#e0e0e0] px-5 py-4">
        <div className="flex items-center gap-8">
          {/* Customer */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e0e0e0] flex items-center justify-center">
              <User className="w-5 h-5 text-[#404040]" />
            </div>
            <div>
              <div className="text-[13px] font-normal leading-[20px] text-[#737373] font-['SF_Pro',sans-serif]">Customer</div>
              <div className="text-[14px] font-[590] leading-[24px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">{subscription.customer}</div>
            </div>
          </div>

          <div className="h-8 w-px bg-[#e0e0e0]" />

          {/* Expiration */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e0e0e0] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#404040]" />
            </div>
            <div>
              <div className="text-[13px] font-normal leading-[20px] text-[#737373] font-['SF_Pro',sans-serif]">
                {isMergedAway ? 'Merged on' : 'Renewal date'}
              </div>
              <div className="text-[14px] font-[590] leading-[24px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                {new Date(subscription.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                {!isMergedAway && <span className="text-[#737373] font-normal">({daysUntilExpiry} days)</span>}
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-[#e0e0e0]" />

          {/* Status Pills */}
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[13px] font-normal leading-[20px] text-[#737373] font-['SF_Pro',sans-serif] mb-1">Status</div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={getHealthBadgeTone(subscription.healthStatus)} label={`Health: ${subscription.health}`} />
                <StatusBadge tone={getSLABadgeTone(subscription.slaStatus)} label={`SLA: ${subscription.sla}`} />
              </div>
            </div>
          </div>

          {sovereigntyMeta && (
            <>
              <div className="h-8 w-px bg-[#e0e0e0]" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-[13px] font-normal leading-[20px] text-[#737373] font-['SF_Pro',sans-serif] mb-1">
                    Sovereignty
                  </div>
                  <BpTag color={sovereigntyMeta.tagColor}>{sovereigntyMeta.label}</BpTag>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#e0e0e0] px-5">
        <BpTabGroup
          tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
          value={activeTab}
          onValueChange={setActiveTab}
          horizontalResizing="hug"
          tablistAriaLabel="Subscription detail sections"
        />
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {renderTabContent()}
      </div>

      {/* Renewal Form Drawer */}
      <RenewalFormDrawer
        isOpen={showRenewalForm}
        onClose={() => setShowRenewalForm(false)}
        subscription={subscription}
        onSubmitted={(request) => setTrackerRequest(request)}
      />

      {/* Modification Form Drawer */}
      <ModificationFormDrawer
        isOpen={showModificationForm}
        onClose={() => setShowModificationForm(false)}
        subscription={subscription}
        onSubmitted={(request) => setTrackerRequest(request)}
      />

      <OpenSupportCaseModal
        open={showSupportCaseModal}
        onOpenChange={setShowSupportCaseModal}
        defaultSubscriptionId={subscription.id}
      />

      {/* Modify / Renew Request Details + Tracker */}
      <ServiceRequestDrawer
        isOpen={!!trackerRequest}
        onClose={() => setTrackerRequest(null)}
        request={trackerRequest}
      />
    </div>
  );
}