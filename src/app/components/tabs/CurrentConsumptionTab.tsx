import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DataTableFooter } from '../ui/DataTable';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { slicePage, useTablePagination } from '../../hooks/useTablePagination';
import {
  Subscription,
  accruedBurstBillableTib,
  includedBurstHeadroomTib,
  protocolEntitlementsForRow,
  usedTibFromBreakdownRow,
  validateHybridWorkingSet,
  NETAPP_BURST_HEADROOM_PCT,
  HYBRID_MIN_SSD_WORKING_SET_PCT,
  PROTOCOL_FAMILY_META,
  type ProtocolEntitlement,
} from '../../data/mockData';
import { HelpCircle, AlertTriangle, Info } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

/** Hover text for one protocol's dot — only "available" implies it can actually be turned on. */
function protocolDotTitle(e: ProtocolEntitlement): string {
  const meta = PROTOCOL_FAMILY_META[e.family];
  if (e.status === 'active') return `${meta.label} (${meta.protocols}) — Active`;
  if (e.status === 'available')
    return `${meta.label} (${meta.protocols}) — Available to enable from existing committed capacity, no extra cost, no hardware change.`;
  return `${meta.label} (${meta.protocols}) — Locked by hardware (ASA is block-only; cannot be enabled).`;
}

/** One-decimal TiB so committed − used never prints a float artifact like 56.19999999999999. */
function roundTib(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatTib(n: number): string {
  return roundTib(n).toFixed(1);
}

interface CurrentConsumptionTabProps {
  subscription: Subscription;
}

export function CurrentConsumptionTab({ subscription }: CurrentConsumptionTabProps) {
  const rows = subscription.serviceLevelBreakdown.map((item) => {
    const used = usedTibFromBreakdownRow(item);
    const includedBurst = includedBurstHeadroomTib(item.committed);
    const accruedBurst = accruedBurstBillableTib(item);
    return {
      level: item.level,
      committed: item.committed,
      includedBurst,
      data: item.data,
      snapshot: item.snapshot,
      used,
      accruedBurst,
      mediaSplit: item.mediaSplit,
      entitlements: protocolEntitlementsForRow(item, subscription),
    };
  });

  const hasHybridLevel = rows.some((r) => r.mediaSplit);

  const totalCommitted = roundTib(rows.reduce((s, r) => s + r.committed, 0));
  const totalUsed = roundTib(rows.reduce((s, r) => s + r.used, 0));
  const totalIncludedBurst = roundTib(rows.reduce((s, r) => s + r.includedBurst, 0));
  const totalAccruedBurst = roundTib(rows.reduce((s, r) => s + r.accruedBurst, 0));

  const chartRows = rows.map((r) => ({
    level: r.level,
    committedBar: r.committed,
    includedBurstBar: r.includedBurst,
    usedBar: r.used,
  }));

  const { currentPage, setCurrentPage, totalPages, pageSize } = useTablePagination(
    rows.length,
    TABLE_PAGE_SIZE,
    [subscription.id]
  );
  const pageRows = slicePage(rows, currentPage, pageSize);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-sm text-gray-600">Committed</div>
          <div className="text-2xl font-semibold text-gray-900">{formatTib(totalCommitted)} TiB</div>
          <div className="mt-1 text-xs text-gray-500">Minimum commitment (sum of service levels)</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-sm text-gray-600">Used</div>
          <div className="text-2xl font-semibold text-gray-900">{formatTib(totalUsed)} TiB</div>
          <div className="mt-1 text-xs text-gray-500">Data + snapshots</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-sm text-gray-600">Included burst (NetApp)</div>
          <div className="text-2xl font-semibold text-gray-900">{formatTib(totalIncludedBurst)} TiB</div>
          <div className="mt-1 text-xs text-gray-500">{Math.round(NETAPP_BURST_HEADROOM_PCT * 100)}% of committed per level</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-sm text-gray-600">Accrued burst (billable)</div>
          <div className={`text-2xl font-semibold ${totalAccruedBurst > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {formatTib(totalAccruedBurst)} TiB
          </div>
          <div className="mt-1 text-xs text-gray-500">Used above commitment → extra burst charges</div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">Headroom under commitment: </span>
          {formatTib(totalIncludedBurst)} TiB remaining before you reach minimum committed capacity.
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Detailed breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service level</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Committed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Included burst (20%)</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Snapshot</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Used</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Accrued burst</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Utilization vs committed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  <span
                    className="inline-flex items-center gap-1"
                    title="File / Block / Object. Green = active (currently provisioned). Grey = either available to enable (hardware supports it, turn it on anytime from existing committed capacity, no extra cost or hardware change) or locked by hardware (ASA is block-only) — hover a dot for which one applies."
                  >
                    Protocols
                    <Info className="h-3.5 w-3.5 text-gray-400" />
                  </span>
                </th>
                {hasHybridLevel && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    SSD / HDD split (working set)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {pageRows.map((r) => {
                const util = r.committed > 0 ? Math.round((r.used / r.committed) * 100) : 0;
                return (
                  <tr key={r.level}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.level}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 tabular-nums">{r.committed}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{r.includedBurst}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 tabular-nums">{r.data}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 tabular-nums">{r.snapshot}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 tabular-nums">{r.used}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {r.accruedBurst > 0 ? (
                        <span className="font-medium text-red-600">{r.accruedBurst}</span>
                      ) : (
                        <span className="text-gray-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex max-w-[140px] items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-gray-200">
                          <div
                            className={`h-2 rounded-full ${util > 100 ? 'bg-red-500' : util > 90 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(util, 100)}%` }}
                          />
                        </div>
                        <span className={util > 100 ? 'text-red-600' : util > 90 ? 'text-amber-600' : 'text-gray-600'}>{util}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2.5">
                        {r.entitlements.map((e) => (
                          <span key={e.family} className="flex flex-col items-center gap-0.5" title={protocolDotTitle(e)}>
                            <span className={`h-2.5 w-2.5 rounded-full ${e.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="text-[10px] uppercase leading-none text-gray-400">
                              {PROTOCOL_FAMILY_META[e.family].label[0]}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    {hasHybridLevel && (
                      <td className="px-4 py-3 text-sm">
                        {r.mediaSplit ? (
                          (() => {
                            const validation = validateHybridWorkingSet(r.mediaSplit);
                            return (
                              <div className="min-w-[160px]">
                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200">
                                  <div
                                    className={validation.compliant ? 'h-2 bg-blue-500' : 'h-2 bg-red-500'}
                                    style={{ width: `${r.mediaSplit.ssdPct}%` }}
                                    title={`SSD (working set): ${r.mediaSplit.ssdTib} TiB`}
                                  />
                                  <div
                                    className="h-2 bg-gray-400"
                                    style={{ width: `${r.mediaSplit.hddPct}%` }}
                                    title={`HDD: ${r.mediaSplit.hddTib} TiB`}
                                  />
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-xs">
                                  <span className="text-gray-600">
                                    SSD {r.mediaSplit.ssdPct}% ({r.mediaSplit.ssdTib} TiB) · HDD {r.mediaSplit.hddPct}% ({r.mediaSplit.hddTib} TiB)
                                  </span>
                                </div>
                                <div
                                  className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                                    validation.compliant ? 'text-green-700' : 'text-red-600'
                                  }`}
                                >
                                  {!validation.compliant && <AlertTriangle className="h-3 w-3 shrink-0" />}
                                  {validation.compliant
                                    ? `Working-set guardrail met (≥ ${HYBRID_MIN_SSD_WORKING_SET_PCT}% SSD)`
                                    : `Not eligible for SLAs — SSD working set below ${HYBRID_MIN_SSD_WORKING_SET_PCT}% minimum`}
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
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
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Consumption by service level</h3>
          <p className="text-sm text-gray-500">As of {new Date().toLocaleDateString()}</p>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} barGap={8} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="level" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'TiB', angle: -90, position: 'insideLeft', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="committedBar" stackId="cap" fill="#d1d5db" name="Committed" barSize={56} />
              <Bar dataKey="includedBurstBar" stackId="cap" fill="#fcd34d" name="Included burst (20%)" barSize={56} />
              <Bar dataKey="usedBar" fill="#2563eb" name="Used (data + snapshot)" barSize={40} radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">Definitions</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-blue-800">
            <li>
              <strong>Committed</strong> — minimum capacity you subscribe to; base invoice applies to this TiB.
            </li>
            <li>
              <strong>Included burst</strong> — {Math.round(NETAPP_BURST_HEADROOM_PCT * 100)}% of committed per level, provided by NetApp as
              operational headroom (not billable by itself).
            </li>
            <li>
              <strong>Used</strong> — data plus snapshots.
            </li>
            <li>
              <strong>Accrued burst</strong> — used capacity above your commitment; this is what drives extra burst charges on your bill.
            </li>
            <li>
              <strong>Protocols</strong> — one dot per File / Block / Object. Green = active today. Grey = either available to enable
              (hover for details — no extra cost, no hardware change) or locked by hardware on an ASA (block-only) service level.
            </li>
            {hasHybridLevel && (
              <li>
                <strong>SSD / HDD split (working set)</strong> — Standard-Hybrid mixes SSD (the "working set") and HDD capacity within one
                service level. Guardrail: at least {HYBRID_MIN_SSD_WORKING_SET_PCT}% of committed capacity must be SSD.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
