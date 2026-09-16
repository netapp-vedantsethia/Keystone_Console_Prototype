import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Info, LayoutGrid, Zap } from 'lucide-react';
import {
  buildAvailabilityForSubscription,
  buildPerformanceLatencyForSubscription,
  buildSustainabilityPowerForSubscription,
  mockSubscriptions,
  ONTAP_AVAILABILITY_SLO_PCT,
  type AvailabilityServiceLevel,
  type Subscription,
  type PerformanceLatencyPoint,
  type PerformanceServiceLevelLatency,
  type SustainabilityPowerPoint,
  type SustainabilityServiceLevelPower,
} from '../../data/mockData';
import { BpTooltip, BpTabGroup } from '@netapp/blueprint/react';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

type LatencyXRange = { start: number; end: number };

function complianceTone(compliance: string): StatusTone {
  return compliance === 'breached' ? 'red' : compliance === 'compliant' ? 'green' : 'gray';
}

function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <BpTooltip title={label} content={children}>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full text-gray-400 transition-colors hover:text-[#0067c5]"
        aria-label={label}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </BpTooltip>
  );
}

function PerformanceLatencyZoomChart({ level }: { level: PerformanceServiceLevelLatency }) {
  const full = level.history;
  const sla = level.slaP90Ms;
  const len = full.length;
  const [xRange, setXRange] = useState<LatencyXRange>({ start: 0, end: Math.max(0, len - 1) });
  const xRangeRef = useRef(xRange);
  xRangeRef.current = xRange;

  useEffect(() => {
    const n = level.history.length;
    setXRange({ start: 0, end: Math.max(0, n - 1) });
  }, [level.levelKey, level.displayName, level.history.length]);

  const dragRef = useRef<{ startVis: number; fullBase: number } | null>(null);
  const endVisRef = useRef<number | null>(null);
  const [selectDraft, setSelectDraft] = useState<{ from: number; to: number } | null>(null);

  const visibleData = len === 0 ? [] : full.slice(xRange.start, xRange.end + 1);

  const applyZoomFromDrag = useCallback(() => {
    const drag = dragRef.current;
    const endVis = endVisRef.current;
    if (!drag) return;
    dragRef.current = null;
    endVisRef.current = null;
    setSelectDraft(null);
    if (endVis == null) return;
    const lo = Math.min(drag.startVis, endVis);
    const hi = Math.max(drag.startVis, endVis);
    if (hi <= lo) return;
    const newStart = drag.fullBase + lo;
    const newEnd = drag.fullBase + hi;
    setXRange({ start: newStart, end: newEnd });
  }, []);

  useEffect(() => {
    const onWinMouseUp = () => {
      if (dragRef.current) applyZoomFromDrag();
    };
    window.addEventListener('mouseup', onWinMouseUp);
    return () => window.removeEventListener('mouseup', onWinMouseUp);
  }, [applyZoomFromDrag]);

  const onMouseDown = (state: { activeTooltipIndex?: number } | null) => {
    if (!state) return;
    const i = state.activeTooltipIndex;
    if (i == null || i < 0) return;
    dragRef.current = { startVis: i, fullBase: xRangeRef.current.start };
    endVisRef.current = i;
    setSelectDraft({ from: i, to: i });
  };

  const onMouseMove = (state: { activeTooltipIndex?: number } | null, e: ReactMouseEvent<Element>) => {
    if (!dragRef.current || !e || e.buttons !== 1) return;
    if (!state) return;
    const i = state.activeTooltipIndex;
    if (i == null || i < 0) return;
    endVisRef.current = i;
    setSelectDraft({ from: dragRef.current.startVis, to: i });
  };

  const draftX =
    selectDraft &&
    visibleData.length > 0 &&
    selectDraft.from >= 0 &&
    selectDraft.to >= 0
      ? {
          x1: visibleData[Math.min(selectDraft.from, selectDraft.to)].label,
          x2: visibleData[Math.max(selectDraft.from, selectDraft.to)].label,
        }
      : null;

  const isFullRange = len === 0 || (xRange.start === 0 && xRange.end === len - 1);

  if (sla == null || len === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">
        No P90 latency SLA applies to this service level (Object / StorageGRID). Select an ONTAP service level to view latency.
      </div>
    );
  }

  const breachInView = visibleData.filter((p) => p.p90Ms >= sla).length;

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{level.displayName} — measured P90 latency (30 days)</h3>
          <InfoTooltip label="How to read latency">
            Latency here is measured in milliseconds (`ms`). `P90` means 90% of samples were at or below this response time in the selected period, so it shows the typical upper-end experience rather than a single spike.
          </InfoTooltip>
        </div>
        <button
          type="button"
          onClick={() => setXRange({ start: 0, end: len - 1 })}
          disabled={isFullRange}
          className="self-start px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          Reset zoom
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-gray-500">
        Keystone target: P90 &lt; {sla} ms for {level.displayName}. Breach when measured P90 ≥ {sla} ms. Drag on the chart to zoom a date
        range.
      </p>
      <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 border-t-2 border-dashed border-gray-400" />
          <span>SLA target ({sla} ms)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span>Within SLA</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-200" />
          <span>Breach</span>
        </div>
      </div>
      <div className="select-none cursor-crosshair" style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={visibleData}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={applyZoomFromDrag}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{ value: 'ms (P90)', angle: -90, position: 'insideLeft', fontSize: 11 }}
              domain={[0, 'auto']}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as PerformanceLatencyPoint;
                const breach = p.p90Ms >= sla;
                return (
                  <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm max-w-xs">
                    <div className="font-medium text-gray-900">{p.label}</div>
                    <div className="mt-1 text-gray-700">
                      P90: {p.p90Ms.toFixed(2)} ms
                      {breach ? <span className="text-red-600"> (≥ {sla} ms SLA)</span> : null}
                    </div>
                    {p.validationDetail ? (
                      <p className="mt-2 border-t border-gray-100 pt-2 text-gray-600 leading-snug">{p.validationDetail}</p>
                    ) : null}
                  </div>
                );
              }}
            />
            {draftX && selectDraft && selectDraft.from !== selectDraft.to && (
              <ReferenceArea
                x1={draftX.x1}
                x2={draftX.x2}
                stroke="#0066CC"
                strokeOpacity={0.5}
                fill="rgba(0, 102, 204, 0.12)"
              />
            )}
            <ReferenceLine
              y={sla}
              stroke="#9ca3af"
              strokeDasharray="6 4"
              label={{ value: `≤${sla} ms`, position: 'right', fill: '#6b7280', fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="p90Ms"
              stroke={level.compliance === 'breached' ? '#ef4444' : '#0066CC'}
              strokeWidth={2}
              dot={(props) => <LatencyP90Dot {...props} slaMs={sla} />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {breachInView > 0 ? (
          <span className="font-medium text-red-600">{breachInView} day(s) at or above SLA in this view</span>
        ) : (
          <span className="font-medium text-green-600">No breaches in this view</span>
        )}
      </p>
    </div>
  );
}

function LatencyP90Dot(props: { cx?: number; cy?: number; payload?: PerformanceLatencyPoint; slaMs: number }) {
  const { cx = 0, cy = 0, payload, slaMs } = props;
  if (!payload) return null;
  const breach = payload.p90Ms >= slaMs;
  if (breach) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill="none" stroke="#ef4444" strokeWidth={2} className="animate-pulse" />
        <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#dc2626" strokeWidth={2} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill="#22c55e" stroke="#16a34a" strokeWidth={1} />;
}

function SustainabilityPowerDot(props: {
  cx?: number;
  cy?: number;
  payload?: SustainabilityPowerPoint;
  slaLimitWPerTib: number;
}) {
  const { cx = 0, cy = 0, payload, slaLimitWPerTib } = props;
  if (!payload) return null;
  const breach = payload.wPerTib > slaLimitWPerTib;
  if (breach) {
    return (
      <g className="[&_circle]:origin-center">
        <circle cx={cx} cy={cy} r={9} fill="none" stroke="#ef4444" strokeWidth={2} className="animate-pulse" />
        <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#dc2626" strokeWidth={2} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill="#22c55e" stroke="#16a34a" strokeWidth={1} />;
}

function ServiceLevelPowerChart({ level }: { level: SustainabilityServiceLevelPower }) {
  const sla = level.slaLimitWPerTib;
  const breachSamples = level.history.filter((p) => p.wPerTib > sla).length;
  return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between mb-4">
          <div className="flex items-center gap-2 pr-4">
            <h3 className="text-lg font-semibold text-gray-900">{level.displayName} — Historical power consumption (30 days)</h3>
            <InfoTooltip label="What is W/TiB?">
              `W/TiB` means watts consumed per tebibyte of committed capacity. It helps compare power efficiency across service levels by normalizing power against the storage capacity being delivered.
            </InfoTooltip>
          </div>
        <div className="flex flex-col gap-1.5 text-xs text-gray-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-6 border-t-2 border-dashed border-gray-400" />
            <span>SLA limit ({sla} W/TiB)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </span>
            <span>Breach (hover for details)</span>
          </div>
        </div>
      </div>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={level.history} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              domain={[0, 'auto']}
              tick={{ fontSize: 11 }}
              label={{ value: 'W/TiB', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as SustainabilityPowerPoint;
                const isBreach = p.wPerTib > sla;
                return (
                  <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm max-w-xs">
                    <div className="font-medium text-gray-900">{p.label}</div>
                    <div className="mt-1 text-gray-700">
                      {p.wPerTib.toFixed(2)} W/TiB {isBreach ? <span className="text-red-600">(above SLA)</span> : null}
                    </div>
                    {isBreach && p.validationDetail ? (
                      <p className="mt-2 border-t border-gray-100 pt-2 text-gray-600 leading-snug">{p.validationDetail}</p>
                    ) : null}
                  </div>
                );
              }}
            />
            <ReferenceLine
              y={sla}
              stroke="#9ca3af"
              strokeDasharray="6 4"
              label={{ value: `SLA ${sla}`, position: 'right', fill: '#6b7280', fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="wPerTib"
              name="W/TiB"
              stroke={level.compliance === 'breached' ? '#ef4444' : '#059669'}
              strokeWidth={2}
              dot={(dotProps) => <SustainabilityPowerDot {...dotProps} slaLimitWPerTib={sla} />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500">
        <p>
          Red markers indicate intervals where measured W/TiB exceeded the <strong>{level.displayName}</strong> SLA.
          Hover a point for validation notes.
        </p>
        {breachSamples > 0 ? (
          <span className="shrink-0 font-medium text-red-600">{breachSamples} breach points detected</span>
        ) : (
          <span className="shrink-0 font-medium text-green-600">No breaches in window</span>
        )}
      </div>
    </div>
  );
}

function formatSecondsReadable(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function AvailabilityDayHeatmap({ level }: { level: AvailabilityServiceLevel }) {
  if (level.sloUptimePct == null || level.daily.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-12 text-center text-sm text-gray-600">
        ONTAP File &amp; Block availability SLO (99.999%) does not apply to Object / StorageGRID in this view.
      </div>
    );
  }

  const cellClass = (down: number) => {
    if (down <= 0) return 'bg-emerald-100 text-emerald-900 border-emerald-200/80';
    if (down <= 60) return 'bg-amber-200 text-amber-950 border-amber-300/80';
    return 'bg-red-400 text-white border-red-500/80';
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-gray-500" aria-hidden />
          <h3 className="text-lg font-semibold text-gray-900">Per-day downtime ({level.monthLabel})</h3>
          <InfoTooltip label="How to read uptime">
            Uptime is the percentage of time the service stayed available during the month after applying the prototype’s qualifying-downtime rules. Each box below represents one day and is colored by the amount of downtime counted toward the SLA.
          </InfoTooltip>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 rounded border border-emerald-200/80 bg-emerald-100" />
            No qualifying downtime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 rounded border border-amber-300/80 bg-amber-200" />
            1–60s
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 shrink-0 rounded border border-red-500/80 bg-red-400" />
            &gt; 60s
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-10 lg:grid-cols-15">
        {level.daily.map((d) => (
          <div
            key={d.dayOfMonth}
            title={`${d.label}: ${d.downtimeSeconds}s dual-controller downtime · ${d.uptimePct.toFixed(5)}% day uptime (after exclusions)`}
            className={`group relative flex h-8 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums ${cellClass(
              d.downtimeSeconds,
            )}`}
          >
            {d.dayOfMonth}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-gray-200 bg-white p-3 text-left text-xs text-gray-600 shadow-lg group-hover:block group-focus-within:block">
              <div className="font-semibold text-gray-900">{d.label}</div>
              <div className="mt-1">
                Counted downtime: <span className="font-medium text-gray-900">{d.downtimeSeconds}s</span>
              </div>
              <div className="mt-1">
                Day uptime: <span className="font-medium text-gray-900">{d.uptimePct.toFixed(5)}%</span>
              </div>
              <div className="mt-2 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-gray-500">
                Qualifying dual-controller downtime counted toward the monthly uptime SLA for this day.
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500 leading-relaxed">
        Cell color reflects seconds of Storage Array Downtime counted toward SLO that day (prototype). Hover a day for seconds and daily
        uptime %.
      </p>
    </div>
  );
}

export function SLATab({ subscription }: { subscription?: Subscription } = {}) {
  const [activeSubTab, setActiveSubTab] = useState('availability');
  const [sustainabilityLevelIndex, setSustainabilityLevelIndex] = useState(0);
  const [performanceLevelIndex, setPerformanceLevelIndex] = useState(0);
  const [availabilityLevelIndex, setAvailabilityLevelIndex] = useState(0);

  const sustainabilitySub = subscription ?? mockSubscriptions[0];
  const sustainabilityLevels = useMemo(
    () => buildSustainabilityPowerForSubscription(sustainabilitySub),
    [sustainabilitySub],
  );

  const performanceLevels = useMemo(
    () => buildPerformanceLatencyForSubscription(sustainabilitySub),
    [sustainabilitySub],
  );

  const availabilityLevels = useMemo(
    () => buildAvailabilityForSubscription(sustainabilitySub),
    [sustainabilitySub],
  );

  const availabilitySummary = useMemo(() => {
    const ontap = availabilityLevels.filter((l) => l.sloUptimePct != null);
    const breached = ontap.filter((l) => l.compliance === 'breached');
    let worst: { name: string; uptime: number } | null = null;
    for (const l of ontap) {
      if (!worst || l.orderUptimePct < worst.uptime) {
        worst = { name: l.displayName, uptime: l.orderUptimePct };
      }
    }
    const totalDowntimeSeconds = ontap.reduce((s, l) => s + l.totalDowntimeSecondsMonth, 0);
    return {
      ontapCount: ontap.length,
      breachedCount: breached.length,
      allCompliant: ontap.length > 0 && breached.length === 0,
      worst,
      totalDowntimeSeconds,
    };
  }, [availabilityLevels]);

  const performanceSummary = useMemo(() => {
    const withSla = performanceLevels.filter((l) => l.slaP90Ms != null);
    const breached = performanceLevels.filter((l) => l.compliance === 'breached');
    const totalBreachDays = performanceLevels.reduce((s, l) => s + l.breachDayCount, 0);
    let worst: { name: string; p90: number; sla: number } | null = null;
    for (const l of withSla) {
      if (l.slaP90Ms == null) continue;
      const r = l.currentP90Ms / l.slaP90Ms;
      const wr = worst ? worst.p90 / worst.sla : 0;
      if (!worst || r > wr) {
        worst = { name: l.displayName, p90: l.currentP90Ms, sla: l.slaP90Ms };
      }
    }
    return {
      monitoredCount: withSla.length,
      breachedLevelCount: breached.length,
      totalBreachDays,
      worst,
      allCompliant: withSla.length > 0 && breached.length === 0,
    };
  }, [performanceLevels]);

  const performanceBreachEvents = useMemo(() => {
    const ev: { level: string; label: string; detail: string; p90: number; sla: number }[] = [];
    for (const l of performanceLevels) {
      if (l.slaP90Ms == null) continue;
      const sla = l.slaP90Ms;
      for (const p of l.history) {
        if (p.p90Ms >= sla) {
          ev.push({
            level: l.displayName,
            label: p.label,
            detail: p.validationDetail ?? `P90 ${p.p90Ms.toFixed(2)} ms met or exceeded ${sla} ms target.`,
            p90: p.p90Ms,
            sla,
          });
        }
      }
    }
    return ev;
  }, [performanceLevels]);

  useEffect(() => {
    setSustainabilityLevelIndex((i) =>
      sustainabilityLevels.length === 0 ? 0 : Math.min(i, sustainabilityLevels.length - 1),
    );
  }, [sustainabilityLevels.length]);

  useEffect(() => {
    setPerformanceLevelIndex((i) =>
      performanceLevels.length === 0 ? 0 : Math.min(i, performanceLevels.length - 1),
    );
  }, [performanceLevels.length]);

  useEffect(() => {
    setAvailabilityLevelIndex((i) =>
      availabilityLevels.length === 0 ? 0 : Math.min(i, availabilityLevels.length - 1),
    );
  }, [availabilityLevels.length]);

  const subTabs = [
    { id: 'availability', label: 'Availability', description: 'Monthly uptime, downtime budget, heatmap, and counted incidents.' },
    { id: 'performance', label: 'Performance', description: 'P90 latency trends in milliseconds across the last 30 days.' },
    { id: 'sustainability', label: 'Sustainability', description: 'Power efficiency by service level, measured as watts per TiB.' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <BpTabGroup
          tabs={subTabs.map((tab) => ({ id: tab.id, label: tab.label }))}
          value={activeSubTab}
          onValueChange={setActiveSubTab}
          horizontalResizing="hug"
          tablistAriaLabel="SLA categories"
        />
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          {subTabs.find((tab) => tab.id === activeSubTab)?.description}
        </p>
      </div>

      {/* Performance SLA Tab — P90 latency vs Keystone target per service level */}
      {activeSubTab === 'performance' && (
        <div className="space-y-6">
          {performanceLevels.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
              No performance SLA templates match this subscription&apos;s service levels.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div
                  className={`rounded-lg border p-5 ${
                    performanceSummary.allCompliant ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {performanceSummary.allCompliant ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <span>P90 latency SLA (30d)</span>
                      <InfoTooltip label="What is P90 latency?">
                        `P90 latency` means 90% of operations completed at or below this latency. It is measured in milliseconds (`ms`) and is a better indicator of day-to-day experience than a single peak reading.
                      </InfoTooltip>
                    </div>
                  </div>
                  <div className={`text-2xl font-semibold ${performanceSummary.allCompliant ? 'text-green-700' : 'text-amber-800'}`}>
                    {performanceSummary.allCompliant
                      ? 'All levels compliant'
                      : `${performanceSummary.breachedLevelCount} level(s) with breach`}
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    {performanceSummary.monitoredCount} ONTAP level(s) with P90 targets · Object has no latency SLA
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span>Worst vs target (end of window)</span>
                      <InfoTooltip label="How to interpret milliseconds">
                        Milliseconds (`ms`) show response time. Lower is better. This card highlights the service level furthest from its latency target at the end of the current 30-day window.
                      </InfoTooltip>
                    </div>
                  </div>
                  {performanceSummary.worst ? (
                    <>
                      <div className="text-2xl font-semibold text-gray-900 tabular-nums">
                        {performanceSummary.worst.p90.toFixed(2)} / {performanceSummary.worst.sla} ms
                      </div>
                      <p className="mt-2 text-xs text-gray-500">{performanceSummary.worst.name} · P90 vs SLA threshold</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No ONTAP latency SLA rows on this subscription.</p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="h-5 w-5 text-gray-600" />
                    <span className="text-sm text-gray-600">Breach days (sum)</span>
                  </div>
                  <div
                    className={`text-2xl font-semibold tabular-nums ${
                      performanceSummary.totalBreachDays > 0 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {performanceSummary.totalBreachDays}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Days where P90 ≥ SLA, across all monitored levels</p>
                </div>
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${
                  performanceLevels.length === 1 ? '' : performanceLevels.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {performanceLevels.map((level, idx) => (
                  <div
                    key={`${level.levelKey}-${level.displayName}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPerformanceLevelIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPerformanceLevelIndex(idx);
                      }
                    }}
                    className={`cursor-pointer rounded-lg border bg-white p-5 text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      performanceLevelIndex === idx ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h4 className="text-base font-semibold text-gray-900">{level.displayName}</h4>
                      <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                        {level.platform}
                      </span>
                    </div>
                    {level.slaP90Ms == null ? (
                      <p className="text-sm text-gray-600">
                        Target 90th-percentile latency: <strong>N/A</strong> (Object / S3 — StorageGRID)
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">
                          SLA target: P90 <strong>&lt; {level.slaP90Ms} ms</strong>
                        </p>
                        <p className="mt-2 text-sm text-gray-700">
                          Latest P90:{' '}
                          <span className="font-semibold tabular-nums">{level.currentP90Ms.toFixed(2)} ms</span>
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <StatusBadge
                            tone={complianceTone(level.compliance)}
                            label={level.compliance === 'breached' ? 'Breached' : level.compliance === 'compliant' ? 'Compliant' : 'N/A'}
                          />
                          {level.breachDayCount > 0 ? (
                            <span className="text-xs text-red-600">{level.breachDayCount} breach day(s)</span>
                          ) : level.slaP90Ms != null ? (
                            <span className="text-xs text-green-600">0 breach days</span>
                          ) : null}
                        </div>
                      </>
                    )}
                    <p className="mt-3 text-center text-xs text-gray-400">Click to show 30-day chart</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <PerformanceLatencyZoomChart level={performanceLevels[performanceLevelIndex]} />
              </div>

              {performanceBreachEvents.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">P90 latency breach log (30 days)</h3>
                  <div className="space-y-3">
                    {performanceBreachEvents.map((ev, i) => (
                      <div key={`${ev.level}-${ev.label}-${i}`} className="border-l-2 border-l-red-500 pl-4 py-2">
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                          <div className="text-sm font-medium text-gray-900">
                            {ev.level} · {ev.label} · P90 {ev.p90.toFixed(2)} ms (≥ {ev.sla} ms)
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">{ev.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Availability SLA Tab — ONTAP 99.999% SLO, per service level + daily heatmap */}
      {activeSubTab === 'availability' && (
        <div className="space-y-6">
          {availabilityLevels.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
              No availability rows match this subscription&apos;s service levels.
            </div>
          ) : (
            <>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div
                  className={`rounded-lg border p-5 ${
                    availabilitySummary.allCompliant ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-3">
                    {availabilitySummary.allCompliant ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <span>Monthly uptime SLO ({availabilitySummary.ontapCount} ONTAP level(s))</span>
                      <InfoTooltip label="What is uptime?">
                        Uptime is the percentage of total service time that remained available during the month. For this SLA view, it is calculated after subtracting qualifying downtime and then compared against the contractual threshold.
                      </InfoTooltip>
                    </div>
                  </div>
                  <div
                    className={`text-2xl font-semibold ${
                      availabilitySummary.allCompliant ? 'text-green-700' : 'text-amber-800'
                    }`}
                  >
                    {availabilitySummary.allCompliant
                      ? 'All levels meet 99.999%'
                      : `${availabilitySummary.breachedCount} level(s) below SLO`}
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Object / S3 rows use N/A — no ONTAP availability SLO in this prototype
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="text-sm text-gray-600">Lowest order uptime (month)</span>
                  </div>
                  {availabilitySummary.worst ? (
                    <>
                      <div className="text-2xl font-semibold tabular-nums text-gray-900">
                        {availabilitySummary.worst.uptime.toFixed(5)}%
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {availabilitySummary.worst.name} · vs SLO ≥ {ONTAP_AVAILABILITY_SLO_PCT}%
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No ONTAP levels on this subscription.</p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-gray-600" />
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <span>Total downtime (sum, all ONTAP levels)</span>
                      <InfoTooltip label="What counts as downtime here?">
                        This is the total qualifying downtime counted toward the uptime calculation for ONTAP-backed levels in the selected month. Excluded maintenance or non-qualifying events are shown separately in the incident list.
                      </InfoTooltip>
                    </div>
                  </div>
                  <div className="text-2xl font-semibold tabular-nums text-gray-900">
                    {formatSecondsReadable(availabilitySummary.totalDowntimeSeconds)}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Qualifying dual-controller seconds in prototype month</p>
                </div>
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${
                  availabilityLevels.length === 1
                    ? ''
                    : availabilityLevels.length === 2
                      ? 'lg:grid-cols-2'
                      : 'lg:grid-cols-2 xl:grid-cols-3'
                }`}
              >
                {availabilityLevels.map((level, idx) => (
                  <div
                    key={`${level.levelKey}-${level.displayName}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setAvailabilityLevelIndex(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setAvailabilityLevelIndex(idx);
                      }
                    }}
                    className={`cursor-pointer rounded-lg border bg-white p-5 text-left outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      availabilityLevelIndex === idx ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h4 className="text-base font-semibold text-gray-900">{level.displayName}</h4>
                      <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                        {level.platform}
                      </span>
                    </div>
                    {level.sloUptimePct == null ? (
                      <p className="text-sm text-gray-600">
                        Uptime SLO: <strong>N/A</strong> (Object / StorageGRID)
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">
                          SLO: order uptime ≥ <strong>{level.sloUptimePct}%</strong>
                        </p>
                        <p className="mt-2 text-sm text-gray-700">
                          Measured:{' '}
                          <span className="font-semibold tabular-nums">{level.orderUptimePct.toFixed(5)}%</span>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Downtime budget used:{' '}
                          <span className="tabular-nums font-medium text-gray-700">
                            {level.totalDowntimeSecondsMonth}s
                          </span>{' '}
                          /{' '}
                          <span className="tabular-nums">{Math.round(level.maxDowntimeSecondsAllowed)}s</span> max ·{' '}
                          {level.storageArrayCount} array(s) (model)
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <StatusBadge
                            tone={complianceTone(level.compliance)}
                            label={level.compliance === 'breached' ? 'Below SLO' : level.compliance === 'compliant' ? 'Meets SLO' : 'N/A'}
                          />
                          <span className="text-xs text-gray-500">{level.daysWithDowntime} day(s) with downtime</span>
                        </div>
                      </>
                    )}
                    <p className="mt-3 text-center text-xs text-gray-400">Click to show heatmap &amp; incidents</p>
                  </div>
                ))}
              </div>

              {availabilityLevels[availabilityLevelIndex] ? (
                <div className="space-y-6">
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <AvailabilityDayHeatmap level={availabilityLevels[availabilityLevelIndex]} />
                  </div>

                  {availabilityLevels[availabilityLevelIndex].sloUptimePct != null && (
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Monthly calculation (readable)</h3>
                      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <dt className="text-xs font-medium text-gray-500">Seconds in month (prototype)</dt>
                          <dd className="mt-0.5 font-mono text-gray-900 tabular-nums">
                            {availabilityLevels[availabilityLevelIndex].secondsInMonth.toLocaleString()}
                          </dd>
                        </div>
                        <div className="rounded-md bg-gray-50 px-3 py-2">
                          <dt className="text-xs font-medium text-gray-500">Qualifying downtime (sum)</dt>
                          <dd className="mt-0.5 font-mono text-gray-900 tabular-nums">
                            {availabilityLevels[availabilityLevelIndex].totalDowntimeSecondsMonth.toLocaleString()}s
                          </dd>
                        </div>
                        <div className="sm:col-span-2 rounded-md bg-gray-50 px-3 py-2">
                          <dt className="text-xs font-medium text-gray-500">Order uptime %</dt>
                          <dd className="mt-1 font-mono text-sm text-gray-900 leading-relaxed">
                            ({availabilityLevels[availabilityLevelIndex].secondsInMonth.toLocaleString()} −{' '}
                            {availabilityLevels[availabilityLevelIndex].totalDowntimeSecondsMonth.toLocaleString()}) ÷{' '}
                            {availabilityLevels[availabilityLevelIndex].secondsInMonth.toLocaleString()} × 100 ={' '}
                            <strong className="tabular-nums">
                              {availabilityLevels[availabilityLevelIndex].orderUptimePct.toFixed(5)}%
                            </strong>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {availabilityLevels[availabilityLevelIndex].incidents.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Downtime-related incidents</h3>
                      <div className="space-y-3">
                        {availabilityLevels[availabilityLevelIndex].incidents.map((inc, i) => (
                          <div
                            key={`${inc.occurredAt}-${i}`}
                            className={`border-l-2 pl-4 py-2 ${inc.excluded ? 'border-l-gray-300 bg-gray-50/80' : 'border-l-amber-500'}`}
                          >
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
                              <span>{inc.occurredAt}</span>
                              <span className="text-gray-500">·</span>
                              <span className="tabular-nums">{inc.durationMinutes} min</span>
                              {inc.excluded ? (
                                <StatusBadge tone="gray" label="Excluded from SLO" />
                              ) : (
                                <StatusBadge tone="amber" label="Counted" />
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">{inc.summary}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <div
                className={`flex items-start gap-3 rounded-lg border p-4 ${
                  availabilitySummary.allCompliant ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50/80'
                }`}
              >
                {availabilitySummary.allCompliant ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div>
                  <div className="text-sm font-semibold text-gray-900">SLA credit (illustrative)</div>
                  <p className="mt-1 text-sm text-gray-700">
                    {availabilitySummary.allCompliant
                      ? `Measured monthly order uptime meets the ${ONTAP_AVAILABILITY_SLO_PCT}% target for all ONTAP service levels in view. Credits follow your contract when SLOs are missed.`
                      : `One or more ONTAP service levels are below the ${ONTAP_AVAILABILITY_SLO_PCT}% monthly uptime SLO in this prototype month. Review incidents and excluded windows; credits, if any, follow your agreement.`}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Sustainability Tab — power SLA per Keystone service level */}
      {activeSubTab === 'sustainability' && (
        <div className="space-y-6">
          {sustainabilityLevels.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
              No sustainability templates are defined for this subscription&apos;s service levels.
            </div>
          ) : (
            <>
          <div
            className={`grid grid-cols-1 gap-4 ${
              sustainabilityLevels.length === 1 ? '' : sustainabilityLevels.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {sustainabilityLevels.map((level, idx) => (
              <div
                key={level.levelKey}
                role="button"
                tabIndex={0}
                onClick={() => setSustainabilityLevelIndex(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSustainabilityLevelIndex(idx);
                  }
                }}
                className={`cursor-pointer rounded-lg border bg-white p-5 text-left transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  sustainabilityLevelIndex === idx ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h4 className="text-base font-semibold text-gray-900">{level.displayName}</h4>
                  <StatusBadge
                    tone={complianceTone(level.compliance)}
                    label={level.compliance === 'breached' ? 'Breached' : 'Compliant'}
                  />
                </div>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-gray-500">Committed capacity</dt>
                    <dd className="font-medium text-gray-900">{level.committedTib} TiB</dd>
                    <dd className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Min: {level.minTib} TiB
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Deployed capacity</dt>
                    <dd className="font-medium text-gray-900">{level.deployedTib} TiB</dd>
                    <dd className="text-xs text-gray-500">{level.deployedPctLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Allocated power</dt>
                    <dd className="font-medium text-gray-900">{level.allocatedPowerW} W</dd>
                    <dd className="text-xs text-gray-500">{level.powerPctOfTotal.toFixed(1)}% of subscription total</dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Current power density</div>
                      <div
                        className={`mt-1 text-2xl font-semibold tabular-nums ${
                          level.compliance === 'breached' ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {level.currentWPerTib.toFixed(1)} W/TiB
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">SLA limit</div>
                      <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">≤ {level.slaLimitWPerTib.toFixed(1)} W/TiB</div>
                    </div>
                  </div>
                  <p
                    className={`mt-2 text-sm ${
                      level.compliance === 'breached' ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {level.compliance === 'breached' ? 'Above target by ' : 'Below target by '}
                    <span className="font-semibold tabular-nums">{Math.abs(level.varianceWPerTib).toFixed(1)} W/TiB</span>
                    <span className="text-gray-500"> ({Math.abs(level.variancePct).toFixed(1)}%)</span>
                  </p>
                </div>
                <p className="mt-2 text-center text-xs text-gray-400">Click to show 30-day chart for this service level</p>
              </div>
            ))}
          </div>

          <ServiceLevelPowerChart level={sustainabilityLevels[sustainabilityLevelIndex]} />

          <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-950">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden />
            <div>
              <p className="font-medium text-blue-900">Why service level matters</p>
              <p className="mt-1 text-xs text-blue-800/90 leading-relaxed">
                Each service level on this subscription carries its own power-density SLA (W/TiB). Capacity figures above come from the
                subscription&apos;s service level breakdown; the same subscription can be compliant at one level and breached at another.
              </p>
            </div>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}