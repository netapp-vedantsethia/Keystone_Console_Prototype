# NetApp Console — Keystone STaaS Subscription Management Prototype

## Overview
This is a high-fidelity enterprise SaaS prototype for NetApp Console's Keystone Storage-as-a-Service (STaaS) subscription management platform.

## Features Implemented

### 🎯 Top-Level Screens (left nav)
1. **Overview** — Fleet-wide KPIs, alerts, cost & billing summary, PO health, quick actions
2. **Subscriptions** — Comprehensive table view with filters, leads to Subscription Detail
3. **Billing & Cost** — Invoices, Purchase Orders, and Cost Explorer tabs
4. **Assets** — Volumes and hardware nodes across the fleet
5. **Operations Center** — Active Alerts, Alert Monitors, Metadata Collection, Service Requests, and Support Cases in one screen (merges what used to be separate Monitoring / Support Requests nav items)

### 📊 Subscription Detail Tabs
- **Recommendations** — Categorized action items with impact/urgency (shown only when applicable)
- **Current Consumption** — Real-time capacity breakdown by service level
- **Consumption Trends** — Interactive chart with spike analysis
- **Volumes** — Detailed volume metrics with optimization suggestions
- **SLA** — Performance, Availability, and Sustainability tracking
- **Billing & Invoices** — Per-subscription invoice history with line items
- **Add-ons** — Add-on service levels and pricing

### 💳 Billing & Cost Screen
- **Invoices** — Fleet-wide invoice list across every subscription, with overview cards (avg monthly cost, unpaid invoices, PO health, delivery status), period/subscription/status filters, CSV export, and a detailed invoice explainer drawer on row click (`InvoiceDetailDrawer`). "Manage delivery preferences" opens the same delivery-preferences drawer used at the subscription level, plus an org-wide scope picker — apply to all subscriptions, or select one or more from a multi-select list
- **Purchase Orders** — One unified page (no sub-tabs): fleet summary cards (active POs, total value, remaining value, sufficiency), a search + status filter bar (All / Active / Depleting soon / Exhausted / Pending review / Rejected), and a slim, one-line-per-PO list. Each approved PO's row packs its status badge, consumption bar/%, consumed vs. total, remaining value, runway (billing cycles drawn vs. elapsed), and covered subscriptions (one-to-many and many-to-one PO ↔ subscription mappings) onto a single line, with vendor/term/service-level and a full per-subscription drawdown breakdown revealed by clicking the row to expand it. Pending/rejected uploads are equally slim rows (amber/red tinted) showing OM status, mapped subscription, and — for rejections — the reason, in the same list. Upload, edit, and re-map all open right-side slide-out drawers (matching every other action in the app) instead of centered modals; re-mapping resets a PO to "Pending Review" since it requires OM re-approval.
- **Cost Explorer** — An AWS Cost Explorer–style view driven entirely by real invoices: date range (billing period / 3M / 6M / 1Y / YTD), granularity (daily / weekly / monthly, restricted sensibly per range), service-level filter, and group-by (cost component / subscription / account / service level). Renders a **Cost** section (stacked $ bar chart + collapsible, CSV-exportable breakdown table) and a **Usage** section (committed/burst capacity ceiling, stacked TiB bar chart with ceiling reference lines, and a collapsible/exportable usage breakdown table)

