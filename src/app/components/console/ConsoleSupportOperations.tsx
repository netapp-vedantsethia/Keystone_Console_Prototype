import { useState, useEffect, useMemo, useRef } from 'react';
import { ConsolePageHeader } from './ConsolePageHeader';
import { ConsoleMetadataCollectionTab } from './ConsoleMetadataCollectionTab';
import { DataTableFooter } from '../ui/DataTable';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { slicePage, useTablePagination } from '../../hooks/useTablePagination';
import {
  Bell,
  TrendingUp,
  Server,
  Plus,
  X,
  Filter,
  FileText,
  LifeBuoy,
  ChevronDown,
  Clock,
  MessageSquare,
} from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { BpTabGroup, BpCard, BpCardProperty } from '@netapp/blueprint/react';
import { ModificationFormDrawer } from './ModificationFormDrawer';
import { RenewalFormDrawer } from './RenewalFormDrawer';
import { OpenSupportCaseModal } from './OpenSupportCaseModal';
import { ServiceRequestDrawer } from './ServiceRequestDrawer';
import {
  getSubscriptionById,
  formatSubscriptionIdentity,
  formatServiceLevels,
  mockConsoleActiveAlerts,
  mockConsoleAlertMonitors,
  mockConsoleSupportCases,
  formatMonitorSubscriptionScope,
  totalMonitorTriggers24h,
  type ConsoleActiveAlert,
  type ConsoleAlertMonitor,
  type ConsoleServiceRequest,
  type ConsoleSupportCase,
  type PlatformNavIntent,
  type Subscription,
} from '../../data/mockData';
import { useServiceRequests } from '../../data/serviceRequestsStore';
import { useConsoleMode } from '../../context/ConsoleModeContext';

type SupportTab = 'metadata' | 'requests' | 'cases' | 'monitors';

interface ConsoleSupportOperationsProps {
  navIntent?: PlatformNavIntent | null;
  onNavIntentConsumed?: () => void;
}

