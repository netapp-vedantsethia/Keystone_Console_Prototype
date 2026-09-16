import React, { useCallback, useMemo, useState } from 'react';
import { BpCheckbox, BpDropdown, BpTextField } from '@netapp/blueprint/react';
import { DataTableFooter } from '../ui/DataTable';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { slicePage, useTablePagination } from '../../hooks/useTablePagination';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  BarChart,
  Bar,
} from 'recharts';
import {
  buildAccruedDailyRowsForServiceLevel,
  buildAccruedMonthlyBucketsForServiceLevel,
  buildHistoricalTrendForServiceLevel,
  buildStitchedHistoricalTrendForServiceLevel,
  formatConsoleLastUpdated,
  getSubscriptionById,
  includedBurstHeadroomTib,
  type AccruedBurstDailyRow,
  type AccruedBurstMonthlyRow,
  type PlatformNavigateOptions,
  type ServiceLevelHistoricalPoint,
  type Subscription,
  usedTibFromBreakdownRow,
} from '../../data/mockData';
import { ArrowUpRight, X, TrendingUp, Database, AlertTriangle, Download, GitMerge } from 'lucide-react';

interface ConsumptionTrendsTabProps {
  subscription: Subscription;
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}

function filterRowsByTimeRange<T extends { date: string }>(
  rows: T[],
  timeRange: string,
  customStart: string,
  customEnd: string,
): T[] {
  if (!rows.length) return rows;
  if (timeRange === 'custom') {
    if (!customStart || !customEnd) return rows;
    const start = new Date(customStart);
    const end = new Date(customEnd);
    return rows.filter((item) => {
      const t = new Date(item.date);
      return t >= start && t <= end;
    });
  }
  const days = parseInt(timeRange, 10);
  const latest = new Date(Math.max(...rows.map((r) => new Date(r.date).getTime())));
  const start = new Date(latest);
  start.setDate(start.getDate() - days);
  return rows.filter((item) => {
    const t = new Date(item.date);
    return t >= start && t <= latest;
  });
}

function filterDailyByTimeRange(
  rows: AccruedBurstDailyRow[],
  timeRange: string,
  customStart: string,
  customEnd: string,
): AccruedBurstDailyRow[] {
  type WithDate = AccruedBurstDailyRow & { date: string };
  const withDate: WithDate[] = rows.map((r) => ({ ...r, date: r.timestampUtc.slice(0, 10) }));
  return filterRowsByTimeRange(withDate, timeRange, customStart, customEnd).map(({ date: _d, ...rest }) => rest);
}

function appendLevelForecast(hist: ServiceLevelHistoricalPoint[], days = 14): ServiceLevelHistoricalPoint[] {
  if (hist.length === 0) return hist;
  const last = hist[hist.length - 1];
  const recent = hist.slice(-7);
  const delta =
    recent.length > 1
      ? (recent[recent.length - 1].used - recent[0].used) / (recent.length - 1)
      : 0;
  const out = [...hist];
  let prev = last;
  const lastDate = new Date(last.date);
  for (let i = 1; i <= days; i++) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    const used = Math.max(0, Math.round((prev.used + delta) * 10) / 10);
    const fracData = prev.used > 0 ? prev.data / prev.used : 0.85;
    const data = Math.round(used * fracData * 10) / 10;
    const snapshot = Math.round((used - data) * 10) / 10;
    const accruedBurst = Math.max(0, Math.round((used - prev.committed) * 10) / 10);
    const row: ServiceLevelHistoricalPoint = {
      date: d.toISOString().slice(0, 10),
      committed: prev.committed,
      burstCapacityTop: prev.burstCapacityTop,
      used,
      data,
      snapshot,
      accruedBurst,
      isForecast: true,
    };
    out.push(row);
    prev = row;
  }
  return out;
}

