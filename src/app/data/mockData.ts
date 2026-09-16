// Mock data for NetApp Console Keystone STaaS

import { PLATFORM_REFERENCE_DATE, shiftDatesDeep, shiftIsoDate, shiftMonthDayLabel } from './dateShift';

export { PLATFORM_REFERENCE_DATE } from './dateShift';

export const userRoles = {
  SUBSCRIPTION_ADMIN: 'Subscription Admin',
  SUBSCRIPTION_VIEWER: 'Subscription Viewer',
  STORAGE_ADMIN: 'Storage Admin',
  STORAGE_OPERATOR: 'Storage Operator',
} as const;

export const customerTypes = {
  DIRECT: 'Direct Customer',
  RESELLER: 'Reseller (Sell-through)',
  SERVICE_PROVIDER: 'Service Provider (Sell-to)',
} as const;

/**
 * Per–service-level capacity snapshot.
 * - `committed`: customer minimum commitment (TiB).
 * - `data` + `snapshot`: used capacity (TiB); total used = data + snapshot.
 * - `burst`: included burst headroom NetApp provides (20% of committed); overwritten by `normalizeSubscription`.
 * - Billable **accrued burst** = max(0, data + snapshot − committed) — see `accruedBurstBillableTib`.
 */
export interface ServiceLevelBreakdown {
  level: string;
  committed: number;
  data: number;
  snapshot: number;
  burst: number;
  /**
   * Present only when this row's current numbers include capacity absorbed from another
   * subscription's merger (see `Subscription.mergedFrom`). Historical invoice generation
   * subtracts this delta for billing periods before the merge's effective month so past
   * invoices still reflect the pre-merge state — see `buildInvoiceLineItemsFromBreakdown`.
   */
  mergedCapacityDelta?: {
    fromSubscriptionId: string;
    /** ISO event date of the merge (same value as the corresponding `mergedFrom` entry). */
    activeFrom: string;
    committed: number;
    data: number;
    snapshot: number;
  };
}

/** Why a subscription is no longer active — drives which badge/filter/tabs apply (see `ConsoleSubscriptionsList`, `ConsoleSubscriptionDetail`). */
export type SubscriptionLifecycleStatus = 'active' | 'merged' | 'terminated' | 'expired';

export interface SubscriptionMergeLink {
  subscriptionId: string;
  /** ISO date the merge event occurred — used for Timeline events, chart annotations, and banner copy. */
  date: string;
}

export interface SubscriptionMergeSource extends SubscriptionMergeLink {
  /** Committed capacity (TiB) absorbed from the merged-away subscription — narrative/display only. */
  addedCommittedTib: number;
}

/**
 * Keystone's two sovereignty deployment models (product naming; see `SOVEREIGNTY_META`):
 * - `dark-site`: hardware lives entirely inside the customer's own environment/premises.
 *   NetApp has no connectivity into it, so usage, live hardware configuration, and burst can
 *   never be measured — only the contracted commitment is known. Mirrors NetApp Keystone's real
 *   "dark site" / private-mode deployment and the industry's "sovereign private cloud" pattern
 *   (fully disconnected, operator has no visibility — e.g. air-gapped government clouds).
 * - `sovereign`: hosted/operated with full telemetry, but data and operations are
 *   contractually and technically confined to the customer's declared region/jurisdiction.
 *   Mirrors the AWS European Sovereign Cloud / Microsoft Cloud for Sovereignty / Google Sovereign
 *   Controls pattern — a provider-operated region with jurisdictional guarantees, full visibility.
 */
export type SovereigntyTier = 'dark-site' | 'sovereign';

export interface SovereigntyProfile {
  tier: SovereigntyTier;
  /** Declared jurisdiction, e.g. "European Union". Not tracked for `dark-site` — there is no visibility to confirm it. */
  jurisdiction?: string;
}

interface SovereigntyVisibility {
  /** Current Consumption + Consumption Trends tabs. */
  usage: boolean;
  /** Volumes tab (per-volume capacity/performance). */
  volumes: boolean;
  /** Burst is ever billed / shown on invoices. */
  burstBilling: boolean;
  /** Measured/live SLA data (latency history, uptime heatmap) vs. contracted targets only. */
  liveSla: boolean;
  /** Live hardware telemetry (CPU, memory, uptime, status) vs. shipped configuration only. */
  hardwareTelemetry: boolean;
}

export const SOVEREIGNTY_META: Record<
  SovereigntyTier,
  {
    label: string;
    shortLabel: string;
    tagColor: 'purple' | 'periwinkle';
    tooltip: string;
    bannerTitle: string;
    bannerDescription: string;
    visibility: SovereigntyVisibility;
  }
> = {
  'dark-site': {
    label: 'Dark Site',
    shortLabel: 'Dark Site',
    tagColor: 'purple',
    tooltip:
      'Dark Site: this subscription runs entirely inside your own environment. NetApp has no connectivity into it, so we can only show your contracted commitment — no live usage or hardware telemetry.',
    bannerTitle: 'Dark Site deployment',
    bannerDescription:
      "This subscription is hosted entirely within your own environment, with no NetApp connectivity in or out. We show only what's contractually known — your committed service levels, committed-capacity invoices, and the hardware we shipped. Live usage, burst, and telemetry are not visible to NetApp by design.",
    visibility: { usage: false, volumes: false, burstBilling: false, liveSla: false, hardwareTelemetry: false },
  },
  sovereign: {
    label: 'Sovereign',
    shortLabel: 'Sovereign',
    tagColor: 'periwinkle',
    tooltip:
      'Sovereign: data and operations stay within your declared region, operated with the same full visibility and reporting as a standard subscription.',
    bannerTitle: 'Sovereign deployment',
    bannerDescription:
      'This subscription keeps your data and operations inside your declared region at every layer — storage, replication, and support. You will get the same full visibility as any other standard subscription: live usage, invoices, SLA reporting, and assets.',
    visibility: { usage: true, volumes: true, burstBilling: true, liveSla: true, hardwareTelemetry: true },
  },
};

export interface Subscription {
  /** Internal key for volumes, ops, and routing (unchanged across rows). */
  id: string;
  /** Subscription number shown in product UI (same value as `id` in this prototype). */
  number: string;
  /** External tracking reference (e.g. MST-1001). */
  trackingId: string;
  customer: string;
  /** Moonshot site / workspace label (e.g. Moonshot Germany). */
  account: string;
  serviceLevels: string[];
  serviceLevelBreakdown: ServiceLevelBreakdown[];
  region: string;
  version: string; // v1, v2, v3, XaaS
  accountType: string; // Direct, Partner, USPS
  addOns: string[]; // Add-ons subscribed
  startDate: string;
  endDate: string;
  /** Sum of per-level minimum commitments (TiB); normalized from breakdown */
  committed: number;
  /** Same as currentUsage after `normalizeSubscription` */
  usage: number;
  /** Total accrued burst TiB (billable); same as burstUsage after normalize */
  burst: number;
  /** Kept equal to `committed` for prototype consistency */
  committedCapacity: number;
  /** Sum of data + snapshot across breakdown (TiB) */
  currentUsage: number;
  /** Sum of max(0, used − committed) per level — billable accrued burst */
  burstUsage: number;
  health: string;
  sla: string;
  collectorStatus: string;
  billingStatus: string;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  slaStatus: 'compliant' | 'at-risk' | 'breached';
  /** Defaults to 'active' via `normalizeSubscription` when omitted. */
  lifecycleStatus?: SubscriptionLifecycleStatus;
  /** Set on the subscription that was merged away — points at the surviving subscription it was consolidated into. */
  mergedInto?: SubscriptionMergeLink;
  /** Set on the surviving subscription — one entry per subscription merged into it (supports many-to-one). */
  mergedFrom?: SubscriptionMergeSource[];
  /** Present only for Keystone's sovereign offerings — see `SovereigntyTier` / `SOVEREIGNTY_META`. */
  sovereignty?: SovereigntyProfile;
}

export function getSovereigntyMeta(sub: Pick<Subscription, 'sovereignty'>) {
  return sub.sovereignty ? SOVEREIGNTY_META[sub.sovereignty.tier] : undefined;
}

export function isDarkSite(sub: Pick<Subscription, 'sovereignty'>): boolean {
  return sub.sovereignty?.tier === 'dark-site';
}

export function isSovereign(sub: Pick<Subscription, 'sovereignty'>): boolean {
  return sub.sovereignty?.tier === 'sovereign';
}

/** Sovereignty tier for a subscription id, if any — used by fleet-wide views (e.g. Assets) that only hold ids. */
export function getSovereigntyTierById(subscriptionId: string): SovereigntyTier | undefined {
  return mockSubscriptions.find((s) => s.id === subscriptionId)?.sovereignty?.tier;
}

/** NetApp included burst pool as a fraction of committed capacity (prototype). */
export const NETAPP_BURST_HEADROOM_PCT = 0.2;

export function includedBurstHeadroomTib(committedTib: number): number {
  return Math.round(committedTib * NETAPP_BURST_HEADROOM_PCT * 10) / 10;
}

export function usedTibFromBreakdownRow(b: Pick<ServiceLevelBreakdown, 'data' | 'snapshot'>): number {
  return Math.round((b.data + b.snapshot) * 10) / 10;
}

/** Capacity used above minimum commitment; this is what extra burst billing applies to. */
export function accruedBurstBillableTib(b: Pick<ServiceLevelBreakdown, 'committed' | 'data' | 'snapshot'>): number {
  const used = usedTibFromBreakdownRow(b);
  return Math.max(0, Math.round((used - b.committed) * 10) / 10);
}

/** Single source of truth: recompute headroom, rollups, and align `committed` / `usage` / `burst*` fields. */
export function normalizeSubscription(rawSub: Subscription): Subscription {
  // Shift every date literal (startDate/endDate, mergedInto/mergedFrom, merge-delta activeFrom)
  // by the same delta as PLATFORM_REFERENCE_DATE so this subscription's whole timeline stays
  // anchored around "today" — see `dateShift.ts`.
  const sub = shiftDatesDeep(rawSub);
  const serviceLevelBreakdown = sub.serviceLevelBreakdown.map((row) => ({
    ...row,
    burst: includedBurstHeadroomTib(row.committed),
  }));
  const committed = serviceLevelBreakdown.reduce((s, b) => s + b.committed, 0);
  const currentUsage = serviceLevelBreakdown.reduce((s, b) => s + usedTibFromBreakdownRow(b), 0);
  const burstUsage = serviceLevelBreakdown.reduce((s, b) => s + accruedBurstBillableTib(b), 0);
  return {
    ...sub,
    serviceLevelBreakdown,
    committed,
    committedCapacity: committed,
    currentUsage,
    usage: currentUsage,
    burstUsage,
    burst: burstUsage,
    lifecycleStatus: sub.lifecycleStatus ?? 'active',
  };
}

/**
 * Curated merger story: 1789858601 (Moonshot Spain — running over its 200 TiB commitment, "At Risk")
 * was consolidated into 1789858609 (Moonshot Europe Central — same EU service levels, ample headroom)
 * on this date. Falls inside the default 30-day Consumption Trends window and inside the most recent
 * closed billing month, so the chart annotation and the invoice "before/after" jump are both visible
 * without changing filters. See `mergedInto` / `mergedFrom` / `mergedCapacityDelta` below.
 */
const SUBSCRIPTION_MERGE_DATE = '2026-03-20';

