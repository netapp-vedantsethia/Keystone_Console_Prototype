import { Fragment, useState } from 'react';
import {
  Server,
  Database,
  X,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Clock,
  ChevronRight,
  Activity,
  Radio,
  HardDrive,
  DollarSign,
  TrendingDown,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  DataTable,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  DataTableHeaderCell,
  DataTableFooter,
} from '../ui/DataTable';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { slicePage, useTablePagination } from '../../hooks/useTablePagination';
import { downloadCsv } from '../../utils/csv';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { Button } from '../ui/button';
import { BpCard, BpDropdown } from '@netapp/blueprint/react';
import {
  getMockConsoleKeystoneAgentCollectors,
  getMockConsoleAsupRecords,
  keystoneAgentCollectorSubscriptions,
  subscriptionForNode,
  formatSubscriptionCompact,
  metadataCollectionHealthSummary,
  metadataSubscriptionRollups,
  mockHardwareNodes,
  type ConsoleKeystoneAgentCollector,
  type ConsoleAsupRecord,
  type MetadataCollectionStatus,
  type MetadataSubscriptionRollup,
  type ConsoleKnowledgeBaseArticle,
} from '../../data/mockData';
import { useConsoleMode } from '../../context/ConsoleModeContext';

type MetadataMainTab = 'subscription' | 'source';

