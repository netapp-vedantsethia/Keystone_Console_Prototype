import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { BpCard, BpCardProperty, BpTabGroup, BpDropdown } from '@netapp/blueprint/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildInvoicesForSubscription,
  seededFraction,
  type Subscription,
  type SubscriptionInvoice,
} from '../../data/mockData';
import { useConsoleMode } from '../../context/ConsoleModeContext';
import { formatUsd, formatUsdCompact } from './billingFormat';

type DateRangeMode = 'billing-period' | '3m' | '6m' | '1y' | 'ytd';
type Granularity = 'daily' | 'weekly' | 'monthly';
type GroupBy = 'cost-component' | 'subscription' | 'account' | 'service-level';

const DATE_RANGE_OPTIONS: { id: DateRangeMode; label: string }[] = [
  { id: 'billing-period', label: 'Billing period' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: '1y', label: '1Y' },
  { id: 'ytd', label: 'YTD' },
];

const GRANULARITY_OPTIONS_BY_RANGE: Record<DateRangeMode, Granularity[]> = {
  'billing-period': ['daily', 'weekly'],
  '3m': ['weekly', 'monthly'],
  '6m': ['monthly'],
  '1y': ['monthly'],
  ytd: ['monthly'],
};

const GRANULARITY_LABEL: Record<Granularity, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const GROUP_BY_LABEL: Record<GroupBy, string> = {
  'cost-component': 'Cost component',
  subscription: 'Subscription',
  account: 'Account',
  'service-level': 'Service level',
};

