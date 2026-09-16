# NetApp Console Codebase Structure

## Directory Organization

```
/src
├── /app
│   ├── App.tsx                          # Main application entry point / screen router
│   ├── /components
│   │   ├── /console                     # Top-level console screens, modals & drawers
│   │   │   ├── ActivationTrackerModal.tsx
│   │   │   ├── CartModal.tsx
│   │   │   ├── ConsoleAssets.tsx
│   │   │   ├── ConsoleBillingCost.tsx           # Billing & Cost shell (tab switcher)
│   │   │   ├── ConsoleBillingCostExplorerTab.tsx
│   │   │   ├── ConsoleBillingInvoicesTab.tsx
│   │   │   ├── ConsoleBillingPurchaseOrdersTab.tsx
│   │   │   ├── ConsoleBreadcrumbs.tsx
│   │   │   ├── ConsoleHeader.tsx
│   │   │   ├── ConsoleLeftNav.tsx
│   │   │   ├── ConsoleMetadataCollectionTab.tsx # By subscription / by source views for Keystone Agent + AutoSupport (used by Operations Center)
│   │   │   ├── ConsoleOverview.tsx
│   │   │   ├── ConsolePageHeader.tsx
│   │   │   ├── ConsoleSubscriptionDetail.tsx
│   │   │   ├── ConsoleSubscriptionsList.tsx
│   │   │   ├── ConsoleSupportOperations.tsx     # Operations Center shell (Alerts/Monitors/Metadata Collection/Requests/Cases)
│   │   │   ├── DeploymentDesignModal.tsx
│   │   │   ├── DeploymentPlanModal.tsx
│   │   │   ├── HealthReportModal.tsx
│   │   │   ├── InvoiceDeliveryFailuresDrawer.tsx # Portal/email delivery failure detail, links to the preferences drawer
│   │   │   ├── InvoiceDeliveryPreferencesDrawer.tsx # AP portal / email delivery form — single-subscription or org-wide scope
│   │   │   ├── InvoiceDetailDrawer.tsx          # Detailed invoice explainer (line items, PoP deltas, dispute/merge banners)
│   │   │   ├── ModificationFormDrawer.tsx
│   │   │   ├── OpenSupportCaseModal.tsx
│   │   │   ├── RenewalFormDrawer.tsx
│   │   │   ├── SiteReadinessModal.tsx
│   │   │   ├── SubscriptionPurchaseOrdersDrawer.tsx # POs covering one subscription, links out to global PO Management
│   │   │   └── billingFormat.ts                 # Shared currency formatting + invoice status helpers
│   │   ├── /tabs                        # Subscription Detail tabs
│   │   │   ├── AddonsTab.tsx
│   │   │   ├── BillingTab.tsx
│   │   │   ├── ConsumptionTrendsTab.tsx
│   │   │   ├── CurrentConsumptionTab.tsx
│   │   │   ├── RecommendationsTab.tsx
│   │   │   ├── SLATab.tsx
│   │   │   └── VolumesTab.tsx
│   │   └── /ui                          # Reusable UI primitives
│   │       ├── DataTable.tsx            # Standardized table components (+ pagination footer)
│   │       ├── button.tsx
│   │       ├── popover.tsx
│   │       ├── sheet.tsx
│   │       └── utils.ts
│   ├── /constants
│   │   └── tablePagination.ts           # Shared page-size constant
│   ├── /data                            # Centralized data store
│   │   ├── mockData.ts                  # Subscriptions, volumes, invoices, POs, recommendations, SLA data
│   │   ├── consoleOperationsMock.ts     # Alerts, monitors, agents, service requests, cases
│   │   └── README.md                    # Data documentation
│   ├── /hooks
│   │   └── useTablePagination.ts        # Pagination state hook used by DataTable-backed views
│   └── /utils
│       ├── subscriptionsCsv.ts          # CSV export for the subscriptions list
│       └── invoiceCsv.ts                # CSV export for a single invoice (with line items) or a list of invoices
├── /assets                               # Raster assets (hashed filenames) + logo path data
└── /styles
    ├── fonts.css                         # Font imports
    ├── index.css                         # Global styles
    ├── tailwind.css                      # Tailwind configuration
    └── theme.css                         # Design system tokens
```

## Screens & Routing

`App.tsx` holds `activeScreen` in state and renders the matching component. The left nav (`ConsoleLeftNav`) drives navigation between:

