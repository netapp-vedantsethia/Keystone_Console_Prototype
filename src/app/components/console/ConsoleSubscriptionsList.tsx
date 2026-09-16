import { useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  Zap,
  Server,
  DollarSign,
  TrendingUp,
  HardDrive,
  Package,
  MoreHorizontal,
  FileDown,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { ConsolePageHeader } from "./ConsolePageHeader";
import { StatusBadge, type StatusTone } from "../ui/StatusBadge";
import { Button } from "../ui/button";
import { BpCard, BpCardProperty, BpTag, BpTooltip } from "@netapp/blueprint/react";
import {
  Subscription,
  applyOrderedConfigToSubscription,
  consoleServiceLevelFromPlanName,
  getSubscriptionById,
  getSovereigntyMeta,
  countSubscriptionsExpiringWithinDays,
  subscriptionsTotalCommittedTib,
  subscriptionsAvgUtilizationRatio,
  subscriptionsInBurstModeCount,
  subscriptionsHighBurstUsageCount,
  subscriptionsInActivationCount,
} from "../../data/mockData";
import { useConsoleMode } from "../../context/ConsoleModeContext";
import { ActivationTrackerModal } from "./ActivationTrackerModal";
import { HealthReportModal } from "./HealthReportModal";
import { InactiveSubscriptionsModal } from "./InactiveSubscriptionsModal";
import { NewSubscriptionDrawer } from "./NewSubscriptionDrawer";
import { ServiceRequestDrawer } from "./ServiceRequestDrawer";
import type { ConsoleServiceRequest } from "../../data/consoleOperationsMock";
import {
  DataTable,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableFooter,
} from "../ui/DataTable";
import { TABLE_PAGE_SIZE } from "../../constants/tablePagination";
import { useTablePagination } from "../../hooks/useTablePagination";
import { downloadCsv } from "../../utils/csv";

interface ConsoleSubscriptionsListProps {
  onSelectSubscription: (
    subscription: Subscription,
    options?: { justActivated?: boolean },
  ) => void;
}

/** Sovereign subscription the completed new-subscription request hands off to (Console Local). */
const SOVEREIGN_SUBSCRIPTION_ID = "1789858613";

export function ConsoleSubscriptionsList({
  onSelectSubscription,
}: ConsoleSubscriptionsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showActivationTracker, setShowActivationTracker] = useState(false);
  const [showHealthReportModal, setShowHealthReportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showInactiveSubscriptions, setShowInactiveSubscriptions] = useState(false);
  const [showNewSubscriptionDrawer, setShowNewSubscriptionDrawer] = useState(false);
  const [trackerRequest, setTrackerRequest] = useState<ConsoleServiceRequest | null>(null);
  const { scopedSubscriptions, scopedActiveSubscriptions, isInScope, setMode } = useConsoleMode();
  /** In-flight activation aligned to subscription 1789858604 (Moonshot Central) — Console only. */
  const activationInProgressSub = isInScope("1789858604") ? getSubscriptionById("1789858604") : undefined;

  const filteredSubscriptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return scopedActiveSubscriptions;
    return scopedActiveSubscriptions.filter((sub) =>
      [sub.number, sub.trackingId, sub.account, sub.customer].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [searchTerm, scopedActiveSubscriptions]);

  const itemsPerPage = TABLE_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, endIndex);
  const inactiveSubscriptions = scopedSubscriptions.filter((s) => s.lifecycleStatus && s.lifecycleStatus !== "active");

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleDownload = () => {
    downloadCsv(
      ['Subscription #', 'Tracking ID', 'Account', 'Customer', 'Service levels', 'End date', 'Committed (TiB)', 'Usage (TiB)', 'Burst (TiB)', 'Health', 'SLA', 'Collector', 'Billing'],
      filteredSubscriptions.map((sub) => [
        sub.number,
        sub.trackingId,
        sub.account,
        sub.customer,
        sub.serviceLevels.join(', '),
        new Date(sub.endDate).toLocaleDateString(),
        sub.committed,
        sub.usage,
        sub.burst,
        sub.health,
        sub.sla,
        sub.collectorStatus,
        sub.billingStatus,
      ]),
      'active-subscriptions.csv',
    );
  };

  const filters = [
    {
      id: "expiring-soon",
      label: "Expiring Soon",
      icon: Clock,
      count: countSubscriptionsExpiringWithinDays(120, scopedSubscriptions),
    },
    {
      id: "high-burst",
      label: "High Burst Usage",
      icon: Zap,
      count: subscriptionsHighBurstUsageCount(),
    },
    {
      id: "sla-risk",
      label: "SLA at Risk",
      icon: AlertCircle,
      count: 2,
    },
    {
      id: "collector-offline",
      label: "Collector Offline",
      icon: Server,
      count: 1,
    },
    {
      id: "invoices-due",
      label: "Invoices Due",
      icon: DollarSign,
      count: 1,
    },
  ];

  const toggleFilter = (filterId: string) => {
    setActiveFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((f) => f !== filterId)
        : [...prev, filterId],
    );
  };

  const getHealthBadgeTone = (health: string): StatusTone => {
    switch (health.toLowerCase()) {
      case "excellent":
        return "green";
      case "good":
        return "blue";
      case "at risk":
        return "amber";
      default:
        return "gray";
    }
  };

  const getSlaBadgeTone = (sla: string): StatusTone => {
    switch (sla.toLowerCase()) {
      case "compliant":
        return "green";
      case "at risk":
        return "amber";
      default:
        return "gray";
    }
  };

  const getCollectorBadgeTone = (status: string): StatusTone => {
    switch (status.toLowerCase()) {
      case "online":
        return "green";
      case "offline":
        return "red";
      default:
        return "gray";
    }
  };

  /** Direct/Partner/USPS is a channel category, not a status — Blueprint tag colors, not `StatusBadge`. */
  const getAccountTypeTagColor = (accountType: string): "blue" | "purple" | "periwinkle" => {
    switch (accountType) {
      case "Direct":
        return "blue";
      case "Partner":
        return "purple";
      default:
        return "periwinkle";
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <ConsolePageHeader
        title="Subscriptions"
        onRefresh={() => {}}
        actions={
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowNewSubscriptionDrawer(true)}>
              <Plus className="w-4 h-4" />
              Order new subscription
            </Button>
            <Button variant="outline" onClick={() => setShowHealthReportModal(true)}>
              <FileDown className="w-4 h-4" />
              Health report
            </Button>
          </div>
        }
      />

      <div className="p-5">
        {/* Insights Overview Header */}
        <div className="mb-6 grid grid-cols-5 gap-4">
          <BpCard>
            <BpCardProperty
              icon={Package}
              value={scopedActiveSubscriptions.length}
              property="Total subscriptions"
            />
            {inactiveSubscriptions.length > 0 && (
              <div className="text-xs text-gray-500">
                +{inactiveSubscriptions.length} merged/terminated
              </div>
            )}
          </BpCard>

          <BpCard>
            <BpCardProperty
              icon={HardDrive}
              value={subscriptionsTotalCommittedTib(scopedActiveSubscriptions).toLocaleString()}
              unit="TiB"
              property="Total committed"
            />
            <div className="text-xs text-gray-500">
              Across all subscriptions
            </div>
          </BpCard>

          <BpCard>
            <BpCardProperty
              icon={TrendingUp}
              value={`${Math.round(subscriptionsAvgUtilizationRatio(scopedActiveSubscriptions) * 100)}%`}
              property="Avg utilization"
            />
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="w-3 h-3" />
              Mean usage vs. committed
            </div>
          </BpCard>

          <BpCard>
            <BpCardProperty
              icon={Zap}
              value={subscriptionsInBurstModeCount(scopedActiveSubscriptions)}
              property="In burst mode"
            />
            <div className="text-xs text-gray-500">
              {subscriptionsHighBurstUsageCount(scopedActiveSubscriptions)} over 20% of committed burst
            </div>
          </BpCard>

          <BpCard>
            <BpCardProperty
              icon={Clock}
              value={subscriptionsInActivationCount(scopedSubscriptions)}
              property="In activation"
            />
            <div className="text-xs text-gray-500">
              Deployment in progress
            </div>
          </BpCard>
        </div>

        {/* Subscriptions in Activation — compact full-width card (single in-flight activation) */}
        {activationInProgressSub && (
          <div className="mb-6">
            <h3 className="mb-2 text-base font-semibold text-gray-900">Subscriptions in Activation</h3>
            <BpCard
              className="cursor-pointer transition-colors hover:border-blue-300"
              onClick={() => setShowActivationTracker(true)}
            >
              <div className="flex items-center gap-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600">
                  <Clock className="h-5 w-5 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[#0067c5] hover:underline">
                    {activationInProgressSub.number}
                  </span>
                  <div className="text-xs text-gray-500">
                    {activationInProgressSub.account} · {activationInProgressSub.customer}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 shrink-0">
                  {activationInProgressSub.serviceLevels.map((level, i) => (
                    <span key={i} className="rounded bg-[#e0e0e0] px-2 py-0.5 text-[12px] font-normal text-[#1c1c1c]">
                      {level}
                    </span>
                  ))}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm text-gray-900">{activationInProgressSub.committed} TiB</div>
                  <div className="text-xs text-gray-500">Committed</div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-sm text-gray-900">
                    {new Date(activationInProgressSub.endDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500">Expected activation</div>
                </div>

                <div className="w-40 shrink-0">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-gray-600">60% Complete</span>
                    <span className="text-gray-500">3 of 5 stages</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: '60%' }} />
                  </div>
                </div>

                <div className="shrink-0">
                  <StatusBadge tone="blue" label="Hardware Fulfilment" />
                </div>
              </div>
            </BpCard>
          </div>
        )}

        {/* Active Subscriptions */}
        <DataTable
          title="Active Subscriptions"
          count={filteredSubscriptions.length}
          showSearch={true}
          showDownload={true}
          onSearch={handleSearch}
          onDownload={handleDownload}
          actions={
            inactiveSubscriptions.length > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setShowInactiveSubscriptions(true)}>
                View inactive subscriptions ({inactiveSubscriptions.length})
              </Button>
            ) : undefined
          }
        >
          <table className="w-full">
            <DataTableHeader>
              <tr>
                <DataTableHeaderCell sortable>
                  Subscription
                </DataTableHeaderCell>
                <DataTableHeaderCell sortable>
                  Account
                </DataTableHeaderCell>
                <DataTableHeaderCell>
                  Service Levels
                </DataTableHeaderCell>
                <DataTableHeaderCell>
                  Version
                </DataTableHeaderCell>
                <DataTableHeaderCell sortable>
                  End Date
                </DataTableHeaderCell>
                <DataTableHeaderCell sortable>
                  Committed
                </DataTableHeaderCell>
                <DataTableHeaderCell sortable>
                  Usage
                </DataTableHeaderCell>
                <DataTableHeaderCell sortable>
                  Burst Usage
                </DataTableHeaderCell>
                <DataTableHeaderCell>
                  Health
                </DataTableHeaderCell>
                <DataTableHeaderCell>SLA</DataTableHeaderCell>
                <DataTableHeaderCell>
                  Collector
                </DataTableHeaderCell>
                <DataTableHeaderCell>
                  Billing
                </DataTableHeaderCell>
                <DataTableHeaderCell sticky="end"></DataTableHeaderCell>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {paginatedSubscriptions.map((sub) => (
                <DataTableRow
                  key={sub.id}
                  onClick={() => onSelectSubscription(sub)}
                >
                  <DataTableCell>
                    <div className="flex items-center gap-1.5">
                      {sub.sovereignty && (
                        <BpTooltip content={getSovereigntyMeta(sub)!.tooltip} placement="top start">
                          <ShieldCheck
                            className="h-3.5 w-3.5 shrink-0 text-purple-600"
                            aria-label={getSovereigntyMeta(sub)!.label}
                          />
                        </BpTooltip>
                      )}
                      <span className="text-[#0067c5] hover:underline font-medium">
                        {sub.number}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400">{sub.trackingId}</div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="text-[13px] text-[#1c1c1c]">{sub.account}</div>
                    <div className="text-[11px] text-gray-500">
                      {sub.customer}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex flex-wrap gap-1">
                      {sub.serviceLevels
                        .slice(0, 2)
                        .map((level, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[#e0e0e0] text-[#1c1c1c] rounded text-[12px]"
                          >
                            {level}
                          </span>
                        ))}
                      {sub.serviceLevels.length > 2 && (
                        <span className="px-2 py-0.5 bg-[#e0e0e0] text-[#1c1c1c] rounded text-[12px]">
                          +{sub.serviceLevels.length - 2}
                        </span>
                      )}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <span>{sub.version}</span>
                      <BpTag color={getAccountTypeTagColor(sub.accountType)}>{sub.accountType}</BpTag>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    {new Date(sub.endDate).toLocaleDateString()}
                  </DataTableCell>
                  <DataTableCell>
                    {sub.committed} TiB
                  </DataTableCell>
                  <DataTableCell>{sub.usage} TiB</DataTableCell>
                  <DataTableCell>
                    <span
                      className={
                        sub.burst <= 0
                          ? "text-gray-900"
                          : sub.committed > 0 &&
                              sub.burst <= 0.2 * sub.committed
                            ? "font-medium text-amber-600"
                            : "font-semibold text-red-600"
                      }
                    >
                      {sub.burst} TiB
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={getHealthBadgeTone(sub.health)} label={sub.health} />
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={getSlaBadgeTone(sub.sla)} label={sub.sla} />
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={getCollectorBadgeTone(sub.collectorStatus)} label={sub.collectorStatus} />
                  </DataTableCell>
                  <DataTableCell>
                    {sub.billingStatus}
                  </DataTableCell>
                  <DataTableCell sticky="end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="More actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
              {paginatedSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-sm text-gray-500">
                    No subscriptions match your search.
                  </td>
                </tr>
              )}
            </DataTableBody>
          </table>
          <DataTableFooter
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredSubscriptions.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </DataTable>

      </div>

      {/* Activation Tracker Modal */}
      <ActivationTrackerModal
        isOpen={showActivationTracker}
        onClose={() => setShowActivationTracker(false)}
        subscriptionId={activationInProgressSub?.id ?? "1789858604"}
        subscriptionName={
          activationInProgressSub
            ? `${activationInProgressSub.account} · ${activationInProgressSub.customer}`
            : ""
        }
      />

      {/* Health Report Modal */}
      <HealthReportModal
        isOpen={showHealthReportModal}
        onClose={() => setShowHealthReportModal(false)}
      />

      {/* Order New Subscription Drawer */}
      <NewSubscriptionDrawer
        isOpen={showNewSubscriptionDrawer}
        onClose={() => setShowNewSubscriptionDrawer(false)}
        accountName={scopedSubscriptions[0]?.customer ?? "AUMOVIO Germany GmbH"}
        onSubmitted={(request) => setTrackerRequest(request)}
      />

      {/* New Subscription Request Details + Tracker */}
      <ServiceRequestDrawer
        isOpen={!!trackerRequest}
        onClose={(allStagesCompleted) => {
          const completed = trackerRequest;
          setTrackerRequest(null);
          /* A finished request means the subscription now exists — land the user on it. */
          if (!allStagesCompleted) return;
          const activated = getSubscriptionById(SOVEREIGN_SUBSCRIPTION_ID);
          if (!activated) return;
          if (completed?.type === "New Subscription") {
            applyOrderedConfigToSubscription(SOVEREIGN_SUBSCRIPTION_ID, {
              serviceLevel: consoleServiceLevelFromPlanName(completed.serviceLevel),
              committedTib: parseFloat(completed.committedCapacity),
            });
          }
          setMode("console-local");
          onSelectSubscription(activated, { justActivated: true });
        }}
        request={trackerRequest}
      />

      {/* Expired / Merged Subscriptions Modal */}
      <InactiveSubscriptionsModal
        isOpen={showInactiveSubscriptions}
        onClose={() => setShowInactiveSubscriptions(false)}
        subscriptions={inactiveSubscriptions}
        onSelectSubscription={onSelectSubscription}
      />
    </div>
  );
}