const COST_COMPONENT_COLORS: Record<string, string> = {
  committed: '#0d9488',
  burst: '#f59e0b',
  addons: '#8b5cf6',
  extras: '#ec4899',
};
const DIMENSION_COLORS = ['#0d9488', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#94a3b8'];
const SHARED_CHARGES_KEY = '__shared_charges__';

interface Slice {
  committedCost: number;
  burstCost: number;
  addOnsCost: number;
  extrasCost: number;
  totalCost: number;
  committedTib: number;
  burstTib: number;
}

function emptySlice(): Slice {
  return { committedCost: 0, burstCost: 0, addOnsCost: 0, extrasCost: 0, totalCost: 0, committedTib: 0, burstTib: 0 };
}

function addSlice(a: Slice, b: Slice): Slice {
  return {
    committedCost: a.committedCost + b.committedCost,
    burstCost: a.burstCost + b.burstCost,
    addOnsCost: a.addOnsCost + b.addOnsCost,
    extrasCost: a.extrasCost + b.extrasCost,
    totalCost: a.totalCost + b.totalCost,
    committedTib: a.committedTib + b.committedTib,
    burstTib: a.burstTib + b.burstTib,
  };
}

function scaleSlice(s: Slice, factor: number): Slice {
  return {
    committedCost: s.committedCost * factor,
    burstCost: s.burstCost * factor,
    addOnsCost: s.addOnsCost * factor,
    extrasCost: s.extrasCost * factor,
    totalCost: s.totalCost * factor,
    committedTib: s.committedTib * factor,
    burstTib: s.burstTib * factor,
  };
}

/** Committed/burst cost + TiB restricted to `serviceLevelFilter` — add-ons/extras aren't level-specific, so they only count when viewing all levels. */
function sliceInvoice(inv: SubscriptionInvoice, serviceLevelFilter: string): Slice {
  const items = serviceLevelFilter === 'all' ? inv.lineItems : inv.lineItems.filter((li) => li.serviceLevel === serviceLevelFilter);
  const committedCost = items.reduce((s, li) => s + li.committedCost, 0);
  const burstCost = items.reduce((s, li) => s + li.burstCost, 0);
  const committedTib = items.reduce((s, li) => s + li.committedTib, 0);
  const burstTib = items.reduce((s, li) => s + li.burstTib, 0);
  const addOnsCost = serviceLevelFilter === 'all' ? inv.addOnsCost : 0;
  const extrasCost = serviceLevelFilter === 'all' ? inv.extrasCost : 0;
  return {
    committedCost,
    burstCost,
    addOnsCost,
    extrasCost,
    totalCost: committedCost + burstCost + addOnsCost + extrasCost,
    committedTib,
    burstTib,
  };
}

interface DimensionRow {
  key: string;
  label: string;
  slice: Slice;
}

interface MonthAgg {
  periodKey: string;
  periodDate: string;
  label: string;
  totals: Slice;
  dimensionRows: DimensionRow[];
}

function monthLabel(periodDateIso: string): string {
  return new Date(periodDateIso).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function monthsCountForRange(mode: DateRangeMode, referenceDate: Date): number {
  switch (mode) {
    case 'billing-period':
      return 1;
    case '3m':
      return 3;
    case '6m':
      return 6;
    case '1y':
      return 12;
    case 'ytd': {
      const lastClosedMonthIndex = referenceDate.getUTCMonth() - 1;
      return Math.max(1, lastClosedMonthIndex + 1);
    }
    default:
      return 1;
  }
}

function buildMonthlyAgg(
  monthsCount: number,
  serviceLevelFilter: string,
  groupBy: GroupBy,
  subscriptionFilter: string,
  allSubs: Subscription[],
): MonthAgg[] {
  const perMonth = new Map<string, MonthAgg>();
  const subs = subscriptionFilter === 'all' ? allSubs : allSubs.filter((s) => s.id === subscriptionFilter);
  for (const sub of subs) {
    const invoices = buildInvoicesForSubscription(sub, monthsCount);
    for (const inv of invoices) {
      const key = inv.periodDate.slice(0, 7);
      let agg = perMonth.get(key);
      if (!agg) {
        agg = { periodKey: key, periodDate: inv.periodDate, label: monthLabel(inv.periodDate), totals: emptySlice(), dimensionRows: [] };
        perMonth.set(key, agg);
      }
      const slice = sliceInvoice(inv, serviceLevelFilter);
      agg.totals = addSlice(agg.totals, slice);

      if (groupBy === 'subscription' || groupBy === 'account') {
        const dimKey = groupBy === 'subscription' ? sub.id : sub.account;
        const dimLabel = groupBy === 'subscription' ? `${sub.trackingId} · ${sub.account}` : sub.account;
        let row = agg.dimensionRows.find((r) => r.key === dimKey);
        if (!row) {
          row = { key: dimKey, label: dimLabel, slice: emptySlice() };
          agg.dimensionRows.push(row);
        }
        row.slice = addSlice(row.slice, slice);
      } else if (groupBy === 'service-level') {
        const items = serviceLevelFilter === 'all' ? inv.lineItems : inv.lineItems.filter((li) => li.serviceLevel === serviceLevelFilter);
        for (const li of items) {
          let row = agg.dimensionRows.find((r) => r.key === li.serviceLevel);
          if (!row) {
            row = { key: li.serviceLevel, label: li.serviceLevel, slice: emptySlice() };
            agg.dimensionRows.push(row);
          }
          row.slice.committedCost += li.committedCost;
          row.slice.burstCost += li.burstCost;
          row.slice.totalCost += li.committedCost + li.burstCost;
          row.slice.committedTib += li.committedTib;
          row.slice.burstTib += li.burstTib;
        }

        if (serviceLevelFilter === 'all' && (inv.addOnsCost > 0 || inv.extrasCost > 0)) {
          let sharedChargesRow = agg.dimensionRows.find((r) => r.key === SHARED_CHARGES_KEY);
          if (!sharedChargesRow) {
            sharedChargesRow = { key: SHARED_CHARGES_KEY, label: 'Shared charges', slice: emptySlice() };
            agg.dimensionRows.push(sharedChargesRow);
          }
          sharedChargesRow.slice.addOnsCost += inv.addOnsCost;
          sharedChargesRow.slice.extrasCost += inv.extrasCost;
          sharedChargesRow.slice.totalCost += inv.addOnsCost + inv.extrasCost;
        }
      }
    }
  }

  const months = Array.from(perMonth.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  if (groupBy === 'cost-component') {
    for (const m of months) {
      m.dimensionRows = [
        { key: 'committed', label: 'Committed Capacity', slice: { ...emptySlice(), committedCost: m.totals.committedCost, totalCost: m.totals.committedCost } },
        { key: 'burst', label: 'Burst Capacity', slice: { ...emptySlice(), burstCost: m.totals.burstCost, totalCost: m.totals.burstCost } },
        { key: 'addons', label: 'Add-ons', slice: { ...emptySlice(), addOnsCost: m.totals.addOnsCost, totalCost: m.totals.addOnsCost } },
        { key: 'extras', label: 'Extras', slice: { ...emptySlice(), extrasCost: m.totals.extrasCost, totalCost: m.totals.extrasCost } },
      ];
    }
  } else {
    for (const m of months) m.dimensionRows.sort((a, b) => b.slice.totalCost - a.slice.totalCost);
  }

  return months;
}

function daysInMonth(periodKey: string): number {
  const [y, m] = periodKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function bucketWeights(periodKey: string, count: number): number[] {
  const raw = Array.from({ length: count }, (_, i) => 0.65 + seededFraction(`cost-explorer-${periodKey}-${i}`) * 0.7);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

interface Bucket {
  key: string;
  label: string;
  totals: Slice;
  dimensionRows: DimensionRow[];
}

interface TooltipPayloadEntry {
  value?: unknown;
  name?: unknown;
  color?: unknown;
}

interface MetricTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadEntry[];
  valueFormatter: (value: number) => string;
  totalLabel?: string;
}

function MetricTooltip({ active, label, payload, valueFormatter, totalLabel = 'Total' }: MetricTooltipProps) {
  if (!active || !payload?.length) return null;

  const numericEntries = payload.filter((entry): entry is TooltipPayloadEntry & { value: number } => typeof entry.value === 'number');
  if (!numericEntries.length) return null;

  const visibleEntries = numericEntries.filter((entry) => entry.value !== 0);
  const entriesToRender = visibleEntries.length ? visibleEntries : numericEntries;
  const total = numericEntries.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="min-w-[180px] rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-2 text-xs font-semibold text-gray-900">{label}</div>
      <div className="space-y-1.5">
        {entriesToRender.map((entry) => (
          <div key={String(entry.name)} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeof entry.color === 'string' ? entry.color : '#94a3b8' }} />
              <span>{String(entry.name)}</span>
            </div>
            <span className="font-medium text-gray-900">{valueFormatter(entry.value)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-gray-200 pt-2">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold text-gray-900">
          <span>{totalLabel}</span>
          <span>{valueFormatter(total)}</span>
        </div>
      </div>
    </div>
  );
}

function expandMonthToBuckets(month: MonthAgg, granularity: Granularity): Bucket[] {
  if (granularity === 'monthly') {
    return [{ key: month.periodKey, label: month.label, totals: month.totals, dimensionRows: month.dimensionRows }];
  }
  const totalDays = daysInMonth(month.periodKey);
  const count = granularity === 'daily' ? totalDays : Math.ceil(totalDays / 7);
  const weights = bucketWeights(month.periodKey, count);
  return weights.map((w, i) => {
    const label =
      granularity === 'daily'
        ? new Date(`${month.periodKey}-${String(Math.min(totalDays, i + 1)).padStart(2, '0')}`).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            timeZone: 'UTC',
          })
        : `Wk ${i + 1}`;
    return {
      key: `${month.periodKey}-${i}`,
      label,
      totals: scaleSlice(month.totals, w),
      dimensionRows: month.dimensionRows.map((r) => ({ ...r, slice: scaleSlice(r.slice, w) })),
    };
  });
}

function fleetCommittedTibNow(serviceLevelFilter: string, subscriptionFilter: string, allActiveSubs: Subscription[]): number {
  const subs = subscriptionFilter === 'all' ? allActiveSubs : allActiveSubs.filter((s) => s.id === subscriptionFilter);
  return subs.reduce((sum, sub) => {
    if (serviceLevelFilter === 'all') return sum + sub.committed;
    const row = sub.serviceLevelBreakdown.find((b) => b.level === serviceLevelFilter);
    return sum + (row?.committed ?? 0);
  }, 0);
}

function download(csv: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ConsoleBillingCostExplorerTab() {
  const { scopedSubscriptions, scopedActiveSubscriptions } = useConsoleMode();
  const [dateRangeMode, setDateRangeMode] = useState<DateRangeMode>('billing-period');
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const [serviceLevelFilter, setServiceLevelFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('cost-component');
  const [costTableCollapsed, setCostTableCollapsed] = useState(false);
  const [usageTableCollapsed, setUsageTableCollapsed] = useState(false);

  const serviceLevelOptions = useMemo(
    () => Array.from(new Set(scopedSubscriptions.flatMap((s) => s.serviceLevels))).sort(),
    [scopedSubscriptions],
  );
  const subscriptionOptions = useMemo(
    () =>
      [...scopedSubscriptions]
        .sort((a, b) => `${a.trackingId} ${a.account}`.localeCompare(`${b.trackingId} ${b.account}`))
        .map((s) => ({ id: s.id, label: `${s.trackingId} · ${s.account}` })),
    [scopedSubscriptions],
  );

  const referenceDate = useMemo(() => new Date(), []);
  const monthsCount = monthsCountForRange(dateRangeMode, referenceDate);

  const availableGranularities = GRANULARITY_OPTIONS_BY_RANGE[dateRangeMode];
  const effectiveGranularity = availableGranularities.includes(granularity) ? granularity : availableGranularities[0];

  const monthsWithPrevious = useMemo(
    () => buildMonthlyAgg(monthsCount * 2, serviceLevelFilter, groupBy, subscriptionFilter, scopedSubscriptions),
    [monthsCount, serviceLevelFilter, groupBy, subscriptionFilter, scopedSubscriptions],
  );
  const months = useMemo(() => monthsWithPrevious.slice(-monthsCount), [monthsWithPrevious, monthsCount]);
  const previousMonths = useMemo(
    () => monthsWithPrevious.slice(0, Math.max(0, monthsWithPrevious.length - monthsCount)),
    [monthsWithPrevious, monthsCount],
  );

  const buckets = useMemo(() => months.flatMap((m) => expandMonthToBuckets(m, effectiveGranularity)), [months, effectiveGranularity]);

  const latestMonth = months[months.length - 1];
  const previousMonth = months.length > 1 ? months[months.length - 2] : previousMonths[previousMonths.length - 1];

  const periodTotals = useMemo(() => months.reduce((acc, m) => addSlice(acc, m.totals), emptySlice()), [months]);
  const previousPeriodTotal = useMemo(() => previousMonths.reduce((s, m) => s + m.totals.totalCost, 0), [previousMonths]);

  const burstTrendPct =
    previousMonth && previousMonth.totals.burstCost > 0
      ? ((latestMonth.totals.burstCost - previousMonth.totals.burstCost) / previousMonth.totals.burstCost) * 100
      : null;
  const totalDeltaVsPrevious = previousMonth ? latestMonth.totals.totalCost - previousMonth.totals.totalCost : null;
  const periodVsPreviousPct = previousPeriodTotal > 0 ? ((periodTotals.totalCost - previousPeriodTotal) / previousPeriodTotal) * 100 : null;
  const annualRunRate = latestMonth ? latestMonth.totals.totalCost * 12 : 0;

  // Top dimension keys across the whole selected window, capped so the chart/table stay readable.
  const dimensionSeries = useMemo(() => {
    if (groupBy === 'cost-component') {
      return [
        { key: 'committed', label: 'Committed Capacity', color: COST_COMPONENT_COLORS.committed },
        { key: 'burst', label: 'Burst Capacity', color: COST_COMPONENT_COLORS.burst },
        { key: 'addons', label: 'Add-ons', color: COST_COMPONENT_COLORS.addons },
        { key: 'extras', label: 'Extras', color: COST_COMPONENT_COLORS.extras },
      ];
    }
    const totalsByKey = new Map<string, { label: string; total: number }>();
    for (const m of months) {
      for (const row of m.dimensionRows) {
        const cur = totalsByKey.get(row.key) ?? { label: row.label, total: 0 };
        cur.total += row.slice.totalCost;
        totalsByKey.set(row.key, cur);
      }
    }
    const ranked = Array.from(totalsByKey.entries())
      .map(([key, v]) => ({ key, label: v.label, total: v.total }))
      .sort((a, b) => b.total - a.total);
    const top = ranked.slice(0, 6);
    const hasMore = ranked.length > 6;
    return [
      ...top.map((r, i) => ({ key: r.key, label: r.label, color: DIMENSION_COLORS[i % DIMENSION_COLORS.length] })),
      ...(hasMore ? [{ key: '__other__', label: 'Other', color: DIMENSION_COLORS[DIMENSION_COLORS.length - 1] }] : []),
    ];
  }, [months, groupBy]);

  const bucketCostValueForSeries = (bucket: Bucket, seriesKey: string): number => {
    if (seriesKey === '__other__') {
      const topKeys = new Set(dimensionSeries.filter((series) => series.key !== '__other__').map((series) => series.key));
      return bucket.dimensionRows.filter((row) => !topKeys.has(row.key)).reduce((sum, row) => sum + row.slice.totalCost, 0);
    }
    const dimensionRow = bucket.dimensionRows.find((row) => row.key === seriesKey);
    return dimensionRow ? dimensionRow.slice.totalCost : 0;
  };

  const roundedBucketCostValueForSeries = (bucket: Bucket, seriesKey: string): number => Math.round(bucketCostValueForSeries(bucket, seriesKey));

  const roundedBucketCostTotal = (bucket: Bucket): number =>
    dimensionSeries.reduce((sum, series) => sum + roundedBucketCostValueForSeries(bucket, series.key), 0);

  const costChartData = useMemo(
    () =>
      buckets.map((b) => {
        const row: Record<string, string | number> = { label: b.label };
        for (const series of dimensionSeries) {
          row[series.key] = roundedBucketCostValueForSeries(b, series.key);
        }
        return row;
      }),
    [buckets, dimensionSeries],
  );

  const usageChartData = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.label,
        committed: Math.round(b.totals.committedTib * 10) / 10,
        burst: Math.round(b.totals.burstTib * 10) / 10,
      })),
    [buckets],
  );

  const committedCeilingTib = fleetCommittedTibNow(serviceLevelFilter, subscriptionFilter, scopedActiveSubscriptions);
  const burstHeadroomTib = Math.round(committedCeilingTib * 0.2 * 10) / 10;
  const totalCeilingTib = committedCeilingTib + burstHeadroomTib;
  const latestUsedTib = latestMonth ? latestMonth.totals.committedTib + latestMonth.totals.burstTib : 0;
  const ceilingPct = totalCeilingTib > 0 ? Math.round((latestUsedTib / totalCeilingTib) * 100) : 0;

  // Rounded to the same 1-decimal precision shown in the chart/table so every row and total agree exactly.
  const roundedCommittedTibForBucket = (b: Bucket): number => Math.round(b.totals.committedTib * 10) / 10;
  const roundedBurstTibForBucket = (b: Bucket): number => Math.round(b.totals.burstTib * 10) / 10;
  const roundedUsedTibForBucket = (b: Bucket): number => roundedCommittedTibForBucket(b) + roundedBurstTibForBucket(b);

  const avgCommittedTib = buckets.length ? buckets.reduce((s, b) => s + roundedCommittedTibForBucket(b), 0) / buckets.length : 0;
  const avgBurstTib = buckets.length ? buckets.reduce((s, b) => s + roundedBurstTibForBucket(b), 0) / buckets.length : 0;
  const avgUsedTib = avgCommittedTib + avgBurstTib;

  const handleExportCostCsv = () => {
    const header = ['Entity', ...buckets.map((b) => b.label), 'Total'];
    const rows = dimensionSeries.map((series) => {
      const values = buckets.map((b) => {
        if (series.key === '__other__') {
          const topKeys = new Set(dimensionSeries.map((s) => s.key));
          return Math.round(b.dimensionRows.filter((r) => !topKeys.has(r.key)).reduce((s, r) => s + r.slice.totalCost, 0));
        }
        const dim = b.dimensionRows.find((r) => r.key === series.key);
        return dim ? Math.round(dim.slice.totalCost) : 0;
      });
      const total = values.reduce((a, v) => a + v, 0);
      return [series.label, ...values, total];
    });
    const totalRow = ['Total', ...buckets.map((_, i) => rows.reduce((s, r) => s + Number(r[i + 1]), 0)), rows.reduce((s, r) => s + Number(r[r.length - 1]), 0)];
    const csv = [header, ...rows, totalRow].map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    download(csv, 'cost-breakdown.csv');
  };

  const handleExportUsageCsv = () => {
    const header = ['Entity', ...buckets.map((b) => b.label), 'Avg / period'];
    const committedRow = ['Committed capacity (TiB)', ...buckets.map((b) => roundedCommittedTibForBucket(b)), Math.round(avgCommittedTib * 10) / 10];
    const burstRow = ['Burst capacity (TiB)', ...buckets.map((b) => roundedBurstTibForBucket(b)), Math.round(avgBurstTib * 10) / 10];
    const usedRow = [
      'Used capacity (TiB)',
      ...buckets.map((b) => roundedUsedTibForBucket(b)),
      Math.round(avgUsedTib * 10) / 10,
    ];
    const csv = [header, committedRow, burstRow, usedRow].map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    download(csv, 'usage-breakdown.csv');
  };

  if (!latestMonth) {
    return <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No billing data available for this range.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BpCard>
          <BpCardProperty value={formatUsd(latestMonth.totals.committedCost)} property={`${latestMonth.label} — Committed`} />
          <div className="mt-1 text-xs text-gray-400">Contractual floor</div>
        </BpCard>
        <BpCard>
          <BpCardProperty value={formatUsd(latestMonth.totals.burstCost)} property={`${latestMonth.label} — Burst`} />
          {burstTrendPct !== null && (
            <div className={`mt-1 text-xs ${burstTrendPct >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {burstTrendPct >= 0 ? '▲' : '▼'} {Math.abs(burstTrendPct).toFixed(0)}% MoM
            </div>
          )}
        </BpCard>
        <BpCard>
          <BpCardProperty value={formatUsd(latestMonth.totals.totalCost)} property={`${latestMonth.label} — Total`} />
          {totalDeltaVsPrevious !== null && previousMonth && (
            <div className={`mt-1 text-xs ${totalDeltaVsPrevious >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {totalDeltaVsPrevious >= 0 ? '▲' : '▼'} {formatUsdCompact(Math.abs(totalDeltaVsPrevious))} vs {previousMonth.label}
            </div>
          )}
        </BpCard>
        <BpCard>
          <BpCardProperty value={formatUsdCompact(annualRunRate)} property="Annual run rate" />
          <div className="mt-1 text-xs text-gray-400">{latestMonth.label} × 12</div>
        </BpCard>
      </div>

      {/* Controls */}
      <div className="flex flex-nowrap items-end gap-3 overflow-x-auto rounded-lg border border-gray-200 bg-white p-4">
        <div className="shrink-0">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Date range</div>
          <BpTabGroup
            tabs={DATE_RANGE_OPTIONS.map((opt) => ({ id: opt.id, label: opt.label }))}
            value={dateRangeMode}
            onValueChange={(id) => setDateRangeMode(id as DateRangeMode)}
            variant="card"
            horizontalResizing="hug"
            tablistAriaLabel="Date range"
          />
        </div>
        <div className="w-32 shrink-0">
          <BpDropdown
            label="Granularity"
            value={effectiveGranularity}
            onValueChange={(value) => setGranularity((value ?? effectiveGranularity) as Granularity)}
            showClearButton={false}
            options={availableGranularities.map((g) => ({ value: g, label: GRANULARITY_LABEL[g] }))}
          />
        </div>
        <div className="w-48 shrink-0">
          <BpDropdown
            label="Subscription"
            value={subscriptionFilter}
            onValueChange={(value) => setSubscriptionFilter(value ?? 'all')}
            showClearButton={false}
            searchable
            options={[{ value: 'all', label: 'All subscriptions' }, ...subscriptionOptions.map((opt) => ({ value: opt.id, label: opt.label }))]}
          />
        </div>
        <div className="w-36 shrink-0">
          <BpDropdown
            label="Service level"
            value={serviceLevelFilter}
            onValueChange={(value) => setServiceLevelFilter(value ?? 'all')}
            showClearButton={false}
            options={[{ value: 'all', label: 'All' }, ...serviceLevelOptions.map((lvl) => ({ value: lvl, label: lvl }))]}
          />
        </div>
        <div className="w-36 shrink-0">
          <BpDropdown
            label="Group by"
            value={groupBy}
            onValueChange={(value) => setGroupBy((value ?? groupBy) as GroupBy)}
            showClearButton={false}
            options={(Object.keys(GROUP_BY_LABEL) as GroupBy[]).map((g) => ({ value: g, label: GROUP_BY_LABEL[g] }))}
          />
        </div>
        {periodVsPreviousPct !== null && (
          <div className="ml-auto shrink-0 whitespace-nowrap pl-3 text-right">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              vs previous {DATE_RANGE_OPTIONS.find((o) => o.id === dateRangeMode)?.label.toLowerCase()}
            </div>
            <div className={`text-sm font-semibold ${periodVsPreviousPct >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {periodVsPreviousPct >= 0 ? '▲' : '▼'} {formatUsdCompact(Math.abs(periodTotals.totalCost - previousPeriodTotal))} (
              {Math.abs(periodVsPreviousPct).toFixed(0)}%)
            </div>
          </div>
        )}
      </div>

      {/* Cost */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">Cost</h3>
        <p className="mb-4 text-xs text-gray-500">Cost ($) grouped by {GROUP_BY_LABEL[groupBy].toLowerCase()}</p>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={costChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={effectiveGranularity === 'daily' ? Math.ceil(costChartData.length / 15) : 0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatUsdCompact(v)} />
              <Tooltip
                content={({ active, label, payload }) => (
                  <MetricTooltip active={active} label={label} payload={payload} valueFormatter={formatUsd} totalLabel="Total cost" />
                )}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {dimensionSeries.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="cost" fill={s.color} name={s.label} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-400">Derived from Keystone billing invoices · Committed capacity is a contractual floor.</p>

        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setCostTableCollapsed((v) => !v)}
            className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5"
          >
            <span className="text-sm font-semibold text-gray-900">Cost breakdown</span>
            <div className="flex items-center gap-3">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportCostCsv();
                }}
                className="flex items-center gap-1 text-xs font-medium text-[#0067c5] hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </span>
              {costTableCollapsed ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
            </div>
          </button>
          {!costTableCollapsed && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-white">
                  <tr>
                    <th className="sticky left-0 bg-white px-4 py-2 text-left text-xs font-semibold text-gray-600">Entity</th>
                    {buckets.map((b) => (
                      <th key={b.key} className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        {b.label}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-gray-900">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dimensionSeries.map((series) => {
                    const values = buckets.map((b) => roundedBucketCostValueForSeries(b, series.key));
                    const total = values.reduce((a, v) => a + v, 0);
                    return (
                      <tr key={series.key} className="hover:bg-gray-50">
                        <td className="sticky left-0 bg-white px-4 py-2 font-medium text-gray-900">
                          <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: series.color }} />
                          {series.label}
                        </td>
                        {values.map((v, i) => (
                          <td key={buckets[i].key} className="whitespace-nowrap px-3 py-2 text-right text-gray-700">
                            {v > 0 ? formatUsd(v) : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-900">{formatUsd(total)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="sticky left-0 bg-gray-50 px-4 py-2 text-gray-900">Total</td>
                    {buckets.map((b) => (
                      <td key={b.key} className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                        {formatUsd(roundedBucketCostTotal(b))}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                      {formatUsd(buckets.reduce((sum, bucket) => sum + roundedBucketCostTotal(bucket), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Usage</h3>
          <div className="text-right text-xs text-gray-500">
            <span className="font-semibold text-gray-900">{ceilingPct}% of ceiling</span> — {latestMonth.label} (latest)
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="flex h-full">
              <div className="h-full bg-teal-600" style={{ width: `${totalCeilingTib > 0 ? Math.min(100, (committedCeilingTib / totalCeilingTib) * 100) : 0}%` }} />
              <div
                className="h-full bg-amber-500"
                style={{ width: `${totalCeilingTib > 0 ? Math.min(100, ((latestMonth.totals.burstTib) / totalCeilingTib) * 100) : 0}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-600" /> Commit: {formatTib(committedCeilingTib)} / {formatTib(committedCeilingTib)} TiB
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Burst: {formatTib(latestMonth.totals.burstTib)} / {formatTib(burstHeadroomTib)} TiB
            </span>
            <span className="text-gray-400">·</span>
            <span>
              {formatTib(latestUsedTib)} TiB used / {formatTib(totalCeilingTib)} TiB ceiling
            </span>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usageChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={effectiveGranularity === 'daily' ? Math.ceil(usageChartData.length / 15) : 0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${formatTib(v)}`} />
              <Tooltip
                content={({ active, label, payload }) => (
                  <MetricTooltip
                    active={active}
                    label={label}
                    payload={payload}
                    valueFormatter={(value) => `${formatTib(value)} TiB`}
                    totalLabel="Total used"
                  />
                )}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="committed" stackId="usage" fill="#0d9488" name="Committed used" />
              <Bar dataKey="burst" stackId="usage" fill="#f59e0b" name="Burst used" />
              <ReferenceLine y={committedCeilingTib} stroke="#0d9488" strokeDasharray="4 4" label={{ value: 'Committed', position: 'insideTopLeft', fontSize: 10, fill: '#0d9488' }} />
              <ReferenceLine y={totalCeilingTib} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Ceiling', position: 'insideTopLeft', fontSize: 10, fill: '#64748b' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setUsageTableCollapsed((v) => !v)}
            className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5"
          >
            <span className="text-sm font-semibold text-gray-900">Usage breakdown</span>
            <div className="flex items-center gap-3">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportUsageCsv();
                }}
                className="flex items-center gap-1 text-xs font-medium text-[#0067c5] hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </span>
              {usageTableCollapsed ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronUp className="h-4 w-4 text-gray-500" />}
            </div>
          </button>
          {!usageTableCollapsed && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-white">
                  <tr>
                    <th className="sticky left-0 bg-white px-4 py-2 text-left text-xs font-semibold text-gray-600">
                      Entity <span className="font-normal text-gray-400">/ committed {formatTib(committedCeilingTib)} TiB</span>
                    </th>
                    {buckets.map((b) => (
                      <th key={b.key} className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        {b.label}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-gray-900">Avg / period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white px-4 py-2 font-medium text-gray-900">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal-600 align-middle" />
                      Committed capacity
                    </td>
                    {buckets.map((b) => (
                      <td key={b.key} className="whitespace-nowrap px-3 py-2 text-right text-gray-700">
                        {formatTib(roundedCommittedTibForBucket(b))}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-900">{formatTib(avgCommittedTib)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="sticky left-0 bg-white px-4 py-2 font-medium text-gray-900">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500 align-middle" />
                      Burst capacity
                    </td>
                    {buckets.map((b) => (
                      <td key={b.key} className="whitespace-nowrap px-3 py-2 text-right text-gray-700">
                        {formatTib(roundedBurstTibForBucket(b))}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-900">{formatTib(avgBurstTib)}</td>
                  </tr>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td className="sticky left-0 bg-gray-50 px-4 py-2 text-gray-900">Used capacity</td>
                    {buckets.map((b) => (
                      <td key={b.key} className="whitespace-nowrap px-3 py-2 text-right text-gray-900">
                        {formatTib(roundedUsedTibForBucket(b))}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right text-gray-900">{formatTib(avgUsedTib)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTib(n: number): string {
  return `${Math.round(n * 10) / 10}`;
}