| Screen id | Component |
|---|---|
| `overview` | `ConsoleOverview` |
| `subscriptions` | `ConsoleSubscriptionsList` |
| `billing-cost` | `ConsoleBillingCost` (tabs: `invoices`, `purchase-orders`, `cost-explorer`) |
| `assets` | `ConsoleAssets` |
| `support` | `ConsoleSupportOperations` (tabs: `alerts`, `monitors`, `metadata` → `ConsoleMetadataCollectionTab`, `requests`, `cases`) |
| `subscription-detail` | `ConsoleSubscriptionDetail` (drill-in from Subscriptions/Overview, not in the left nav) |

`ConsoleSubscriptionDetail` manages its own tab state (`recommendations`, `current-consumption`, `consumption-trends`, `volumes`, `sla`, `billing`, `addons`) independent of the top-level screen router — a merged-away subscription's tab list is filtered down to just `current-consumption`, `consumption-trends`, `billing`, and a timeline entry point.

`ConsoleBillingPurchaseOrdersTab` (the `purchase-orders` tab within `ConsoleBillingCost`) is a single page with no internal sub-tabs: a search box + status filter chips (All / Active / Depleting soon / Exhausted / Pending review / Rejected) narrow a slim, one-line-per-PO list (click a row to expand its vendor/term/drawdown detail in place); upload, edit, and re-map open right-side `Sheet` drawers rather than modals, consistent with every other drawer in the app.

## Data Organization

All platform data is centralized in `src/app/data/mockData.ts` (with operational data such as alerts/agents/cases in `consoleOperationsMock.ts`). See `src/app/data/README.md` for the full field-level reference. Key exports:

- `mockSubscriptions`, `activeMockSubscriptions` — the core entity; `activeMockSubscriptions` excludes merged/terminated subscriptions and backs every fleet-wide KPI
- `mockVolumes`, `mockHardwareNodes` — Assets data
- `mockRecommendations` / `getRecommendationsForSubscription`
- `buildInvoicesForSubscription`, `allSubscriptionInvoices` — per-subscription and fleet-wide invoices
- `mockPurchaseOrders`, `purchaseOrderMetricsList`, `purchaseOrdersSummary` — PO health & consumption
- `mockPoUploadEntries`, `poUploadEntriesSummary` — PO upload/OM-review queue that feeds the Upload & Map POs sub-tab
- `invoiceDeliveryPreferenceForSubscription`, `fleetInvoiceDeliverySummary` — per-subscription and fleet-wide invoice delivery preferences/health
- `fleetBillingTotalsForOffset` — fleet-wide monthly billing totals (used by Overview and Cost Explorer alike, so the numbers agree)
- `getSubscriptionTimeline`, `buildStitchedHistoricalTrendForServiceLevel` — subscription merger timeline events and stitched pre/post-merge consumption trend
- `getMockConsoleKeystoneAgentCollectors`, `getMockConsoleAsupRecords`, `metadataCollectionHealthSummary` — Metadata Collection (Keystone Agent / AutoSupport), derived from `mockHardwareNodes`; exposed as memoized getters (not eager consts) to avoid a module-init race with the `mockData.ts` ↔ `consoleOperationsMock.ts` circular import
- `metadataSubscriptionRollups`, `nodeTelemetryStatus`, `collectorForNode`, `asupForNode` — per-subscription/per-node rollups that power the "By subscription" view (a node's telemetry status is the worse of its Keystone Agent and AutoSupport status)
- `userRoles`, `customerTypes` — role/tenancy constants used by `App.tsx`

## Design System

All styling adheres to the NetApp design system defined in `src/styles/theme.css`:

- Colors: `--color-*` (background, foreground, primary, etc.)
- Spacing: standard Tailwind spacing
- Borders: `--color-border`
- Radius: `--radius-*` (sm, md, lg, xl)
- Typography: SF Pro font family

### Typography Standards
- Font Family: `'SF_Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI'`
- Table Headers: 13px, font-weight 590, #1c1c1c
- Table Cells: 14px, font-weight 400, #1c1c1c, line-height 24px
- Table Header Background: #DDF1FF

### Component Patterns
- Use `DataTable` (`components/ui/DataTable.tsx`) for all tables, paired with `useTablePagination`
- Follow SF Pro typography throughout

## Import Guidelines

```typescript
// Console components
import { ConsoleHeader } from './components/console/ConsoleHeader';

// Data
import { mockSubscriptions, Subscription } from './data/mockData';

// UI components
import { DataTable } from './components/ui/DataTable';
import { Button } from './components/ui/button';
```

## Protected Files

These files must NOT be modified or deleted without explicit instruction:
- `/pnpm-lock.yaml`

## Notes

1. All active screen-level components live in `/src/app/components/console/`.
2. All mock/sample data is centralized in `/src/app/data/` — do not hardcode data values in components.
3. Tables use the standardized `DataTable` component with shared pagination.
