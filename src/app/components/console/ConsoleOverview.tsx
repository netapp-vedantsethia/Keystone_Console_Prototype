import { ConsolePageHeader } from "./ConsolePageHeader";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Server,
  Database,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  HardDrive,
  Clock,
  Activity,
  Package,
  Zap,
  Bell,
  Shield,
  DollarSign,
  ShoppingCart,
} from "lucide-react";
import imgAideImage from "figma:asset/81700b285c49b095e1b0efad5982ae98a90f863e.png";
import imgInsightsImage from "figma:asset/fa86841256967a8a858e00bcb1ffb51a486bae91.png";
import imgClassifyImage from "figma:asset/3e6f20dc607302ce5ce9a61bf8ab53cc4dbe4733.png";
import imgOntapImage from "figma:asset/a688519ccdbe38beafdfe82009a149935f3eb381.png";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useState, useMemo, useEffect, useRef, type CSSProperties } from "react";
import { CartModal } from "./CartModal";
import { Popover } from "react-aria-components";
import { BpButton, BpCard, BpCardProperty, BpDropdown, BpTag } from "@netapp/blueprint/react";
import { StatusBadge } from "../ui/StatusBadge";
import { Button } from "../ui/button";
import {
  mockHardwareNodes,
  mockRecommendations,
  getSubscriptionById,
  formatSubscriptionIdentity,
  formatSubscriptionOptionLabel,
  formatSubscriptionCompact,
  countSubscriptionsExpiringWithinDays,
  openPipelineServiceRequests,
  overviewRecentAlerts,
  overviewAddOnSlotTotals,
  overviewSubscriptionsAboveBurstCount,
  overviewSubscriptionsNearCommitCount,
  overviewUniqueClusterCount,
  overviewGridCountFromClusters,
  countHardwareNodesOntapNMinus3OrOlder,
  getAvailableAddOnNamesForSubscription,
  KEYSTONE_ADDON_CATALOG,
  overviewComplianceVulnerabilityTotal,
  fleetBillingTotalsForOffset,
  purchaseOrderMetricsList,
  purchaseOrdersSummary,
  mockConsoleActiveAlerts,
  type PlatformNavigateOptions,
  type Subscription,
  type Recommendation,
} from "../../data/mockData";
import { useConsoleMode } from "../../context/ConsoleModeContext";

type SlaLikeMetric = { name: string; value: string; target: string; status: string };
type SlaLikeSummary = {
  overallCompliance: number;
  target: number;
  metrics: SlaLikeMetric[];
  subscriptionsAtRisk: number;
  totalSubscriptions: number;
  /** Extra pillar-specific footer stat (e.g. uptime streak, carbon saved) — shown alongside the at-risk count. */
  extraStat?: { label: string; value: string };
};

/**
 * One SLA pillar (Availability/Performance/Sustainability): compliance donut + full metric
 * breakdown side-by-side in a single dense row, so the detail from the original metric cards is
 * preserved without the vertical real estate they used to take.
 */
