# NetApp Console Platform Data

This directory contains all centralized mock data for the NetApp Console Keystone STaaS platform. **Every screen reads from these files — do not hardcode data values in components.**

- `mockData.ts` — subscriptions, volumes/hardware, consumption, recommendations, SLA, billing (invoices), purchase orders, cost aggregation
- `consoleOperationsMock.ts` — alerts, monitors, metadata collection (Keystone Agent / AutoSupport), service requests, support cases (re-exported from `mockData.ts`)

## Core Data Types

### 1. User Roles & Customer Types
- `userRoles`: Subscription Admin, Subscription Viewer, Storage Admin, Storage Operator
- `customerTypes`: Direct Customer, Reseller (Sell-through), Service Provider (Sell-to)

### 2. Subscriptions (`mockSubscriptions`, `activeMockSubscriptions`)
- **Count**: 12 subscriptions (`mockSubscriptions`); `activeMockSubscriptions` filters to `lifecycleStatus === 'active'` and backs every fleet-wide KPI (Overview, Cost Explorer usage ceiling, subscriptions list count) so a merged/terminated subscription never inflates current totals
- **Fields**: id, number, trackingId, customer, account, serviceLevels, region, version, accountType, addOns, startDate, endDate, committedCapacity, currentUsage, burstUsage, serviceLevelBreakdown, health/SLA/collector/billing status, `lifecycleStatus`, `mergedInto`, `mergedFrom`
- Everything else in the app (volumes, invoices, purchase orders, recommendations, cost rollups) is derived from or keyed by a subscription's `id`

### 2a. Subscription Mergers (`lifecycleStatus`, `mergedInto`, `mergedFrom`, `ServiceLevelBreakdown.mergedCapacityDelta`)
Models the scenario where subscription A is terminated and its commitments are folded into subscription B, without losing visibility into A's historical consumption:
- `lifecycleStatus: 'active' | 'merged' | 'terminated' | 'expired'` — a distinct status model (not reused from `health`/`billingStatus`) with its own badge and filter on the Subscriptions list.
- The merged-away subscription (`mergedInto: { subscriptionId, date }`) keeps its full historical data; `buildInvoicesForSubscription` drops any billing period on/after the merge month and marks its last invoice `isFinalInvoice`. Its detail page only shows Current Consumption, Consumption Trends, Billing & Invoices, and Timeline, plus a banner linking to the surviving subscription.
- The surviving subscription (`mergedFrom: SubscriptionMergeSource[]`) carries a `mergedCapacityDelta` on the affected `ServiceLevelBreakdown` rows — `buildInvoiceLineItemsFromBreakdown` subtracts that delta for periods before the merge, so its own invoice history shows a real step-up at the merge month instead of a flat, already-merged number for all history.
- `getSubscriptionTimeline` adds a `'merged'` event (type + `linkedSubscriptionId`) on both subscriptions, and `buildStitchedHistoricalTrendForServiceLevel` lets Consumption Trends optionally stitch the surviving subscription's post-merge data onto the merged-away subscription's pre-merge history for one continuous view, with a reference line marking the merge date.
- One curated example is seeded: subscription `1789858601` merged into `1789858609` on `2026-03-20`. Any PO that funded the merged-away subscription is left pointing at it as a historical record (no PO handling changes are made automatically).

### 3. Consumption Trends
- `consumptionTrendData` / `mockConsumptionTrend`: 30 days of fleet-level daily consumption (date, used, committed, burst, data, snapshot)
- `scaleConsumptionTrendForSubscription(subscription)`: scales the shared curve to one subscription's committed/used capacity
- `buildHistoricalTrendForServiceLevel`, `buildAccruedDailyRowsForServiceLevel`, `buildAccruedMonthlyBucketsForServiceLevel`: per-service-level derivatives used by Consumption Trends and Billing views