const rawMockSubscriptions: Subscription[] = [
  {
    id: '1789858600',
    number: '1789858600',
    trackingId: 'MST-1001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Germany',
    serviceLevels: ['Extreme', 'Standard'],
    serviceLevelBreakdown: [
      { level: 'Extreme', committed: 100, data: 95, snapshot: 10, burst: 0 },
      { level: 'Standard', committed: 15, data: 5, snapshot: 5, burst: 0 },
    ],
    region: 'US-East',
    version: 'v1',
    accountType: 'Direct',
    addOns: ['Backup', 'DR'],
    startDate: '2024-01-15',
    endDate: '2026-05-15', // Expiring soon (~39 days from Apr 6, 2026)
    committed: 115,
    usage: 105,
    burst: 20,
    committedCapacity: 500,
    currentUsage: 425,
    burstUsage: 18, 
    health: 'Excellent',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
  {
    id: '1789858601',
    number: '1789858601',
    trackingId: 'MST-2001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Spain',
    serviceLevels: ['Premium', 'Performance'],
    serviceLevelBreakdown: [
      { level: 'Premium', committed: 150, data: 175, snapshot: 30, burst: 15 },
      { level: 'Performance', committed: 50, data: 25, snapshot: 15, burst: 15 },
    ],
    region: 'EU-West',
    version: 'v2',
    accountType: 'Partner',
    addOns: ['Backup'],
    startDate: '2023-06-01',
    // Merged into 1789858609 on SUBSCRIPTION_MERGE_DATE (was running hot over commitment — see mergedInto below).
    endDate: SUBSCRIPTION_MERGE_DATE,
    committed: 200,
    usage: 195,
    burst: 30,
    committedCapacity: 1200,
    currentUsage: 1150,
    burstUsage: 28, 
    health: 'At Risk',
    sla: 'At Risk',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'warning',
    slaStatus: 'at-risk',
    lifecycleStatus: 'merged',
    mergedInto: { subscriptionId: '1789858609', date: SUBSCRIPTION_MERGE_DATE },
  },
  {
    id: '1789858602',
    number: '1789858602',
    trackingId: 'MST-3001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot India',
    serviceLevels: ['Performance', 'Value'],
    serviceLevelBreakdown: [
      { level: 'Performance', committed: 100, data: 90, snapshot: 20, burst: 10 },
      { level: 'Value', committed: 50, data: 25, snapshot: 10, burst: 10 },
    ],
    region: 'APAC',
    version: 'v3',
    accountType: 'USPS',
    addOns: ['DR'],
    startDate: '2024-03-01',
    endDate: '2027-03-01',
    committed: 150,
    usage: 120,
    burst: 0,
    committedCapacity: 800,
    currentUsage: 650,
    burstUsage: 0, 
    health: 'Good',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
  {
    // Dark Site: entirely inside the customer's own environment, no NetApp connectivity.
    // `data`/`snapshot` are 0 by design — actual usage is never visible to NetApp for this tier.
    id: '1789858612',
    number: '1789858612',
    trackingId: 'MST-13001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'AUMOVIO Frankfurt',
    serviceLevels: ['Extreme'],
    serviceLevelBreakdown: [
      { level: 'Extreme', committed: 120, data: 0, snapshot: 0, burst: 0 },
    ],
    region: 'DE-OnPrem',
    version: 'v3',
    accountType: 'Direct',
    addOns: ['Backup'],
    startDate: '2025-01-10',
    endDate: '2028-01-10',
    committed: 120,
    usage: 0,
    burst: 0,
    committedCapacity: 120,
    currentUsage: 0,
    burstUsage: 0,
    health: 'Excellent',
    sla: 'Compliant',
    collectorStatus: 'Not Connected',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
    sovereignty: { tier: 'dark-site' },
  },
  {
    // Sovereign: fully operated by NetApp, data stays inside the declared EU region.
    id: '1789858613',
    number: '1789858613',
    trackingId: 'MST-14001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'AUMOVIO Berlin',
    serviceLevels: ['Premium', 'Performance'],
    serviceLevelBreakdown: [
      { level: 'Premium', committed: 160, data: 100, snapshot: 20, burst: 20 },
      { level: 'Performance', committed: 100, data: 60, snapshot: 15, burst: 10 },
    ],
    region: 'EU-Sovereign',
    version: 'v3',
    accountType: 'Direct',
    addOns: ['Backup', 'DR'],
    startDate: '2025-02-01',
    endDate: '2028-02-01',
    committed: 260,
    usage: 195,
    burst: 0,
    committedCapacity: 260,
    currentUsage: 195,
    burstUsage: 0,
    health: 'Excellent',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
    sovereignty: { tier: 'sovereign', jurisdiction: 'European Union' },
  },
  {
    id: '1789858603',
    number: '1789858603',
    trackingId: 'MST-4001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot USA',
    serviceLevels: ['Extreme', 'Premium'],
    serviceLevelBreakdown: [
      { level: 'Extreme', committed: 200, data: 100, snapshot: 40, burst: 20 },
      { level: 'Premium', committed: 50, data: 25, snapshot: 10, burst: 10 },
    ],
    region: 'US-West',
    version: 'XaaS',
    accountType: 'Partner',
    addOns: ['Backup', 'DR'],
    startDate: '2022-09-15',
    endDate: '2026-06-30', // Expiring soon (~85 days)
    committed: 250,
    usage: 245,
    burst: 50,
    committedCapacity: 2000,
    currentUsage: 1800,
    burstUsage: 45, 
    health: 'Critical', 
    sla: 'Breached',  
    collectorStatus: 'Offline',
    billingStatus: 'Overdue',
    healthStatus: 'critical',
    slaStatus: 'breached',
  },
  {
    id: '1789858604',
    number: '1789858604',
    trackingId: 'MST-5001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Central',
    serviceLevels: ['Extreme'],
    serviceLevelBreakdown: [
      { level: 'Extreme', committed: 180, data: 90, snapshot: 30, burst: 15 },
    ],
    region: 'US-Central',
    version: 'v1',
    accountType: 'Direct',
    addOns: ['Backup'],
    startDate: '2024-02-01',
    endDate: '2027-02-01',
    committed: 180,
    usage: 165,
    burst: 15,
    committedCapacity: 900,
    currentUsage: 820,
    burstUsage: 12, 
    health: 'Excellent',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
  {
    id: '1789858605',
    number: '1789858605',
    trackingId: 'MST-6001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Great Plains',
    serviceLevels: ['Premium', 'Standard'],
    serviceLevelBreakdown: [
      { level: 'Premium', committed: 250, data: 125, snapshot: 50, burst: 25 },
      { level: 'Standard', committed: 70, data: 60, snapshot: 20, burst: 20 },
    ],
    region: 'US-Central',
    version: 'v2',
    accountType: 'Direct',
    addOns: ['Backup', 'DR'],
    startDate: '2024-04-01',
    endDate: '2027-04-01',
    committed: 320,
    usage: 295,
    burst: 45,
    committedCapacity: 1800,
    currentUsage: 1680,
    burstUsage: 40, 
    health: 'Good',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
  {
    id: '1789858606',
    number: '1789858606',
    trackingId: 'MST-7001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Atlantic',
    serviceLevels: ['Extreme', 'Premium', 'Performance'],
    serviceLevelBreakdown: [
      { level: 'Extreme', committed: 300, data: 350, snapshot: 60, burst: 30 },
      { level: 'Premium', committed: 150, data: 75, snapshot: 30, burst: 15 },
      { level: 'Performance', committed: 50, data: 25, snapshot: 10, burst: 10 },
    ],
    region: 'US-East',
    version: 'XaaS',
    accountType: 'Partner',
    addOns: ['Backup', 'DR'],
    startDate: '2025-01-15',
    endDate: '2028-01-15',
    committed: 500,
    usage: 485,
    burst: 120,
    committedCapacity: 3500,
    currentUsage: 3200,
    burstUsage: 115, 
    health: 'At Risk',
    sla: 'At Risk',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'warning',
    slaStatus: 'at-risk',
  },
  {
    id: '1789858607',
    number: '1789858607',
    trackingId: 'MST-8001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Pacific',
    serviceLevels: ['Extreme', 'Premium'],
    serviceLevelBreakdown: [
      { level: 'Extreme', committed: 300, data: 53, snapshot: 60, burst: 30 },
      { level: 'Premium', committed: 120, data: 60, snapshot: 20, burst: 10 },
    ],
    region: 'US-West',
    version: 'v3',
    accountType: 'Partner',
    addOns: ['DR'],
    startDate: '2024-05-01',
    endDate: '2027-05-01',
    committed: 420,
    usage: 390,
    burst: 85,
    committedCapacity: 2800,
    currentUsage: 2550,
    burstUsage: 80, 
    health: 'Good',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
  {
    id: '1789858608',
    number: '1789858608',
    trackingId: 'MST-9001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Asia Pacific',
    serviceLevels: ['Performance', 'Standard'],
    serviceLevelBreakdown: [
      { level: 'Performance', committed: 200, data: 100, snapshot: 40, burst: 20 },
      { level: 'Standard', committed: 80, data: 40, snapshot: 10, burst: 10 },
    ],
    region: 'APAC',
    version: 'v2',
    accountType: 'Direct',
    addOns: ['Backup'],
    startDate: '2023-07-01',
    endDate: '2026-07-01',
    committed: 280,
    usage: 255,
    burst: 35,
    committedCapacity: 1600,
    currentUsage: 1480,
    burstUsage: 30, 
    health: 'Excellent',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
  {
    id: '1789858609',
    number: '1789858609',
    trackingId: 'MST-10001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Europe Central',
    serviceLevels: ['Premium', 'Performance'],
    // Premium/Performance rows include capacity merged in from 1789858601 (Moonshot Spain) — see
    // `mergedCapacityDelta` on each row. Historical invoices before SUBSCRIPTION_MERGE_DATE subtract
    // the delta so billing correctly shows the pre-merge (250/100) totals for older periods.
    serviceLevelBreakdown: [
      {
        level: 'Premium',
        committed: 400,
        data: 300,
        snapshot: 80,
        burst: 25,
        mergedCapacityDelta: {
          fromSubscriptionId: '1789858601',
          activeFrom: SUBSCRIPTION_MERGE_DATE,
          committed: 150,
          data: 175,
          snapshot: 30,
        },
      },
      {
        level: 'Performance',
        committed: 150,
        data: 75,
        snapshot: 35,
        burst: 10,
        mergedCapacityDelta: {
          fromSubscriptionId: '1789858601',
          activeFrom: SUBSCRIPTION_MERGE_DATE,
          committed: 50,
          data: 25,
          snapshot: 15,
        },
      },
    ],
    region: 'EU-Central',
    version: 'XaaS',
    accountType: 'Partner',
    addOns: ['Backup', 'DR'],
    startDate: '2024-08-01',
    endDate: '2027-08-01',
    committed: 550,
    usage: 490,
    burst: 0,
    committedCapacity: 2200,
    currentUsage: 2050,
    burstUsage: 0, 
    health: 'Good',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
    mergedFrom: [
      { subscriptionId: '1789858601', date: SUBSCRIPTION_MERGE_DATE, addedCommittedTib: 200 },
    ],
  },
  {
    id: '1789858610',
    number: '1789858610',
    trackingId: 'MST-11001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Western US',
    serviceLevels: ['Extreme', 'Premium'],
    serviceLevelBreakdown: [
      { level: 'Extreme', committed: 350, data: 175, snapshot: 70, burst: 35 },
      { level: 'Premium', committed: 130, data: 65, snapshot: 20, burst: 10 },
    ],
    region: 'US-West',
    version: 'v3',
    accountType: 'Direct',
    addOns: ['Backup', 'DR'],
    startDate: '2025-03-01',
    endDate: '2028-03-01',
    committed: 480,
    usage: 445,
    burst: 95,
    committedCapacity: 3200,
    currentUsage: 2950,
    burstUsage: 90, 
    health: 'Excellent',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
  {
    id: '1789858611',
    number: '1789858611',
    trackingId: 'MST-12001',
    customer: 'AUMOVIO Germany GmbH',
    account: 'Moonshot Northeast',
    serviceLevels: ['Premium', 'Standard'],
    serviceLevelBreakdown: [
      { level: 'Premium', committed: 150, data: 75, snapshot: 30, burst: 15 },
      { level: 'Standard', committed: 70, data: 35, snapshot: 10, burst: 10 },
    ],
    region: 'US-East',
    version: 'v2',
    accountType: 'Direct',
    addOns: ['Backup'],
    startDate: '2024-06-15',
    endDate: '2027-06-15',
    committed: 220,
    usage: 200,
    burst: 25,
    committedCapacity: 1300,
    currentUsage: 1180,
    burstUsage: 22, 
    health: 'Good',
    sla: 'Compliant',
    collectorStatus: 'Online',
    billingStatus: 'Current',
    healthStatus: 'healthy',
    slaStatus: 'compliant',
  },
];

export const mockSubscriptions: Subscription[] = rawMockSubscriptions.map(normalizeSubscription);

/**
 * Only currently-active subscriptions — use for fleet-wide totals/averages/counts (committed
 * capacity, utilization, burst, SLA "of N subscriptions" denominators, etc.) so a merged-away
 * subscription's capacity isn't double-counted against the surviving subscription it absorbed
 * into. Per-subscription views (detail pages, timelines, invoices) still use `mockSubscriptions`
 * so merged/terminated subscriptions remain individually reachable.
 */
export const activeMockSubscriptions: Subscription[] = mockSubscriptions.filter(
  (s) => s.lifecycleStatus === 'active',
);

/** Page header line: viewer-local date, time, and timezone abbreviation. */
export function formatConsoleLastUpdated(date: Date = new Date()): string {
  return `Last updated: ${date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })}`;
}

/** Resolve a subscription by internal id (used across volumes, console ops, alerts). */
export function getSubscriptionById(id: string): Subscription | undefined {
  return mockSubscriptions.find((s) => s.id === id);
}

/**
 * Single-line identity: subscription #, Moonshot site (`account`), tracking ref (`trackingId`), MSP customer.
 */
export function formatSubscriptionIdentity(sub: Subscription): string {
  return `${sub.number} · ${sub.account} · ${sub.trackingId} · ${sub.customer}`;
}

/** Shorter: subscription # · Moonshot site. */
export function formatSubscriptionCompact(sub: Subscription): string {
  return `${sub.number} · ${sub.account}`;
}

/** Select / filter dropdown label (matches list columns). */
export function formatSubscriptionOptionLabel(sub: Subscription): string {
  return `${sub.number} · ${sub.account} · ${sub.trackingId}`;
}

/**
 * Maps a catalog plan name ("Unified Premium") to the Console's service-level vocabulary
 * ("Premium"), so an ordered plan and the activated subscription describe the same tier.
 */
export function consoleServiceLevelFromPlanName(planName: string): string {
  return planName.replace(/^unified\s+/i, '').trim();
}

/**
 * Prototype-only: rewrites an existing subscription in place so a completed self-service order
 * lands on a subscription matching what was requested. A real system would create a new record;
 * here the fleet is a fixed fixture, so the sovereign entry is restated instead. Rollups
 * (committed / usage / burst) are recomputed downstream by `normalizeSubscription`.
 */
export function applyOrderedConfigToSubscription(
  subscriptionId: string,
  config: { serviceLevel: string; committedTib: number },
): void {
  const sub = mockSubscriptions.find((s) => s.id === subscriptionId);
  if (!sub || !Number.isFinite(config.committedTib) || config.committedTib <= 0) return;
  const committed = Math.round(config.committedTib);
  sub.serviceLevels = [config.serviceLevel];
  sub.serviceLevelBreakdown = [
    {
      level: config.serviceLevel,
      committed,
      data: Math.round(committed * 0.62 * 10) / 10,
      snapshot: Math.round(committed * 0.13 * 10) / 10,
      burst: 0,
    },
  ];
}

/** MSP customer shown in global chrome (Moonshot fleet shares one customer in this prototype). */
export function platformMspCustomer(): string {
  return mockSubscriptions[0]?.customer ?? 'AUMOVIO Germany GmbH';
}

/** Program / workspace label in header (from first subscription Moonshot site name). */
export function platformProgramLabel(): string {
  const t = mockSubscriptions[0]?.account ?? 'Moonshot';
  return t.split(/\s+/)[0] ?? 'Moonshot';
}

export function countSubscriptionsExpiringWithinDays(days: number, subs: Subscription[] = mockSubscriptions): number {
  const start = PLATFORM_REFERENCE_DATE.getTime();
  const end = start + days * 86400000;
  return subs.filter((s) => {
    const t = new Date(s.endDate).getTime();
    return t >= start && t <= end;
  }).length;
}

/** Deep-link from Overview into the Operations Center (consumed on mount by the target screen). */
export type PlatformNavIntent = {
  screen: 'support';
  supportTab?: 'metadata' | 'requests' | 'cases' | 'monitors';
  highlightServiceRequestId?: string;
  highlightSupportCaseId?: string;
  highlightAlertId?: string;
};

export type PlatformNavigateOptions = Omit<PlatformNavIntent, 'screen'> & {
  /** Deep-link into Assets (ONTAP Nodes tab = `nodes`). */
  assetsTab?: 'volumes' | 'nodes';
  /** When true, rows at or behind ONTAP N-3 are highlighted on the nodes table. */
  highlightOntapNMinus3?: boolean;
  /** Deep-link into Billing & Cost (e.g. from a subscription's Purchase Orders drawer). */
  billingCostTab?: 'invoices' | 'purchase-orders' | 'cost-explorer';
};

function subscriptionRef(subscriptionId: string): {
  subscriptionId: string;
  subscriptionNumber: string;
} {
  const s = rawMockSubscriptions.find((x) => x.id === subscriptionId);
  if (!s) {
    throw new Error(`mockData: unknown subscription id ${subscriptionId}`);
  }
  return { subscriptionId: s.id, subscriptionNumber: s.number };
}

export interface VolumeTrendPoint {
  date: string;
  capacity: number;
}

export interface VolumeSuggestion {
  title: string;
  impact: string;
  effort: 'Low' | 'Medium' | 'High';
}

export interface Volume {
  id: string;
  subscriptionId: string;
  subscriptionNumber: string;
  clusterName: string;
  name: string;
  svm: string;
  capacityUsed: number;
  snapshot: number;
  growthRate: number;
  latency: number;
  iops: number;
  throughput: number;
  tiering: string;
  protection: string;
  anomalies: string[];
  trendData: VolumeTrendPoint[];
  suggestions: VolumeSuggestion[];
}

export interface HardwareNode {
  id: string;
  subscriptionId: string;
  subscriptionNumber: string;
  name: string;
  clusterName: string;
  model: string;
  serialNumber: string;
  ontapVersion: string;
  status: 'Healthy' | 'Warning' | 'Critical';
  cpuUtilization: number;
  memoryUsed: number;
  memoryTotal: number;
  uptime: string;
  disks: number;
  location: string;
}

function slugFromSubscriptionNumber(num: string): string {
  return num.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function regionHint(region: string): string {
  const map: Record<string, string> = {
    'US-East': 'useast',
    'EU-West': 'euwest',
    APAC: 'apac',
    'US-West': 'uswest',
    'US-Central': 'uscentral',
    'EU-Central': 'eucentral',
    'DE-OnPrem': 'deonprem',
    'EU-Sovereign': 'eusov',
  };
  return map[region] ?? 'reg';
}

/** Deterministic 0..1 pseudo-random for stable mock metrics across reloads. */
function detRand(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildTrendFromCapacity(capacityUsed: number): VolumeTrendPoint[] {
  const factors = [0.88, 0.91, 0.94, 0.97, 1.0, 1.02];
  return factors.map((f, i) => ({
    date: shiftIsoDate(`2026-01-${String(1 + i * 6).padStart(2, '0')}`),
    capacity: Math.round(Math.max(0.1, capacityUsed * f) * 10) / 10,
  }));
}

function buildVolumeSuggestions(args: {
  snapshot: number;
  growthRate: number;
  anomalies: string[];
}): VolumeSuggestion[] {
  const out: VolumeSuggestion[] = [];
  if (args.anomalies.length > 0) {
    out.push({
      title: 'Review anomaly findings',
      impact: 'Address flagged conditions before they affect SLA',
      effort: 'Medium',
    });
  }
  if (args.growthRate > 8) {
    out.push({
      title: 'Capacity planning checkpoint',
      impact: 'Sustained growth may require tier or subscription adjustment',
      effort: 'Low',
    });
  }
  if (args.snapshot > 25) {
    out.push({
      title: 'Snapshot retention review',
      impact: `About ${args.snapshot.toFixed(1)} TiB in snapshots — tune policy if appropriate`,
      effort: 'Low',
    });
  }
  if (out.length === 0) {
    out.push({
      title: 'Routine optimization',
      impact: 'Validate tiering and protection alignment with workload class',
      effort: 'Low',
    });
  }
  return out.slice(0, 3);
}

const VOLUME_ROLE = ['data_primary', 'app_logs', 'shared_fs', 'backup_dr', 'analytics_temp'] as const;
const NODE_MODELS = ['AFF A800', 'AFF A900', 'AFF A400', 'FAS9500', 'FAS8700', 'AFF C400'] as const;

/** Oldest → newest ONTAP train in this prototype; current = last entry. */
export const ONTAP_RELEASE_TRAIN_ASC = [
  '9.12.1',
  '9.13.1',
  '9.14.1',
  '9.15.1',
  '9.16.1',
  '9.17.1',
  '9.18.1',
] as const;

export type OntapReleaseString = (typeof ONTAP_RELEASE_TRAIN_ASC)[number];

export function ontapReleaseIndex(version: string): number {
  const i = ONTAP_RELEASE_TRAIN_ASC.indexOf(version as OntapReleaseString);
  return i;
}

/** True when the node is on the N-3 train or older (compliance “upgrade from” band). */
export function isOntapNMinus3OrOlder(version: string): boolean {
  const idx = ontapReleaseIndex(version);
  if (idx < 0) return false;
  const currentIdx = ONTAP_RELEASE_TRAIN_ASC.length - 1;
  return idx <= currentIdx - 3;
}

export const KEYSTONE_ADDON_CATALOG = [
  { id: 'backup', name: 'Backup' },
  { id: 'dr', name: 'DR' },
  { id: 'fabricpool', name: 'FabricPool' },
  { id: 'ransomware', name: 'Anti-Ransomware' },
  { id: 'snapmirror-cloud', name: 'SnapMirror Cloud' },
  { id: 'monitoring-advanced', name: 'Advanced Monitoring' },
] as const;

export function getAvailableAddOnNamesForSubscription(sub: Subscription): string[] {
  return KEYSTONE_ADDON_CATALOG.filter((a) => !sub.addOns.includes(a.name)).map((a) => a.name);
}

export function overviewAddOnSlotTotals(
  subs: Subscription[] = activeMockSubscriptions,
): { subscribed: number; available: number } {
  let subscribed = 0;
  let available = 0;
  for (const s of subs) {
    subscribed += s.addOns.length;
    available += getAvailableAddOnNamesForSubscription(s).length;
  }
  return { subscribed, available };
}

export function overviewSubscriptionsAboveBurstCount(subs: Subscription[] = activeMockSubscriptions): number {
  return subs.filter((s) => s.burst > 0).length;
}

/** Usage at or above 88% of committed with no accrued burst (prototype “near commit”). */
export function overviewSubscriptionsNearCommitCount(
  pct = 0.88,
  subs: Subscription[] = activeMockSubscriptions,
): number {
  return subs.filter(
    (s) => s.committed > 0 && s.usage >= pct * s.committed && s.burst <= 0,
  ).length;
}

export function subscriptionsTotalCommittedTib(subs: Subscription[] = activeMockSubscriptions): number {
  return subs.reduce((s, x) => s + x.committed, 0);
}

/** Mean of (usage / committed) for subscriptions with committed > 0. */
export function subscriptionsAvgUtilizationRatio(subs: Subscription[] = activeMockSubscriptions): number {
  let n = 0;
  let sum = 0;
  for (const x of subs) {
    if (x.committed <= 0) continue;
    sum += x.usage / x.committed;
    n += 1;
  }
  if (n === 0) return 0;
  return sum / n;
}

/** Any accrued burst (usage over commitment). */
export function subscriptionsInBurstModeCount(subs: Subscription[] = activeMockSubscriptions): number {
  return subs.filter((s) => s.burst > 0).length;
}

/** Accrued burst strictly above 20% of committed (aligns with subscriptions list burst styling). */
export function subscriptionsHighBurstUsageCount(subs: Subscription[] = activeMockSubscriptions): number {
  return subs.filter(
    (s) => s.committed > 0 && s.burst > 0.2 * s.committed,
  ).length;
}

/** Ids treated as in-flight activation on the Subscriptions console (prototype). */
export const SUBSCRIPTIONS_IN_ACTIVATION_IDS: readonly string[] = ['1789858604'];

export function subscriptionsInActivationCount(subs: Subscription[] = mockSubscriptions): number {
  return SUBSCRIPTIONS_IN_ACTIVATION_IDS.filter((id) =>
    subs.some((s) => s.id === id),
  ).length;
}

const NODE_LOCATIONS = [
  'Ashburn, VA',
  'San Francisco, CA',
  'New York, NY',
  'London, UK',
  'Singapore',
  'Mumbai, IN',
  'Sydney, AU',
  'Denver, CO',
  'Frankfurt, DE',
] as const;

function buildMockVolumes(): Volume[] {
  const volumes: Volume[] = [];
  let seq = 0;

  rawMockSubscriptions.forEach((sub, subIdx) => {
    const ref = subscriptionRef(sub.id);
    const slug = slugFromSubscriptionNumber(sub.number);
    const reg = regionHint(sub.region);
    const clusterName = `${reg}-${slug}-cl-01`;
    const volumeCount = 4 + (subIdx % 2);

    for (let i = 0; i < volumeCount; i++) {
      seq += 1;
      const id = `vol-${String(seq).padStart(4, '0')}`;
      const seed = subIdx * 100 + i;

      let name: string;
      if (sub.id === '1789858600' && i === 0) {
        name = 'prod_database_01';
      } else if (sub.id === '1789858601' && i === 0) {
        name = 'app_data_vol';
      } else {
        name = `${slug}_${VOLUME_ROLE[i % VOLUME_ROLE.length]}_${String(i + 1).padStart(2, '0')}`;
      }

      const svm = `svm-${slug}-${i + 1}`;
      const capacityUsed = Math.round((25 + detRand(seed, 1) * 320) * 10) / 10;
      const snapshot = Math.round(detRand(seed, 2) * Math.min(50, capacityUsed * 0.35) * 10) / 10;
      const growthRate = Math.round((0.2 + detRand(seed, 3) * 18) * 10) / 10;
      const latency = Math.round((0.5 + detRand(seed, 4) * 3.5) * 10) / 10;
      const iops = Math.round(800 + detRand(seed, 5) * 32000);
      const throughput = Math.round(120 + detRand(seed, 6) * 2000);
      const tieringOpts = ['Auto', 'Snapshot-only', 'All'] as const;
      const protectionOpts = ['SnapMirror', 'SnapVault', 'Local Snapshot', 'None'] as const;
      const tiering = tieringOpts[Math.floor(detRand(seed, 7) * tieringOpts.length)];
      const protection = protectionOpts[Math.floor(detRand(seed, 8) * protectionOpts.length)];

      const anomalies: string[] = [];
      if (growthRate > 12) anomalies.push('High growth rate');
      if (snapshot > capacityUsed * 0.35 && snapshot > 15) anomalies.push('Snapshot growth');
      if (detRand(seed, 9) > 0.92) anomalies.push('Latency variance');

      volumes.push({
        id,
        ...ref,
        clusterName,
        name,
        svm,
        capacityUsed,
        snapshot,
        growthRate,
        latency,
        iops,
        throughput,
        tiering,
        protection,
        anomalies,
        trendData: buildTrendFromCapacity(capacityUsed),
        suggestions: buildVolumeSuggestions({ snapshot, growthRate, anomalies }),
      });
    }
  });

  return volumes;
}

function buildMockHardwareNodes(): HardwareNode[] {
  const nodes: HardwareNode[] = [];
  let seq = 0;

  rawMockSubscriptions.forEach((sub, subIdx) => {
    const ref = subscriptionRef(sub.id);
    const slug = slugFromSubscriptionNumber(sub.number);
    const reg = regionHint(sub.region);
    const clusterName = `${reg}-${slug}-cl-01`;
    const nodeCount = 2 + (subIdx % 3);

    for (let i = 0; i < nodeCount; i++) {
      seq += 1;
      const id = `node-${String(seq).padStart(4, '0')}`;
      const seed = subIdx * 50 + i;
      const cpu = Math.round(25 + detRand(seed, 10) * 65);
      const memTotal = detRand(seed, 11) > 0.5 ? 256 : 192;
      const memUsed = Math.round(memTotal * (0.35 + detRand(seed, 12) * 0.55));
      let status: HardwareNode['status'] = 'Healthy';
      if (cpu > 75) status = 'Warning';
      if (cpu > 92 && detRand(seed, 13) > 0.7) status = 'Critical';

      const vi = Math.floor(detRand(seed, 15) * ONTAP_RELEASE_TRAIN_ASC.length);
      const ontapVersion = ONTAP_RELEASE_TRAIN_ASC[vi];
      nodes.push({
        id,
        ...ref,
        name: `${reg}-${slug}-node-${String(i + 1).padStart(2, '0')}`,
        clusterName,
        model: NODE_MODELS[Math.floor(detRand(seed, 14) * NODE_MODELS.length)],
        serialNumber: `SN${sub.id.slice(-4)}${String(seq).padStart(5, '0')}`,
        ontapVersion,
        status,
        cpuUtilization: cpu,
        memoryUsed: memUsed,
        memoryTotal: memTotal,
        uptime: `${Math.floor(30 + detRand(seed, 16) * 330)} days`,
        disks: [12, 20, 24, 32, 36, 48, 60][Math.floor(detRand(seed, 17) * 7)],
        location: NODE_LOCATIONS[Math.floor(detRand(seed, 18) * NODE_LOCATIONS.length)],
      });
    }
  });

  return nodes;
}

export const mockVolumes: Volume[] = buildMockVolumes();

export const mockHardwareNodes: HardwareNode[] = buildMockHardwareNodes();

export function overviewUniqueClusterCount(nodes: HardwareNode[] = mockHardwareNodes): number {
  return new Set(nodes.map((n) => n.clusterName)).size;
}

export function overviewGridCountFromClusters(nodes: HardwareNode[] = mockHardwareNodes): number {
  const c = overviewUniqueClusterCount(nodes);
  return Math.max(1, Math.round(c / 3));
}

export function countHardwareNodesOntapNMinus3OrOlder(nodes: HardwareNode[] = mockHardwareNodes): number {
  return nodes.filter((n) => isOntapNMinus3OrOlder(n.ontapVersion)).length;
}

export function getVolumesForSubscription(subscriptionId: string): Volume[] {
  return mockVolumes.filter((v) => v.subscriptionId === subscriptionId);
}

export const mockVolumesTotalCapacityUsedTiB = mockVolumes.reduce(
  (sum, v) => sum + v.capacityUsed,
  0
);

const rawConsumptionTrendData = [
  { date: '2026-01-09', used: 380, committed: 500, burst: 0, data: 300, snapshot: 80 },
  { date: '2026-01-10', used: 385, committed: 500, burst: 0, data: 305, snapshot: 80 },
  { date: '2026-01-11', used: 390, committed: 500, burst: 0, data: 310, snapshot: 80 },
  { date: '2026-01-12', used: 395, committed: 500, burst: 0, data: 315, snapshot: 80 },
  { date: '2026-01-13', used: 400, committed: 500, burst: 0, data: 320, snapshot: 80 },
  { date: '2026-01-14', used: 405, committed: 500, burst: 0, data: 325, snapshot: 80 },
  { date: '2026-01-15', used: 410, committed: 500, burst: 0, data: 330, snapshot: 80 },
  { date: '2026-01-16', used: 415, committed: 500, burst: 0, data: 335, snapshot: 80 },
  { date: '2026-01-17', used: 418, committed: 500, burst: 0, data: 338, snapshot: 80 },
  { date: '2026-01-18', used: 420, committed: 500, burst: 0, data: 340, snapshot: 80 },
  { date: '2026-01-19', used: 422, committed: 500, burst: 0, data: 342, snapshot: 80 },
  { date: '2026-01-20', used: 425, committed: 500, burst: 0, data: 345, snapshot: 80 },
  { date: '2026-01-21', used: 430, committed: 500, burst: 0, data: 350, snapshot: 80 },
  { date: '2026-01-22', used: 440, committed: 500, burst: 0, data: 360, snapshot: 80 },
  { date: '2026-01-23', used: 460, committed: 500, burst: 0, data: 380, snapshot: 80 },
  { date: '2026-01-24', used: 485, committed: 500, burst: 0, data: 405, snapshot: 80 },
  { date: '2026-01-25', used: 510, committed: 500, burst: 10, data: 430, snapshot: 80 },
  { date: '2026-01-26', used: 535, committed: 500, burst: 35, data: 450, snapshot: 85 },
  { date: '2026-01-27', used: 545, committed: 500, burst: 45, data: 455, snapshot: 90 },
  { date: '2026-01-28', used: 540, committed: 500, burst: 40, data: 450, snapshot: 90 },
  { date: '2026-01-29', used: 530, committed: 500, burst: 30, data: 445, snapshot: 85 },
  { date: '2026-01-30', used: 520, committed: 500, burst: 20, data: 440, snapshot: 80 },
  { date: '2026-01-31', used: 515, committed: 500, burst: 15, data: 435, snapshot: 80 },
  { date: '2026-02-01', used: 510, committed: 500, burst: 10, data: 430, snapshot: 80 },
  { date: '2026-02-02', used: 505, committed: 500, burst: 5, data: 425, snapshot: 80 },
  { date: '2026-02-03', used: 500, committed: 500, burst: 0, data: 420, snapshot: 80 },
  { date: '2026-02-04', used: 495, committed: 500, burst: 0, data: 415, snapshot: 80 },
  { date: '2026-02-05', used: 490, committed: 500, burst: 0, data: 410, snapshot: 80 },
  { date: '2026-02-06', used: 488, committed: 500, burst: 0, data: 408, snapshot: 80 },
  { date: '2026-02-07', used: 485, committed: 500, burst: 0, data: 405, snapshot: 80 },
  { date: '2026-02-08', used: 483, committed: 500, burst: 0, data: 403, snapshot: 80 },
  { date: '2026-02-09', used: 480, committed: 500, burst: 0, data: 400, snapshot: 80 },
  { date: '2026-02-10', used: 478, committed: 500, burst: 0, data: 398, snapshot: 80 },
  { date: '2026-02-11', used: 475, committed: 500, burst: 0, data: 395, snapshot: 80 },
  { date: '2026-02-12', used: 473, committed: 500, burst: 0, data: 393, snapshot: 80 },
  { date: '2026-02-13', used: 470, committed: 500, burst: 0, data: 390, snapshot: 80 },
  { date: '2026-02-14', used: 468, committed: 500, burst: 0, data: 388, snapshot: 80 },
  { date: '2026-02-15', used: 465, committed: 500, burst: 0, data: 385, snapshot: 80 },
  { date: '2026-02-16', used: 463, committed: 500, burst: 0, data: 383, snapshot: 80 },
  { date: '2026-02-17', used: 460, committed: 500, burst: 0, data: 380, snapshot: 80 },
  { date: '2026-02-18', used: 458, committed: 500, burst: 0, data: 378, snapshot: 80 },
  { date: '2026-02-19', used: 455, committed: 500, burst: 0, data: 375, snapshot: 80 },
  { date: '2026-02-20', used: 453, committed: 500, burst: 0, data: 373, snapshot: 80 },
  { date: '2026-02-21', used: 450, committed: 500, burst: 0, data: 370, snapshot: 80 },
  { date: '2026-02-22', used: 448, committed: 500, burst: 0, data: 368, snapshot: 80 },
  { date: '2026-02-23', used: 445, committed: 500, burst: 0, data: 365, snapshot: 80 },
  { date: '2026-02-24', used: 443, committed: 500, burst: 0, data: 363, snapshot: 80 },
  { date: '2026-02-25', used: 440, committed: 500, burst: 0, data: 360, snapshot: 80 },
  { date: '2026-02-26', used: 438, committed: 500, burst: 0, data: 358, snapshot: 80 },
  { date: '2026-02-27', used: 435, committed: 500, burst: 0, data: 355, snapshot: 80 },
  { date: '2026-02-28', used: 433, committed: 500, burst: 0, data: 353, snapshot: 80 },
  { date: '2026-03-01', used: 430, committed: 500, burst: 0, data: 350, snapshot: 80 },
  { date: '2026-03-02', used: 432, committed: 500, burst: 0, data: 352, snapshot: 80 },
  { date: '2026-03-03', used: 435, committed: 500, burst: 0, data: 355, snapshot: 80 },
  { date: '2026-03-04', used: 438, committed: 500, burst: 0, data: 358, snapshot: 80 },
  { date: '2026-03-05', used: 440, committed: 500, burst: 0, data: 360, snapshot: 80 },
  { date: '2026-03-06', used: 443, committed: 500, burst: 0, data: 363, snapshot: 80 },
  { date: '2026-03-07', used: 445, committed: 500, burst: 0, data: 365, snapshot: 80 },
  { date: '2026-03-08', used: 448, committed: 500, burst: 0, data: 368, snapshot: 80 },
  { date: '2026-03-09', used: 450, committed: 500, burst: 0, data: 370, snapshot: 80 },
  { date: '2026-03-10', used: 453, committed: 500, burst: 0, data: 373, snapshot: 80 },
  { date: '2026-03-11', used: 455, committed: 500, burst: 0, data: 375, snapshot: 80 },
  { date: '2026-03-12', used: 458, committed: 500, burst: 0, data: 378, snapshot: 80 },
  { date: '2026-03-13', used: 460, committed: 500, burst: 0, data: 380, snapshot: 80 },
  { date: '2026-03-14', used: 463, committed: 500, burst: 0, data: 383, snapshot: 80 },
  { date: '2026-03-15', used: 465, committed: 500, burst: 0, data: 385, snapshot: 80 },
  { date: '2026-03-16', used: 468, committed: 500, burst: 0, data: 388, snapshot: 80 },
  { date: '2026-03-17', used: 470, committed: 500, burst: 0, data: 390, snapshot: 80 },
  { date: '2026-03-18', used: 473, committed: 500, burst: 0, data: 393, snapshot: 80 },
  { date: '2026-03-19', used: 475, committed: 500, burst: 0, data: 395, snapshot: 80 },
  { date: '2026-03-20', used: 478, committed: 500, burst: 0, data: 398, snapshot: 80 },
  { date: '2026-03-21', used: 480, committed: 500, burst: 0, data: 400, snapshot: 80 },
  { date: '2026-03-22', used: 483, committed: 500, burst: 0, data: 403, snapshot: 80 },
  { date: '2026-03-23', used: 485, committed: 500, burst: 0, data: 405, snapshot: 80 },
  { date: '2026-03-24', used: 488, committed: 500, burst: 0, data: 408, snapshot: 80 },
  { date: '2026-03-25', used: 490, committed: 500, burst: 0, data: 410, snapshot: 80 },
  { date: '2026-03-26', used: 493, committed: 500, burst: 0, data: 413, snapshot: 80 },
  { date: '2026-03-27', used: 495, committed: 500, burst: 0, data: 415, snapshot: 80 },
  { date: '2026-03-28', used: 498, committed: 500, burst: 0, data: 418, snapshot: 80 },
  { date: '2026-03-29', used: 500, committed: 500, burst: 0, data: 420, snapshot: 80 },
  { date: '2026-03-30', used: 503, committed: 500, burst: 3, data: 423, snapshot: 80 },
  { date: '2026-03-31', used: 505, committed: 500, burst: 5, data: 425, snapshot: 80 },
  { date: '2026-04-01', used: 508, committed: 500, burst: 8, data: 428, snapshot: 80 },
  { date: '2026-04-02', used: 510, committed: 500, burst: 10, data: 430, snapshot: 80 },
  { date: '2026-04-03', used: 512, committed: 500, burst: 12, data: 432, snapshot: 80 },
  { date: '2026-04-04', used: 515, committed: 500, burst: 15, data: 435, snapshot: 80 },
  { date: '2026-04-05', used: 517, committed: 500, burst: 17, data: 437, snapshot: 80 },
  { date: '2026-04-06', used: 520, committed: 500, burst: 20, data: 440, snapshot: 80 },
  { date: '2026-04-07', used: 522, committed: 500, burst: 22, data: 442, snapshot: 80 },
  { date: '2026-04-08', used: 525, committed: 500, burst: 25, data: 445, snapshot: 80 },
  { date: '2026-04-09', used: 528, committed: 500, burst: 28, data: 448, snapshot: 80 },
];

/** Daily consumption trend, timeline-shifted so the last point always lands on "today". */
export const consumptionTrendData = rawConsumptionTrendData.map((row) => ({
  ...row,
  date: shiftIsoDate(row.date),
}));

// Export as mockConsumptionTrend for compatibility
export const mockConsumptionTrend = consumptionTrendData;

/** Shape of each row in consumption / billing trend charts (`burst` = accrued burst billable TiB). */
export type ConsumptionTrendPoint = (typeof consumptionTrendData)[number];

/**
 * Scale the template curve so the last point matches `subscription.currentUsage` and committed = `subscription.committed`.
 * `burst` on each row is accrued burst: max(0, used − committed).
 */
export function scaleConsumptionTrendForSubscription(subscription: Subscription): ConsumptionTrendPoint[] {
  const committed = Math.max(1, subscription.committed);
  const targetUseEnd = Math.max(0, subscription.currentUsage);
  const template = consumptionTrendData;
  const uLast = template[template.length - 1]?.used ?? 1;
  const scaleUse = uLast > 0 ? targetUseEnd / uLast : 1;

  return template.map((row) => {
    const used = Math.round(row.used * scaleUse * 10) / 10;
    const accruedBurst = Math.max(0, Math.round((used - committed) * 10) / 10);
    const fracData = row.used > 0 ? row.data / row.used : 0.85;
    const data = Math.round(used * fracData * 10) / 10;
    const snapshot = Math.round((used - data) * 10) / 10;
    return {
      date: row.date,
      used,
      committed,
      burst: accruedBurst,
      data,
      snapshot,
    };
  });
}

/** Per-day series for one service level (Consumption trend — historical view). */
export type ServiceLevelHistoricalPoint = {
  date: string;
  committed: number;
  /** committed + included 20% headroom (ceiling before “above burst” band) */
  burstCapacityTop: number;
  used: number;
  data: number;
  snapshot: number;
  accruedBurst: number;
  isForecast?: boolean;
};

/**
 * Historical consumption trend for a single service level: scales subscription curve by this level’s share of total used.
 */
export function buildHistoricalTrendForServiceLevel(
  subscription: Subscription,
  levelName: string,
): ServiceLevelHistoricalPoint[] {
  const b = subscription.serviceLevelBreakdown.find((x) => x.level === levelName);
  if (!b) return [];
  const subSeries = scaleConsumptionTrendForSubscription(subscription);
  const levelUsedTarget = usedTibFromBreakdownRow(b);
  const totalUsedTarget = Math.max(0.0001, subscription.currentUsage);
  const share = Math.min(1, Math.max(0, levelUsedTarget / totalUsedTarget));

  const committed = b.committed;
  const burstCapacityTop = Math.round((committed + includedBurstHeadroomTib(committed)) * 10) / 10;
  const den = b.data + b.snapshot;
  const fracData = den > 0 ? b.data / den : 0.85;

  return subSeries.map((row) => {
    const used = Math.round(row.used * share * 10) / 10;
    const data = Math.round(used * fracData * 10) / 10;
    const snapshot = Math.round((used - data) * 10) / 10;
    const accruedBurst = Math.max(0, Math.round((used - committed) * 10) / 10);
    return {
      date: row.date,
      committed,
      burstCapacityTop,
      used,
      data,
      snapshot,
      accruedBurst,
    };
  });
}

/**
 * Continuous pre/post-merge consumption trend for a service level — only meaningful for a
 * subscription that absorbed another via a merger (`mergedFrom`). For dates before the merge event,
 * splices in the merged-away subscription's own historical points for that level (its real,
 * independently-anchored usage); for dates on/after the merge, uses this subscription's own points
 * (which already include the merged capacity). Returns `null` when there's no applicable merge or the
 * merged-away subscription never had this level, so callers can hide the "include history" toggle.
 */
export function buildStitchedHistoricalTrendForServiceLevel(
  subscription: Subscription,
  levelName: string,
): ServiceLevelHistoricalPoint[] | null {
  const merge = subscription.mergedFrom?.[0];
  if (!merge) return null;
  const oldSub = getSubscriptionById(merge.subscriptionId);
  if (!oldSub) return null;

  const oldHist = buildHistoricalTrendForServiceLevel(oldSub, levelName);
  if (oldHist.length === 0) return null;
  const newHist = buildHistoricalTrendForServiceLevel(subscription, levelName);
  const oldByDate = new Map(oldHist.map((row) => [row.date, row]));

  return newHist.map((row) => (row.date < merge.date ? oldByDate.get(row.date) ?? row : row));
}

export type AccruedBurstDailyRow = {
  timestampUtc: string;
  committed: number;
  consumed: number;
  accruedBurst: number;
};

export function buildAccruedDailyRowsForServiceLevel(
  subscription: Subscription,
  levelName: string,
): AccruedBurstDailyRow[] {
  return buildHistoricalTrendForServiceLevel(subscription, levelName).map((row) => ({
    timestampUtc: `${row.date}T12:00:00.000Z`,
    committed: row.committed,
    consumed: row.used,
    accruedBurst: row.accruedBurst,
  }));
}

export type AccruedBurstMonthlyRow = {
  monthKey: string;
  label: string;
  /** Month closed & invoiced (mutually exclusive with uninvoiced for past months) */
  invoiced: number;
  /** Month closed, metering final, not yet invoiced (typically the month immediately before as-of) */
  uninvoiced: number;
  /** In-progress current month — accrued to date (MTD) */
  provisional: number;
  /** Predicted remainder of current month (with forecast on) OR pure future months */
  forecast: number;
  hasAlert: boolean;
};

function formatMonthKeyShort(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function prevCalendarMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (m <= 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Scale tiny accrued values so bars are readable in the prototype (TiB). */
function displayAccruedBurstTiB(accrued: number): number {
  if (accrued <= 0) return 0;
  return Math.round(Math.max(accrued * 8, accrued + 1.5) * 10) / 10;
}

/**
 * Monthly accrued burst bars — **one billing status per past month** (invoiced XOR uninvoiced).
 * **Current as-of month**: `provisional` = MTD accrued; optional `forecast` = predicted remainder when enabled.
 * **Future months** (when `extraForecastMonths` > 0): `forecast` only.
 */
export function buildAccruedMonthlyBucketsForServiceLevel(
  subscription: Subscription,
  levelName: string,
  options?: { extraForecastMonths?: number; addCurrentMonthForecast?: boolean },
): AccruedBurstMonthlyRow[] {
  const hist = buildHistoricalTrendForServiceLevel(subscription, levelName);
  if (hist.length === 0) return [];

  const asOfDate = hist[hist.length - 1].date;
  const asOfYM = asOfDate.slice(0, 7);
  const lastClosedYM = prevCalendarMonthKey(asOfYM);

  const lastInMonth = new Map<string, ServiceLevelHistoricalPoint>();
  for (const row of hist) {
    const mk = row.date.slice(0, 7);
    lastInMonth.set(mk, row);
  }
  const sortedKeys = Array.from(lastInMonth.keys()).sort();

  const rows: AccruedBurstMonthlyRow[] = sortedKeys.map((monthKey) => {
    const closing = lastInMonth.get(monthKey)!;
    const mtdTiB = Math.max(0, closing.accruedBurst);
    const barTiB = displayAccruedBurstTiB(mtdTiB);

    let h = 0;
    const seed = monthKey + levelName;
    for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;

    if (monthKey === asOfYM) {
      const addFc = options?.addCurrentMonthForecast ?? false;
      const provisional = barTiB;
      const forecast =
        addFc && barTiB > 0
          ? Math.round(barTiB * 0.5 * 10) / 10
          : addFc && barTiB === 0
            ? Math.round((2 + (h % 5)) * 10) / 10
            : 0;
      return {
        monthKey,
        label: formatMonthKeyShort(monthKey),
        invoiced: 0,
        uninvoiced: 0,
        provisional,
        forecast,
        hasAlert: h % 17 === 0 && (provisional > 0 || forecast > 0),
      };
    }

    if (monthKey < asOfYM) {
      const isLastClosed = monthKey === lastClosedYM;
      const amount = barTiB;
      return {
        monthKey,
        label: formatMonthKeyShort(monthKey),
        invoiced: isLastClosed ? 0 : amount,
        uninvoiced: isLastClosed ? amount : 0,
        provisional: 0,
        forecast: 0,
        hasAlert: h % 13 === 0 && amount > 5,
      };
    }

    return {
      monthKey,
      label: formatMonthKeyShort(monthKey),
      invoiced: 0,
      uninvoiced: 0,
      provisional: 0,
      forecast: barTiB,
      hasAlert: false,
    };
  });

  const extra = options?.extraForecastMonths ?? 0;
  if (extra > 0) {
    let yy: number;
    let mm: number;
    const lastRow = rows[rows.length - 1];
    if (lastRow) {
      const [y, m] = lastRow.monthKey.split('-').map(Number);
      yy = y;
      mm = m + 1;
      if (mm > 12) {
        mm = 1;
        yy += 1;
      }
    } else {
      const [y, m] = asOfYM.split('-').map(Number);
      yy = y;
      mm = m + 1;
      if (mm > 12) {
        mm = 1;
        yy += 1;
      }
    }

    const cur = rows.find((r) => r.monthKey === asOfYM);
    const refForecast =
      cur != null
        ? Math.max(Math.round((cur.provisional + cur.forecast) * 10) / 10, 0.5)
        : (rows.filter((r) => r.forecast > 0).pop()?.forecast ?? 8);

    for (let i = 0; i < extra; i++) {
      const mk = `${yy}-${String(mm).padStart(2, '0')}`;
      const forecastVal = Math.max(0, Math.round(refForecast * (0.92 - i * 0.06) * 10) / 10);
      rows.push({
        monthKey: mk,
        label: formatMonthKeyShort(mk),
        invoiced: 0,
        uninvoiced: 0,
        provisional: 0,
        forecast: forecastVal,
        hasAlert: false,
      });
      mm += 1;
      if (mm > 12) {
        mm = 1;
        yy += 1;
      }
    }
  }

  return rows;
}

/** Daily W/TiB sample for sustainability (power) SLA chart */
export interface SustainabilityPowerPoint {
  label: string;
  wPerTib: number;
  /** Optional copy for breach tooltips */
  validationDetail?: string;
}

/** Power + capacity snapshot per Keystone service level (subscription → service level → SLA) */
export interface SustainabilityServiceLevelPower {
  levelKey: string;
  displayName: string;
  compliance: 'compliant' | 'breached';
  committedTib: number;
  minTib: number;
  deployedTib: number;
  deployedPctLabel: string;
  allocatedPowerW: number;
  powerPctOfTotal: number;
  slaLimitWPerTib: number;
  varianceWPerTib: number;
  variancePct: number;
  currentWPerTib: number;
  history: SustainabilityPowerPoint[];
}

const extremePowerHistory: SustainabilityPowerPoint[] = [
  { label: 'Mar 1', wPerTib: 5.1 },
  { label: 'Mar 3', wPerTib: 5.35 },
  { label: 'Mar 5', wPerTib: 5.8 },
  { label: 'Mar 7', wPerTib: 6.15 },
  { label: 'Mar 9', wPerTib: 6.55 },
  { label: 'Mar 11', wPerTib: 6.95 },
  { label: 'Mar 13', wPerTib: 7.35 },
  { label: 'Mar 15', wPerTib: 7.72 },
  { label: 'Mar 16', wPerTib: 7.68 },
  {
    label: 'Mar 17',
    wPerTib: 8.12,
    validationDetail:
      'Rolling 24h average exceeded Extreme SLA (8 W/TiB). Correlated with burst tier activity on svm-prod-east.',
  },
  { label: 'Mar 18', wPerTib: 7.74 },
  { label: 'Mar 19', wPerTib: 7.81 },
  { label: 'Mar 20', wPerTib: 7.86 },
  { label: 'Mar 21', wPerTib: 7.76 },
  { label: 'Mar 22', wPerTib: 7.83 },
  {
    label: 'Mar 23',
    wPerTib: 8.42,
    validationDetail: 'Peak interval breach during backup window (02:00–05:00 UTC).',
  },
  { label: 'Mar 24', wPerTib: 7.79 },
  { label: 'Mar 25', wPerTib: 7.88 },
  {
    label: 'Mar 26',
    wPerTib: 8.55,
    validationDetail: 'W/TiB above SLA; workload mix shifted toward small-file random I/O.',
  },
  { label: 'Mar 27', wPerTib: 7.91 },
  { label: 'Mar 28', wPerTib: 7.94 },
  {
    label: 'Mar 29',
    wPerTib: 8.68,
    validationDetail: 'Fourth validated breach interval in the 30-day window.',
  },
  { label: 'Mar 30', wPerTib: 7.9 },
  { label: 'Mar 31', wPerTib: 7.85 },
  { label: 'Apr 1', wPerTib: 7.92 },
  { label: 'Apr 2', wPerTib: 7.96 },
  {
    label: 'Apr 4',
    wPerTib: 9.2,
    validationDetail:
      'Sustained elevation vs committed power envelope; fifth breach sample in window—eligible for SLA review per subscription terms.',
  },
];

const premiumPowerHistory: SustainabilityPowerPoint[] = [
  { label: 'Mar 1', wPerTib: 3.25 },
  { label: 'Mar 4', wPerTib: 3.32 },
  { label: 'Mar 7', wPerTib: 3.38 },
  { label: 'Mar 10', wPerTib: 3.45 },
  { label: 'Mar 13', wPerTib: 3.52 },
  { label: 'Mar 16', wPerTib: 3.55 },
  { label: 'Mar 19', wPerTib: 3.58 },
  { label: 'Mar 22', wPerTib: 3.6 },
  { label: 'Mar 25', wPerTib: 3.58 },
  { label: 'Mar 28', wPerTib: 3.62 },
  { label: 'Mar 31', wPerTib: 3.59 },
  { label: 'Apr 4', wPerTib: 3.6 },
];

const standardPowerHistory: SustainabilityPowerPoint[] = [
  { label: 'Mar 1', wPerTib: 4.9 },
  { label: 'Mar 8', wPerTib: 5.05 },
  { label: 'Mar 15', wPerTib: 5.15 },
  { label: 'Mar 22', wPerTib: 5.22 },
  { label: 'Mar 29', wPerTib: 5.18 },
  { label: 'Apr 4', wPerTib: 5.2 },
];

const performancePowerHistory: SustainabilityPowerPoint[] = [
  { label: 'Mar 1', wPerTib: 6.0 },
  { label: 'Mar 8', wPerTib: 6.25 },
  { label: 'Mar 15', wPerTib: 6.45 },
  { label: 'Mar 22', wPerTib: 6.55 },
  { label: 'Mar 29', wPerTib: 6.62 },
  { label: 'Apr 4', wPerTib: 6.7 },
];

const valuePowerHistory: SustainabilityPowerPoint[] = [
  { label: 'Mar 1', wPerTib: 4.6 },
  { label: 'Mar 8', wPerTib: 4.72 },
  { label: 'Mar 15', wPerTib: 4.85 },
  { label: 'Mar 22', wPerTib: 4.9 },
  { label: 'Mar 29', wPerTib: 4.88 },
  { label: 'Apr 4', wPerTib: 4.92 },
];

/** Shifts a chart-axis history array's `label` fields ("Mon D") so the window ends near "today". */
function shiftPowerHistory(history: SustainabilityPowerPoint[]): SustainabilityPowerPoint[] {
  return history.map((row) => ({ ...row, label: shiftMonthDayLabel(row.label) }));
}

/** Baseline templates keyed by lowercase service level name (matches `subscription.serviceLevels`) */
const sustainabilityPowerTemplatesByKey: Record<string, SustainabilityServiceLevelPower> = {
  extreme: {
    levelKey: 'extreme',
    displayName: 'Extreme',
    compliance: 'breached',
    committedTib: 100,
    minTib: 200,
    deployedTib: 100,
    deployedPctLabel: '100% of committed',
    allocatedPowerW: 920,
    powerPctOfTotal: 63.0,
    slaLimitWPerTib: 8,
    varianceWPerTib: 1.2,
    variancePct: 15.0,
    currentWPerTib: 9.2,
    history: shiftPowerHistory(extremePowerHistory),
  },
  premium: {
    levelKey: 'premium',
    displayName: 'Premium',
    compliance: 'compliant',
    committedTib: 150,
    minTib: 300,
    deployedTib: 150,
    deployedPctLabel: '100% of committed',
    allocatedPowerW: 540,
    powerPctOfTotal: 37.0,
    slaLimitWPerTib: 4,
    varianceWPerTib: -0.4,
    variancePct: -10.0,
    currentWPerTib: 3.6,
    history: shiftPowerHistory(premiumPowerHistory),
  },
  standard: {
    levelKey: 'standard',
    displayName: 'Standard',
    compliance: 'compliant',
    committedTib: 50,
    minTib: 100,
    deployedTib: 50,
    deployedPctLabel: '100% of committed',
    allocatedPowerW: 220,
    powerPctOfTotal: 25.0,
    slaLimitWPerTib: 6,
    varianceWPerTib: -0.35,
    variancePct: -6.0,
    currentWPerTib: 5.2,
    history: shiftPowerHistory(standardPowerHistory),
  },
  performance: {
    levelKey: 'performance',
    displayName: 'Performance',
    compliance: 'compliant',
    committedTib: 80,
    minTib: 160,
    deployedTib: 80,
    deployedPctLabel: '100% of committed',
    allocatedPowerW: 380,
    powerPctOfTotal: 35.0,
    slaLimitWPerTib: 7,
    varianceWPerTib: -0.25,
    variancePct: -3.5,
    currentWPerTib: 6.7,
    history: shiftPowerHistory(performancePowerHistory),
  },
  value: {
    levelKey: 'value',
    displayName: 'Value',
    compliance: 'compliant',
    committedTib: 40,
    minTib: 80,
    deployedTib: 40,
    deployedPctLabel: '100% of committed',
    allocatedPowerW: 160,
    powerPctOfTotal: 20.0,
    slaLimitWPerTib: 5.5,
    varianceWPerTib: -0.2,
    variancePct: -4.0,
    currentWPerTib: 4.92,
    history: shiftPowerHistory(valuePowerHistory),
  },
};

function applySubscriptionBreakdownToSustainabilityTemplate(
  template: SustainabilityServiceLevelPower,
  levelNameFromSubscription: string,
  breakdown: ServiceLevelBreakdown | undefined,
): SustainabilityServiceLevelPower {
  const committed = breakdown?.committed ?? template.committedTib;
  const used = breakdown ? usedTibFromBreakdownRow(breakdown) : committed;
  const deployed = Math.min(committed, Math.round(used * 10) / 10);
  const ratio = template.committedTib > 0 ? committed / template.committedTib : 1;
  const allocatedPowerW = Math.max(1, Math.round(template.allocatedPowerW * ratio));
  const minTib = Math.round(committed * 2);
  const deployedPct = committed > 0 ? Math.round((deployed / committed) * 100) : 100;
  return {
    ...template,
    displayName: levelNameFromSubscription,
    levelKey: template.levelKey,
    committedTib: committed,
    deployedTib: deployed,
    deployedPctLabel: `${deployedPct}% of committed`,
    minTib,
    allocatedPowerW,
    powerPctOfTotal: 0,
  };
}

/** Power SLA cards + chart data for the service levels on a subscription (order matches `subscription.serviceLevels`). */
export function buildSustainabilityPowerForSubscription(subscription: Subscription): SustainabilityServiceLevelPower[] {
  const list: SustainabilityServiceLevelPower[] = [];
  for (const levelName of subscription.serviceLevels) {
    const key = levelName.toLowerCase();
    const template = sustainabilityPowerTemplatesByKey[key];
    if (!template) continue;
    const breakdown = subscription.serviceLevelBreakdown.find((b) => b.level === levelName);
    list.push(applySubscriptionBreakdownToSustainabilityTemplate(template, levelName, breakdown));
  }
  const totalPower = list.reduce((s, l) => s + l.allocatedPowerW, 0);
  for (const row of list) {
    row.powerPctOfTotal = totalPower > 0 ? Math.round((row.allocatedPowerW / totalPower) * 1000) / 10 : 0;
  }
  return list;
}

/** Daily measured 90th-percentile latency (ms) for performance SLA chart */
export interface PerformanceLatencyPoint {
  label: string;
  p90Ms: number;
  validationDetail?: string;
}

/** Latency SLA row per Keystone service level (ONTAP P90 targets; Object has no latency SLA) */
export interface PerformanceServiceLevelLatency {
  levelKey: string;
  displayName: string;
  platform: 'ONTAP' | 'StorageGRID';
  /** Target P90 latency in ms; `null` = not applicable */
  slaP90Ms: number | null;
  history: PerformanceLatencyPoint[];
  compliance: 'compliant' | 'breached' | 'n/a';
  currentP90Ms: number;
  breachDayCount: number;
}

const extremeLatencyHistory: PerformanceLatencyPoint[] = [
  { label: 'Mar 1', p90Ms: 0.58 },
  { label: 'Mar 3', p90Ms: 0.62 },
  { label: 'Mar 5', p90Ms: 0.71 },
  { label: 'Mar 7', p90Ms: 0.68 },
  { label: 'Mar 9', p90Ms: 0.75 },
  { label: 'Mar 11', p90Ms: 0.82 },
  { label: 'Mar 13', p90Ms: 0.79 },
  { label: 'Mar 15', p90Ms: 0.88 },
  {
    label: 'Mar 17',
    p90Ms: 1.12,
    validationDetail: 'Daily P90 latency exceeded Extreme target (< 1 ms). Elevated NFS metadata path on svm-prod-east.',
  },
  { label: 'Mar 18', p90Ms: 0.77 },
  { label: 'Mar 19', p90Ms: 0.84 },
  {
    label: 'Mar 21',
    p90Ms: 1.08,
    validationDetail: 'Second breach in window—correlated with backup fan-in during maintenance.',
  },
  { label: 'Mar 23', p90Ms: 0.91 },
  { label: 'Mar 25', p90Ms: 0.86 },
  { label: 'Mar 27', p90Ms: 0.93 },
  { label: 'Mar 29', p90Ms: 0.89 },
  { label: 'Mar 31', p90Ms: 0.95 },
  { label: 'Apr 2', p90Ms: 0.98 },
  { label: 'Apr 4', p90Ms: 0.94 },
];

const premiumLatencyHistory: PerformanceLatencyPoint[] = [
  { label: 'Mar 1', p90Ms: 1.15 },
  { label: 'Mar 5', p90Ms: 1.28 },
  { label: 'Mar 9', p90Ms: 1.35 },
  { label: 'Mar 13', p90Ms: 1.42 },
  { label: 'Mar 17', p90Ms: 1.55 },
  { label: 'Mar 21', p90Ms: 1.62 },
  {
    label: 'Mar 25',
    p90Ms: 2.18,
    validationDetail: 'P90 exceeded Premium target (< 2 ms) during synchronous mirror catch-up.',
  },
  { label: 'Mar 29', p90Ms: 1.71 },
  { label: 'Apr 4', p90Ms: 1.58 },
];

const performanceLevelLatencyHistory: PerformanceLatencyPoint[] = [
  { label: 'Mar 1', p90Ms: 2.4 },
  { label: 'Mar 5', p90Ms: 2.55 },
  { label: 'Mar 9', p90Ms: 2.72 },
  { label: 'Mar 13', p90Ms: 2.88 },
  { label: 'Mar 17', p90Ms: 3.05 },
  { label: 'Mar 21', p90Ms: 3.12 },
  { label: 'Mar 25', p90Ms: 3.28 },
  { label: 'Mar 29', p90Ms: 3.35 },
  { label: 'Apr 4', p90Ms: 3.22 },
];

const standardLatencyHistory: PerformanceLatencyPoint[] = [
  { label: 'Mar 1', p90Ms: 3.1 },
  { label: 'Mar 5', p90Ms: 3.25 },
  { label: 'Mar 9', p90Ms: 3.42 },
  { label: 'Mar 13', p90Ms: 3.58 },
  { label: 'Mar 17', p90Ms: 3.35},
  { label: 'Mar 21', p90Ms: 3.72 },
  { label: 'Mar 25', p90Ms: 3.88 },
  { label: 'Mar 29', p90Ms: 3.65 },
  { label: 'Apr 4', p90Ms: 3.78 },
];

const valueLatencyHistory: PerformanceLatencyPoint[] = [
  { label: 'Mar 1', p90Ms: 9.2 },
  { label: 'Mar 8', p90Ms: 10.5 },
  { label: 'Mar 15', p90Ms: 11.8 },
  { label: 'Mar 22', p90Ms: 12.4 },
  { label: 'Mar 29', p90Ms: 13.1 },
  { label: 'Apr 4', p90Ms: 12.6 },
];

type PerformanceLatencyTemplate = {
  levelKey: string;
  platform: 'ONTAP' | 'StorageGRID';
  slaP90Ms: number | null;
  history: PerformanceLatencyPoint[];
};

/** Shifts a chart-axis history array's `label` fields ("Mon D") so the window ends near "today". */
function shiftLatencyHistory(history: PerformanceLatencyPoint[]): PerformanceLatencyPoint[] {
  return history.map((row) => ({ ...row, label: shiftMonthDayLabel(row.label) }));
}

const performanceLatencyTemplatesByKey: Record<string, PerformanceLatencyTemplate> = {
  extreme: { levelKey: 'extreme', platform: 'ONTAP', slaP90Ms: 1, history: shiftLatencyHistory(extremeLatencyHistory) },
  premium: { levelKey: 'premium', platform: 'ONTAP', slaP90Ms: 2, history: shiftLatencyHistory(premiumLatencyHistory) },
  performance: {
    levelKey: 'performance',
    platform: 'ONTAP',
    slaP90Ms: 4,
    history: shiftLatencyHistory(performanceLevelLatencyHistory),
  },
  standard: { levelKey: 'standard', platform: 'ONTAP', slaP90Ms: 4, history: shiftLatencyHistory(standardLatencyHistory) },
  value: { levelKey: 'value', platform: 'ONTAP', slaP90Ms: 17, history: shiftLatencyHistory(valueLatencyHistory) },
  object: { levelKey: 'object', platform: 'StorageGRID', slaP90Ms: null, history: [] },
  s3: { levelKey: 'object', platform: 'StorageGRID', slaP90Ms: null, history: [] },
};

function finalizePerformanceLatencyRow(
  template: PerformanceLatencyTemplate,
  displayName: string,
): PerformanceServiceLevelLatency {
  if (template.slaP90Ms == null) {
    return {
      levelKey: template.levelKey,
      displayName,
      platform: template.platform,
      slaP90Ms: null,
      history: [],
      compliance: 'n/a',
      currentP90Ms: 0,
      breachDayCount: 0,
    };
  }
  const sla = template.slaP90Ms;
  const breachDayCount = template.history.filter((p) => p.p90Ms >= sla).length;
  const last = template.history[template.history.length - 1];
  return {
    levelKey: template.levelKey,
    displayName,
    platform: template.platform,
    slaP90Ms: sla,
    history: template.history,
    breachDayCount,
    currentP90Ms: last?.p90Ms ?? 0,
    compliance: breachDayCount > 0 ? 'breached' : 'compliant',
  };
}

/** P90 latency SLA view for service levels on a subscription (order matches `subscription.serviceLevels`). */
export function buildPerformanceLatencyForSubscription(subscription: Subscription): PerformanceServiceLevelLatency[] {
  const list: PerformanceServiceLevelLatency[] = [];
  for (const levelName of subscription.serviceLevels) {
    const key = levelName.toLowerCase();
    const template = performanceLatencyTemplatesByKey[key];
    if (!template) continue;
    list.push(finalizePerformanceLatencyRow(template, levelName));
  }
  return list;
}

/** ONTAP File & Block STaaS availability SLO (five nines), monthly basis */
export const ONTAP_AVAILABILITY_SLO_PCT = 99.999;

/** One calendar day: average storage-array uptime % (prototype — monitoring tool aggregation) */
export interface AvailabilityDayPoint {
  dayOfMonth: number;
  label: string;
  /** Daily uptime % after averaging arrays for that day */
  uptimePct: number;
  /** Both-controller downtime contributing to that day (seconds), exclusions applied in production */
  downtimeSeconds: number;
}

export interface AvailabilityDowntimeIncident {
  occurredAt: string;
  durationMinutes: number;
  summary: string;
  excluded: boolean;
}

/** Per service level: monthly rollup + daily heatmap inputs */
export interface AvailabilityServiceLevel {
  levelKey: string;
  displayName: string;
  platform: 'ONTAP' | 'StorageGRID';
  /** SLO % for ONTAP; null for Object */
  sloUptimePct: number | null;
  storageArrayCount: number;
  monthLabel: string;
  secondsInMonth: number;
  /** Max downtime (seconds) still compatible with SLO for this month */
  maxDowntimeSecondsAllowed: number;
  /** Sum of qualifying downtime seconds in month (prototype) */
  totalDowntimeSecondsMonth: number;
  /** (c) STaaS order uptime — average of storage array uptime % for the month */
  orderUptimePct: number;
  daily: AvailabilityDayPoint[];
  compliance: 'compliant' | 'breached' | 'n/a';
  daysWithDowntime: number;
  incidents: AvailabilityDowntimeIncident[];
}

/** Short month name of the current SLA tracking month (always `PLATFORM_REFERENCE_DATE`'s month). */
function currentAvailabilityMonthShort(): string {
  return PLATFORM_REFERENCE_DATE.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

/** Long "Month Year" label for the current SLA tracking month. */
function currentAvailabilityMonthLabel(): string {
  return PLATFORM_REFERENCE_DATE.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function buildAvailabilityMonthDays(downtimePerDay: number[]): AvailabilityDayPoint[] {
  const secDay = 86400;
  const monthShort = currentAvailabilityMonthShort();
  return downtimePerDay.map((down, i) => {
    const dayOfMonth = i + 1;
    const uptimePct = ((secDay - down) / secDay) * 100;
    return {
      dayOfMonth,
      label: `${monthShort} ${dayOfMonth}`,
      uptimePct,
      downtimeSeconds: down,
    };
  });
}

/** Re-dates a `YYYY-MM-DD ...` incident timestamp onto the current SLA tracking month, keeping the same day-of-month and time-of-day. */
function toCurrentAvailabilityMonthTimestamp(original: string): string {
  const match = /^\d{4}-\d{2}-(\d{2})(.*)$/.exec(original);
  if (!match) return original;
  const [, day, rest] = match;
  const y = PLATFORM_REFERENCE_DATE.getUTCFullYear();
  const m = String(PLATFORM_REFERENCE_DATE.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${day}${rest}`;
}

function rollupAvailabilityMonth(
  daily: AvailabilityDayPoint[],
  secondsInMonth: number,
  slo: number,
): {
  totalDowntimeSecondsMonth: number;
  orderUptimePct: number;
  compliance: 'compliant' | 'breached';
  daysWithDowntime: number;
} {
  const totalDowntimeSecondsMonth = daily.reduce((s, d) => s + d.downtimeSeconds, 0);
  const orderUptimePct = ((secondsInMonth - totalDowntimeSecondsMonth) / secondsInMonth) * 100;
  const maxDown = secondsInMonth * (1 - slo / 100);
  const compliance = orderUptimePct >= slo ? 'compliant' : 'breached';
  const daysWithDowntime = daily.filter((d) => d.downtimeSeconds > 0).length;
  return { totalDowntimeSecondsMonth, orderUptimePct, compliance, daysWithDowntime };
}

type AvailabilityTemplateCore = {
  levelKey: string;
  downtimePerDay30: number[];
  incidents: AvailabilityDowntimeIncident[];
};

const availabilityOntapTemplatesByKey: Record<string, AvailabilityTemplateCore> = {
  extreme: {
    levelKey: 'extreme',
    downtimePerDay30: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    incidents: [
      {
        occurredAt: toCurrentAvailabilityMonthTimestamp('2026-04-12 03:18 UTC'),
        durationMinutes: 1,
        summary: 'HA pair both controllers unavailable — monitoring tool; auto-failover completed.',
        excluded: false,
      },
    ],
  },
  premium: {
    levelKey: 'premium',
    downtimePerDay30: Array(30).fill(0),
    incidents: [],
  },
  performance: {
    levelKey: 'performance',
    downtimePerDay30: [
      0, 0, 0, 0, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    incidents: [
      {
        occurredAt: toCurrentAvailabilityMonthTimestamp('2026-04-05 14:22 UTC'),
        durationMinutes: 1,
        summary: 'Brief dual-controller event (within monthly SLO budget after array average).',
        excluded: false,
      },
    ],
  },
  standard: {
    levelKey: 'standard',
    downtimePerDay30: [
      0, 0, 0, 0, 180, 0, 0, 0, 0, 0, 0, 90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    incidents: [
      {
        occurredAt: toCurrentAvailabilityMonthTimestamp('2026-04-05 09:10 UTC'),
        durationMinutes: 3,
        summary: 'Array pair unreachable during firmware prep — counted toward SLO.',
        excluded: false,
      },
      {
        occurredAt: toCurrentAvailabilityMonthTimestamp('2026-04-12 11:40 UTC'),
        durationMinutes: 2,
        summary: 'Secondary path loss; both nodes briefly unavailable.',
        excluded: false,
      },
      {
        occurredAt: toCurrentAvailabilityMonthTimestamp('2026-04-22 16:05 UTC'),
        durationMinutes: 2,
        summary: 'Planned RMA handoff — mutually agreed; excluded from SLO clock.',
        excluded: true,
      },
    ],
  },
  value: {
    levelKey: 'value',
    downtimePerDay30: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    incidents: [],
  },
};

function finalizeAvailabilityRow(
  core: AvailabilityTemplateCore,
  displayName: string,
  storageArrayCount: number,
): AvailabilityServiceLevel {
  const slo = ONTAP_AVAILABILITY_SLO_PCT;
  const daily = buildAvailabilityMonthDays(core.downtimePerDay30);
  const secondsInMonth = 30 * 86400;
  const maxDowntimeSecondsAllowed = secondsInMonth * (1 - slo / 100);
  const rolled = rollupAvailabilityMonth(daily, secondsInMonth, slo);
  return {
    levelKey: core.levelKey,
    displayName,
    platform: 'ONTAP',
    sloUptimePct: slo,
    storageArrayCount,
    monthLabel: currentAvailabilityMonthLabel(),
    secondsInMonth,
    maxDowntimeSecondsAllowed,
    totalDowntimeSecondsMonth: rolled.totalDowntimeSecondsMonth,
    orderUptimePct: rolled.orderUptimePct,
    daily,
    compliance: rolled.compliance,
    daysWithDowntime: rolled.daysWithDowntime,
    incidents: core.incidents,
  };
}

const availabilityObjectPlaceholder: AvailabilityServiceLevel = {
  levelKey: 'object',
  displayName: 'Object',
  platform: 'StorageGRID',
  sloUptimePct: null,
  storageArrayCount: 0,
  monthLabel: currentAvailabilityMonthLabel(),
  secondsInMonth: 30 * 86400,
  maxDowntimeSecondsAllowed: 0,
  totalDowntimeSecondsMonth: 0,
  orderUptimePct: 0,
  daily: [],
  compliance: 'n/a',
  daysWithDowntime: 0,
  incidents: [],
};

/** Availability SLO + daily heatmap rows for subscription service levels */
export function buildAvailabilityForSubscription(subscription: Subscription): AvailabilityServiceLevel[] {
  const list: AvailabilityServiceLevel[] = [];
  for (const levelName of subscription.serviceLevels) {
    const key = levelName.toLowerCase();
    if (key === 'object' || key === 's3') {
      list.push({ ...availabilityObjectPlaceholder, displayName: levelName });
      continue;
    }
    const core = availabilityOntapTemplatesByKey[key];
    if (!core) continue;
    const breakdown = subscription.serviceLevelBreakdown.find((b) => b.level === levelName);
    const committed = breakdown?.committed ?? 100;
    const storageArrayCount = Math.max(2, Math.min(8, Math.round(committed / 45 + 1)));
    list.push(finalizeAvailabilityRow(core, levelName, storageArrayCount));
  }
  return list;
}

export interface Recommendation {
  id: string;
  /** Internal subscription key; matches `Subscription.id`. */
  subscriptionId: string;
  category: 'renew' | 'upgrade' | 'security' | 'capacity' | 'performance' | 'collector';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  /** `SubscriptionDetail` Radix tab value (e.g. billing, volumes). */
  actionSubscriptionTab: string;
  /** `ConsoleSubscriptionDetail` `activeTab` id. */
  actionConsoleTab: string;
}

export const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-001',
    subscriptionId: '1789858600',
    category: 'renew',
    title: 'Subscription 1789858600 expires in 39 days',
    description: 'Renew subscription to avoid service interruption. Current usage trends suggest maintaining current capacity levels.',
    impact: 'high',
    urgency: 'high',
    effort: 'low',
    actionSubscriptionTab: 'billing',
    actionConsoleTab: 'billing',
  },
  {
    id: 'rec-002',
    subscriptionId: '1789858601',
    category: 'renew',
    title: 'Subscription 1789858601 expires in 56 days',
    description: 'Renew subscription and consider capacity upgrade based on consistent burst usage patterns.',
    impact: 'high',
    urgency: 'high',
    effort: 'low',
    actionSubscriptionTab: 'billing',
    actionConsoleTab: 'billing',
  },
  {
    id: 'rec-003',
    subscriptionId: '1789858603',
    category: 'renew',
    title: 'Subscription 1789858603 expires in 85 days',
    description: 'Renew subscription to avoid service interruption. Address collector offline status before renewal.',
    impact: 'high',
    urgency: 'high',
    effort: 'low',
    actionSubscriptionTab: 'billing',
    actionConsoleTab: 'billing',
  },
  {
    id: 'rec-004',
    subscriptionId: '1789858600',
    category: 'security',
    title: 'ONTAP firmware update available',
    description: 'Critical security patches available for 3 storage systems. Update recommended within 30 days.',
    impact: 'high',
    urgency: 'critical',
    effort: 'medium',
    actionSubscriptionTab: 'support',
    actionConsoleTab: 'sla',
  },
  {
    id: 'rec-005',
    subscriptionId: '1789858600',
    category: 'capacity',
    title: 'Optimize snapshot retention on prod_database_01',
    description: 'Reduce snapshot retention period from 90 to 30 days to reclaim 45 TiB.',
    impact: 'medium',
    urgency: 'low',
    effort: 'low',
    actionSubscriptionTab: 'volumes',
    actionConsoleTab: 'volumes',
  },
  {
    id: 'rec-006',
    subscriptionId: '1789858601',
    category: 'performance',
    title: 'Add QoS policy to app_data_vol',
    description: 'High IOPS variance detected. Configure QoS to stabilize performance and meet SLA targets.',
    impact: 'medium',
    urgency: 'medium',
    effort: 'low',
    actionSubscriptionTab: 'sla',
    actionConsoleTab: 'sla',
  },
  {
    id: 'rec-007',
    subscriptionId: '1789858603',
    category: 'collector',
    title: 'Collector offline: collector-us-west-02',
    description: 'Billing data collection interrupted. Restart collector to resume metering.',
    impact: 'high',
    urgency: 'critical',
    effort: 'low',
    actionSubscriptionTab: 'collectors',
    actionConsoleTab: 'billing',
  },
];

export function getRecommendationsForSubscription(subscriptionId: string): Recommendation[] {
  return mockRecommendations.filter((r) => r.subscriptionId === subscriptionId);
}

export interface Invoice {
  id: string;
  period: string;
  committed: number;
  burstBilled: number;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  dueDate: string;
}

/** Monthly recurring cost per Keystone add-on (prototype rate card); drives Add-ons cost on every invoice. */
export const ADDON_MONTHLY_RATE_USD: Record<string, number> = {
  Backup: 3000,
  DR: 4500,
  FabricPool: 2000,
  'Anti-Ransomware': 2500,
  'SnapMirror Cloud': 3500,
  'Advanced Monitoring': 1500,
};

/** Sum of subscribed add-on rates (from `KEYSTONE_ADDON_CATALOG` / `subscription.addOns`). */
export function addOnsMonthlyCostForSubscription(subscription: Subscription): number {
  return subscription.addOns.reduce((sum, name) => sum + (ADDON_MONTHLY_RATE_USD[name] ?? 0), 0);
}

export interface ExtraLineItem {
  label: string;
  amount: number;
}

const EXTRA_LINE_ITEM_CATALOG: ExtraLineItem[] = [
  { label: 'Professional services', amount: 2500 },
  { label: 'Data migration assistance', amount: 1800 },
  { label: 'Expedited support', amount: 950 },
  { label: 'Snapshot restore assist', amount: 640 },
  { label: 'Capacity true-up adjustment', amount: 1690 },
];

/** Deterministic 0..1 hash so mock data stays stable across renders instead of using Math.random(). */
export function seededFraction(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (h % 10000) / 10000;
}

/** Occasional one-off billed items (professional services, migrations, etc.) — stable per subscription + period. */
function extraLineItemsFor(subscriptionId: string, periodKey: string): ExtraLineItem[] {
  const f = seededFraction(`${subscriptionId}-${periodKey}-extras`);
  if (f < 0.45) return [];
  const count = f < 0.8 ? 1 : 2;
  const items: ExtraLineItem[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(
      seededFraction(`${subscriptionId}-${periodKey}-extra-${i}`) * EXTRA_LINE_ITEM_CATALOG.length,
    );
    items.push(EXTRA_LINE_ITEM_CATALOG[idx]);
  }
  return items;
}

/** Prototype committed rate $/TiB by service level (Keystone: burst billed at the same rate). */
export const billingCommittedRatePerTibUsd: Record<string, number> = {
  extreme: 90,
  premium: 88,
  performance: 82,
  standard: 72,
  value: 62,
  object: 48,
  s3: 48,
};

export function billingRateForLevel(levelName: string): number {
  const k = levelName.toLowerCase();
  return billingCommittedRatePerTibUsd[k] ?? 80;
}

export interface InvoiceLineItem {
  serviceLevel: string;
  committedTib: number;
  ratePerTib: number;
  committedCost: number;
  burstTib: number;
  burstCost: number;
  subtotal: number;
}

/** Invoice with line items derived from subscription service level breakdown */
export interface SubscriptionInvoice extends Invoice {
  lineItems: InvoiceLineItem[];
  /** First day of the billing period (`YYYY-MM-DD`) — used for sorting/grouping across subscriptions. */
  periodDate: string;
  subscriptionId: string;
  addOnsCost: number;
  extraItems: ExtraLineItem[];
  extrasCost: number;
  /** PO covering this subscription during this period, if any (see `mockPurchaseOrders`). */
  purchaseOrderId: string | null;
  /** True when the customer has disputed this invoice (surfaces "Under Review" instead of "Ready for Payment"). */
  disputed: boolean;
  /** Support case tracking the dispute — set only when `disputed` is true (see `mockConsoleSupportCases`). */
  disputeSupportCaseId?: string;
  /** True for the last invoice ever generated for a subscription that was merged away (see `mergedInto`). */
  isFinalInvoice?: boolean;
}

/**
 * Subscription whose latest invoice is under dispute — kept in sync with support case `CS-2402`
 * (see `consoleOperationsMock.ts`) so Billing & Invoices and the support case agree with each other.
 */
const DISPUTED_INVOICE_SUBSCRIPTION_ID = '1789858606';
const DISPUTED_INVOICE_SUPPORT_CASE_ID = 'CS-2402';

/** First day of the calendar month containing `dateIso` (`YYYY-MM-DD`). */
function monthStartIso(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}

/**
 * Build line items from `serviceLevelBreakdown` (committed + burst TiB × rates).
 * `burstTibMultiplier` simulates month-to-month variance in burst billing.
 * `periodDateIso` (first day of the billing period) determines whether a row's `mergedCapacityDelta`
 * applies: periods before the merge's effective month bill the pre-merge (delta-subtracted) capacity,
 * so a subscription's invoice history shows a real jump at the month the merge took effect.
 */
export function buildInvoiceLineItemsFromBreakdown(
  subscription: Subscription,
  burstTibMultiplier = 1,
  periodDateIso?: string,
): InvoiceLineItem[] {
  return subscription.serviceLevelBreakdown.map((rawB) => {
    const delta = rawB.mergedCapacityDelta;
    const isPreMerge = Boolean(delta && periodDateIso && periodDateIso < monthStartIso(delta.activeFrom));
    const b = isPreMerge && delta
      ? {
          ...rawB,
          committed: Math.max(0, rawB.committed - delta.committed),
          data: Math.max(0, rawB.data - delta.data),
          snapshot: Math.max(0, rawB.snapshot - delta.snapshot),
        }
      : rawB;

    const rate = billingRateForLevel(b.level);
    const burstRate = rate;
    // Dark Site has no usage visibility, so accrued burst can never be measured or
    // billed — invoices are committed-capacity only (see `SOVEREIGNTY_META`).
    const accrued = isDarkSite(subscription) ? 0 : accruedBurstBillableTib(b);
    const burstTib = Math.max(0, Math.round(accrued * burstTibMultiplier * 10) / 10);
    const committedCost = Math.round(b.committed * rate);
    const burstCost = Math.round(burstTib * burstRate);
    return {
      serviceLevel: b.level,
      committedTib: b.committed,
      ratePerTib: rate,
      committedCost,
      burstTib,
      burstCost,
      subtotal: committedCost + burstCost,
    };
  });
}

/** Last fully-closed billing month as of `PLATFORM_REFERENCE_DATE` (e.g. reference Apr 9, 2026 → March 2026). */
function lastClosedBillingMonthStart(): Date {
  const d = PLATFORM_REFERENCE_DATE;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
}

/** Cyclical burst variance applied month-to-month so trend charts aren't perfectly flat. */
const BURST_VARIANCE_CYCLE = [1, 1.12, 0.88, 1.05, 0.93, 1.18];

function dueDateForPeriodKey(periodKey: string): string {
  const [y, m] = periodKey.split('-').map(Number);
  // `m` is 1-indexed (Jan=1); passing it as the (0-indexed) month arg lands on the 15th of the *next* month.
  return new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10);
}

/**
 * Rolling `monthsCount` billing periods ending at the last closed month; amounts, add-ons, extras,
 * and PO linkage are all derived from the subscription so every view of billing stays consistent.
 */
export function buildInvoicesForSubscription(subscription: Subscription, monthsCount = 6): SubscriptionInvoice[] {
  const referenceMonthStart = lastClosedBillingMonthStart();
  const addOnsCost = addOnsMonthlyCostForSubscription(subscription);

  // A merged-away subscription stops billing once its commitments move to the surviving
  // subscription — periods on/after that effective month are dropped, and every remaining
  // (pre-merge) invoice is treated as closed/settled rather than pending or overdue.
  const mergeEffectiveMonth =
    subscription.lifecycleStatus === 'merged' && subscription.mergedInto
      ? monthStartIso(subscription.mergedInto.date)
      : null;

  const invoices = Array.from({ length: monthsCount }, (_, i) => {
    const periodDate = new Date(referenceMonthStart);
    periodDate.setUTCMonth(periodDate.getUTCMonth() - i);
    const periodDateIso = periodDate.toISOString().slice(0, 10);
    const periodKey = periodDateIso.slice(0, 7);
    const periodLabel = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    if (mergeEffectiveMonth && periodDateIso >= mergeEffectiveMonth) return null;

    const burstMul = BURST_VARIANCE_CYCLE[i % BURST_VARIANCE_CYCLE.length];
    const lineItems = buildInvoiceLineItemsFromBreakdown(subscription, burstMul, periodDateIso);
    const committed = lineItems.reduce((s, r) => s + r.committedCost, 0);
    const burstBilled = lineItems.reduce((s, r) => s + r.burstCost, 0);
    const extraItems = extraLineItemsFor(subscription.id, periodKey);
    const extrasCost = extraItems.reduce((s, e) => s + e.amount, 0);
    const amount = committed + burstBilled + addOnsCost + extrasCost;

    const status: Invoice['status'] = mergeEffectiveMonth
      ? 'paid'
      : subscription.billingStatus === 'Overdue' && i === 0
        ? 'overdue'
        : i === 0
          ? 'pending'
          : 'paid';

    const disputed = subscription.id === DISPUTED_INVOICE_SUBSCRIPTION_ID && i === 0 && status === 'pending';

    const invoice: SubscriptionInvoice = {
      id: `inv-${subscription.id}-${periodKey}`,
      period: periodLabel,
      periodDate: periodDateIso,
      subscriptionId: subscription.id,
      committed,
      burstBilled,
      addOnsCost,
      extraItems,
      extrasCost,
      amount,
      status,
      dueDate: dueDateForPeriodKey(periodKey),
      lineItems,
      purchaseOrderId: purchaseOrderForSubscriptionPeriod(subscription.id, periodDateIso)?.id ?? null,
      disputed,
      disputeSupportCaseId: disputed ? DISPUTED_INVOICE_SUPPORT_CASE_ID : undefined,
    };
    return invoice;
  }).filter((inv): inv is SubscriptionInvoice => inv !== null);

  if (mergeEffectiveMonth && invoices.length > 0) {
    invoices[0].isFinalInvoice = true;
  }

  return invoices;
}

/** Flattened, most-recent-first invoices across every subscription (Billing & Cost → Invoices). */
export function allSubscriptionInvoices(monthsCount = 6, subs: Subscription[] = mockSubscriptions): SubscriptionInvoice[] {
  return subs
    .flatMap((sub) => buildInvoicesForSubscription(sub, monthsCount))
    .sort((a, b) => (a.periodDate < b.periodDate ? 1 : a.periodDate > b.periodDate ? -1 : a.subscriptionId.localeCompare(b.subscriptionId)));
}

export interface PurchaseOrder {
  id: string;
  name: string;
  /** Billing customer this PO was issued by (see `Subscription.customer`). */
  account: string;
  status: 'active' | 'expired';
  /** Subscriptions this PO funds — a PO can cover many subscriptions (one-to-many). */
  coveredSubscriptionIds: string[];
  startDate: string;
  endDate: string;
}

/**
 * Regional Keystone POs for AUMOVIO Germany GmbH's Moonshot fleet. AMER West shows a PO renewal
 * (FY24 expired → FY26 active) covering the same subscriptions — a many-to-one PO/subscription
 * relationship over time, alongside every PO's one-to-many coverage of multiple subscriptions.
 */
const rawMockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-2025-EMEA-01',
    name: 'FY26 Regional PO — EMEA',
    account: 'AUMOVIO Germany GmbH',
    status: 'active',
    coveredSubscriptionIds: ['1789858600', '1789858601', '1789858609'], // MST-1001, MST-2001, MST-10001
    startDate: '2025-04-01',
    endDate: '2027-03-31',
  },
  {
    id: 'PO-2025-APAC-01',
    name: 'FY26 Regional PO — APAC',
    account: 'AUMOVIO Germany GmbH',
    status: 'active',
    coveredSubscriptionIds: ['1789858602', '1789858607', '1789858608'], // MST-3001, MST-8001, MST-9001
    startDate: '2025-07-01',
    endDate: '2027-06-30',
  },
  {
    id: 'PO-2024-AMER-E-01',
    name: 'FY24 Regional PO — AMER East',
    account: 'AUMOVIO Germany GmbH',
    status: 'active',
    coveredSubscriptionIds: ['1789858603', '1789858606', '1789858611'], // MST-4001, MST-7001, MST-12001
    startDate: '2024-10-01',
    endDate: '2026-06-30',
  },
  {
    id: 'PO-2024-AMER-W-01',
    name: 'FY24 Regional PO — AMER West',
    account: 'AUMOVIO Germany GmbH',
    status: 'expired',
    coveredSubscriptionIds: ['1789858604', '1789858605', '1789858610'], // MST-5001, MST-6001, MST-11001
    startDate: '2024-01-01',
    endDate: '2025-12-31',
  },
  {
    id: 'PO-2026-AMER-W-02',
    name: 'FY26 Regional PO — AMER West',
    account: 'AUMOVIO Germany GmbH',
    status: 'active',
    coveredSubscriptionIds: ['1789858604', '1789858605', '1789858610'], // MST-5001, MST-6001, MST-11001 (renewal)
    startDate: '2026-01-01',
    endDate: '2027-12-31',
  },
];

/** Timeline-shifted so PO windows stay correctly positioned (active/expired) relative to "today". */
export const mockPurchaseOrders: PurchaseOrder[] = rawMockPurchaseOrders.map((po) => ({
  ...po,
  startDate: shiftIsoDate(po.startDate),
  endDate: shiftIsoDate(po.endDate),
}));

/** Resolve the PO (if any) covering a subscription for a given billing period. */
export function purchaseOrderForSubscriptionPeriod(
  subscriptionId: string,
  periodDateIso: string,
): PurchaseOrder | undefined {
  const t = new Date(periodDateIso).getTime();
  return mockPurchaseOrders.find(
    (po) =>
      po.coveredSubscriptionIds.includes(subscriptionId) &&
      t >= new Date(po.startDate).getTime() &&
      t <= new Date(po.endDate).getTime(),
  );
}

function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.max(0, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()));
}

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export interface PurchaseOrderMetrics extends PurchaseOrder {
  coveredSubscriptions: Subscription[];
  /** Current combined monthly run-rate of covered subscriptions (from their latest invoice). */
  monthlyRunRateUsd: number;
  /** Run-rate × full contract term — the PO's value at the fleet's current burn rate. */
  totalValueUsd: number;
  consumedUsd: number;
  remainingUsd: number;
  consumedPct: number;
  estDepletionDate: string;
  monthsUntilDepletion: number;
  healthStatus: 'healthy' | 'depleting-soon' | 'exhausted' | 'expired';
}

/** Derives PO $ value, consumption, and health entirely from covered subscriptions' real invoices. */
export function purchaseOrderMetrics(po: PurchaseOrder): PurchaseOrderMetrics {
  const coveredSubscriptions = po.coveredSubscriptionIds
    .map((id) => getSubscriptionById(id))
    .filter((s): s is Subscription => Boolean(s));

  const monthlyRunRateUsd = coveredSubscriptions.reduce((sum, sub) => {
    const [latest] = buildInvoicesForSubscription(sub, 1);
    return sum + (latest?.amount ?? 0);
  }, 0);

  const referenceIso = PLATFORM_REFERENCE_DATE.toISOString().slice(0, 10);
  const termMonths = Math.max(1, monthsBetween(po.startDate, po.endDate));
  const totalValueUsd = Math.round(monthlyRunRateUsd * termMonths);

  const elapsedMonths = Math.min(termMonths, Math.max(0, monthsBetween(po.startDate, referenceIso)));
  const consumedUsd = Math.min(totalValueUsd, Math.round(monthlyRunRateUsd * elapsedMonths));
  const remainingUsd = Math.max(0, totalValueUsd - consumedUsd);
  const consumedPct = totalValueUsd > 0 ? consumedUsd / totalValueUsd : 0;
  const monthsUntilDepletion = monthlyRunRateUsd > 0 ? remainingUsd / monthlyRunRateUsd : Infinity;
  const estDepletionDate = addMonthsIso(referenceIso, Math.round(monthsUntilDepletion));

  let healthStatus: PurchaseOrderMetrics['healthStatus'];
  if (po.status === 'expired') healthStatus = 'expired';
  else if (remainingUsd <= 0) healthStatus = 'exhausted';
  else if (monthsUntilDepletion <= 3) healthStatus = 'depleting-soon';
  else healthStatus = 'healthy';

  return {
    ...po,
    coveredSubscriptions,
    monthlyRunRateUsd,
    totalValueUsd,
    consumedUsd,
    remainingUsd,
    consumedPct,
    estDepletionDate,
    monthsUntilDepletion,
    healthStatus,
  };
}

export function purchaseOrderMetricsList(): PurchaseOrderMetrics[] {
  return mockPurchaseOrders.map(purchaseOrderMetrics);
}

/** Every PO (active or expired) covering a subscription, most-recently-started first — one-to-many at the PO level. */
export function purchaseOrdersForSubscription(subscriptionId: string): PurchaseOrderMetrics[] {
  return purchaseOrderMetricsList()
    .filter((po) => po.coveredSubscriptionIds.includes(subscriptionId))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
}

export interface FleetBillingTotals {
  periodDate: string;
  periodLabel: string;
  committed: number;
  burst: number;
  addOns: number;
  extras: number;
  total: number;
  status: Invoice['status'];
}

/** ISO date of the 1st of the month `monthOffset` months before the last closed billing month. */
export function periodDateIsoForOffset(monthOffset: number): string {
  const d = lastClosedBillingMonthStart();
  d.setUTCMonth(d.getUTCMonth() - monthOffset);
  return d.toISOString().slice(0, 10);
}

/**
 * Fleet-wide billing totals for the Nth most recent billing period (0 = current/latest), summed
 * across every subscription's real invoice — keeps Overview's billing card consistent with
 * Billing & Cost → Invoices. Matches by `periodDate` rather than array position because a merged
 * subscription's invoice array can be shorter than `monthOffset + 1` (billing stopped early).
 */
export function fleetBillingTotalsForOffset(
  monthOffset = 0,
  subs: Subscription[] = mockSubscriptions,
): FleetBillingTotals {
  let committed = 0;
  let burst = 0;
  let addOns = 0;
  let extras = 0;
  let total = 0;
  let periodDate = '';
  let periodLabel = '';
  let status: Invoice['status'] = 'paid';

  const expectedPeriodDateIso = periodDateIsoForOffset(monthOffset);
  for (const sub of subs) {
    const inv = buildInvoicesForSubscription(sub, monthOffset + 1).find((i) => i.periodDate === expectedPeriodDateIso);
    if (!inv) continue;
    committed += inv.committed;
    burst += inv.burstBilled;
    addOns += inv.addOnsCost;
    extras += inv.extrasCost;
    total += inv.amount;
    periodDate = inv.periodDate;
    periodLabel = inv.period;
    if (inv.status === 'overdue') status = 'overdue';
    else if (inv.status === 'pending' && status !== 'overdue') status = 'pending';
  }

  return { periodDate, periodLabel, committed, burst, addOns, extras, total, status };
}

export function purchaseOrdersSummary(pos: PurchaseOrderMetrics[] = purchaseOrderMetricsList()): {
  activeCount: number;
  totalValueUsd: number;
  consumedUsd: number;
  remainingUsd: number;
  depletingSoonCount: number;
} {
  const active = pos.filter((po) => po.status === 'active');
  const totalValueUsd = active.reduce((s, po) => s + po.totalValueUsd, 0);
  const consumedUsd = active.reduce((s, po) => s + po.consumedUsd, 0);
  return {
    activeCount: active.length,
    totalValueUsd,
    consumedUsd,
    remainingUsd: Math.max(0, totalValueUsd - consumedUsd),
    depletingSoonCount: active.filter((po) => po.healthStatus === 'depleting-soon' || po.healthStatus === 'exhausted')
      .length,
  };
}

// ---------------------------------------------------------------------------
// PO upload & mapping workflow — Billing & Cost → Purchase Orders → Upload & Map POs
// ---------------------------------------------------------------------------

/**
 * Order Management review status for an uploaded PO document. Only `approved` uploads become a
 * real, billing-active `PurchaseOrder` (see `purchaseOrderId`) — `pending` and `rejected` uploads
 * exist only in this queue and never consume or fund a subscription's capacity.
 */
export type PoOmStatus = 'approved' | 'pending' | 'rejected';

export interface PoUploadEntry {
  id: string;
  fileName: string;
  poNumber: string;
  /** Face value of the PO document itself — null when not yet captured (e.g. a rejected upload). */
  poAmountUsd: number | null;
  /** Subscription(s) this upload is mapped to — empty until mapped (one-to-many, like `PurchaseOrder`). */
  mappedSubscriptionIds: string[];
  validFrom: string | null;
  validTo: string | null;
  uploadedAt: string;
  uploadedBy: string;
  omStatus: PoOmStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  /** Set once `omStatus` is `'approved'` — links to the corresponding entry in `mockPurchaseOrders`. */
  purchaseOrderId?: string;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const PO_UPLOAD_UPLOADERS = ['John Smith', 'Sarah Chen', 'Mike Johnson'];
const PO_UPLOAD_REVIEWERS = ['Sarah Chen', 'Mike Johnson'];

/** Every OM-approved PO started life as an upload — this backfills that upload record 1:1. */
function approvedUploadEntryForPurchaseOrder(po: PurchaseOrder, idx: number): PoUploadEntry {
  const metrics = purchaseOrderMetrics(po);
  const uploadedBy = PO_UPLOAD_UPLOADERS[idx % PO_UPLOAD_UPLOADERS.length];
  const reviewedBy = PO_UPLOAD_REVIEWERS[idx % PO_UPLOAD_REVIEWERS.length];
  return {
    id: `po-upload-${po.id}`,
    fileName: `${po.id}_signed.pdf`,
    poNumber: po.id,
    poAmountUsd: Math.round(metrics.totalValueUsd),
    mappedSubscriptionIds: po.coveredSubscriptionIds,
    validFrom: po.startDate,
    validTo: po.endDate,
    uploadedAt: po.startDate,
    uploadedBy,
    omStatus: 'approved',
    reviewedBy,
    reviewedAt: addDaysIso(po.startDate, 1),
    purchaseOrderId: po.id,
  };
}

/**
 * Full Upload & Map POs queue — every approved PO backfilled from `mockPurchaseOrders`, plus one
 * curated pending amendment and one curated rejection so every OM-review state has an example.
 */
export const mockPoUploadEntries: PoUploadEntry[] = [
  ...mockPurchaseOrders.map((po, idx) => approvedUploadEntryForPurchaseOrder(po, idx)),
  {
    id: 'po-upload-2026-amer-e-02',
    fileName: 'PO-2026-AMER-E-02_amendment.pdf',
    poNumber: 'PO-2026-AMER-E-02',
    poAmountUsd: 620_000,
    mappedSubscriptionIds: ['1789858603'], // MST-4001
    validFrom: '2026-07-01',
    validTo: '2028-06-30',
    uploadedAt: addDaysIso(PLATFORM_REFERENCE_DATE.toISOString().slice(0, 10), -6),
    uploadedBy: 'John Smith',
    omStatus: 'pending',
  },
  {
    id: 'po-upload-2026-apac-02',
    fileName: 'PO-2026-APAC-02_signed.pdf',
    poNumber: 'PO-2026-APAC-02',
    poAmountUsd: null,
    mappedSubscriptionIds: [],
    validFrom: null,
    validTo: null,
    uploadedAt: addDaysIso(PLATFORM_REFERENCE_DATE.toISOString().slice(0, 10), -3),
    uploadedBy: 'Mike Johnson',
    omStatus: 'rejected',
    reviewedBy: 'Sarah Chen',
    reviewedAt: addDaysIso(PLATFORM_REFERENCE_DATE.toISOString().slice(0, 10), -1),
    rejectionReason: 'PO number does not match vendor record — resubmit with corrected PO number.',
  },
];

export function poUploadEntriesSummary(): {
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalCount: number;
} {
  const approvedCount = mockPoUploadEntries.filter((e) => e.omStatus === 'approved').length;
  const pendingCount = mockPoUploadEntries.filter((e) => e.omStatus === 'pending').length;
  const rejectedCount = mockPoUploadEntries.filter((e) => e.omStatus === 'rejected').length;
  return { approvedCount, pendingCount, rejectedCount, totalCount: mockPoUploadEntries.length };
}

/**
 * Invoice delivery — every subscription's invoices go out either straight to an Accounts Payable
 * portal or by email. AP portal delivery is never on its own: a working backup email is mandatory
 * whenever the portal is the primary channel, so billing still reaches the customer if the portal
 * delivery fails.
 */
export type InvoiceDeliveryMethod = 'ap-portal' | 'email';
export type ApPortalProvider = 'SAP Ariba' | 'Coupa' | 'Oracle iSupplier' | 'Tungsten Network';

export const AP_PORTAL_PROVIDERS: ApPortalProvider[] = ['SAP Ariba', 'Coupa', 'Oracle iSupplier', 'Tungsten Network'];

export interface InvoiceDeliveryEmail {
  email: string;
  status: 'delivering' | 'failed';
  /** Set when `status` is `'failed'` — which invoice period(s) bounced, and why. */
  failureDetail?: string;
}

export interface InvoicePortalDeliveryError {
  periodLabel: string;
  reason: string;
}

export interface InvoiceDeliveryPreference {
  subscriptionId: string;
  primaryMethod: InvoiceDeliveryMethod;
  /** Set when `primaryMethod` is `'ap-portal'`. */
  apPortalProvider?: ApPortalProvider;
  /** Recent failed portal delivery attempts — empty when the portal is healthy. */
  portalDeliveryErrors: InvoicePortalDeliveryError[];
  /** Mock uploaded AP portal onboarding doc name, if any. */
  onboardingInstructionsFileName?: string;
  /**
   * The delivery email(s) on file. When `primaryMethod` is `'email'` these ARE the primary
   * delivery addresses; when it's `'ap-portal'` these are the mandatory secondary/backup
   * addresses — either way, at least one entry is required.
   */
  emails: InvoiceDeliveryEmail[];
}

/** Subscription with curated AP portal + email delivery failures (ties into its existing Overdue billing status). */
const DELIVERY_ISSUE_SUBSCRIPTION_ID = '1789858603';

function emailForAccount(account: string, mailbox: string): string {
  const domain = account
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${mailbox}@${domain}.com`;
}

/**
 * Deterministic delivery preference per subscription, built from the subscription itself (account
 * name → email domain) and its real invoice history (portal errors / failed-email detail reference
 * actual billing periods) so this stays consistent with the rest of Billing & Invoices.
 */
export function invoiceDeliveryPreferenceForSubscription(subscriptionId: string): InvoiceDeliveryPreference {
  const subscription = getSubscriptionById(subscriptionId);
  if (!subscription) {
    return { subscriptionId, primaryMethod: 'email', portalDeliveryErrors: [], emails: [] };
  }

  const recentPeriods = buildInvoicesForSubscription(subscription, 3).map((inv) => inv.period);
  const isCurated = subscriptionId === DELIVERY_ISSUE_SUBSCRIPTION_ID;

  const methodSeed = seededFraction(`${subscriptionId}-delivery-method`);
  const primaryMethod: InvoiceDeliveryMethod = isCurated || methodSeed < 0.45 ? 'ap-portal' : 'email';

  if (primaryMethod === 'email') {
    return {
      subscriptionId,
      primaryMethod,
      portalDeliveryErrors: [],
      emails: [{ email: emailForAccount(subscription.account, 'billing'), status: 'delivering' }],
    };
  }

  const providerIdx = Math.floor(seededFraction(`${subscriptionId}-portal-provider`) * AP_PORTAL_PROVIDERS.length);
  const apPortalProvider = AP_PORTAL_PROVIDERS[providerIdx];

  if (!isCurated) {
    return {
      subscriptionId,
      primaryMethod,
      apPortalProvider,
      portalDeliveryErrors: [],
      emails: [{ email: emailForAccount(subscription.account, 'ap-invoices'), status: 'delivering' }],
    };
  }

  return {
    subscriptionId,
    primaryMethod,
    apPortalProvider,
    portalDeliveryErrors: recentPeriods.map((periodLabel) => ({
      periodLabel,
      reason: `Unknown error posting to ${apPortalProvider}`,
    })),
    onboardingInstructionsFileName: 'ap-portal-onboarding-instructions.pdf',
    emails: [
      { email: emailForAccount(subscription.account, 'ap-invoices'), status: 'delivering' },
      { email: emailForAccount(subscription.account, 'billing'), status: 'delivering' },
      {
        email: emailForAccount(subscription.account, 'no-reply'),
        status: 'failed',
        failureDetail: `Failed invoice delivery: ${recentPeriods[0] ?? 'latest period'}`,
      },
      {
        email: emailForAccount(subscription.account, 'apscan'),
        status: 'failed',
        failureDetail: `Failed invoice delivery: ${recentPeriods.join(', ')}`,
      },
    ],
  };
}

/** Fleet-wide invoice delivery health — powers the "Delivery status" card on the global Invoices tab. */
export function fleetInvoiceDeliverySummary(subs: Subscription[] = mockSubscriptions): {
  subscriptionsWithIssues: number;
  totalPortalErrors: number;
  totalFailedEmails: number;
  apPortalCount: number;
  emailCount: number;
} {
  let subscriptionsWithIssues = 0;
  let totalPortalErrors = 0;
  let totalFailedEmails = 0;
  let apPortalCount = 0;
  let emailCount = 0;
  for (const sub of subs) {
    const pref = invoiceDeliveryPreferenceForSubscription(sub.id);
    if (pref.primaryMethod === 'ap-portal') apPortalCount += 1;
    else emailCount += 1;
    const failedEmails = pref.emails.filter((e) => e.status === 'failed').length;
    const portalErrors = pref.portalDeliveryErrors.length;
    if (failedEmails > 0 || portalErrors > 0) subscriptionsWithIssues += 1;
    totalPortalErrors += portalErrors;
    totalFailedEmails += failedEmails;
  }
  return { subscriptionsWithIssues, totalPortalErrors, totalFailedEmails, apPortalCount, emailCount };
}

// ---------------------------------------------------------------------------
// Subscription Timeline — order-form history (signed / modified / renewed)
// ---------------------------------------------------------------------------

/**
 * Every new order, modification, or renewal a customer signs produces a document (a "signed order
 * form"). This reuses the same placeholder PDF asset the quoting flow already ships (`CartModal`)
 * so "View" / "PDF" actions resolve to a real file instead of a dead link.
 */
export const ORDER_FORM_PDF_HREF = `${import.meta.env.BASE_URL}Quote_CSR-1775830431087.pdf`;

/** Friendly display copy for `KEYSTONE_ADDON_CATALOG` entries, used in timeline narrative text. */
const ADDON_DISPLAY_NAMES: Record<string, string> = {
  Backup: 'Backup',
  DR: 'Disaster Recovery',
  FabricPool: 'FabricPool Tiering',
  'Anti-Ransomware': 'Anti-Ransomware Protection',
  'SnapMirror Cloud': 'SnapMirror Cloud',
  'Advanced Monitoring': 'Advanced Monitoring',
};

export function addOnDisplayName(name: string): string {
  return ADDON_DISPLAY_NAMES[name] ?? name;
}

/** Order-form-level committed capacity line (level + TiB). */
export interface TimelineCapacityRow {
  level: string;
  committed: number;
}

/** The signed document itself — addresses, sales motion, term, capacity, services, conditions. */
export interface TimelineOrderForm {
  id: string;
  signedDate: string;
  signerName: string;
  signerTitle: string;
  signerOrg: string;
  pdfUrl: string;
  billTo: string;
  shipTo: string;
  channel: string;
  contractValueUsd: number;
  termMonths: number;
  termLabel: string;
  effectiveDate: string;
  committedTotalTib: number;
  committedBreakdown: TimelineCapacityRow[];
  additionalServices: string[];
  specialConditions: string[];
}

export type SubscriptionTimelineEventType = 'signed' | 'modified' | 'renewed' | 'merged' | 'upcoming';

export interface SubscriptionTimelineEvent {
  id: string;
  subscriptionId: string;
  type: SubscriptionTimelineEventType;
  /** True for the order form currently in effect (mutually exclusive across a subscription's events). */
  isCurrent?: boolean;
  date: string;
  title: string;
  description: string;
  whatChanged?: string[];
  orderForm?: TimelineOrderForm;
  /** For 'merged' events — the other subscription involved, so the UI can render a "Go to" link. */
  linkedSubscriptionId?: string;
}

function timelineCapacityTotal(rows: TimelineCapacityRow[]): number {
  return rows.reduce((sum, row) => sum + row.committed, 0);
}

/**
 * $/TiB/month (from `billingCommittedRatePerTibUsd`, the same rate card billing uses) × term months —
 * so an order form's contract value always reconciles with the committed-capacity economics shown
 * on the Billing tab, instead of being an independently hardcoded number.
 */
function estimatedContractValueUsd(breakdown: TimelineCapacityRow[], termMonths: number): number {
  const monthly = breakdown.reduce((sum, row) => sum + row.committed * billingRateForLevel(row.level), 0);
  return Math.round(monthly * termMonths);
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

/**
 * Hand-authored order-form history for subscription 1789858600 (AUMOVIO Germany GmbH · Moonshot Germany).
 * The final ("current") stage is derived directly from the live `Subscription` record so it can never
 * drift out of sync; only the earlier historical stages (interim capacity, dates, signers) are
 * narrative detail that isn't captured anywhere else in the data model.
 */
function buildMoonshotGermanyTimeline(sub: Subscription): SubscriptionTimelineEvent[] {
  const billTo = `${sub.customer}, ${sub.region}`;
  const termMonths = 36;

  const stage1Breakdown: TimelineCapacityRow[] = [
    { level: 'Extreme', committed: 80 },
    { level: 'Standard', committed: 12 },
  ];
  const stage2Breakdown: TimelineCapacityRow[] = [
    { level: 'Extreme', committed: 90 },
    { level: 'Standard', committed: 14 },
  ];
  // Stage 3 is the live subscription's own breakdown — always matches current committed capacity.
  const stage3Breakdown: TimelineCapacityRow[] = sub.serviceLevelBreakdown.map((row) => ({
    level: row.level,
    committed: row.committed,
  }));

  const stage1Value = estimatedContractValueUsd(stage1Breakdown, termMonths);
  const stage2Value = estimatedContractValueUsd(stage2Breakdown, termMonths);
  const stage3Value = estimatedContractValueUsd(stage3Breakdown, termMonths);

  return [
    {
      id: `${sub.id}-tl-001`,
      subscriptionId: sub.id,
      type: 'signed',
      date: sub.startDate,
      title: 'Subscription signed',
      description: `Initial ${termMonths}-month Keystone STaaS subscription · ${timelineCapacityTotal(stage1Breakdown)} TiB committed`,
      orderForm: {
        id: `OF-${sub.trackingId}-001`,
        signedDate: sub.startDate,
        signerName: 'Sarah Johnson',
        signerTitle: 'Procurement',
        signerOrg: sub.customer,
        pdfUrl: ORDER_FORM_PDF_HREF,
        billTo,
        shipTo: billTo,
        channel: sub.accountType,
        contractValueUsd: stage1Value,
        termMonths,
        termLabel: `${termMonths} months (initial)`,
        effectiveDate: sub.startDate,
        committedTotalTib: timelineCapacityTotal(stage1Breakdown),
        committedBreakdown: stage1Breakdown,
        additionalServices: ['Premium Support'],
        specialConditions: ['Net-60 payment terms'],
      },
    },
    {
      id: `${sub.id}-tl-002`,
      subscriptionId: sub.id,
      type: 'modified',
      date: shiftIsoDate('2024-09-15'),
      title: 'Capacity & services modified',
      description: `Customer expanded committed capacity and added ${addOnDisplayName('Backup')} add-on`,
      whatChanged: [
        `Committed capacity: ${timelineCapacityTotal(stage1Breakdown)} → ${timelineCapacityTotal(stage2Breakdown)} TiB`,
        `Add-on: ${addOnDisplayName('Backup')} added (+${formatUsd(ADDON_MONTHLY_RATE_USD.Backup)}/mo)`,
        `Contract value: ${formatUsd(stage1Value)} → ${formatUsd(stage2Value)}`,
      ],
      orderForm: {
        id: `OF-${sub.trackingId}-002`,
        signedDate: shiftIsoDate('2024-09-15'),
        signerName: 'Sarah Johnson',
        signerTitle: 'IT Procurement',
        signerOrg: sub.customer,
        pdfUrl: ORDER_FORM_PDF_HREF,
        billTo,
        shipTo: billTo,
        channel: sub.accountType,
        contractValueUsd: stage2Value,
        termMonths,
        termLabel: `${termMonths} months (unchanged)`,
        effectiveDate: sub.startDate,
        committedTotalTib: timelineCapacityTotal(stage2Breakdown),
        committedBreakdown: stage2Breakdown,
        additionalServices: ['Premium Support', addOnDisplayName('Backup')],
        specialConditions: ['Net-60 payment terms'],
      },
    },
    {
      id: `${sub.id}-tl-003`,
      subscriptionId: sub.id,
      type: 'modified',
      isCurrent: true,
      date: shiftIsoDate('2025-10-01'),
      title: 'Capacity & services modified',
      description: `Customer expanded committed capacity and added ${addOnDisplayName('DR')} add-on`,
      whatChanged: [
        `Committed capacity: ${timelineCapacityTotal(stage2Breakdown)} → ${timelineCapacityTotal(stage3Breakdown)} TiB`,
        `Add-on: ${addOnDisplayName('DR')} added (+${formatUsd(ADDON_MONTHLY_RATE_USD.DR)}/mo)`,
        `Contract value: ${formatUsd(stage2Value)} → ${formatUsd(stage3Value)}`,
        'Payment terms updated: Net-45 (was Net-60)',
      ],
      orderForm: {
        id: `OF-${sub.trackingId}-003`,
        signedDate: shiftIsoDate('2025-10-01'),
        signerName: 'Sarah Johnson',
        signerTitle: 'Procurement Director',
        signerOrg: sub.customer,
        pdfUrl: ORDER_FORM_PDF_HREF,
        billTo,
        shipTo: billTo,
        channel: sub.accountType,
        contractValueUsd: stage3Value,
        termMonths,
        termLabel: `${termMonths} months (unchanged)`,
        effectiveDate: sub.startDate,
        committedTotalTib: sub.committed,
        committedBreakdown: stage3Breakdown,
        additionalServices: ['Premium Support', ...sub.addOns.map(addOnDisplayName)],
        specialConditions: ['Net-45 payment terms', 'Mid-term capacity review scheduled'],
      },
    },
    {
      id: `${sub.id}-tl-upcoming`,
      subscriptionId: sub.id,
      type: 'upcoming',
      date: sub.endDate,
      title: 'Subscription expires',
      description: 'Term ends. Service paused if no renewal in place.',
    },
  ];
}

/** Subscriptions with a fully hand-authored order-form history; every other subscription falls back to `buildDefaultSubscriptionTimeline`. */
const TIMELINE_BUILDERS: Record<string, (sub: Subscription) => SubscriptionTimelineEvent[]> = {
  '1789858600': buildMoonshotGermanyTimeline,
};

/**
 * Generic order-form history for subscriptions without an authored narrative: an initial "Signed"
 * order form (backed out from the current committed capacity), an optional "Modified" order form
 * when add-ons are present, and the term's "Subscription expires" milestone — every value derived
 * from that subscription's own `mockSubscriptions` record.
 */
function buildDefaultSubscriptionTimeline(sub: Subscription): SubscriptionTimelineEvent[] {
  const termMonths = Math.max(12, monthsBetween(sub.startDate, sub.endDate));
  const billTo = `${sub.customer}, ${sub.region}`;
  const currentBreakdown: TimelineCapacityRow[] = sub.serviceLevelBreakdown.map((row) => ({
    level: row.level,
    committed: row.committed,
  }));
  const hasAddOns = sub.addOns.length > 0;

  // Back out a plausible "before add-ons" starting capacity for subscriptions that have grown.
  const initialBreakdown: TimelineCapacityRow[] = hasAddOns
    ? currentBreakdown.map((row) => ({ level: row.level, committed: Math.max(1, Math.round(row.committed * 0.85)) }))
    : currentBreakdown;
  const initialTotal = timelineCapacityTotal(initialBreakdown);
  const initialValue = estimatedContractValueUsd(initialBreakdown, termMonths);
  const currentValue = estimatedContractValueUsd(currentBreakdown, termMonths);

  const events: SubscriptionTimelineEvent[] = [
    {
      id: `${sub.id}-tl-signed`,
      subscriptionId: sub.id,
      type: 'signed',
      isCurrent: !hasAddOns,
      date: sub.startDate,
      title: 'Subscription signed',
      description: `Initial ${termMonths}-month Keystone STaaS subscription · ${initialTotal} TiB committed`,
      orderForm: {
        id: `OF-${sub.trackingId}-001`,
        signedDate: sub.startDate,
        signerName: 'Procurement Team',
        signerTitle: 'Procurement',
        signerOrg: sub.customer,
        pdfUrl: ORDER_FORM_PDF_HREF,
        billTo,
        shipTo: billTo,
        channel: sub.accountType,
        contractValueUsd: initialValue,
        termMonths,
        termLabel: `${termMonths} months (initial)`,
        effectiveDate: sub.startDate,
        committedTotalTib: initialTotal,
        committedBreakdown: initialBreakdown,
        additionalServices: ['Premium Support'],
        specialConditions: ['Net-60 payment terms'],
      },
    },
  ];

  if (hasAddOns) {
    const modDate = addMonthsIso(sub.startDate, Math.max(3, Math.round(termMonths / 3)));
    events.push({
      id: `${sub.id}-tl-modified`,
      subscriptionId: sub.id,
      type: 'modified',
      isCurrent: true,
      date: modDate,
      title: 'Capacity & services modified',
      description: `Customer expanded committed capacity and added ${sub.addOns.map(addOnDisplayName).join(', ')}`,
      whatChanged: [
        `Committed capacity: ${initialTotal} → ${sub.committed} TiB`,
        ...sub.addOns.map((a) => `Add-on: ${addOnDisplayName(a)} added (+${formatUsd(ADDON_MONTHLY_RATE_USD[a] ?? 0)}/mo)`),
        `Contract value: ${formatUsd(initialValue)} → ${formatUsd(currentValue)}`,
      ],
      orderForm: {
        id: `OF-${sub.trackingId}-002`,
        signedDate: modDate,
        signerName: 'Procurement Team',
        signerTitle: 'IT Procurement',
        signerOrg: sub.customer,
        pdfUrl: ORDER_FORM_PDF_HREF,
        billTo,
        shipTo: billTo,
        channel: sub.accountType,
        contractValueUsd: currentValue,
        termMonths,
        termLabel: `${termMonths} months (unchanged)`,
        effectiveDate: sub.startDate,
        committedTotalTib: sub.committed,
        committedBreakdown: currentBreakdown,
        additionalServices: ['Premium Support', ...sub.addOns.map(addOnDisplayName)],
        specialConditions: ['Net-45 payment terms'],
      },
    });
  }

  events.push({
    id: `${sub.id}-tl-upcoming`,
    subscriptionId: sub.id,
    type: 'upcoming',
    date: sub.endDate,
    title: 'Subscription expires',
    description: 'Term ends. Service paused if no renewal in place.',
  });

  return events;
}

/**
 * Order-form timeline for a subscription — oldest first. UI is responsible for "Newest first" sorting.
 * Layers merger events on top of the base order-form history: a merged-away subscription's generic
 * "expires" milestone is replaced with a "Merged into ..." event, and a surviving subscription gets a
 * "Merged with ..." event for each subscription it absorbed — both link to the other subscription.
 */
export function getSubscriptionTimeline(sub: Subscription): SubscriptionTimelineEvent[] {
  const build = TIMELINE_BUILDERS[sub.id] ?? buildDefaultSubscriptionTimeline;
  let events = build(sub);

  if (sub.lifecycleStatus === 'merged' && sub.mergedInto) {
    const target = getSubscriptionById(sub.mergedInto.subscriptionId);
    events = events.filter((e) => e.type !== 'upcoming');
    events.push({
      id: `${sub.id}-tl-merged-into`,
      subscriptionId: sub.id,
      type: 'merged',
      date: sub.mergedInto.date,
      title: `Merged into ${target?.number ?? sub.mergedInto.subscriptionId}`,
      description: `Commitments and future consumption for this subscription are now tracked on ${
        target ? `${target.account} (${target.number})` : sub.mergedInto.subscriptionId
      }. Historical usage and invoices before this date remain here.`,
      linkedSubscriptionId: sub.mergedInto.subscriptionId,
    });
  }

  if (sub.mergedFrom?.length) {
    for (const merge of sub.mergedFrom) {
      const source = getSubscriptionById(merge.subscriptionId);
      events.push({
        id: `${sub.id}-tl-merged-from-${merge.subscriptionId}`,
        subscriptionId: sub.id,
        type: 'merged',
        date: merge.date,
        title: `Merged with ${source?.number ?? merge.subscriptionId}`,
        description: `${
          source ? `${source.account} (${source.number})` : merge.subscriptionId
        } was consolidated into this subscription.`,
        whatChanged: [`Committed capacity: +${merge.addedCommittedTib} TiB`],
        linkedSubscriptionId: merge.subscriptionId,
      });
    }
  }

  return [...events].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Console operations (alerts, monitors, agents, service requests, cases) — all keyed by `subscriptionId`. */
export * from './consoleOperationsMock';