export function ConsoleSupportOperations({
  navIntent = null,
  onNavIntentConsumed,
}: ConsoleSupportOperationsProps) {
  const allServiceRequests = useServiceRequests();
  const { scopedSubscriptions, isInScope } = useConsoleMode();
  const serviceRequests = useMemo(
    () => allServiceRequests.filter((r) => isInScope(r.subscriptionId)),
    [allServiceRequests, isInScope],
  );
  const supportCases = useMemo(
    () => mockConsoleSupportCases.filter((c) => isInScope(c.subscriptionId)),
    [isInScope],
  );
  const alertMonitors = useMemo(
    () =>
      mockConsoleAlertMonitors.filter(
        (m) => m.subscriptionIds === 'all' || m.subscriptionIds.some((id) => isInScope(id)),
      ),
    [isInScope],
  );
  const [activeTab, setActiveTab] = useState<SupportTab>('metadata');
  const [selectedAlert, setSelectedAlert] = useState<ConsoleActiveAlert | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ConsoleServiceRequest | null>(null);
  const [selectedSupport, setSelectedSupport] = useState<ConsoleSupportCase | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showNewCaseForm, setShowNewCaseForm] = useState(false);

  const [isNewRequestDropdownOpen, setIsNewRequestDropdownOpen] = useState(false);
  const newRequestDropdownRef = useRef<HTMLDivElement>(null);
  const [pendingServiceRequestKind, setPendingServiceRequestKind] = useState<
    'modification' | 'renewal' | null
  >(null);
  const [showSubscriptionIdentifySheet, setShowSubscriptionIdentifySheet] =
    useState(false);
  const [identifySelectedSubscriptionId, setIdentifySelectedSubscriptionId] =
    useState('');
  const [identifySubscriptionPickerOpen, setIdentifySubscriptionPickerOpen] =
    useState(false);
  const identifySubscriptionPickerRef = useRef<HTMLDivElement>(null);
  const [identifyError, setIdentifyError] = useState('');
  const [serviceRequestTargetSubscription, setServiceRequestTargetSubscription] =
    useState<Subscription | null>(null);
  const [showServiceModificationForm, setShowServiceModificationForm] =
    useState(false);
  const [showServiceRenewalForm, setShowServiceRenewalForm] = useState(false);

  const navAppliedRef = useRef('');

  useEffect(() => {
    if (!navIntent || navIntent.screen !== 'support') {
      navAppliedRef.current = '';
      return;
    }
    const sig = [
      navIntent.supportTab,
      navIntent.highlightServiceRequestId,
      navIntent.highlightSupportCaseId,
      navIntent.highlightAlertId,
    ].join('|');
    if (navAppliedRef.current === sig) return;
    navAppliedRef.current = sig;

    if (navIntent.supportTab) setActiveTab(navIntent.supportTab);
    if (navIntent.highlightServiceRequestId) {
      const r = serviceRequests.find(
        (x) => x.id === navIntent.highlightServiceRequestId,
      );
      if (r) setSelectedRequest(r);
    }
    if (navIntent.highlightSupportCaseId) {
      const c = supportCases.find(
        (x) => x.caseId === navIntent.highlightSupportCaseId,
      );
      if (c) {
        setActiveTab('cases');
        setSelectedSupport(c);
      }
    }
    if (navIntent.highlightAlertId) {
      const a = mockConsoleActiveAlerts.find((x) => x.id === navIntent.highlightAlertId);
      if (a) setSelectedAlert(a);
    }
    queueMicrotask(() => onNavIntentConsumed?.());
  }, [navIntent, onNavIntentConsumed, serviceRequests, supportCases]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (
        newRequestDropdownRef.current &&
        !newRequestDropdownRef.current.contains(t)
      ) {
        setIsNewRequestDropdownOpen(false);
      }
      if (
        identifySubscriptionPickerRef.current &&
        !identifySubscriptionPickerRef.current.contains(t)
      ) {
        setIdentifySubscriptionPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monitorsPg = useTablePagination(alertMonitors.length, TABLE_PAGE_SIZE, [alertMonitors.length]);
  const pageMonitors = slicePage(alertMonitors, monitorsPg.currentPage, monitorsPg.pageSize);

  const openServiceRequestIdentify = (kind: 'modification' | 'renewal') => {
    setPendingServiceRequestKind(kind);
    setIsNewRequestDropdownOpen(false);
    setIdentifySelectedSubscriptionId('');
    setIdentifySubscriptionPickerOpen(false);
    setIdentifyError('');
    setShowSubscriptionIdentifySheet(true);
  };

  const closeSubscriptionIdentifySheet = () => {
    setShowSubscriptionIdentifySheet(false);
    setPendingServiceRequestKind(null);
    setIdentifyError('');
    setIdentifySubscriptionPickerOpen(false);
  };

  const handleConfirmSubscriptionIdentify = () => {
    setIdentifyError('');
    if (!identifySelectedSubscriptionId.trim()) {
      setIdentifyError('Select a subscription from the list.');
      return;
    }
    const sub = getSubscriptionById(identifySelectedSubscriptionId.trim());
    if (!sub) {
      setIdentifyError('That subscription is no longer available.');
      return;
    }
    const kind = pendingServiceRequestKind;
    setServiceRequestTargetSubscription(sub);
    closeSubscriptionIdentifySheet();
    if (kind === 'modification') setShowServiceModificationForm(true);
    else if (kind === 'renewal') setShowServiceRenewalForm(true);
  };

  const closeServiceModificationForm = () => {
    setShowServiceModificationForm(false);
    setServiceRequestTargetSubscription(null);
  };

  const closeServiceRenewalForm = () => {
    setShowServiceRenewalForm(false);
    setServiceRequestTargetSubscription(null);
  };

  const getStatusTone = (status: string): StatusTone => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'resolved':
        return 'green';
      case 'in progress':
        return 'blue';
      case 'in review':
        return 'amber';
      case 'pending approval':
        return 'purple';
      case 'waiting on customer':
        return 'amber';
      default:
        return 'gray';
    }
  };

  const getPriorityTone = (priority: string): StatusTone => {
    switch (priority.toLowerCase()) {
      case 'high':
      case 'p1':
        return 'red';
      case 'medium':
      case 'p2':
        return 'amber';
      case 'low':
      case 'p3':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getSeverityTone = (severity: string): StatusTone => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'amber';
      case 'info':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const subscriptionLine = (alert: ConsoleActiveAlert) => {
    if (alert.subscriptionId) {
      const sub = getSubscriptionById(alert.subscriptionId);
      return sub ? formatSubscriptionIdentity(sub) : alert.subscriptionId;
    }
    return alert.multiSubscriptionLabel ?? '—';
  };

  const createCaseDisabled = Boolean(selectedAlert?.linkedSupportCaseId);

  const TABS: { id: SupportTab; label: string; icon: typeof Bell; count: number }[] = [
    { id: 'metadata', label: 'Metadata Collection', icon: Server, count: 0 },
    { id: 'requests', label: 'Service Requests', icon: FileText, count: serviceRequests.length },
    { id: 'cases', label: 'Support Cases', icon: LifeBuoy, count: supportCases.length },
    { id: 'monitors', label: 'Alert Monitors', icon: Filter, count: alertMonitors.length },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <ConsolePageHeader
        title="Operations Center"
        onRefresh={() => {}}
      />

      <div className="p-5">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="border-b border-gray-200 px-2">
            <BpTabGroup
              tabs={TABS.map((tab) => ({
                id: tab.id,
                label: tab.label,
                icon: tab.icon,
                count: tab.count > 0 ? tab.count : undefined,
              }))}
              value={activeTab}
              onValueChange={(id) => setActiveTab(id as SupportTab)}
              horizontalResizing="hug"
              tablistAriaLabel="Operations Center sections"
            />
          </div>

          {activeTab === 'monitors' && (
            <>
              <div className="flex items-center justify-between px-6 pt-6">
                <h2 className="text-lg font-semibold text-gray-900">Alert Monitors</h2>
                <button
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Monitor
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 pb-4 sm:grid-cols-2">
                <BpCard>
                  <BpCardProperty icon={Bell} value={alertMonitors.filter((m) => m.enabled).length} property="Active monitors" />
                  <div className="mt-1 text-xs text-gray-500">
                    of {alertMonitors.length} total
                  </div>
                </BpCard>
                <BpCard>
                  <BpCardProperty icon={TrendingUp} value={totalMonitorTriggers24h(alertMonitors)} property="Total triggered (24h)" />
                  <div className="mt-1 text-xs text-gray-500">Across all monitors</div>
                </BpCard>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monitor Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscriptions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notifications</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Triggered</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count (24h)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pageMonitors.map((monitor) => (
                      <tr key={monitor.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{monitor.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{monitor.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{monitor.condition}</td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge tone={getSeverityTone(monitor.severity)} label={monitor.severity} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatMonitorSubscriptionScope(monitor.subscriptionIds)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{monitor.notifications}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{monitor.lastTriggered}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{monitor.triggerCount}</td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge tone={monitor.enabled ? 'green' : 'gray'} label={monitor.enabled ? 'Enabled' : 'Disabled'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DataTableFooter
                currentPage={monitorsPg.currentPage}
                totalPages={monitorsPg.totalPages}
                totalItems={alertMonitors.length}
                itemsPerPage={monitorsPg.pageSize}
                onPageChange={monitorsPg.setCurrentPage}
                className="border-gray-200 text-gray-600"
              />
            </>
          )}

          {activeTab === 'metadata' && <ConsoleMetadataCollectionTab />}

          {activeTab === 'requests' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Service Requests</h2>
                <div ref={newRequestDropdownRef} className="relative">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg bg-[#0067c5] px-4 py-2 text-white transition-colors hover:bg-[#0056a6]"
                    onClick={() =>
                      setIsNewRequestDropdownOpen(!isNewRequestDropdownOpen)
                    }
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-semibold">New request</span>
                    <span className="h-4 w-px shrink-0 bg-white/50" />
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  {isNewRequestDropdownOpen && (
                    <div className="absolute right-0 z-10 mt-2 w-56 rounded-lg border border-[#e0e0e0] bg-white shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-[#1c1c1c] transition-colors hover:bg-gray-50"
                        onClick={() => openServiceRequestIdentify('modification')}
                      >
                        Modify Subscription
                      </button>
                      <div className="border-t border-[#e0e0e0]" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-[#1c1c1c] transition-colors hover:bg-gray-50"
                        onClick={() => openServiceRequestIdentify('renewal')}
                      >
                        Renew Subscription
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {serviceRequests.map((request) => {
                  const sub = getSubscriptionById(request.subscriptionId);
                  const subLine = sub ? formatSubscriptionIdentity(sub) : request.subscriptionId;
                  const levels = sub ? formatServiceLevels(sub) : '—';
                  const detailHint =
                    request.type === 'Capacity Increase'
                      ? `${request.currentCommit} → ${request.requestedCommit}`
                      : request.type === 'Renewal'
                        ? `Term ${request.currentTerm}, expires ${sub?.endDate ?? request.expirationDate}`
                        : request.type === 'Service Level Change'
                          ? `${request.currentServiceLevel} → ${request.requestedServiceLevel}`
                          : request.type === 'New Subscription'
                            ? `${request.siteLocation} · ${request.serviceLevel} · ${request.committedCapacity}`
                            : `${request.modification} · ${request.implementationDate}`;
                  return (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{request.id}</span>
                            <StatusBadge tone={getStatusTone(request.status)} label={request.status} />
                            <StatusBadge tone={getPriorityTone(request.priority)} label={request.priority} />
                          </div>
                          <div className="text-sm text-gray-900 font-medium mb-1">{request.type}</div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>
                              <span className="font-medium text-gray-700">Subscription:</span> {subLine}
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Service levels:</span> {levels}
                            </div>
                            <div className="text-gray-700">{detailHint}</div>
                            <div>
                              Requested by {request.requestedBy} · {request.lastUpdated}
                            </div>
                          </div>
                        </div>
                        <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0 ml-2">
                          View Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'cases' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Support Cases</h2>
                <button
                  type="button"
                  onClick={() => setShowNewCaseForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Open Case
                </button>
              </div>
              <div className="space-y-3">
                {supportCases.map((caseItem) => {
                  const sub = getSubscriptionById(caseItem.subscriptionId);
                  const subLine = sub ? formatSubscriptionIdentity(sub) : caseItem.subscriptionId;
                  return (
                    <div
                      key={caseItem.caseId}
                      onClick={() => setSelectedSupport(caseItem)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Case ID</span>
                            <span className="text-sm font-semibold text-gray-900">{caseItem.caseId}</span>
                            <StatusBadge tone={getStatusTone(caseItem.status)} label={caseItem.status} />
                            <StatusBadge tone={getPriorityTone(caseItem.priority)} label={caseItem.priority} />
                            {caseItem.priority === 'P1' && (
                              <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                SLA: {caseItem.slaRemaining}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-900 font-medium mb-1">{caseItem.title}</div>
                          <div className="text-xs text-gray-600">
                            {subLine} · Opened {caseItem.opened} · {caseItem.lastUpdate}
                          </div>
                        </div>
                        <button type="button" className="text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0 ml-2">
                          View Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Alert Detail Drawer */}
      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50"
          onClick={() => setSelectedAlert(null)}
          role="presentation"
        >
          <div
            className="flex h-full max-h-[100dvh] w-full max-w-[700px] flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedAlert.title}</h2>
                <p className="text-sm text-gray-500">{selectedAlert.category} alert</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              <div className="space-y-6">
                {selectedAlert.linkedSupportCaseId && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Support Case ID</div>
                        <div className="text-sm font-semibold text-gray-900">{selectedAlert.linkedSupportCaseId}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Case status</div>
                        <StatusBadge tone="blue" label={selectedAlert.supportCaseStatus ?? 'Open'} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Severity</div>
                    <StatusBadge tone={getSeverityTone(selectedAlert.severity)} label={selectedAlert.severity} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Status</div>
                    <StatusBadge tone="amber" label={selectedAlert.status} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">First detected</div>
                    <div className="text-sm text-gray-900">{selectedAlert.firstDetected}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Last occurrence</div>
                    <div className="text-sm text-gray-900">{selectedAlert.lastOccurrence}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Occurrences</div>
                    <div className="text-sm text-gray-900">{selectedAlert.occurrences}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Subscription</div>
                    <div className="text-sm text-blue-600">{subscriptionLine(selectedAlert)}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-sm text-gray-700">{selectedAlert.description}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Affected resource</h3>
                  <p className="text-sm text-gray-700">{selectedAlert.affectedResource}</p>
                </div>

                {selectedAlert.actionTaken && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Action taken</h3>
                    <p className="text-sm text-blue-700">{selectedAlert.actionTaken}</p>
                  </div>
                )}

                {selectedAlert.recommended && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-green-900 mb-2">Recommended action</h3>
                    <p className="text-sm text-green-700">{selectedAlert.recommended}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 space-y-2 border-t border-gray-200 bg-white px-6 py-4">
              <button
                type="button"
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Acknowledge alert
              </button>
              <button
                type="button"
                disabled={createCaseDisabled}
                title={
                  createCaseDisabled
                    ? 'A support case is already linked to this alert'
                    : 'Open a new support case from this alert'
                }
                className={`w-full rounded-lg border px-4 py-2 transition-colors ${
                  createCaseDisabled
                    ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}
              >
                Create Support Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Request Drawer (details + tracker merged, single click) */}
      <ServiceRequestDrawer
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
      />

      {/* Support Case Detail Drawer */}
      {selectedSupport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50"
          onClick={() => setSelectedSupport(null)}
          role="presentation"
        >
          <div
            className="flex h-full max-h-[100dvh] w-full max-w-[700px] flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Support Case ID</p>
                <h2 className="text-xl font-semibold text-gray-900">{selectedSupport.caseId}</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedSupport.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupport(null)}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Case ID</div>
                  <div className="text-sm font-semibold text-gray-900">{selectedSupport.caseId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Status</div>
                  <StatusBadge tone={getStatusTone(selectedSupport.status)} label={selectedSupport.status} />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Priority</div>
                  <StatusBadge tone={getPriorityTone(selectedSupport.priority)} label={selectedSupport.priority} />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Opened</div>
                  <div className="text-sm text-gray-900">{selectedSupport.opened}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-600 mb-1">Subscription</div>
                  <div className="text-sm text-blue-600">
                    {(() => {
                      const sub = getSubscriptionById(selectedSupport.subscriptionId);
                      return sub ? formatSubscriptionIdentity(sub) : selectedSupport.subscriptionId;
                    })()}
                  </div>
                  {(() => {
                    const sub = getSubscriptionById(selectedSupport.subscriptionId);
                    return sub ? (
                      <div className="text-xs text-gray-600 mt-1">
                        Service levels: {formatServiceLevels(sub)} · {sub.account}
                      </div>
                    ) : null;
                  })()}
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">SLA remaining</div>
                  <div className={`text-sm font-medium ${selectedSupport.priority === 'P1' ? 'text-red-600' : 'text-gray-900'}`}>
                    {selectedSupport.slaRemaining}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Last update</div>
                  <div className="text-sm text-gray-900">{selectedSupport.lastUpdate}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-700">{selectedSupport.description}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Affected Systems</h3>
                <p className="text-sm text-gray-700">{selectedSupport.affectedSystems}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Assigned Engineer</h3>
                <p className="text-sm text-gray-700">{selectedSupport.assignedTo}</p>
              </div>

              {/* Comments / Progress */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Case Progress & Comments</h3>
                <div className="space-y-4">
                  {selectedSupport.comments.map((comment, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{comment.author}</span>
                        <span className="text-xs text-gray-500">{comment.time}</span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>

            <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Add Comment</h3>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Enter your comment or update..."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  rows={4}
                />
                <button type="button" className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
                  <MessageSquare className="h-4 w-4" />
                  Post Comment
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Identify subscription before modification / renewal (from Service requests) */}
      <Sheet
        open={showSubscriptionIdentifySheet}
        onOpenChange={(open) => {
          if (!open) closeSubscriptionIdentifySheet();
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-visible p-0 sm:max-w-md">
          <div className="shrink-0 border-b border-gray-200 px-6 py-4 pr-14">
            <SheetHeader className="space-y-1 p-0 text-left">
              <SheetTitle className="font-['SF_Pro',sans-serif]">
                {pendingServiceRequestKind === 'renewal'
                  ? 'Renew subscription'
                  : 'Modify subscription'}
              </SheetTitle>
              <SheetDescription className="font-['SF_Pro',sans-serif]">
                Select the subscription this service request applies to.
              </SheetDescription>
            </SheetHeader>
          </div>
          <SheetBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-visible px-6 py-4">
            <div ref={identifySubscriptionPickerRef} className="relative">
              <span
                id="sr-subscription-combo-label"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Subscription number / tracking ID
              </span>
              <button
                type="button"
                id="sr-subscription-combo"
                aria-labelledby="sr-subscription-combo-label"
                aria-haspopup="listbox"
                aria-expanded={identifySubscriptionPickerOpen}
                onClick={() =>
                  setIdentifySubscriptionPickerOpen((open) => !open)
                }
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {(() => {
                  const picked = identifySelectedSubscriptionId
                    ? getSubscriptionById(identifySelectedSubscriptionId)
                    : undefined;
                  return (
                    <span className="min-w-0 flex-1">
                      {picked ? (
                        <>
                          <span className="block text-[15px] font-semibold leading-snug text-gray-900">
                            {picked.number}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                            {picked.trackingId}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">Select…</span>
                      )}
                    </span>
                  );
                })()}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                    identifySubscriptionPickerOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              {identifySubscriptionPickerOpen ? (
                <div
                  role="listbox"
                  aria-labelledby="sr-subscription-combo-label"
                  className="absolute left-0 right-0 z-[100] mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {scopedSubscriptions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={identifySelectedSubscriptionId === s.id}
                      className={`flex w-full flex-col items-stretch px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                        identifySelectedSubscriptionId === s.id
                          ? 'bg-blue-50'
                          : ''
                      }`}
                      onClick={() => {
                        setIdentifySelectedSubscriptionId(s.id);
                        setIdentifyError('');
                        setIdentifySubscriptionPickerOpen(false);
                      }}
                    >
                      <span className="text-[15px] font-semibold leading-snug text-gray-900">
                        {s.number}
                      </span>
                      <span className="mt-0.5 text-xs leading-snug text-gray-500">
                        {s.trackingId}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {identifyError ? (
              <p className="text-sm text-red-600" role="alert">
                {identifyError}
              </p>
            ) : null}
          </SheetBody>
          <div className="flex shrink-0 gap-3 border-t border-gray-200 px-6 py-4">
            <Button
              type="button"
              className="flex-1 bg-[#0067c5] hover:bg-[#0056a6]"
              onClick={handleConfirmSubscriptionIdentify}
            >
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={closeSubscriptionIdentifySheet}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {serviceRequestTargetSubscription && (
        <>
          <ModificationFormDrawer
            isOpen={showServiceModificationForm}
            onClose={closeServiceModificationForm}
            subscription={serviceRequestTargetSubscription}
            onSubmitted={(request) => {
              setActiveTab('requests');
              setSelectedRequest(request);
            }}
          />
          <RenewalFormDrawer
            isOpen={showServiceRenewalForm}
            onClose={closeServiceRenewalForm}
            subscription={serviceRequestTargetSubscription}
            onSubmitted={(request) => {
              setActiveTab('requests');
              setSelectedRequest(request);
            }}
          />
        </>
      )}

      <OpenSupportCaseModal
        open={showNewCaseForm}
        onOpenChange={setShowNewCaseForm}
      />
    </div>
  );
}