### 4. Volumes & Hardware (`mockVolumes`, `mockHardwareNodes`)
- Volumes: capacity used, snapshot, growth rate, latency, IOPS, throughput, tiering, protection, anomalies — used by the Assets screen and the Volumes subscription-detail tab
- Hardware nodes: cluster/node inventory with ONTAP version, used for the Assets screen and the "nodes on outdated ONTAP" recommendation signal

### 5. Recommendations (`mockRecommendations` / `getRecommendationsForSubscription`)
- 7 recommendations across categories: Renew, Security, Capacity, Performance, Collector
- Priority levels: critical, high, medium, low

### 6. Billing — Invoices (`Invoice`, `SubscriptionInvoice`, `buildInvoicesForSubscription`, `allSubscriptionInvoices`)
- Invoices are generated (not hand-authored) per subscription per billing period via `buildInvoicesForSubscription(subscription, monthsCount = 6)`, and flattened across the fleet via `allSubscriptionInvoices(monthsCount = 6)`
- Each invoice = committed cost (from `billingCommittedRatePerTibUsd` × service-level breakdown) + burst cost + add-ons cost (`addOnsMonthlyCostForSubscription`, priced from `ADDON_MONTHLY_RATE_USD`) + deterministic "extra" line items (`extraLineItemsFor`, from `EXTRA_LINE_ITEM_CATALOG`)
- Each invoice resolves an optional `purchaseOrderId` via `purchaseOrderForSubscriptionPeriod`, so an invoice can be traced to the PO that covered it
- Status: `paid` / `pending` / `overdue`, derived from the invoice's `dueDate` vs `PLATFORM_REFERENCE_DATE`

### 7. Billing — Purchase Orders (`PurchaseOrder`, `mockPurchaseOrders`, `purchaseOrderMetrics`, `purchaseOrderMetricsList`, `purchaseOrdersSummary`)
- 5 purchase orders modeling both **one PO → many subscriptions** and **many POs → one subscription over time** (renewals)
- `purchaseOrderMetrics(po)` dynamically computes consumed value, remaining balance, burn rate, and months-until-depletion from the invoices attributed to that PO
- `purchaseOrdersSummary()` aggregates fleet-wide PO value/consumption for the Overview and Billing & Cost screens

### 7a. PO Upload & OM-Review Workflow (`PoUploadEntry`, `mockPoUploadEntries`, `poUploadEntriesSummary`)
- Layered on top of `mockPurchaseOrders` — every OM-approved PO is backfilled 1:1 as an `omStatus: 'approved'` upload entry (`approvedUploadEntryForPurchaseOrder`), plus one curated `pending` amendment and one curated `rejected` upload so all three OM-review states have an example.
- Powers the single-page Billing & Cost → **Purchase Orders** view: every `PoUploadEntry` renders as a slim, one-line row (metrics-backed when `approved`; a lighter amber/red-tinted row when `pending`/`rejected`) in one filterable list — there's no separate "Upload & Map POs" tab, and no side-by-side card grid. Clicking an approved row expands it in place to reveal vendor/term/service-level and the per-subscription drawdown breakdown. Upload a new PO (starts `pending`), re-map to a different subscription (resets to `pending`, requiring re-approval — matches the "Re-mapping requires OM re-approval" warning in the UI), or edit an existing entry — all via right-side drawers. Only `approved` uploads correspond to a real, billing-active PO (`purchaseOrderId` links back to `mockPurchaseOrders`); `pending`/`rejected` uploads never fund or consume a subscription's capacity.

### 8. Fleet Cost Aggregation (`fleetBillingTotalsForOffset`, Cost Explorer)
- `fleetBillingTotalsForOffset` computes total committed / burst / add-on / extras cost for the fleet for a given month offset (0 = current billing period) — backs the Overview "Cost & Billing" widget.
- The Billing & Cost → **Cost Explorer** tab reads the same underlying invoices (`buildInvoicesForSubscription` across every subscription) and aggregates them by month, then — for Daily/Weekly granularity — splits each real month's totals into deterministic, seeded sub-buckets (`seededFraction`-based weights that sum to 1) so every bucket still rolls up to the true monthly invoice figures. It can group by cost component (committed/burst/add-ons/extras), subscription, account, or service level, and filter to a single service level (which also restricts the TiB usage ceiling/used calculations). The Usage section's ceiling is derived from `activeMockSubscriptions`' committed capacity plus `includedBurstHeadroomTib`, so it agrees with the Subscriptions list and Overview.