function downloadCsv(filename: string, headers: string[], lines: string[][]) {
  const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
  const body = [headers.join(','), ...lines.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function AccruedMonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: AccruedBurstMonthlyRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  if (!row) return null;
  const items: string[] = [];
  if (row.invoiced > 0) {
    items.push(`Invoiced: ${row.invoiced} TiB — month closed, invoice finalized`);
  }
  if (row.uninvoiced > 0) {
    items.push(`Uninvoiced: ${row.uninvoiced} TiB — month closed, ready to invoice`);
  }
  if (row.provisional > 0) {
    items.push(`Provisional: ${row.provisional} TiB — current month (MTD accrued)`);
  }
  if (row.forecast > 0) {
    items.push(
      row.provisional > 0
        ? `Forecast: ${row.forecast} TiB — predicted remainder of this month`
        : `Forecast: ${row.forecast} TiB — future usage (not yet accrued)`,
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      {label != null && label !== '' && <p className="mb-1.5 font-semibold text-gray-900">{label}</p>}
      <ul className="m-0 list-none space-y-1 p-0 text-gray-700">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function TrendsSubscriptionSnapshotTable({
  subscriptionNumber,
  data,
  snapshot,
  headroom,
  used,
}: {
  subscriptionNumber: string;
  data: number;
  snapshot: number;
  headroom: number;
  used: number;
}) {
  const rows = useMemo(
    () => [{ subscriptionNumber, data, snapshot, headroom, used }],
    [subscriptionNumber, data, snapshot, headroom, used]
  );
  const { currentPage, setCurrentPage, totalPages, pageSize } = useTablePagination(
    rows.length,
    TABLE_PAGE_SIZE,
    [subscriptionNumber]
  );
  const page = slicePage(rows, currentPage, pageSize);
  const r = page[0];
  if (!r) return null;
  return (
    <>
      <div className="mt-2 overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-left text-[10px] font-medium uppercase text-gray-500">
            <tr>
              <th className="px-2 py-2">Subscription</th>
              <th className="px-2 py-2">Data</th>
              <th className="px-2 py-2">Snapshot</th>
              <th className="px-2 py-2">Burst (20%)</th>
              <th className="px-2 py-2">Used</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100">
              <td className="px-2 py-2 font-medium text-blue-700">{r.subscriptionNumber}</td>
              <td className="px-2 py-2 tabular-nums">{r.data}</td>
              <td className="px-2 py-2 tabular-nums">{r.snapshot}</td>
              <td className="px-2 py-2 tabular-nums">{r.headroom}</td>
              <td className="px-2 py-2 font-medium tabular-nums">{r.used}</td>
            </tr>
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50 text-xs font-medium">
            <tr>
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2 tabular-nums">{r.data}</td>
              <td className="px-2 py-2 tabular-nums">{r.snapshot}</td>
              <td className="px-2 py-2 tabular-nums">{r.headroom}</td>
              <td className="px-2 py-2 tabular-nums">{r.used}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <DataTableFooter
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={rows.length}
        itemsPerPage={pageSize}
        onPageChange={setCurrentPage}
        className="border-gray-200 text-gray-600"
      />
    </>
  );
}

function AccruedBurstDailyTable({ rows, resetKey }: { rows: AccruedBurstDailyRow[]; resetKey: string }) {
  const { currentPage, setCurrentPage, totalPages, pageSize } = useTablePagination(
    rows.length,
    TABLE_PAGE_SIZE,
    [resetKey, rows.length]
  );
  const pageRows = slicePage(rows, currentPage, pageSize);
  return (
    <>
      <div className="mt-2 rounded-md border border-gray-200">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 border-b border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-2 py-2">Timestamp (UTC)</th>
                <th className="px-2 py-2">Committed</th>
                <th className="px-2 py-2">Consumed</th>
                <th className="px-2 py-2">Accrued burst</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.timestampUtc} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-mono text-[11px] text-gray-800">{r.timestampUtc}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.committed}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.consumed}</td>
                  <td className="px-2 py-1.5 tabular-nums text-red-700">{r.accruedBurst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <DataTableFooter
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={rows.length}
        itemsPerPage={pageSize}
        onPageChange={setCurrentPage}
        className="border-t border-gray-200 text-gray-600"
      />
    </>
  );
}

export function ConsumptionTrendsTab({ subscription, onNavigate }: ConsumptionTrendsTabProps) {
  const [timeRange, setTimeRange] = useState('30');
  const [viewType, setViewType] = useState<'historical' | 'accrued'>('historical');
  const [showForecast, setShowForecast] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [spikeDrawerOpen, setSpikeDrawerOpen] = useState(false);
  const [selectedSpike, setSelectedSpike] = useState<{ start: string; end: string } | null>(null);
  const [spikeLevelName, setSpikeLevelName] = useState<string>('');
  const [refAreaLeft, setRefAreaLeft] = useState('');
  const [refAreaRight, setRefAreaRight] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragLevel, setDragLevel] = useState<string | null>(null);
  const [includeMergeHistory, setIncludeMergeHistory] = useState(true);
  const lastUpdatedLabel = useMemo(() => formatConsoleLastUpdated(), []);

  const mergedAwayCutoffDate =
    subscription.lifecycleStatus === 'merged' && subscription.mergedInto ? subscription.mergedInto.date : null;
  const mergeSource = subscription.mergedFrom?.[0] ?? null;
  const mergeSourceSub = mergeSource ? getSubscriptionById(mergeSource.subscriptionId) : undefined;

  const perLevel = useMemo(() => {
    const map: Record<
      string,
      {
        historical: ServiceLevelHistoricalPoint[];
        daily: AccruedBurstDailyRow[];
        monthly: AccruedBurstMonthlyRow[];
        breakdown: (typeof subscription.serviceLevelBreakdown)[0];
        isStitched: boolean;
      }
    > = {};
    for (const level of subscription.serviceLevels) {
      const b = subscription.serviceLevelBreakdown.find((x) => x.level === level);
      if (!b) continue;

      let historical = buildHistoricalTrendForServiceLevel(subscription, level);
      let isStitched = false;
      if (mergedAwayCutoffDate) {
        historical = historical.filter((row) => row.date <= mergedAwayCutoffDate);
      } else if (mergeSource) {
        if (includeMergeHistory) {
          const stitched = buildStitchedHistoricalTrendForServiceLevel(subscription, level);
          if (stitched) {
            historical = stitched;
            isStitched = true;
          }
        } else {
          historical = historical.filter((row) => row.date >= mergeSource.date);
        }
      }

      map[level] = {
        historical,
        daily: buildAccruedDailyRowsForServiceLevel(subscription, level),
        monthly: buildAccruedMonthlyBucketsForServiceLevel(subscription, level, {
          extraForecastMonths: showForecast && viewType === 'accrued' ? 3 : 0,
          addCurrentMonthForecast: showForecast && viewType === 'accrued',
        }),
        breakdown: b,
        isStitched,
      };
    }
    return map;
  }, [subscription, showForecast, viewType, mergedAwayCutoffDate, mergeSource, includeMergeHistory]);

  const spikeAnalysis = {
    summary: 'Usage increased sharply in the selected window — review snapshots and new volumes.',
    topVolumes: [
      { name: 'app_data_vol', delta: 42.3, percent: 50, factor: 'New volume created' },
      { name: 'user_home_dirs', delta: 28.5, percent: 34, factor: 'Snapshot growth' },
      { name: 'prod_database_01', delta: 14.2, percent: 16, factor: 'Workload peak' },
    ],
    factors: ['Snapshot growth', 'New volume created', 'Workload peak'],
  };

  const handleMouseDown = (level: string, e: { activeLabel?: string } | null) => {
    if (e?.activeLabel) {
      setDragLevel(level);
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(e.activeLabel);
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: { activeLabel?: string } | null) => {
    if (isDragging && dragLevel && e?.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = useCallback(() => {
    if (isDragging && refAreaLeft && refAreaRight && dragLevel && refAreaLeft !== refAreaRight) {
      const lo = refAreaLeft < refAreaRight ? refAreaLeft : refAreaRight;
      const hi = refAreaLeft < refAreaRight ? refAreaRight : refAreaLeft;
      setSelectedSpike({ start: lo, end: hi });
      setSpikeLevelName(dragLevel);
      setSpikeDrawerOpen(true);
    }
    setRefAreaLeft('');
    setRefAreaRight('');
    setIsDragging(false);
    setDragLevel(null);
  }, [isDragging, refAreaLeft, refAreaRight, dragLevel]);

  const exportHistoricalCsv = (level: string, rows: ServiceLevelHistoricalPoint[]) => {
    downloadCsv(
      `consumption-${subscription.number}-${level}.csv`,
      ['date', 'committed', 'burst_capacity_top', 'used', 'data', 'snapshot', 'accrued_burst', 'forecast'],
      rows.map((r) => [
        r.date,
        String(r.committed),
        String(r.burstCapacityTop),
        String(r.used),
        String(r.data),
        String(r.snapshot),
        String(r.accruedBurst),
        r.isForecast ? 'yes' : 'no',
      ]),
    );
  };

  const exportAccruedCsv = (level: string, daily: AccruedBurstDailyRow[], monthly: AccruedBurstMonthlyRow[]) => {
    downloadCsv(
      `accrued-burst-daily-${subscription.number}-${level}.csv`,
      ['timestamp_utc', 'committed', 'consumed', 'accrued_burst'],
      daily.map((r) => [r.timestampUtc, String(r.committed), String(r.consumed), String(r.accruedBurst)]),
    );
    downloadCsv(
      `accrued-burst-monthly-${subscription.number}-${level}.csv`,
      ['month', 'invoiced', 'uninvoiced', 'provisional', 'forecast'],
      monthly.map((m) => [
        m.monthKey,
        String(m.invoiced),
        String(m.uninvoiced),
        String(m.provisional),
        String(m.forecast),
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-44">
              <BpDropdown
                label="Time range"
                value={timeRange}
                onValueChange={(value) => setTimeRange(value ?? '30')}
                options={[
                  { value: '7', label: 'Last 7 days' },
                  { value: '30', label: 'Last 30 days' },
                  { value: '90', label: 'Last 90 days' },
                  { value: 'custom', label: 'Custom range' },
                ]}
                showClearButton={false}
              />
            </div>
            <div className="w-52">
              <BpDropdown
                label="View"
                value={viewType}
                onValueChange={(value) => setViewType((value ?? 'historical') as 'historical' | 'accrued')}
                options={[
                  { value: 'historical', label: 'Historical consumption' },
                  { value: 'accrued', label: 'Accrued burst' },
                ]}
                showClearButton={false}
              />
            </div>
            <BpCheckbox checked={showForecast} onChange={(e) => setShowForecast(e.target.checked)} label="Forecast" />
            {mergeSource && viewType === 'historical' && (
              <BpCheckbox
                checked={includeMergeHistory}
                onChange={(e) => setIncludeMergeHistory(e.target.checked)}
                label="Include pre-merge history"
              />
            )}
          </div>
          <p className="text-xs text-gray-500">
            One block per service level · definitions match Current consumption &amp; Billing
          </p>
        </div>

        {timeRange === 'custom' && (
          <div className="flex flex-wrap items-end gap-4 border-t border-gray-100 pt-4">
            <BpTextField
              type="date"
              label="Start"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
            <BpTextField
              type="date"
              label="End"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {mergedAwayCutoffDate && subscription.mergedInto && (
        <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <GitMerge className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div className="text-sm text-indigo-900">
            <div className="font-semibold">Subscription merged</div>
            <p className="mt-1">
              This subscription was merged on {new Date(mergedAwayCutoffDate).toLocaleDateString()}. Consumption trends
              are shown up to the merge date only.
            </p>
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-1 font-semibold underline hover:no-underline"
              onClick={() => onNavigate?.('subscription-detail', subscription.mergedInto!.subscriptionId)}
            >
              Go to surviving subscription <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {mergeSource && (
        <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <GitMerge className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div className="text-sm text-indigo-900">
            <div className="font-semibold">Capacity absorbed from a merged subscription</div>
            <p className="mt-1">
              On {new Date(mergeSource.date).toLocaleDateString()}, this subscription absorbed commitments from{' '}
              {mergeSourceSub?.trackingId ?? mergeSource.subscriptionId}. Use “Include pre-merge history” above to see a
              stitched, continuous trend across both subscriptions.
            </p>
            <button
              type="button"
              className="mt-1.5 inline-flex items-center gap-1 font-semibold underline hover:no-underline"
              onClick={() => onNavigate?.('subscription-detail', mergeSource.subscriptionId)}
            >
              Go to old subscription <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <p className="text-sm font-medium text-gray-800">
        Performance service levels ({subscription.serviceLevels.length})
      </p>

      {subscription.serviceLevels.map((level) => {
        const pack = perLevel[level];
        if (!pack) return null;
        const { breakdown, historical: rawHist, daily: allDaily, monthly: monthlyRaw, isStitched } = pack;

        const filteredHist = filterRowsByTimeRange(rawHist, timeRange, customStartDate, customEndDate);
        const histChart =
          showForecast && viewType === 'historical' ? appendLevelForecast(filteredHist) : filteredHist;

        const usedNow = usedTibFromBreakdownRow(breakdown);
        const headroom = includedBurstHeadroomTib(breakdown.committed);
        const burstTop = rawHist[0]?.burstCapacityTop ?? breakdown.committed + headroom;

        const yMax =
          histChart.length === 0
            ? 10
            : Math.max(
                ...histChart.map((d) =>
                  Math.max(d.used, d.burstCapacityTop, d.committed, d.data + d.snapshot),
                ),
              ) * 1.12;

        const filteredDaily = filterDailyByTimeRange(allDaily, timeRange, customStartDate, customEndDate);
        const monthlyForChart = monthlyRaw;

        return (
          <div key={level} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3">
              <h3 className="text-base font-semibold text-gray-900">{level}</h3>
              <p className="text-xs text-gray-500">
                Committed {breakdown.committed} TiB · Included burst (20%) {headroom} TiB · Used {usedNow} TiB
              </p>
            </div>

            {viewType === 'historical' ? (
              <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-12">
                <div className="lg:col-span-8">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">Consumption trend</span>
                    <button
                      type="button"
                      onClick={() => exportHistoricalCsv(level, histChart)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download CSV
                    </button>
                  </div>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={histChart}
                        onMouseDown={(e) => handleMouseDown(level, e)}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                        />
                        <YAxis
                          domain={[0, yMax]}
                          tick={{ fontSize: 10 }}
                          label={{ value: 'TiB', angle: -90, position: 'insideLeft', fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: 12 }}
                          formatter={(v: number, n: string) => [`${v} TiB`, n]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />

                        {breakdown.committed < burstTop ? (
                          <ReferenceArea
                            y1={breakdown.committed}
                            y2={burstTop}
                            fill="#F7941D"
                            fillOpacity={0.1}
                            strokeOpacity={0}
                          />
                        ) : null}
                        {burstTop < yMax ? (
                          <ReferenceArea y1={burstTop} y2={yMax} fill="#fce7f3" fillOpacity={0.65} strokeOpacity={0} />
                        ) : null}

                        {refAreaLeft && refAreaRight && isDragging && dragLevel === level && (
                          <ReferenceArea
                            x1={refAreaLeft}
                            x2={refAreaRight}
                            fill="#dbeafe"
                            fillOpacity={0.35}
                          />
                        )}

                        <ReferenceLine
                          y={breakdown.committed}
                          stroke="#ca8a04"
                          strokeDasharray="5 5"
                          label={{ value: 'Committed', position: 'right', fill: '#a16207', fontSize: 10 }}
                        />
                        <ReferenceLine
                          y={burstTop}
                          stroke="#2563eb"
                          strokeDasharray="5 5"
                          label={{ value: 'Burst ceiling (commit + 20%)', position: 'right', fill: '#1d4ed8', fontSize: 10 }}
                        />

                        {isStitched && mergeSource && (
                          <ReferenceLine
                            x={mergeSource.date}
                            stroke="#4f46e5"
                            strokeDasharray="3 3"
                            label={{ value: 'Merger', position: 'top', fill: '#4338ca', fontSize: 10 }}
                          />
                        )}

                        <Line type="monotone" dataKey="used" stroke="#0d9488" strokeWidth={2} dot={false} name="Used capacity" />
                        <Line type="monotone" dataKey="data" stroke="#16a34a" strokeWidth={2} dot={false} name="Data" />
                        <Line type="monotone" dataKey="snapshot" stroke="#9333ea" strokeWidth={2} dot={false} name="Snapshot" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Amber: included burst band (committed → burst ceiling). Pink: above burst ceiling. Drag on the
                    chart to select a range for spike analysis.
                  </p>
                </div>

                <div className="lg:col-span-4 lg:border-l lg:border-gray-100 lg:pl-6">
                  <p className="text-xs text-gray-400">{lastUpdatedLabel}</p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-4">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{usedNow} TiB</div>
                      <div className="text-xs text-gray-500">Used capacity</div>
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-gray-700">{breakdown.committed} TiB</div>
                      <div className="text-xs text-gray-500">Committed</div>
                    </div>
                  </div>

                  <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Subscriptions (1)
                  </h4>
                  <TrendsSubscriptionSnapshotTable
                    subscriptionNumber={subscription.number}
                    data={breakdown.data}
                    snapshot={breakdown.snapshot}
                    headroom={headroom}
                    used={usedNow}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">Accrued burst by monthly billing</span>
                    <button
                      type="button"
                      onClick={() => exportAccruedCsv(level, filteredDaily, monthlyForChart)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download CSV
                    </button>
                  </div>
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyForChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} label={{ value: 'TiB', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                        <Tooltip content={AccruedMonthlyTooltip} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="invoiced" stackId="a" fill="#1e3a8a" name="Invoiced" />
                        <Bar dataKey="uninvoiced" stackId="a" fill="#3b82f6" name="Uninvoiced" />
                        <Bar dataKey="provisional" stackId="a" fill="#93c5fd" name="Provisional" />
                        <Bar dataKey="forecast" stackId="a" fill="#e0e7ff" name="Forecast" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {monthlyForChart.some((m) => m.hasAlert) && (
                    <p className="mt-1 text-xs text-amber-700">Some months are flagged for review (prototype alert marker).</p>
                  )}
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-800">Accrued burst by days</span>
                  <AccruedBurstDailyTable
                    rows={filteredDaily}
                    resetKey={`${level}-${timeRange}-${customStartDate}-${customEndDate}`}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showForecast && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Forecast extends the historical series (per level) or adds future months on accrued bars. Values are illustrative.
          </span>
        </div>
      )}

      {spikeDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50"
          onClick={() => setSpikeDrawerOpen(false)}
          role="presentation"
        >
          <div
            className="flex h-full max-h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spike-analysis-panel-title"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <div>
                <h2 id="spike-analysis-panel-title" className="text-lg font-semibold text-gray-900">
                  Spike analysis
                </h2>
                <p className="text-xs text-gray-500">
                  {spikeLevelName} · {selectedSpike?.start} → {selectedSpike?.end}
                </p>
              </div>
              <button type="button" onClick={() => setSpikeDrawerOpen(false)} className="rounded-md p-2 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 text-amber-600" />
                  <div>
                    <div className="text-sm font-semibold text-amber-900">What changed</div>
                    <div className="text-sm text-amber-800">{spikeAnalysis.summary}</div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Top volumes</h3>
                <div className="space-y-2">
                  {spikeAnalysis.topVolumes.map((volume, idx) => (
                    <div key={idx} className="rounded-md border border-gray-200 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <Database className="h-4 w-4 text-gray-500" />
                        {volume.name}
                      </div>
                      <div className="mt-1 text-red-600">+{volume.delta} TiB · {volume.percent}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