function SlaComplianceDonut({
  icon: Icon,
  label,
  sla,
}: {
  icon: LucideIcon;
  label: string;
  sla: SlaLikeSummary;
}) {
  const isOnTarget = sla.overallCompliance >= sla.target;
  const ringColor = isOnTarget ? "#28a745" : "#ff8c00";
  const displayPercent = sla.overallCompliance >= 99.95 ? 100 : Math.round(sla.overallCompliance * 10) / 10;
  const donutData = [
    { name: "compliant", value: Math.max(0, Math.min(100, displayPercent)) },
    { name: "remainder", value: Math.max(0, 100 - displayPercent) },
  ];
  const footNote =
    sla.subscriptionsAtRisk === 0
      ? "No subscriptions at risk"
      : `${sla.subscriptionsAtRisk} of ${sla.totalSubscriptions} at risk`;

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">{label}</span>
        </div>
        <StatusBadge tone={isOnTarget ? "green" : "amber"} label={`${displayPercent}%`} />
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-[64px] w-[64px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={31}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill={ringColor} />
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {sla.metrics.map((m) => (
            <div key={m.name} className="flex items-center justify-between gap-2 text-xs" title={`Target: ${m.target}`}>
              <span className="truncate text-gray-500">{m.name}</span>
              <span className="flex shrink-0 items-center gap-1 font-medium text-gray-900">
                {m.value}
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    m.status === "excellent" ? "bg-emerald-500" : m.status === "good" ? "bg-green-500" : "bg-amber-500"
                  }`}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={`mt-2 border-t border-gray-100 pt-2 text-xs font-medium ${isOnTarget ? "text-green-700" : "text-amber-700"}`}>
        {footNote}
        {sla.extraStat ? ` · ${sla.extraStat.label}: ${sla.extraStat.value}` : ""}
      </div>
    </div>
  );
}

const RECOMMENDATION_CATEGORY_META: Record<Recommendation["category"], { label: string; color: "blue" | "purple" | "periwinkle" | "yellow" | "grey" }> = {
  renew: { label: "Lifecycle", color: "purple" },
  upgrade: { label: "Reliability", color: "periwinkle" },
  security: { label: "Security", color: "blue" },
  capacity: { label: "Cost", color: "yellow" },
  performance: { label: "Performance", color: "periwinkle" },
  collector: { label: "Reliability", color: "periwinkle" },
};

const RECOMMENDATION_URGENCY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CAPACITY_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type CapacityChartRow = {
  month: string;
  commit: number;
  actual: number;
  data: number;
  snapshot: number;
  burst: number;
};

/** 12-month prototype series from subscription breakdown; `serviceLevelKey` is `all` or a level id (e.g. extreme, premium). */
function buildMonthlyCapacityTrend(
  sub: Subscription,
  serviceLevelKey: string,
): CapacityChartRow[] {
  const breakdown = sub.serviceLevelBreakdown;
  let committed: number;
  let dataT: number;
  let snapT: number;

  if (serviceLevelKey === "all") {
    committed = breakdown.reduce((s, b) => s + b.committed, 0);
    dataT = breakdown.reduce((s, b) => s + b.data, 0);
    snapT = breakdown.reduce((s, b) => s + b.snapshot, 0);
  } else {
    const row = breakdown.find(
      (b) => b.level.toLowerCase() === serviceLevelKey.toLowerCase(),
    );
    if (!row) {
      committed = sub.committed;
      dataT = sub.currentUsage * 0.65;
      snapT = Math.max(0, Math.round((sub.currentUsage - dataT) * 10) / 10);
    } else {
      committed = row.committed;
      dataT = row.data;
      snapT = row.snapshot;
    }
  }

  const used = Math.max(0.1, dataT + snapT);
  const headroom = Math.round(committed * 0.2 * 10) / 10;
  const burstCeiling = committed + headroom;
  const seed = sub.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  return CAPACITY_MONTH_LABELS.map((month, i) => {
    const t = Math.sin((seed + i * 11) * 0.17) * 0.06 + (i - 6) * 0.003;
    const ratio = Math.min(1.35, Math.max(0.75, 0.98 + t));
    const actual = Math.round(used * ratio * 10) / 10;
    const scale = actual / used;
    return {
      month,
      commit: committed,
      actual,
      data: Math.round(dataT * scale * 10) / 10,
      snapshot: Math.round(snapT * scale * 10) / 10,
      burst: burstCeiling,
    };
  });
}

type AttentionCard = {
  id: string;
  title: string;
  icon: LucideIcon;
  iconColor: string;
  items?: string[];
  stats?: { subscribed: number; available: number };
  description?: string;
  badges?: { label: string; color: "red" | "blue" }[];
  action: string;
  bgColor: string;
  theme: "red" | "blue" | "yellow" | "green";
};

interface ConsoleOverviewProps {
  onNavigate: (
    screen: string,
    subscriptionId?: string,
    options?: PlatformNavigateOptions,
  ) => void;
}

function AddOnsBySubscriptionPopover({ label }: { label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { scopedActiveSubscriptions } = useConsoleMode();

  return (
    <>
      <BpButton
        ref={triggerRef}
        type="button"
        appearance="flat"
        size="small"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {label} →
      </BpButton>
      <Popover
        triggerRef={triggerRef}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        placement="bottom start"
        offset={8}
        className="z-50 max-h-[min(70vh,520px)] w-[min(100vw-2rem,28rem)] overflow-y-auto rounded-md bg-[var(--background-content,var(--background))] shadow-[4px_4px_12px_0_var(--border-drop-shadow,rgba(0,0,0,0.15))] outline-none"
      >
        <div className="border-b border-gray-100 px-4 py-3">
          <h4 className="text-sm font-semibold text-gray-900">
            Add-ons by subscription
          </h4>
          <p className="mt-1 text-xs text-gray-500">
            Catalog: {KEYSTONE_ADDON_CATALOG.length} offerings · Subscribed and available lists
            come from each subscription record in the mock data model.
          </p>
        </div>
        <ul className="divide-y divide-gray-100 text-sm">
          {scopedActiveSubscriptions.map((sub) => {
            const available = getAvailableAddOnNamesForSubscription(sub);
            return (
              <li key={sub.id} className="px-4 py-3">
                <div className="font-medium text-gray-900">
                  {formatSubscriptionCompact(sub)}
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Subscribed:</span>{" "}
                  {sub.addOns.length ? sub.addOns.join(" · ") : "—"}
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Available:</span>{" "}
                  {available.length ? available.join(" · ") : "—"}
                </div>
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}

/**
 * Blueprint's `BpCard` defaults to a spacious 40px horizontal / 24px vertical inset
 * (`--space-500` / `--space-300`). Overriding those tokens locally keeps every card on this
 * dashboard-dense page at a tight, consistent 16px in every direction.
 */
const BP_CARD_TIGHT_PADDING = {
  "--space-500": "16px",
  "--space-300": "16px",
} as CSSProperties;

export function ConsoleOverview({
  onNavigate,
}: ConsoleOverviewProps) {
  const { mode, scopedSubscriptions, scopedActiveSubscriptions, isInScope } = useConsoleMode();
  const scopedHardwareNodes = useMemo(
    () => mockHardwareNodes.filter((n) => isInScope(n.subscriptionId)),
    [isInScope],
  );
  const [selectedNotification, setSelectedNotification] =
    useState<any>(null);
  const [selectedServiceLevel, setSelectedServiceLevel] =
    useState<string>("all");
  const [selectedSubscription, setSelectedSubscription] =
    useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] =
    useState<string | null>(null);

  useEffect(() => {
    setSelectedServiceLevel("all");
  }, [selectedSubscription]);

  // Cart state - set to true when there are items in cart
  const hasCartItems = true; // This would be dynamic based on actual cart state
  const [showCartModal, setShowCartModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCart") !== "1" && params.get("openCart") !== "true") {
      return;
    }
    setShowCartModal(true);
    params.delete("openCart");
    const q = params.toString();
    const path =
      window.location.pathname +
      (q ? `?${q}` : "") +
      window.location.hash;
    window.history.replaceState({}, document.title, path);
  }, []);

  const addOnSlots = overviewAddOnSlotTotals(scopedActiveSubscriptions);
  const aboveBurstCount = overviewSubscriptionsAboveBurstCount(scopedActiveSubscriptions);
  const nearCommitCount = overviewSubscriptionsNearCommitCount(0.88, scopedActiveSubscriptions);
  const ontapN3NodeCount = countHardwareNodesOntapNMinus3OrOlder(scopedHardwareNodes);
  const vulnerabilityFindings = overviewComplianceVulnerabilityTotal(
    mockConsoleActiveAlerts.filter((a) => (a.subscriptionId == null ? mode === "console" : isInScope(a.subscriptionId))),
  );

  // Cost & Billing card: derived from the same per-subscription invoices as Billing & Cost.
  const currentPeriodBilling = useMemo(() => fleetBillingTotalsForOffset(0, scopedSubscriptions), [scopedSubscriptions]);
  const priorPeriodBilling = useMemo(() => fleetBillingTotalsForOffset(1, scopedSubscriptions), [scopedSubscriptions]);
  const billingTrendPct =
    priorPeriodBilling.total > 0
      ? ((currentPeriodBilling.total - priorPeriodBilling.total) / priorPeriodBilling.total) * 100
      : 0;
  const scopedPurchaseOrders = useMemo(
    () => purchaseOrderMetricsList().filter((po) => po.coveredSubscriptionIds.some((id) => isInScope(id))),
    [isInScope],
  );
  const poSummary = useMemo(() => purchaseOrdersSummary(scopedPurchaseOrders), [scopedPurchaseOrders]);
  const poNeedingAttention = useMemo(() => {
    const active = scopedPurchaseOrders.filter((po) => po.status === "active");
    return active.sort((a, b) => a.monthsUntilDepletion - b.monthsUntilDepletion)[0] ?? null;
  }, [scopedPurchaseOrders]);
  const poConsumedPct =
    poSummary.totalValueUsd > 0 ? Math.round((poSummary.consumedUsd / poSummary.totalValueUsd) * 100) : 0;

  const baseAttentionCards = useMemo(
    (): AttentionCard[] => [
      {
        id: "capacity",
        title: "Capacity & Consumption",
        icon: Database,
        iconColor: "#dc3545",
        items: [
          `${aboveBurstCount} Above Burst`,
          `${nearCommitCount} Near Commit`,
        ],
        action: "View details",
        bgColor: "#fff5f5",
        theme: "red" as const,
      },
      {
        id: "addons",
        title: "Add-ons",
        icon: Package,
        iconColor: "#0066CC",
        stats: {
          subscribed: addOnSlots.subscribed,
          available: addOnSlots.available,
        },
        action: "View details",
        bgColor: "#f0f8ff",
        theme: "blue" as const,
      },
      {
        id: "inventory",
        title: "Inventory & Compliance",
        icon: AlertTriangle,
        iconColor: "#ff6b35",
        items: [
          `${ontapN3NodeCount} ONTAP N-3+ (nodes)`,
          `${vulnerabilityFindings} vulnerability findings (alerts)`,
        ],
        action: "View details",
        bgColor: "#fffbf0",
        theme: "yellow" as const,
      },
    ],
    [
      aboveBurstCount,
      nearCommitCount,
      addOnSlots.subscribed,
      addOnSlots.available,
      ontapN3NodeCount,
      vulnerabilityFindings,
    ],
  );

  const attentionCards = useMemo((): AttentionCard[] => {
    const list: AttentionCard[] = [...baseAttentionCards];
    if (hasCartItems) {
      list.unshift({
        id: "cart",
        title: "View Cart",
        icon: ShoppingCart,
        iconColor: "#10b981",
        items: ["1 Quote pending Acceptance", "Upload purchase order"],
        action: "Go to cart",
        bgColor: "#f0fdf4",
        theme: "green",
      });
    }
    return list;
  }, [baseAttentionCards, hasCartItems]);

  const handleAttentionCardAction = (cardId: string) => {
    if (cardId === "cart") {
      setShowCartModal(true);
      return;
    }
    if (cardId === "capacity") {
      onNavigate("subscriptions");
      return;
    }
    if (cardId === "inventory") {
      onNavigate("assets", undefined, {
        assetsTab: "nodes",
        highlightOntapNMinus3: true,
      });
    }
  };

  // Subscription & Inventory Summary - Split into 3 cards
  const subscriptionsCard = [
    {
      label: "Subscriptions",
      value: String(scopedActiveSubscriptions.length),
      icon: FileText,
    },
    {
      label: "Expiring Soon",
      value: String(countSubscriptionsExpiringWithinDays(120, scopedSubscriptions)),
      color: "#ff6b35",
      icon: Clock,
      tooltip: "Expiring in next 120 days",
    },
  ];

  const infrastructureCard = useMemo(
    () => [
      {
        label: "Clusters",
        value: String(overviewUniqueClusterCount(scopedHardwareNodes)),
        icon: Server,
      },
      { label: "Nodes", value: String(scopedHardwareNodes.length), icon: HardDrive },
      {
        label: "Grids",
        value: String(overviewGridCountFromClusters(scopedHardwareNodes)),
        icon: Package,
      },
    ],
    [scopedHardwareNodes],
  );

  const openReqPipeline = useMemo(
    () => openPipelineServiceRequests().filter((r) => isInScope(r.subscriptionId)),
    [isInScope],
  );
  const openRequestsCard = {
    title: "Open Requests",
    value: String(openReqPipeline.length),
    icon: FileText,
    badges: [
      {
        label: `${openReqPipeline.filter((r) => r.priority === "High").length} high priority`,
        color: "red",
      },
      { label: `${openReqPipeline.length} in pipeline`, color: "blue" },
    ],
  };

  // All subscriptions capacity data
  const allSubscriptionsData = [
    {
      month: "Jan",
      commit: 100,
      actual: 85,
      data: 58,
      snapshot: 27,
      burst: 120,
    },
    {
      month: "Feb",
      commit: 100,
      actual: 91,
      data: 63,
      snapshot: 28,
      burst: 120,
    },
    {
      month: "Mar",
      commit: 100,
      actual: 88,
      data: 60,
      snapshot: 28,
      burst: 120,
    },
    {
      month: "Apr",
      commit: 100,
      actual: 94,
      data: 65,
      snapshot: 29,
      burst: 120,
    },
    {
      month: "May",
      commit: 100,
      actual: 97,
      data: 68,
      snapshot: 29,
      burst: 120,
    },
    {
      month: "Jun",
      commit: 100,
      actual: 93,
      data: 64,
      snapshot: 29,
      burst: 120,
    },
    {
      month: "Jul",
      commit: 100,
      actual: 89,
      data: 61,
      snapshot: 28,
      burst: 120,
    },
    {
      month: "Aug",
      commit: 100,
      actual: 95,
      data: 66,
      snapshot: 29,
      burst: 120,
    },
    {
      month: "Sep",
      commit: 100,
      actual: 92,
      data: 64,
      snapshot: 28,
      burst: 120,
    },
    {
      month: "Oct",
      commit: 100,
      actual: 98,
      data: 69,
      snapshot: 29,
      burst: 120,
    },
    {
      month: "Nov",
      commit: 100,
      actual: 96,
      data: 67,
      snapshot: 29,
      burst: 120,
    },
    {
      month: "Dec",
      commit: 100,
      actual: 94,
      data: 65,
      snapshot: 29,
      burst: 120,
    },
  ];

  // Above burst data (2 subscriptions)
  const aboveBurstData = [
    {
      month: "Jan",
      commit: 100,
      actual: 122,
      data: 89,
      snapshot: 33,
      burst: 120,
    },
    {
      month: "Feb",
      commit: 100,
      actual: 125,
      data: 91,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Mar",
      commit: 100,
      actual: 121,
      data: 88,
      snapshot: 33,
      burst: 120,
    },
    {
      month: "Apr",
      commit: 100,
      actual: 128,
      data: 94,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "May",
      commit: 100,
      actual: 131,
      data: 96,
      snapshot: 35,
      burst: 120,
    },
    {
      month: "Jun",
      commit: 100,
      actual: 127,
      data: 93,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Jul",
      commit: 100,
      actual: 123,
      data: 90,
      snapshot: 33,
      burst: 120,
    },
    {
      month: "Aug",
      commit: 100,
      actual: 129,
      data: 95,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Sep",
      commit: 100,
      actual: 126,
      data: 92,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Oct",
      commit: 100,
      actual: 132,
      data: 97,
      snapshot: 35,
      burst: 120,
    },
    {
      month: "Nov",
      commit: 100,
      actual: 130,
      data: 96,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Dec",
      commit: 100,
      actual: 128,
      data: 94,
      snapshot: 34,
      burst: 120,
    },
  ];

  // Using burst data (3 subscriptions)
  const usingBurstData = [
    {
      month: "Jan",
      commit: 100,
      actual: 108,
      data: 75,
      snapshot: 33,
      burst: 120,
    },
    {
      month: "Feb",
      commit: 100,
      actual: 112,
      data: 78,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Mar",
      commit: 100,
      actual: 106,
      data: 73,
      snapshot: 33,
      burst: 120,
    },
    {
      month: "Apr",
      commit: 100,
      actual: 115,
      data: 80,
      snapshot: 35,
      burst: 120,
    },
    {
      month: "May",
      commit: 100,
      actual: 118,
      data: 82,
      snapshot: 36,
      burst: 120,
    },
    {
      month: "Jun",
      commit: 100,
      actual: 113,
      data: 79,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Jul",
      commit: 100,
      actual: 109,
      data: 76,
      snapshot: 33,
      burst: 120,
    },
    {
      month: "Aug",
      commit: 100,
      actual: 116,
      data: 81,
      snapshot: 35,
      burst: 120,
    },
    {
      month: "Sep",
      commit: 100,
      actual: 111,
      data: 77,
      snapshot: 34,
      burst: 120,
    },
    {
      month: "Oct",
      commit: 100,
      actual: 119,
      data: 83,
      snapshot: 36,
      burst: 120,
    },
    {
      month: "Nov",
      commit: 100,
      actual: 117,
      data: 82,
      snapshot: 35,
      burst: 120,
    },
    {
      month: "Dec",
      commit: 100,
      actual: 114,
      data: 80,
      snapshot: 34,
      burst: 120,
    },
  ];

  // Underutilized data (4 subscriptions)
  const underutilizedData = [
    {
      month: "Jan",
      commit: 100,
      actual: 58,
      data: 41,
      snapshot: 17,
      burst: 120,
    },
    {
      month: "Feb",
      commit: 100,
      actual: 62,
      data: 43,
      snapshot: 19,
      burst: 120,
    },
    {
      month: "Mar",
      commit: 100,
      actual: 56,
      data: 39,
      snapshot: 17,
      burst: 120,
    },
    {
      month: "Apr",
      commit: 100,
      actual: 64,
      data: 45,
      snapshot: 19,
      burst: 120,
    },
    {
      month: "May",
      commit: 100,
      actual: 67,
      data: 47,
      snapshot: 20,
      burst: 120,
    },
    {
      month: "Jun",
      commit: 100,
      actual: 63,
      data: 44,
      snapshot: 19,
      burst: 120,
    },
    {
      month: "Jul",
      commit: 100,
      actual: 59,
      data: 42,
      snapshot: 17,
      burst: 120,
    },
    {
      month: "Aug",
      commit: 100,
      actual: 65,
      data: 46,
      snapshot: 19,
      burst: 120,
    },
    {
      month: "Sep",
      commit: 100,
      actual: 61,
      data: 43,
      snapshot: 18,
      burst: 120,
    },
    {
      month: "Oct",
      commit: 100,
      actual: 68,
      data: 48,
      snapshot: 20,
      burst: 120,
    },
    {
      month: "Nov",
      commit: 100,
      actual: 66,
      data: 46,
      snapshot: 20,
      burst: 120,
    },
    {
      month: "Dec",
      commit: 100,
      actual: 64,
      data: 45,
      snapshot: 19,
      burst: 120,
    },
  ];

  const capacityUsageData: CapacityChartRow[] = (() => {
    if (selectedStatusFilter === "2 Above Burst") {
      return aboveBurstData;
    }
    if (selectedStatusFilter === "3 Using Burst") {
      return usingBurstData;
    }
    if (selectedStatusFilter === "4 Underutilized") {
      return underutilizedData;
    }

    if (selectedSubscription === "all") {
      return allSubscriptionsData;
    }

    const sub = scopedSubscriptions.find((s) => s.id === selectedSubscription);
    if (!sub) {
      return allSubscriptionsData;
    }
    return buildMonthlyCapacityTrend(sub, selectedServiceLevel);
  })();

  const capacityChartYMax = Math.max(
    20,
    ...capacityUsageData.flatMap((r) => [
      r.commit,
      r.actual,
      r.burst,
      r.data + r.snapshot,
    ]),
  );
  const capacityChartDomainMax = Math.ceil(capacityChartYMax * 1.12);
  const capacityLastRow =
    capacityUsageData[capacityUsageData.length - 1] ?? allSubscriptionsData[11];

  const selectedSubForLevels =
    selectedSubscription !== "all"
      ? getSubscriptionById(selectedSubscription)
      : undefined;

  // Usage status badges
  const usageStatus = [
    { label: "2 Above Burst", color: "#dc3545" },
    { label: "3 Using Burst", color: "#ff6b35" },
    { label: "4 Underutilized", color: "#0066CC" },
  ];

  // Cost Insights
  const costMetrics = [
    {
      label: "Current Commit",
      value: "$520K",
      color: "#404040",
    },
    {
      label: "Recommended Commit",
      value: "$465K",
      color: "#28a745",
    },
    {
      label: "Potential Savings",
      value: "$55K/mo",
      highlight: true,
    },
  ];

  // Forecast Data
  const forecastData = [
    {
      period: "30d",
      value: 88,
      label: "30d forecast",
      risk: false,
    },
    {
      period: "60d",
      value: 91,
      label: "60d forecast",
      risk: true,
    },
    {
      period: "90d",
      value: 95,
      label: "90d forecast",
      risk: true,
    },
  ];

  // Forecast Drivers
  const forecastDrivers = [
    {
      name: "Workload growth",
      value: 12,
      severity: "high",
      color: "#dc3545",
    },
    {
      name: "Volume provisioning change",
      value: 8,
      severity: "medium",
      color: "#ff6b35",
    },
    {
      name: "QoS adjustments",
      value: 5,
      severity: "medium",
      color: "#ff6b35",
    },
    {
      name: "Replication/SnapMirror expansion",
      value: 3,
      severity: "low",
      color: "#0066CC",
    },
  ];

  // SLA Overview by Subscription
  const slaData = [
    { name: "Meeting SLA", value: 19, color: "#28a745" },
    { name: "At Risk", value: 3, color: "#ff6b35" },
    { name: "Breached", value: 2, color: "#dc3545" },
  ];

  // Performance SLA metrics
  const performanceSLA = {
    overallCompliance: 99.2,
    target: 99.9,
    metrics: [
      {
        name: "Average Latency",
        value: "0.8ms",
        target: "<1ms",
        status: "good",
      },
      {
        name: "Peak Latency",
        value: "2.3ms",
        target: "<3ms",
        status: "good",
      },
      {
        name: "IOPS Delivered",
        value: "245K",
        target: ">200K",
        status: "good",
      },
      {
        name: "Throughput",
        value: "8.5 GB/s",
        target: ">8 GB/s",
        status: "good",
      },
    ],
    subscriptionsAtRisk: 2,
    totalSubscriptions: scopedActiveSubscriptions.length,
  };

  // Sustainability SLA metrics
  const sustainabilitySLA = {
    overallCompliance: 94.5,
    target: 95.0,
    metrics: [
      {
        name: "Carbon Efficiency",
        value: "82%",
        target: ">80%",
        status: "good",
      },
      {
        name: "Power Usage",
        value: "1.42 kW",
        target: "<1.5",
        status: "good",
      },
      {
        name: "Cooling Efficiency",
        value: "91%",
        target: ">90%",
        status: "good",
      },
      {
        name: "Energy per TiB",
        value: "18 kWh",
        target: "<20 kWh",
        status: "good",
      },
    ],
    subscriptionsAtRisk: 4,
    totalSubscriptions: scopedActiveSubscriptions.length,
    extraStat: { label: "Carbon saved YTD", value: "127 tons CO₂" },
  };

  // Availability SLA metrics
  const availabilitySLA = {
    overallCompliance: 99.9999,
    target: 99.9999,
    metrics: [
      {
        name: "System Uptime",
        value: "99.9999%",
        target: "99.9999%",
        status: "good",
      },
      {
        name: "Data Availability",
        value: "100%",
        target: "100%",
        status: "excellent",
      },
      {
        name: "MTTR (Mean Time to Repair)",
        value: "1.2h",
        target: "<2h",
        status: "good",
      },
      {
        name: "Unplanned Downtime",
        value: "0 min",
        target: "0 min",
        status: "excellent",
      },
    ],
    subscriptionsAtRisk: 0,
    totalSubscriptions: scopedActiveSubscriptions.length,
    extraStat: { label: "Uptime streak", value: "127 days" },
  };

  const overviewAlertIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "security":
        return Shield;
      case "capacity":
        return TrendingUp;
      case "support":
        return AlertCircle;
      case "infrastructure":
        return AlertTriangle;
      case "compliance":
        return HardDrive;
      case "recommendation":
        return Lightbulb;
      default:
        return Bell;
    }
  };

  const recentAlerts = overviewRecentAlerts(mockConsoleActiveAlerts.length)
    .filter((a) => (a.subscriptionId == null ? mode === "console" : isInScope(a.subscriptionId)))
    .slice(0, 3)
    .map((a) => {
    const tenant =
      a.subscriptionId != null
        ? (() => {
            const s = getSubscriptionById(a.subscriptionId);
            return s ? formatSubscriptionIdentity(s) : a.subscriptionId;
          })()
        : (a.multiSubscriptionLabel ?? "Multiple tenants");
    return {
      id: a.id,
      alertSourceId: a.id,
      type: a.severity,
      category: a.category,
      title: a.title,
      description: `${a.description} — ${tenant}`,
      time: a.lastOccurrence,
      icon: overviewAlertIcon(a.category),
      color:
        a.severity === "Critical"
          ? "#dc3545"
          : a.severity === "Warning"
            ? "#ff6b35"
            : "#0066CC",
      action: "Open in Operations Center",
    };
  });

  const openRequests = openReqPipeline.map((r) => {
    const s = getSubscriptionById(r.subscriptionId);
    return {
      id: r.id,
      type: r.type,
      status: r.status,
      updated: r.lastUpdated,
      subscriptionLine: s ? formatSubscriptionIdentity(s) : r.subscriptionId,
    };
  });

  const portfolioRecommendations = mockRecommendations
    .filter((r) => isInScope(r.subscriptionId))
    .sort(
      (a, b) =>
        (RECOMMENDATION_URGENCY_RANK[a.urgency] ?? 9) - (RECOMMENDATION_URGENCY_RANK[b.urgency] ?? 9),
    )
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <ConsolePageHeader
        title="Overview"
        onRefresh={() => {}}
      />

      <div className="p-5 space-y-4">
        {/* Attention Needed - Top Priority */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Attention Needed
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {attentionCards.map((card) => {
              const Icon = card.icon;
              return (
                <BpCard key={card.id} style={{ ...BP_CARD_TIGHT_PADDING, backgroundColor: card.bgColor }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white">
                      <Icon
                        className="w-5 h-5"
                        style={{ color: card.iconColor }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {card.title}
                      </h3>
                    </div>
                  </div>
                  {card.badges && (
                    <div className="flex flex-wrap gap-2">
                      {card.badges.map((badge, bidx) => (
                        <StatusBadge
                          key={bidx}
                          tone={badge.color === "red" ? "red" : "blue"}
                          label={badge.label}
                        />
                      ))}
                    </div>
                  )}
                  {card.items && (
                    <div className="text-xs text-gray-700 space-y-1">
                      {card.items.map((item, iidx) => (
                        <div key={iidx}>{item}</div>
                      ))}
                    </div>
                  )}
                  {card.stats && (
                    <div className="text-xs text-gray-700 space-y-1">
                      <div>
                        Subscribed: {card.stats.subscribed}
                      </div>
                      <div>
                        Available: {card.stats.available}
                      </div>
                    </div>
                  )}
                  {card.description && (
                    <div className="text-xs text-gray-700">
                      {card.description}
                    </div>
                  )}
                  {card.id === "addons" ? (
                    <AddOnsBySubscriptionPopover label={card.action} />
                  ) : (
                    <Button variant="link" size="sm" onClick={() => handleAttentionCardAction(card.id)}>
                      {card.action} →
                    </Button>
                  )}
                </BpCard>
              );
            })}
          </div>
        </div>

        {/* Subscription & Inventory Summary */}
        {/* Subscription & Inventory Summary - 3 Cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Card 1: Subscriptions & Expiring Soon */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-700" />
              <h3 className="text-sm font-semibold text-gray-900">
                Subscriptions & Expiring Soon
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {subscriptionsCard.map((item, idx) => (
                <BpCardProperty
                  key={idx}
                  direction="vertical"
                  icon={item.icon}
                  value={
                    <span className={item.color ? "text-red-600" : undefined}>{item.value}</span>
                  }
                  property={item.label}
                  tooltip={item.tooltip}
                />
              ))}
            </div>
          </BpCard>

          {/* Card 2: Clusters, Nodes & Grids */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-700" />
              <h3 className="text-sm font-semibold text-gray-900">
                Clusters, Nodes & Grids
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {infrastructureCard.map((item, idx) => (
                <BpCardProperty key={idx} direction="vertical" icon={item.icon} value={item.value} property={item.label} />
              ))}
            </div>
          </BpCard>

          {/* Card 3: Open Requests */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-700" />
              <h3 className="text-sm font-semibold text-gray-900">
                {openRequestsCard.title}
              </h3>
            </div>
            <BpCardProperty direction="vertical" value={openRequestsCard.value} property="Total requests" />
          </BpCard>
        </div>

        {/* Two Column Layout: Capacity Usage + Cost Insights */}
        <div className="grid grid-cols-2 gap-4">
          {/* Capacity Usage */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Capacity Usage
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {/* Subscription Selector */}
                <div className="w-56">
                  <BpDropdown
                    aria-label="Subscription"
                    value={selectedSubscription}
                    onValueChange={(value) => setSelectedSubscription(value ?? "all")}
                    showClearButton={false}
                    searchable
                    options={[
                      { value: "all", label: "All Subscriptions" },
                      ...scopedSubscriptions.map((sub) => ({ value: sub.id, label: formatSubscriptionOptionLabel(sub) })),
                    ]}
                  />
                </div>

                {selectedSubscription !== "all" && selectedSubForLevels ? (
                  <div className="w-40">
                    <BpDropdown
                      aria-label="Performance service level"
                      value={selectedServiceLevel}
                      onValueChange={(value) => setSelectedServiceLevel(value ?? "all")}
                      showClearButton={false}
                      options={[
                        { value: "all", label: "All service levels" },
                        ...selectedSubForLevels.serviceLevels.map((level) => ({ value: level.toLowerCase(), label: level })),
                      ]}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {/* Clickable Status Filters */}
            <div className="flex gap-2">
              {usageStatus.map((status, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    // Filter graph by clicking status
                    setSelectedStatusFilter(
                      selectedStatusFilter === status.label
                        ? null
                        : status.label,
                    );
                  }}
                  className="px-2 py-0.5 rounded text-xs font-medium transition-all hover:ring-2 hover:ring-offset-1 cursor-pointer"
                  style={{
                    backgroundColor:
                      selectedStatusFilter === status.label
                        ? status.color
                        : `${status.color}15`,
                    color:
                      selectedStatusFilter === status.label
                        ? "white"
                        : status.color,
                    border: `1px solid ${status.color}40`,
                    fontWeight:
                      selectedStatusFilter === status.label
                        ? 600
                        : 500,
                  }}
                >
                  {status.label}
                </button>
              ))}
              {selectedStatusFilter && (
                <button
                  onClick={() => setSelectedStatusFilter(null)}
                  className="px-2 py-0.5 rounded text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-300"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Custom Legend */}
            {/* <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 justify-end text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 border-t-2 border-dashed border-[#B2D234]"></div>
                <span className="text-gray-700">Committed capacity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#da1e21] opacity-20 rounded-sm"></div>
                <span className="text-gray-700">Above Burst capacity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#f7941d] opacity-20 rounded-sm"></div>
                <span className="text-gray-700">Burst capacity</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#5e8dcd] rounded-sm"></div>
                <span className="text-gray-700">Used capacity</span>
              </div>
            </div> */}

            <div style={{ width: "100%", height: "280px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={capacityUsageData}
                  margin={{
                    top: 5,
                    right: 10,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  {capacityLastRow.burst > capacityLastRow.commit ? (
                    <ReferenceArea
                      y1={capacityLastRow.burst}
                      y2={capacityChartDomainMax}
                      fill="#da1e21"
                      fillOpacity={0.1}
                    />
                  ) : null}
                  {capacityLastRow.burst > capacityLastRow.commit ? (
                    <ReferenceArea
                      y1={capacityLastRow.commit}
                      y2={capacityLastRow.burst}
                      fill="#f7941d"
                      fillOpacity={0.1}
                    />
                  ) : null}

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    label={{
                      value: "TiB",
                      angle: -90,
                      position: "insideLeft",
                      fontSize: 11,
                    }}
                    domain={[0, capacityChartDomainMax]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />

                  {/* Used capacity line - front, solid, with dots */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#5e8dcd"
                    strokeWidth={2}
                    name="Used"
                    dot={{
                      r: 4,
                      fill: "#5e8dcd",
                      strokeWidth: 2,
                      stroke: "white",
                    }}
                  />

                  {/* Committed capacity line - behind, thicker, dashed */}
                  {/* <Line 
                    type="monotone" 
                    dataKey="commit" 
                    stroke="#B2D234" 
                    strokeWidth={3} 
                    strokeDasharray="8 4" 
                    name="Committed" 
                    dot={false}
                    opacity={0.8}
                  /> */}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-200">
              <div>
                <div className="text-xs text-gray-600">
                  Days in Burst Mode
                </div>
                <div className="text-xl font-semibold text-gray-900">
                  4
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">
                  60-day Breach Probability
                </div>
                <div className="text-xl font-semibold text-red-600">
                  35%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">
                  Current vs Last Period
                </div>
                <div className="text-xl font-semibold text-red-600">
                  +5%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">
                  Biggest Driver
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  VDI growth +35%
                </div>
              </div>
            </div>
          </BpCard>

          {/* Cost Insights & Optimization */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Billing & Invoices
            </h2>

            {/* Monthly Cost */}
            <div>
              <div className="text-sm text-gray-600 mb-1">
                Monthly Cost ({currentPeriodBilling.periodLabel || "Current Period"})
              </div>
              <div className="text-3xl font-semibold text-gray-900">
                ${currentPeriodBilling.total.toLocaleString()}
              </div>
              <div
                className={`flex items-center gap-1 text-sm mt-1 ${
                  billingTrendPct <= 0 ? "text-green-600" : "text-amber-600"
                }`}
              >
                {billingTrendPct <= 0 ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                <span>
                  {Math.abs(billingTrendPct).toFixed(1)}%{" "}
                  {billingTrendPct <= 0 ? "lower" : "higher"} than{" "}
                  {priorPeriodBilling.periodLabel || "last period"}
                </span>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-3 gap-3 pb-4 border-b border-gray-200">
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  Committed
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  ${currentPeriodBilling.committed.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  Burst Charges
                </div>
                <div className="text-sm font-semibold text-orange-600">
                  ${currentPeriodBilling.burst.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  Add-ons
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  ${currentPeriodBilling.addOns.toLocaleString()}
                </div>
              </div>
            </div>

            {/* PO Health */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Purchase Order Health
                </span>
                <StatusBadge
                  tone={poSummary.depletingSoonCount > 0 ? "amber" : "green"}
                  label={poSummary.depletingSoonCount > 0 ? "Needs attention" : "Healthy"}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    PO Balance Remaining ({poSummary.activeCount} active PO
                    {poSummary.activeCount === 1 ? "" : "s"})
                  </span>
                  <span className="font-semibold text-gray-900">
                    ${(poSummary.remainingUsd / 1_000_000).toFixed(1)}M / $
                    {(poSummary.totalValueUsd / 1_000_000).toFixed(1)}M
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        poSummary.depletingSoonCount > 0 ? "bg-amber-500" : "bg-green-600"
                      }`}
                      style={{ width: `${Math.min(100, poConsumedPct)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">
                    {poConsumedPct}%
                  </span>
                </div>
                {poNeedingAttention && (
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      {poNeedingAttention.id} depletion:{" "}
                      {new Date(poNeedingAttention.estDepletionDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>{Math.round(poNeedingAttention.monthsUntilDepletion)} months remaining</span>
                  </div>
                )}
              </div>
            </div>

            {/* Last Invoice */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Last Generated Invoice
                </span>
                <StatusBadge tone="blue" label="Paid" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Consolidated statement · {priorPeriodBilling.periodLabel}
                  </span>
                  <span className="font-semibold text-gray-900">
                    ${priorPeriodBilling.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Period: {priorPeriodBilling.periodLabel}</span>
                  <span>Status: Paid</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => onNavigate("billing-cost")}
                >
                  View Invoice Details
                </Button>
              </div>
            </div>
          </BpCard>
        </div>

        {/* Overall service-level performance: full-width row */}
        <BpCard style={BP_CARD_TIGHT_PADDING}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-700" />
              <h3 className="text-base font-semibold text-gray-900">
                Overall service-level performance
              </h3>
            </div>
            <Button variant="link" size="sm" onClick={() => onNavigate("subscriptions")}>
              View all subscriptions
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <SlaComplianceDonut icon={Shield} label="Availability" sla={availabilitySLA} />
            <SlaComplianceDonut icon={Activity} label="Performance" sla={performanceSLA} />
            <SlaComplianceDonut icon={Zap} label="Sustainability" sla={sustainabilitySLA} />
          </div>
        </BpCard>

        {/* Recommendations + Open Service Requests + Alerts & Notifications: one row, three columns */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recommendations */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Recommendations</h2>
              <StatusBadge tone="blue" label={String(portfolioRecommendations.length)} />
            </div>
            <div className="space-y-2">
              {portfolioRecommendations.slice(0, 3).map((rec) => {
                const meta = RECOMMENDATION_CATEGORY_META[rec.category];
                return (
                  <button
                    type="button"
                    key={rec.id}
                    onClick={() => onNavigate("subscriptions", rec.subscriptionId)}
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-left transition-colors hover:border-blue-500"
                  >
                    <div className="mb-0.5 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-900 line-clamp-1">{rec.title}</span>
                      <BpTag color={meta.color}>{meta.label}</BpTag>
                    </div>
                    <div className="text-xs text-gray-500 line-clamp-1">{rec.description}</div>
                  </button>
                );
              })}
              {portfolioRecommendations.length === 0 && <p className="text-sm text-gray-500">No recommendations right now.</p>}
            </div>
          </BpCard>

          {/* Open Service Requests */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Open Service Requests</h2>
              <StatusBadge tone="blue" label={String(openRequests.length)} />
            </div>
            <div className="space-y-2">
              {openRequests.slice(0, 3).map((request) => (
                <button
                  type="button"
                  key={request.id}
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-left transition-colors hover:border-blue-500"
                  onClick={() =>
                    onNavigate("support", undefined, {
                      supportTab: "requests",
                      highlightServiceRequestId: request.id,
                    })
                  }
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-900">{request.id}</span>
                    <StatusBadge tone="amber" label={request.status} />
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-1">{request.type}</div>
                  <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">{request.subscriptionLine}</div>
                </button>
              ))}
              {openRequests.length === 0 && <p className="text-sm text-gray-500">No open requests.</p>}
            </div>
            <Button
              className="w-full"
              size="sm"
              onClick={() => onNavigate("support", undefined, { supportTab: "requests" })}
            >
              Create New Request
            </Button>
          </BpCard>

          {/* Alerts & Notifications */}
          <BpCard style={BP_CARD_TIGHT_PADDING}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Recent Alerts & Notifications</h2>
              <Button variant="link" size="sm" onClick={() => onNavigate("support", undefined, { supportTab: "monitors" })}>
                View all
              </Button>
            </div>
            <div className="space-y-2">
              {recentAlerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <button
                    type="button"
                    key={alert.id}
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-left transition-colors hover:bg-gray-50"
                    onClick={() =>
                      onNavigate("support", undefined, {
                        highlightAlertId: alert.alertSourceId,
                      })
                    }
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${alert.color}15` }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: alert.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2">
                          <StatusBadge
                            tone={alert.type === "Critical" ? "red" : alert.type === "Warning" ? "amber" : "blue"}
                            label={alert.type}
                          />
                          <span className="text-xs text-gray-500">{alert.time}</span>
                        </div>
                        <div className="text-xs font-medium text-gray-900 line-clamp-1">{alert.title}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {recentAlerts.length === 0 && <p className="text-sm text-gray-500">No active alerts.</p>}
            </div>
          </BpCard>
        </div>

        {/* Explore Other NetApp Console Services */}
        <BpCard style={BP_CARD_TIGHT_PADDING}>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Explore Other NetApp Console Services
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Enhance your data management with these
              complementary services
            </p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {/* AIDE with Keystone */}
            <BpCard type="flat" style={BP_CARD_TIGHT_PADDING}>
              <div className="w-fit">
                <BpTag color='blue'>New</BpTag>
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                AIDE with Keystone!
              </h3>
              <p className="text-xs text-gray-600">
                What is AIDE?
              </p>
              <img
                src={imgAideImage}
                alt="AIDE"
                className="w-full h-20 object-cover rounded"
              />
              <Button variant="outline" size="sm" className="w-full">
                Estimate TCO
              </Button>
            </BpCard>

            {/* Intelligent Insights */}
            <BpCard type="flat" style={BP_CARD_TIGHT_PADDING}>
              <Lightbulb className="w-6 h-6 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Intelligent Insights
              </h3>
              <p className="text-xs text-gray-600">
                What is the DI?
              </p>
              <img
                src={imgInsightsImage}
                alt="Insights"
                className="w-full h-20 object-cover rounded"
              />
              <Button variant="outline" size="sm" className="w-full">
                Get FREE Trial
              </Button>
            </BpCard>

            {/* Classify your data */}
            <BpCard type="flat" style={BP_CARD_TIGHT_PADDING}>
              <Database className="w-6 h-6 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900">
                Classify your data
              </h3>
              <p className="text-xs text-gray-600">
                What is NetApp Data Classification?
              </p>
              <img
                src={imgClassifyImage}
                alt="Classify"
                className="w-full h-20 object-cover rounded"
              />
              <Button variant="outline" size="sm" className="w-full">
                Start now
              </Button>
            </BpCard>

            {/* ONTAP in your Cloud */}
            <BpCard type="flat" style={BP_CARD_TIGHT_PADDING}>
              <Server className="w-6 h-6 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">
                ONTAP in your Cloud!
              </h3>
              <p className="text-xs text-gray-600">
                CVO licensing with Keystone
              </p>
              <img
                src={imgOntapImage}
                alt="ONTAP"
                className="w-full h-20 object-cover rounded"
              />
              <Button size="sm" className="w-full" variant="secondary">
                Take Test Drive
              </Button>
            </BpCard>
          </div>
        </BpCard>
      </div>

      {/* Cart Modal */}
      <CartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
      />
    </div>
  );
}