### 8a. Invoice Delivery Preferences (`InvoiceDeliveryPreference`, `invoiceDeliveryPreferenceForSubscription`, `fleetInvoiceDeliverySummary`)
- Every subscription has a deterministic delivery preference (AP portal or email, with a mandatory backup email whenever AP portal is primary) seeded via `invoiceDeliveryPreferenceForSubscription(subscriptionId)`, including any portal delivery errors or failed email addresses.
- `fleetInvoiceDeliverySummary()` aggregates delivery health (subscriptions with issues, portal errors, failed emails, AP-portal vs. email split) for the global Invoices tab's "Delivery status" card.
- `InvoiceDeliveryPreferencesDrawer` renders the same form for both scopes: a single subscription (Billing & Invoices → manage delivery), or org-wide (Billing & Cost → Invoices → manage delivery, `allowScopeSelection`), where a first "Apply to" step lets you target all subscriptions or a multi-select of specific ones.

### 8b. Six Keystone SLA features (`ServiceLevelBreakdown` extensions, guardrail/eligibility functions)
Adds six new SLA guarantees on top of the existing performance/availability/sustainability model. Capacity Add, Availability, Storage Efficiency, and Performance are available **by default** on every subscription unless a guardrail explicitly fails; Multi-Protocol and Standard-Hybrid are opt-in (an add-on and a service level, respectively).

1. **Standard-Hybrid performance service level** — a new service level (`'Standard-Hybrid'`) registered alongside Extreme/Premium/Performance/Standard/Value in every SLA template map (`sustainabilityPowerTemplatesByKey`, `performanceLatencyTemplatesByKey`, `availabilityOntapTemplatesByKey`, `billingCommittedRatePerTibUsd`). Partial-SSD/partial-HDD storage: `ServiceLevelBreakdown.mediaSplit = { ssdPct, hddPct, ssdTib, hddTib }`. Guardrail — minimum 10% SSD "working set" (`HYBRID_MIN_SSD_WORKING_SET_PCT`), validated by `validateHybridWorkingSet()`.
2. **Availability SLA** — bumped `ONTAP_AVAILABILITY_SLO_PCT` from five nines to **99.9999%** (six nines), across Extreme/Premium/Performance/Standard/Value/Standard-Hybrid (block + file only; Object/StorageGRID stays out of scope, unchanged). New eligibility gate: a level must be used at ≥80% of committed capacity (`SLA_CLAIM_MIN_UTILIZATION_PCT`, `isEligibleForSlaClaim()`, `utilizationPct()`) to be eligible to claim a breach credit — surfaced per level as `AvailabilityServiceLevel.utilizationPct` / `.eligibleForClaim`.
3. **Multi-Protocol Support SLA** — cosmetic/informational only. Modeled as a bundle entry in the existing add-on catalog: `MULTIPROTOCOL_ADDON_NAME = 'Multiprotocol (NFS+SMB)'` in `KEYSTONE_ADDON_CATALOG` / `ADDON_MONTHLY_RATE_USD` (billed $0), detected via `hasMultiProtocol(subscription)`. Lets the same NetApp SVM/volume serve NFS and SMB clients simultaneously via an extra data LIF, **and** provisions a LUN alongside it — unlocking Block (FC/iSCSI) on that service level too, not just File. **Elected at signing only** — unlike every other catalog add-on, it ships with the initial order and can never be requested as a mid-term modification; `getAvailableAddOnNamesForSubscription()` excludes it unconditionally so it never appears as "addable" post-signing. Eligibility is per service level, not subscription-wide, and is a **hardware** question: `isMultiProtocolEligibleRow(row)` gates on `(row.storageArchitecture ?? 'unified') !== 'asa'`, not on what's currently provisioned.
   - **Hardware architecture** — new `ServiceLevelBreakdown.storageArchitecture?: 'unified' | 'asa'` (defaults to `'unified'`). Unified (AFF/FAS) hardware can physically serve File + Block + Object from one system under a single Availability SLA; ASA (All-Flash SAN Array) is a hard, block-only hardware lock — File and Object are never available there, regardless of add-ons.
   - **Protocol entitlements** — `protocolEntitlementsForRow(row, subscription)` derives one `ProtocolEntitlement` (`family: 'file' | 'block' | 'object'`, `status: 'active' | 'available' | 'locked'`) per family per row: on ASA rows, Block is `active` and File/Object are `locked`; on unified rows, each family is `active` if currently provisioned (`storageType`) — or, for Block specifically, also if the Multiprotocol add-on is present — and otherwise `available` (enable anytime from existing committed capacity, no extra cost, no hardware change). `PROTOCOL_FAMILY_META` supplies display labels/protocol strings; `hasAsaRow(subscription)` is a convenience helper for ASA detection. Surfaced as a single "Protocols" column in the Current Consumption tab's detailed breakdown table — one dot per family (green = active, grey = available-to-enable or hardware-locked, distinguished only via hover text) — kept deliberately as the one place this info lives, no separate card or table.