### 🛟 Operations Center Screen
- **Active Alerts** — Fleet-wide alert feed (security, capacity, compliance, infrastructure) with a detail drawer and "Create Support Case" hand-off
- **Alert Monitors** — Configured threshold/condition monitors that generate the alerts above
- **Metadata Collection** — How Keystone collects platform telemetry, from the two real collection methods:
  - **Keystone Agent** (collector) — many-to-many with subscriptions/nodes; a regional collector instance streams real-time usage + performance telemetry for a pool of nodes that can span multiple subscriptions, and a subscription's nodes can be split across more than one collector
  - **AutoSupport (ASUP)** — one-to-one with a node; a once-daily, point-in-time capacity snapshot per node used for billing/capacity verification, with no performance or real-time detail
  - Three summary cards lead with the natural hierarchy — **Subscriptions impact → Data sources impact → Node impact** — followed by two views: **By subscription** (expandable per-subscription rows drilling into each node's Keystone Agent + AutoSupport status) and **By source** (Keystone Agent instances and AutoSupport records grouped by collection method). Both views open the same "what went wrong / evidence / recommended steps / KB article" detail drawer, and issues are seeded on the same subscriptions already referenced by Active Alerts so the story is consistent across tabs
- **Service Requests** — Modification / renewal / service-level-change / capacity-increase requests, linked to subscriptions
- **Support Cases** — Ticket list with SLA, comments, and case detail drawer

### 🎨 Design System
- **Colors**: Neutral backgrounds with blue (#0066CC) primary accent
- **Status indicators**: Green (healthy), Amber (warning), Red (critical), Gray (unknown)
- **Layout**: Fixed left navigation + top header
- **Typography**: Clean, enterprise-grade sans-serif (SF Pro)
- **Accessibility**: High contrast for severity states

### 👤 Role-Based UI
Four user personas supported via `userRoles` in `mockData.ts`:
- Subscription Admin (full access)
- Subscription Viewer (read-only)
- Storage Admin (technical focus)
- Storage Operator (operational focus)

### 🏢 Customer Types
Three tenancy models via `customerTypes` in `mockData.ts`:
- Direct Customer
- Reseller (Sell-through)
- Service Provider (Sell-to)

### ✨ Interactive Features
- **Spike Analysis** — Click chart regions on Consumption Trends to analyze usage increases
- **Volume Detail Panel** — Slide-in drawer with performance metrics and suggestions
- **Invoice Detail** — Expandable rows with committed / burst / add-ons / extras breakdown
- **Support Case Creation** — Auto-populated context from selected data
- **Deployment / Site Readiness / Renewal / Modification** flows via modals & drawers

### 📈 Data Visualizations (Recharts)
- Line charts for consumption trends, cost trends, and performance SLA tracking
- Stacked bar charts for cost breakdowns and service-level splits, including the global Cost Explorer's $ cost and TiB usage charts (with dashed committed/ceiling reference lines)
- Forecast overlays with reference regions

## Data Model

All platform data is centralized in `src/app/data/mockData.ts` (plus `consoleOperationsMock.ts` for alerts/agents/service requests). See `src/app/data/README.md` for the full reference.

- **Subscriptions** (`mockSubscriptions`) are the core entity — everything else (volumes, invoices, purchase orders, recommendations) is derived from or keyed by subscription.
- **Invoices** (`buildInvoicesForSubscription`, `allSubscriptionInvoices`) are generated per subscription per billing period from committed rate, burst usage, add-ons, and extra line items — and linked to a Purchase Order where one applies.
- **Purchase Orders** (`mockPurchaseOrders`, `purchaseOrderMetricsList`) model one-to-many and many-to-one PO ↔ subscription relationships, with dynamically computed consumption, remaining balance, burn rate, and depletion forecast. `mockPoUploadEntries` layers the upload/OM-review workflow (Upload & Map POs) on top — every approved PO is backfilled as an approved upload, plus one curated pending and one curated rejected example.
- **Invoice delivery preferences** (`invoiceDeliveryPreferenceForSubscription`, `fleetInvoiceDeliverySummary`) drive both the subscription-level and org-wide delivery drawers from the same seed data, so per-subscription and fleet-wide delivery health always agree.
- **Cost Explorer**, **Invoices**, and the Overview's Cost & Billing / PO Health widgets all read from the same fleet-wide aggregation helpers (`buildInvoicesForSubscription`, `allSubscriptionInvoices`, `fleetBillingTotalsForOffset`, `purchaseOrdersSummary`) so the numbers stay consistent across the app. The Cost Explorer's daily/weekly buckets are a deterministic, seeded split of each real billing month's totals — every bucket's numbers still sum back to the true monthly invoice figures.
- **Metadata Collection** (`getMockConsoleKeystoneAgentCollectors`, `getMockConsoleAsupRecords`, both in `consoleOperationsMock.ts`) are generated from `mockHardwareNodes` so the fleet used for telemetry health matches the fleet shown on Assets:
  - Keystone Agent collectors are pooled 1–2 per region and nodes are round-robined across a region's pool, producing genuine node-level many-to-many coverage (one collector can serve nodes from multiple subscriptions; one subscription's nodes can be split across collectors).
  - AutoSupport records are one row per hardware node (strict one-to-one).
  - A couple of curated issue states are seeded on the same subscriptions already referenced by `mockConsoleActiveAlerts` (1789858603, 1789858607, 1789858608) so Active Alerts and Metadata Collection tell one consistent story.

## Technical Stack
- **React** 18 with TypeScript
- **Vite** for dev server and build
- **Recharts** for data visualization
- **Tailwind CSS** v4 for styling
- **Lucide React** for icons
- **Radix UI** primitives (`popover`, `sheet`) for accessibility

## Usage Tips

1. **Explore Navigation**: Click through all left nav items to see each section
2. **Interactive Charts**: Hover over charts for tooltips, click the spike region in Consumption Trends for analysis
3. **Table Interactions**: Click subscription rows to view details, use filters and search
4. **Billing & Cost**: Switch between Invoices / Purchase Orders / Cost Explorer tabs to see linked data

## Code Owners
- Vedant Sethia [vedant.sethia@netapp.com]

---

**Note**: This is a high-fidelity prototype with realistic mock data. All interactions are client-side and designed for demonstration purposes.