/** Compact compliance ring — presentation-only wrapper around `metadataCollectionHealthSummary()` counts. */
function HealthDonut({ healthy, total }: { healthy: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((healthy / total) * 100);
  const color = pct >= 100 ? '#28a745' : pct >= 70 ? '#ff8c00' : '#dc3545';
  const data = [
    { name: 'healthy', value: Math.max(0, Math.min(100, pct)) },
    { name: 'remainder', value: Math.max(0, 100 - pct) },
  ];
  return (
    <div className="relative h-[96px] w-[96px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={33}
            outerRadius={44}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            <Cell fill={color} />
            <Cell fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-semibold text-gray-900">{pct}%</span>
      </div>
    </div>
  );
}

function SourceHealthBar({ label, healthy, total }: { label: string; healthy: number; total: number }) {
  const pct = total === 0 ? 100 : Math.round((healthy / total) * 100);
  const isFullyHealthy = healthy === total;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {healthy} of {total} healthy
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${isFullyHealthy ? 'bg-green-600' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const STATUS_TONE: Record<MetadataCollectionStatus, StatusTone> = {
  Healthy: 'green',
  Degraded: 'amber',
  'At risk': 'amber',
  Critical: 'red',
};

const STATUS_SEVERITY_RANK: Record<MetadataCollectionStatus, number> = {
  Critical: 3,
  'At risk': 2,
  Degraded: 1,
  Healthy: 0,
};

interface ImpactedRow {
  key: string;
  label: string;
  sub: string;
  nodeCount: number;
}

interface DrawerData {
  kind: 'Keystone Agent' | 'AutoSupport';
  title: string;
  status: MetadataCollectionStatus;
  lastTransfer: string;
  summary: string;
  detectedAt?: string;
  whatWentWrong?: string;
  evidence?: string[];
  recommendedSteps?: string[];
  kbArticle?: ConsoleKnowledgeBaseArticle;
  impacted: ImpactedRow[];
}

function collectorToDrawer(collector: ConsoleKeystoneAgentCollector): DrawerData {
  const impacted = keystoneAgentCollectorSubscriptions(collector).map(({ subscription, nodeCount }) => ({
    key: subscription.id,
    label: formatSubscriptionCompact(subscription),
    sub: `${subscription.region} · ${subscription.serviceLevels.join(', ')}`,
    nodeCount,
  }));
  return {
    kind: 'Keystone Agent',
    title: collector.name,
    status: collector.status,
    lastTransfer: collector.lastTransfer,
    summary: collector.summary,
    detectedAt: collector.detectedAt,
    whatWentWrong: collector.whatWentWrong,
    evidence: collector.evidence,
    recommendedSteps: collector.recommendedSteps,
    kbArticle: collector.kbArticle,
    impacted,
  };
}

function asupToDrawer(record: ConsoleAsupRecord): DrawerData {
  const subscription = subscriptionForNode(record.nodeId);
  return {
    kind: 'AutoSupport',
    title: record.nodeName,
    status: record.status,
    lastTransfer: record.lastTransfer,
    summary: record.summary,
    detectedAt: record.detectedAt,
    whatWentWrong: record.whatWentWrong,
    evidence: record.evidence,
    recommendedSteps: record.recommendedSteps,
    kbArticle: record.kbArticle,
    impacted: subscription
      ? [
          {
            key: subscription.id,
            label: formatSubscriptionCompact(subscription),
            sub: `${subscription.region} · ${subscription.serviceLevels.join(', ')}`,
            nodeCount: 1,
          },
        ]
      : [],
  };
}

function MetadataDrawer({ data, onClose }: { data: DrawerData; onClose: () => void }) {
  const isHealthy = !data.whatWentWrong;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-full max-h-[100dvh] w-full max-w-[560px] flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-purple-700 bg-purple-100">
                {data.kind === 'Keystone Agent' ? <Server className="h-3 w-3" /> : <Database className="h-3 w-3" />}
                {data.kind}
              </span>
              <StatusBadge tone={STATUS_TONE[data.status]} label={data.status} />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5 text-gray-600" />
            </Button>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-gray-900">{data.title}</h2>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <Clock className="h-3.5 w-3.5" /> Last transfer: {data.lastTransfer}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <div className="space-y-6">
            {isHealthy ? (
              <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <div className="text-sm font-semibold text-green-900">Operating normally</div>
                  <div className="text-sm text-green-700">{data.summary}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div>
                      <div className="text-sm font-semibold text-red-900">What went wrong</div>
                      <p className="mt-1 text-sm text-red-800">{data.whatWentWrong}</p>
                    </div>
                  </div>
                  {data.detectedAt && (
                    <div className="mt-2 pl-7 text-xs text-red-700">Detected at {data.detectedAt}</div>
                  )}
                </div>

                {data.evidence && data.evidence.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">Evidence</h3>
                    <ul className="space-y-1.5">
                      {data.evidence.map((line, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-gray-700">
                          <span className="text-gray-400">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.recommendedSteps && data.recommendedSteps.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">Recommended steps</h3>
                    <ol className="space-y-1.5">
                      {data.recommendedSteps.map((step, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-gray-700">
                          <span className="font-medium text-gray-500">{idx + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {data.kbArticle && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">Knowledge base article</h3>
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <div>
                        <div className="text-sm font-semibold text-blue-700">{data.kbArticle.id}</div>
                        <div className="text-sm text-blue-900">{data.kbArticle.title}</div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Still stuck after following the KB? Open a support case and we&apos;ll attach this diagnosis.
                    </p>
                  </div>
                )}
              </>
            )}

            {data.impacted.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Impacted subscriptions</h3>
                <div className="space-y-2">
                  {data.impacted.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{row.label}</div>
                        <div className="text-xs text-gray-500">{row.sub}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.nodeCount} node{row.nodeCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4">
          <Button variant="outline" className="w-full">
            Contact NetApp support
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImpactChip({ tone, icon, children }: { tone: 'billing' | 'performance'; icon: React.ReactNode; children: React.ReactNode }) {
  const toneClass =
    tone === 'billing' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {icon}
      {children}
    </span>
  );
}

/** Metering readiness reflects whether AutoSupport (billing verification) data is intact for the subscription. */
function meteringReadinessTone(rollup: MetadataSubscriptionRollup): { tone: StatusTone; label: string } {
  return rollup.billingImpact ? { tone: 'amber', label: 'At risk' } : { tone: 'green', label: 'Ready' };
}

function SubscriptionRollupRow({
  rollup,
  expanded,
  onToggle,
  onOpenCollector,
  onOpenAsup,
}: {
  rollup: MetadataSubscriptionRollup;
  expanded: boolean;
  onToggle: () => void;
  onOpenCollector: (collector: ConsoleKeystoneAgentCollector) => void;
  onOpenAsup: (record: ConsoleAsupRecord) => void;
}) {
  const metering = meteringReadinessTone(rollup);
  return (
    <Fragment>
      <DataTableRow onClick={onToggle}>
        <DataTableCell>
          <div className="flex items-center gap-2">
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
            <span className="font-medium text-[#0067c5]">{rollup.subscription.number}</span>
          </div>
        </DataTableCell>
        <DataTableCell>{rollup.subscription.trackingId}</DataTableCell>
        <DataTableCell>{rollup.subscription.account}</DataTableCell>
        <DataTableCell>
          <StatusBadge tone={STATUS_TONE[rollup.status]} label={rollup.status} />
        </DataTableCell>
        <DataTableCell align="right">
          {rollup.affectedNodeCount} of {rollup.nodes.length}
        </DataTableCell>
        <DataTableCell>
          <StatusBadge tone={metering.tone} label={metering.label} />
        </DataTableCell>
      </DataTableRow>

      {expanded && (
        <tr>
          <td colSpan={6} className="border-t border-gray-200 bg-gray-50 p-0">
            <div className="px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {rollup.billingImpact && (
                  <ImpactChip tone="billing" icon={<DollarSign className="h-3 w-3" />}>
                    Billing impact
                  </ImpactChip>
                )}
                {rollup.performanceImpact && (
                  <ImpactChip tone="performance" icon={<TrendingDown className="h-3 w-3" />}>
                    Performance impact
                  </ImpactChip>
                )}
              </div>
              <table className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Node</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Telemetry status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Keystone Agent</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">AutoSupport</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rollup.nodes.map((row) => (
                    <tr key={row.node.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{row.node.name}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge tone={STATUS_TONE[row.telemetryStatus]} label={row.telemetryStatus} />
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {row.collector ? (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => onOpenCollector(row.collector as ConsoleKeystoneAgentCollector)}
                          >
                            {row.collector.status !== 'Healthy' ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            )}
                            <span>
                              {row.collector.name} · {row.collector.lastTransfer}
                            </span>
                          </Button>
                        ) : (
                          <span className="text-gray-400">Not covered</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {row.asup ? (
                          <Button variant="link" size="sm" onClick={() => onOpenAsup(row.asup as ConsoleAsupRecord)}>
                            {row.asup.status !== 'Healthy' ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            )}
                            <span>{row.asup.lastTransfer}</span>
                          </Button>
                        ) : (
                          <span className="text-gray-400">No record</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function ConsoleMetadataCollectionTab() {
  const { scopedSubscriptions, isInScope } = useConsoleMode();
  const [mainTab, setMainTab] = useState<MetadataMainTab>('subscription');
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const [rollupSearch, setRollupSearch] = useState('');
  const [collectorSearch, setCollectorSearch] = useState('');
  const [asupSearch, setAsupSearch] = useState('');

  const scopedNodeIds = new Set(mockHardwareNodes.filter((n) => isInScope(n.subscriptionId)).map((n) => n.id));
  const scopedHardwareNodes = mockHardwareNodes.filter((n) => scopedNodeIds.has(n.id));
  const collectors = getMockConsoleKeystoneAgentCollectors().filter((c) => c.nodeIds.some((id) => scopedNodeIds.has(id)));
  const asupRecords = getMockConsoleAsupRecords().filter((a) => scopedNodeIds.has(a.nodeId));
  const summary = metadataCollectionHealthSummary(scopedSubscriptions, scopedHardwareNodes);
  const rollups = metadataSubscriptionRollups(scopedSubscriptions);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const worst = [...rollups].sort(
      (a, b) => STATUS_SEVERITY_RANK[b.status] - STATUS_SEVERITY_RANK[a.status],
    )[0];
    return worst && worst.status !== 'Healthy' ? new Set([worst.subscription.id]) : new Set();
  });
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sortedRollups = [...rollups].sort(
    (a, b) => STATUS_SEVERITY_RANK[b.status] - STATUS_SEVERITY_RANK[a.status],
  );

  const filteredRollups = sortedRollups.filter((rollup) => {
    const q = rollupSearch.trim().toLowerCase();
    if (!q) return true;
    return [rollup.subscription.number, rollup.subscription.trackingId, rollup.subscription.account].some((field) =>
      field?.toLowerCase().includes(q),
    );
  });

  const filteredCollectors = collectors.filter((collector) => {
    const q = collectorSearch.trim().toLowerCase();
    if (!q) return true;
    return [collector.name, collector.region].some((field) => field?.toLowerCase().includes(q));
  });

  const filteredAsupRecords = asupRecords.filter((record) => {
    const q = asupSearch.trim().toLowerCase();
    if (!q) return true;
    return [record.nodeName, record.clusterName].some((field) => field?.toLowerCase().includes(q));
  });

  const collectorsPg = useTablePagination(filteredCollectors.length, TABLE_PAGE_SIZE, [collectorSearch]);
  const pageCollectors = slicePage(filteredCollectors, collectorsPg.currentPage, collectorsPg.pageSize);

  const asupPg = useTablePagination(filteredAsupRecords.length, TABLE_PAGE_SIZE, [asupSearch]);
  const pageAsup = slicePage(filteredAsupRecords, asupPg.currentPage, asupPg.pageSize);

  const rollupsPg = useTablePagination(filteredRollups.length, TABLE_PAGE_SIZE, [rollupSearch]);
  const pageRollups = slicePage(filteredRollups, rollupsPg.currentPage, rollupsPg.pageSize);

  const downloadRollupsCsv = () =>
    downloadCsv(
      ['Subscription ID', 'Tracking ID', 'Account name', 'Telemetry health', 'Nodes impacted', 'Total nodes', 'Metering readiness'],
      filteredRollups.map((rollup) => [
        rollup.subscription.number,
        rollup.subscription.trackingId,
        rollup.subscription.account,
        rollup.status,
        rollup.affectedNodeCount,
        rollup.nodes.length,
        meteringReadinessTone(rollup).label,
      ]),
      'metadata-subscriptions.csv',
    );

  const downloadCollectorsCsv = () =>
    downloadCsv(
      ['Instance', 'Region', 'Nodes covered', 'Last transfer', 'Status', 'Impacted subscriptions'],
      filteredCollectors.map((collector) => [
        collector.name,
        collector.region,
        collector.nodeIds.length,
        collector.lastTransfer,
        collector.status,
        keystoneAgentCollectorSubscriptions(collector).length,
      ]),
      'keystone-agent-instances.csv',
    );

  const downloadAsupCsv = () =>
    downloadCsv(
      ['Instance', 'Cluster', 'Last transfer', 'Status', 'Impacted subscription'],
      filteredAsupRecords.map((record) => {
        const subscription = subscriptionForNode(record.nodeId);
        return [
          record.nodeName,
          record.clusterName,
          record.lastTransfer,
          record.status,
          subscription ? formatSubscriptionCompact(subscription) : record.subscriptionId,
        ];
      }),
      'autosupport-nodes.csv',
    );

  const healthySubscriptions = summary.totalSubscriptions - summary.subscriptionsAtRisk;
  const healthyNodes = summary.totalNodes - summary.affectedNodeCount;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Metadata Collection</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Subscription telemetry health */}
        <BpCard>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Subscription telemetry health</h3>
          </div>
          <div className="flex items-center gap-4">
            <HealthDonut healthy={healthySubscriptions} total={summary.totalSubscriptions} />
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {healthySubscriptions} of {summary.totalSubscriptions} healthy
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.billingImpactSubscriptions > 0 && (
                  <ImpactChip tone="billing" icon={<DollarSign className="h-3 w-3" />}>
                    {summary.billingImpactSubscriptions} billing impact
                  </ImpactChip>
                )}
                {summary.performanceImpactSubscriptions > 0 && (
                  <ImpactChip tone="performance" icon={<TrendingDown className="h-3 w-3" />}>
                    {summary.performanceImpactSubscriptions} performance impact
                  </ImpactChip>
                )}
                {summary.billingImpactSubscriptions === 0 && summary.performanceImpactSubscriptions === 0 && (
                  <span className="text-xs text-gray-500">No billing or performance impact</span>
                )}
              </div>
            </div>
          </div>
        </BpCard>

        {/* Metadata source health */}
        <BpCard>
          <div className="mb-3 flex items-center gap-2">
            <Radio className="h-5 w-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Metadata source health</h3>
          </div>
          <div className="space-y-3">
            <SourceHealthBar
              label="Keystone Agent"
              healthy={summary.collectorInstances - summary.collectorIssueCount}
              total={summary.collectorInstances}
            />
            <SourceHealthBar
              label="AutoSupport"
              healthy={summary.asupNodeCount - summary.asupIssueCount}
              total={summary.asupNodeCount}
            />
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {summary.failingSourceCount > 0
              ? `${summary.failingSourceCount} source${summary.failingSourceCount === 1 ? '' : 's'} failing`
              : 'All sources healthy'}
          </div>
        </BpCard>

        {/* Node telemetry coverage */}
        <BpCard>
          <div className="mb-3 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Node telemetry coverage</h3>
          </div>
          <div className="flex items-center gap-4">
            <HealthDonut healthy={healthyNodes} total={summary.totalNodes} />
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {summary.affectedNodeCount} of {summary.totalNodes} affected
              </div>
              <div className="mt-1 text-xs text-gray-500">Across both collection methods</div>
            </div>
          </div>
        </BpCard>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {mainTab === 'subscription'
            ? "Each subscription's nodes, and how each node's Keystone Agent and AutoSupport coverage is doing — expand a subscription to drill into its nodes, then into a specific source instance."
            : 'Keystone Agent (many-to-many, real-time telemetry) and AutoSupport (one-to-one, daily billing verification) source instances.'}
        </p>
        <div className="w-56 shrink-0">
          <BpDropdown
            aria-label="Metadata collection view"
            value={mainTab}
            onValueChange={(id) => setMainTab((id as MetadataMainTab) ?? 'subscription')}
            showClearButton={false}
            options={[
              { value: 'subscription', label: 'Subscription view' },
              { value: 'source', label: 'Source view' },
            ]}
          />
        </div>
      </div>

      {mainTab === 'subscription' && (
        <DataTable
          title="Subscriptions"
          count={filteredRollups.length}
          showSearch
          showDownload
          onSearch={setRollupSearch}
          onDownload={downloadRollupsCsv}
        >
          <table className="w-full">
            <DataTableHeader>
              <tr>
                <DataTableHeaderCell>Subscription ID</DataTableHeaderCell>
                <DataTableHeaderCell>Tracking ID</DataTableHeaderCell>
                <DataTableHeaderCell>Account name</DataTableHeaderCell>
                <DataTableHeaderCell>Telemetry health</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Nodes impacted</DataTableHeaderCell>
                <DataTableHeaderCell>Metering readiness</DataTableHeaderCell>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {pageRollups.map((rollup) => (
                <SubscriptionRollupRow
                  key={rollup.subscription.id}
                  rollup={rollup}
                  expanded={expandedIds.has(rollup.subscription.id)}
                  onToggle={() => toggleExpanded(rollup.subscription.id)}
                  onOpenCollector={(collector) => setDrawer(collectorToDrawer(collector))}
                  onOpenAsup={(record) => setDrawer(asupToDrawer(record))}
                />
              ))}
              {pageRollups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                    No subscriptions match your search.
                  </td>
                </tr>
              )}
            </DataTableBody>
          </table>
          <DataTableFooter
            currentPage={rollupsPg.currentPage}
            totalPages={rollupsPg.totalPages}
            totalItems={filteredRollups.length}
            itemsPerPage={rollupsPg.pageSize}
            onPageChange={rollupsPg.setCurrentPage}
          />
        </DataTable>
      )}

      {mainTab === 'source' && (
        <div className="space-y-5">
          <DataTable
            title="Keystone Agent instances"
            count={filteredCollectors.length}
            showSearch
            showDownload
            onSearch={setCollectorSearch}
            onDownload={downloadCollectorsCsv}
          >
            <table className="w-full">
              <DataTableHeader>
                <tr>
                  <DataTableHeaderCell>Instance</DataTableHeaderCell>
                  <DataTableHeaderCell>Region</DataTableHeaderCell>
                  <DataTableHeaderCell align="right">Nodes covered</DataTableHeaderCell>
                  <DataTableHeaderCell>Last transfer</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Impacted subscriptions</DataTableHeaderCell>
                  <DataTableHeaderCell sticky="end"></DataTableHeaderCell>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {pageCollectors.map((collector) => {
                  const subs = keystoneAgentCollectorSubscriptions(collector);
                  return (
                    <DataTableRow key={collector.id}>
                      <DataTableCell>{collector.name}</DataTableCell>
                      <DataTableCell>{collector.region}</DataTableCell>
                      <DataTableCell align="right">{collector.nodeIds.length}</DataTableCell>
                      <DataTableCell>{collector.lastTransfer}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={STATUS_TONE[collector.status]} label={collector.status} />
                      </DataTableCell>
                      <DataTableCell>
                        {subs.length} subscription{subs.length === 1 ? '' : 's'}
                      </DataTableCell>
                      <DataTableCell align="right" sticky="end">
                        <Button variant="link" size="sm" onClick={() => setDrawer(collectorToDrawer(collector))}>
                          View details
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
                {pageCollectors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                      No Keystone Agent instances match your search.
                    </td>
                  </tr>
                )}
              </DataTableBody>
            </table>
            <DataTableFooter
              currentPage={collectorsPg.currentPage}
              totalPages={collectorsPg.totalPages}
              totalItems={filteredCollectors.length}
              itemsPerPage={collectorsPg.pageSize}
              onPageChange={collectorsPg.setCurrentPage}
            />
          </DataTable>

          <DataTable
            title="AutoSupport nodes"
            count={filteredAsupRecords.length}
            showSearch
            showDownload
            onSearch={setAsupSearch}
            onDownload={downloadAsupCsv}
          >
            <table className="w-full">
              <DataTableHeader>
                <tr>
                  <DataTableHeaderCell>Instance</DataTableHeaderCell>
                  <DataTableHeaderCell>Cluster</DataTableHeaderCell>
                  <DataTableHeaderCell>Last transfer</DataTableHeaderCell>
                  <DataTableHeaderCell>Status</DataTableHeaderCell>
                  <DataTableHeaderCell>Impacted subscription</DataTableHeaderCell>
                  <DataTableHeaderCell sticky="end"></DataTableHeaderCell>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {pageAsup.map((record) => {
                  const subscription = subscriptionForNode(record.nodeId);
                  return (
                    <DataTableRow key={record.id}>
                      <DataTableCell>{record.nodeName}</DataTableCell>
                      <DataTableCell>{record.clusterName}</DataTableCell>
                      <DataTableCell>{record.lastTransfer}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={STATUS_TONE[record.status]} label={record.status} />
                      </DataTableCell>
                      <DataTableCell>
                        {subscription ? formatSubscriptionCompact(subscription) : record.subscriptionId}
                      </DataTableCell>
                      <DataTableCell align="right" sticky="end">
                        <Button variant="link" size="sm" onClick={() => setDrawer(asupToDrawer(record))}>
                          View details
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
                {pageAsup.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                      No AutoSupport nodes match your search.
                    </td>
                  </tr>
                )}
              </DataTableBody>
            </table>
            <DataTableFooter
              currentPage={asupPg.currentPage}
              totalPages={asupPg.totalPages}
              totalItems={filteredAsupRecords.length}
              itemsPerPage={asupPg.pageSize}
              onPageChange={asupPg.setCurrentPage}
            />
          </DataTable>
        </div>
      )}

      {drawer && <MetadataDrawer data={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}