4. **Storage Efficiency SLA** — only for logical-metering, data-reducible, non-object rows. New `ServiceLevelBreakdown` fields: `storageType` (`'block' | 'unified' | 'object'`), `meteringType` (`'logical' | 'physical'`), `dataReducible`, `physicalUsedTib`. Target ratio is 2.5:1 for both Block and Unified (`STORAGE_EFFICIENCY_TARGET_RATIO`). `buildStorageEfficiencyForSubscription(subscription)` returns realized ratio + compliance per level; a breach auto-triggers remediation (`remediationInProgress`) — NetApp ships more disks, no customer claim needed. Verify workload reducibility with the external tool referenced by `STORAGE_EFFICIENCY_EXTERNAL_TOOL_URL`/`_NAME` (NetApp Active IQ Digital Advisor's Storage Efficiency dashboard).
5. **Capacity Add SLA** — only for standard/limited-discount deals with no deviations (`Subscription.dealType`, `.hasDeviations`), not in the first or last year of the term, and usable once every 12 months (`Subscription.lastCapacityAddDate`, `CAPACITY_ADD_COOLDOWN_MONTHS`). `capacityAddEligibility(subscription)` returns `{ eligible, reasons, nextEligibleDate }`. When eligible, customers can add up to 100% of committed capacity (`CAPACITY_ADD_MAX_PCT_OF_COMMITTED`) in increments of `Max(50 TiB, included burst headroom)` (`CAPACITY_ADD_MIN_INCREMENT_TIB_FLOOR`); `calculateCapacityAdd(row, addTib)` computes the resulting TiB-weighted blended $/TiB rate from the row's original `initialRatePerTibUsd` and today's list rate (`billingRateForLevel`).
6. **Performance SLA** — same ≥80%-utilization credit-claim gate as Availability (shared `SLA_CLAIM_MIN_UTILIZATION_PCT` / `isEligibleForSlaClaim()`), surfaced per level as `PerformanceServiceLevelLatency.utilizationPct` / `.eligibleForClaim`.

A showcase subscription (`1789858614`, "Moonshot Nordic") demonstrates all six together: Standard-Hybrid with a **20% SSD working set** — the correct/compliant ratio (min 10%) — but a Storage Efficiency breach (auto-remediation) and an Availability/Performance breach at ~100% utilization (claim-eligible), plus the Multiprotocol add-on and a fully Capacity-Add-eligible profile. A dedicated subscription (`1789858615`, "Moonshot Baltic") demonstrates the Multi-Protocol Support SLA in isolation (Standard/Value, `addOns` includes `Multiprotocol (NFS+SMB)`, otherwise fully compliant — Block now shows `active` on both levels under the new entitlement logic). A dedicated subscription (`1789858616`, "Moonshot Cascade") demonstrates the ASA hardware lock: its Extreme row is `storageArchitecture: 'asa'` + `storageType: 'block'` (Block `active`, File/Object `locked`), paired with an ordinary unified Standard row for contrast. A few existing subscriptions are lightly tagged for guardrail variety: `1789858602` (non-reducible workload), `1789858603` (non-standard deal + deviations), `1789858606` (recent Capacity Add — still in cooldown), `1789858607` (Standard-Hybrid working-set guardrail violated, 6% SSD), `1789858608` (physically-metered row), `1789858611` (below-list initial rate, otherwise fully eligible for Capacity Add).

### 9. Metadata Collection — Keystone Agent & AutoSupport (`getMockConsoleKeystoneAgentCollectors`, `getMockConsoleAsupRecords`, `keystoneAgentCollectorSubscriptions`, `subscriptionForNode`, `collectorForNode`, `asupForNode`, `nodeTelemetryStatus`, `metadataSubscriptionRollups`, `metadataCollectionHealthSummary`)
Keystone collects platform metadata two ways, and the mock model reflects the two very different relationships:
- **Keystone Agent** (collector) — many-to-many with subscriptions/nodes. Nodes are grouped by region, then round-robined across 1–2 regional collector instances per region (2 when the region has ≥2 subscriptions), so one collector instance can stream real-time usage + performance telemetry for nodes across multiple subscriptions, and one subscription's nodes can be split across more than one collector.
- **AutoSupport (ASUP)** — one-to-one with a node. Every entry in `mockHardwareNodes` gets exactly one ASUP record: a once-daily, point-in-time capacity snapshot used for billing/capacity verification, with no real-time or performance detail.
- Both are generated from `mockHardwareNodes` (so the covered fleet always matches Assets), then a couple of issue states are seeded on the same subscriptions already referenced by `mockConsoleActiveAlerts` (`1789858603`, `1789858607`, `1789858608`) so Active Alerts and Metadata Collection agree with each other.
- Exposed as **memoized getter functions** (`getMockConsoleKeystoneAgentCollectors()`, `getMockConsoleAsupRecords()`), not eager array consts — `consoleOperationsMock.ts` and `mockData.ts` are a circular import (`mockData.ts` does `export * from './consoleOperationsMock'`, and this module reads `mockHardwareNodes` back from `mockData.ts`), so building the arrays at module-evaluation time would race against `mockHardwareNodes`'s own initialization. Call the getters instead of caching the array yourself.
- The UI reflects the natural hierarchy **Subscription → Node → Source instance**: `metadataSubscriptionRollups()` walks every subscription's nodes and, for each node, looks up its one collector (`collectorForNode`) and its one ASUP record (`asupForNode`) to derive a per-node `nodeTelemetryStatus` (the worse of the two). The Metadata Collection tab's three summary cards are ordered **Subscriptions impact → Data sources impact → Node impact** to match, and its two views — **By subscription** and **By source** — both drill down into the same collector/ASUP detail drawer.

## Usage

### Importing Data

```typescript
// Subscriptions, volumes, recommendations
import { mockSubscriptions, mockVolumes, getRecommendationsForSubscription } from './data/mockData';

// Billing
import { allSubscriptionInvoices, buildInvoicesForSubscription } from './data/mockData';
import { mockPurchaseOrders, purchaseOrderMetricsList, purchaseOrdersSummary } from './data/mockData';
import { mockPoUploadEntries, poUploadEntriesSummary } from './data/mockData';
import { fleetBillingTotalsForOffset } from './data/mockData';
import { invoiceDeliveryPreferenceForSubscription, fleetInvoiceDeliverySummary } from './data/mockData';

// Metadata Collection (Keystone Agent / AutoSupport)
import { getMockConsoleKeystoneAgentCollectors, getMockConsoleAsupRecords } from './data/mockData';

// Types
import type { Subscription, Volume, SubscriptionInvoice, PurchaseOrder } from './data/mockData';

// Constants
import { userRoles, customerTypes } from './data/mockData';
```

### Data Relationships

1. **Subscriptions** are the core entity — referenced by id everywhere else.
2. **Volumes / Hardware Nodes** reference a subscription via `subscriptionId`.
3. **Invoices** are generated per subscription per period and optionally linked to a **Purchase Order**.
4. **Purchase Orders** can cover one or many subscriptions (and a subscription can be covered by different POs over time via renewals); PO health is derived from the invoices that reference it. Every PO originates from a **PO upload entry** (`mockPoUploadEntries`), which tracks the OM-review lifecycle (pending → approved/rejected) before a PO becomes billing-active.
5. **Recommendations** are generated per subscription from health/SLA/collector/billing signals.
6. **Console operations** (alerts, monitors, service requests, cases — in `consoleOperationsMock.ts`) are keyed by `subscriptionId`.
7. **Metadata Collection**: AutoSupport is one-to-one with a **node** (a subscription's several nodes each get their own ASUP record); Keystone Agent collectors are many-to-many — one collector instance covers nodes from potentially several subscriptions, and one subscription's nodes can be covered by more than one collector.
8. **Subscription mergers**: a merged-away subscription (`lifecycleStatus: 'merged'`) points at the surviving subscription via `mergedInto`; the survivor points back via `mergedFrom` and carries the absorbed capacity as a `mergedCapacityDelta` on its service-level breakdown, so invoices, timeline events, and consumption trends on both sides stay historically accurate.
9. **Invoice delivery preferences** are keyed by `subscriptionId` and can be managed one at a time or in bulk (all subscriptions, or a multi-select) from the global Invoices tab.

## Key Statistics (as of the current mock dataset)

- **Total Subscriptions**: 15 (`mockSubscriptions`), 14 active (`activeMockSubscriptions`) — 1 merged away
- **Expiring Soon** (< 90 days): 4
- **Subscriptions in Burst**: 5
- **Subscriptions in Activation**: 1
- **Volumes**: 54, **Hardware Nodes**: 36
- **Recommendations**: 7
- **Purchase Orders**: 5 (`mockPurchaseOrders`); **PO upload entries**: 7 (5 approved backfilled from POs, 1 pending, 1 rejected)
- **Rolling Invoices** (6 months × 12 subscriptions, fewer for the merged-away subscription once clipped at its merge date): ~70
- **Keystone Agent collector instances**: 10 (1–2 per region, covering all 36 hardware nodes with no gaps/overlaps)
- **AutoSupport records**: 36 (one per hardware node)
- **Subscription mergers**: 1 curated scenario — `1789858601` merged into `1789858609` on `2026-03-20`

## Notes

- All active subscriptions have end dates after 2025 to avoid showing as expired.
- Consumption trend data covers 30 days from 2026-01-09 to 2026-02-07, then is scaled per subscription and per service level for downstream charts.
- `PLATFORM_REFERENCE_DATE` (in `dateShift.ts`, re-exported from `mockData.ts`) is real "today" — computed fresh from `new Date()` on every load, so the whole prototype's relative dates/statuses always stay current. Every literal date in the mock data (subscription start/end, PO windows, invoices, alerts, SLA charts, etc.) was authored against a fixed anchor (`2026-04-09`) and is shifted by the same delta as real "now" vs. that anchor (`TIMELINE_SHIFT_DAYS`, via `shiftDatesDeep`/`shiftIsoDate`/`shiftAnyDateString`) — see `dateShift.ts`. Because both "today" and every other date move together, every relative relationship in the data (overdue invoices, expiring-soon subscriptions, recent alerts) stays correct no matter when the prototype is opened, with no manual re-dating needed.
- The data is designed to showcase a range of states across subscriptions, invoices, and purchase orders: healthy, at-risk, critical, overdue, depleting-soon, and merged.
- The Cost Explorer's daily/weekly views are a **display-only** split of real monthly totals (seeded, deterministic) — they do not introduce new ground-truth numbers, so exports and the monthly "Total" column always reconcile with `allSubscriptionInvoices`.
