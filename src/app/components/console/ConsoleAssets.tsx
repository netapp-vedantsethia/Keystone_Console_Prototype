import { useMemo, useState, useEffect } from 'react';
import { ConsolePageHeader } from './ConsolePageHeader';
import { DataTableFooter } from '../ui/DataTable';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { slicePage, useTablePagination } from '../../hooks/useTablePagination';
import { Search, Download, AlertCircle, HardDrive, Server, Database, Filter, ShieldCheck } from 'lucide-react';
import {
  mockVolumes,
  mockHardwareNodes,
  isOntapNMinus3OrOlder,
  getSovereigntyTierById,
  type HardwareNode,
  type Volume,
} from '../../data/mockData';
import { useConsoleMode } from '../../context/ConsoleModeContext';
import { X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function isPrivateSovereignNode(node: Pick<HardwareNode, 'subscriptionId'>): boolean {
  return getSovereigntyTierById(node.subscriptionId) === 'dark-site';
}

function matchesSearch(haystack: string, q: string) {
  return haystack.toLowerCase().includes(q.trim().toLowerCase());
}

export interface ConsoleAssetsProps {
  initialTab?: 'volumes' | 'nodes';
  highlightOntapNMinus3?: boolean;
  onIntentConsumed?: () => void;
}

export function ConsoleAssets({
  initialTab,
  highlightOntapNMinus3,
  onIntentConsumed,
}: ConsoleAssetsProps = {}) {
  const [activeTab, setActiveTab] = useState<'volumes' | 'nodes'>(() =>
    initialTab === 'volumes' || initialTab === 'nodes' ? initialTab : 'volumes',
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVolume, setSelectedVolume] = useState<Volume | null>(null);
  const [selectedNode, setSelectedNode] = useState<HardwareNode | null>(null);
  const [highlightOntapN3Rows, setHighlightOntapN3Rows] = useState(() =>
    Boolean(highlightOntapNMinus3),
  );

  useEffect(() => {
    if (initialTab === 'volumes' || initialTab === 'nodes') {
      setActiveTab(initialTab);
    }
    if (highlightOntapNMinus3) {
      setHighlightOntapN3Rows(true);
    }
    if ((initialTab || highlightOntapNMinus3) && onIntentConsumed) {
      queueMicrotask(() => onIntentConsumed());
    }
  }, [initialTab, highlightOntapNMinus3, onIntentConsumed]);

  const { isInScope } = useConsoleMode();

  const scopedNodes = useMemo(() => mockHardwareNodes.filter((n) => isInScope(n.subscriptionId)), [isInScope]);

  // Dark Site subscriptions have no volume-level visibility for NetApp — exclude their
  // volumes from the fleet view entirely rather than showing usage data that can't actually exist.
  const visibleVolumes = useMemo(
    () =>
      mockVolumes.filter((v) => getSovereigntyTierById(v.subscriptionId) !== 'dark-site' && isInScope(v.subscriptionId)),
    [isInScope],
  );

  const filteredVolumes = useMemo(() => {
    const q = searchTerm.trim();
    if (!q) return visibleVolumes;
    return visibleVolumes.filter(
      (v) =>
        matchesSearch(v.name, q) ||
        matchesSearch(v.subscriptionNumber, q) ||
        matchesSearch(v.clusterName, q) ||
        matchesSearch(v.svm, q)
    );
  }, [searchTerm, visibleVolumes]);

  const filteredNodes = useMemo(() => {
    const q = searchTerm.trim();
    if (!q) return scopedNodes;
    return scopedNodes.filter(
      (n) =>
        matchesSearch(n.name, q) ||
        matchesSearch(n.subscriptionNumber, q) ||
        matchesSearch(n.clusterName, q) ||
        matchesSearch(n.location, q)
    );
  }, [searchTerm, scopedNodes]);

  const totalCapacityLabel = visibleVolumes
    .reduce((sum, v) => sum + v.capacityUsed, 0)
    .toLocaleString(undefined, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });

  const volPage = useTablePagination(filteredVolumes.length, TABLE_PAGE_SIZE, [searchTerm]);
  const nodePage = useTablePagination(filteredNodes.length, TABLE_PAGE_SIZE, [searchTerm]);
  const pageVolumes = slicePage(filteredVolumes, volPage.currentPage, volPage.pageSize);
  const pageNodes = slicePage(filteredNodes, nodePage.currentPage, nodePage.pageSize);

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <ConsolePageHeader
        title="Assets"
        onRefresh={() => {}}
        actions={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded bg-white hover:bg-gray-50 text-sm font-medium text-gray-900">
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded bg-white hover:bg-gray-50 text-sm font-medium text-gray-900">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        }
      />

      <div className="p-5">
        {/* Overview Stats */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">Total Volumes</span>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{visibleVolumes.length}</div>
            <div className="text-xs text-gray-500 mt-1">Across all subscriptions</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">Total Nodes</span>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{scopedNodes.length}</div>
            <div className="text-xs text-gray-500 mt-1">Hardware controllers</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-gray-600">Volumes with Anomalies</span>
            </div>
            <div className="text-2xl font-semibold text-orange-600">
              {visibleVolumes.filter(v => v.anomalies.length > 0).length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Requires attention</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">Total Capacity</span>
            </div>
            <div className="text-2xl font-semibold text-gray-900">{totalCapacityLabel} TiB</div>
            <div className="text-xs text-gray-500 mt-1">Used across volumes</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('volumes');
                  setHighlightOntapN3Rows(false);
                }}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'volumes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Volumes ({visibleVolumes.length})
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('nodes')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'nodes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  ONTAP Nodes ({scopedNodes.length})
                </div>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {activeTab === 'nodes' && highlightOntapN3Rows ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
              Highlighted rows are on <strong>ONTAP N-3 or older</strong> (Latest version: 9.18.1)
            </div>
          ) : null}

          {/* Content */}
          {activeTab === 'volumes' ? (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#DDF1FF] border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Volume Name</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Subscription</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Cluster</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">SVM</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Capacity Used</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Snapshot</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Growth Rate</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Latency</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">IOPS</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Anomalies</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageVolumes.map((volume) => (
                    <tr
                      key={volume.id}
                      onClick={() => setSelectedVolume(volume)}
                      className="hover:bg-[#F5F5F5] cursor-pointer transition-colors border-b border-[var(--border)]"
                    >
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-blue-600">{volume.name}</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{volume.subscriptionNumber}</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{volume.clusterName}</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{volume.svm}</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{volume.capacityUsed} TiB</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{volume.snapshot} TiB</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif]">
                        <span className={volume.growthRate > 10 ? 'text-red-600 font-medium' : volume.growthRate > 5 ? 'text-amber-600' : 'text-[#1c1c1c]'}>
                          {volume.growthRate}% /month
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{volume.latency} ms</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{volume.iops.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        {volume.anomalies.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span className="text-amber-600 text-xs">{volume.anomalies.length}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataTableFooter
              currentPage={volPage.currentPage}
              totalPages={volPage.totalPages}
              totalItems={filteredVolumes.length}
              itemsPerPage={volPage.pageSize}
              onPageChange={volPage.setCurrentPage}
              className="border-gray-200 text-gray-600"
            />
            </>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#DDF1FF] border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Node Name</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Subscription</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Cluster</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Model</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">ONTAP Version</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Status</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">CPU Utilization</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Memory</th>
                    <th className="px-4 py-3 text-left text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Uptime</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageNodes.map((node) => {
                    const ontapBehind = isOntapNMinus3OrOlder(node.ontapVersion);
                    const rowHighlight = highlightOntapN3Rows && ontapBehind;
                    const isSovereignPrivate = isPrivateSovereignNode(node);
                    return (
                    <tr
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[#F5F5F5] ${
                        rowHighlight ? 'bg-amber-50/90 ring-1 ring-inset ring-amber-200' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-blue-600">
                        <span className="inline-flex items-center gap-1.5">
                          {isSovereignPrivate && (
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-purple-600" aria-label="Dark Site" />
                          )}
                          {node.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{node.subscriptionNumber}</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{node.clusterName}</td>
                      <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{node.model}</td>
                      {isSovereignPrivate ? (
                        <td colSpan={5} className="px-4 py-3 text-[13px] italic text-gray-400 font-['SF_Pro',sans-serif]">
                          Not available — no NetApp connectivity into Dark Site environments
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">
                            <span className={rowHighlight ? 'font-semibold text-amber-900' : ''}>{node.ontapVersion}</span>
                            {rowHighlight ? (
                              <span className="ml-2 inline-block rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-[590] text-amber-900">
                                N-3+
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                node.status === 'Healthy'
                                  ? 'bg-green-50 text-green-700'
                                  : node.status === 'Critical'
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {node.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                                <div
                                  className={`h-2 rounded-full ${node.cpuUtilization > 80 ? 'bg-red-500' : node.cpuUtilization > 60 ? 'bg-amber-500' : 'bg-green-500'}`}
                                  style={{ width: `${node.cpuUtilization}%` }}
                                ></div>
                              </div>
                              <span className="text-[#1c1c1c] font-['SF_Pro',sans-serif]">{node.cpuUtilization}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{node.memoryUsed}/{node.memoryTotal} GB</td>
                        </>
                      )}
                      {!isSovereignPrivate && (
                        <td className="px-4 py-3 text-[14px] font-normal leading-[24px] font-['SF_Pro',sans-serif] text-[#1c1c1c]">{node.uptime}</td>
                      )}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
            <DataTableFooter
              currentPage={nodePage.currentPage}
              totalPages={nodePage.totalPages}
              totalItems={filteredNodes.length}
              itemsPerPage={nodePage.pageSize}
              onPageChange={nodePage.setCurrentPage}
              className="border-gray-200 text-gray-600"
            />
            </>
          )}
        </div>
      </div>

      {/* Volume Detail Panel */}
      {selectedVolume && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50"
          onClick={() => setSelectedVolume(null)}
          role="presentation"
        >
          <div
            className="flex h-full max-h-[100dvh] w-full max-w-[600px] flex-col bg-white shadow-2xl animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedVolume.name}</h2>
                <p className="text-sm text-gray-500">Volume Details & Recommendations</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVolume(null)}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
            <div className="space-y-6">
              {/* Volume Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-1 text-xs text-gray-600">Capacity Used</div>
                  <div className="text-xl font-semibold text-gray-900">{selectedVolume.capacityUsed} TiB</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Snapshot</div>
                  <div className="text-xl font-semibold text-gray-900">{selectedVolume.snapshot} TiB</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Growth Rate</div>
                  <div className={`text-xl font-semibold ${selectedVolume.growthRate > 10 ? 'text-red-600' : 'text-gray-900'}`}>
                    {selectedVolume.growthRate}%/mo
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Latency</div>
                  <div className="text-xl font-semibold text-gray-900">{selectedVolume.latency} ms</div>
                </div>
              </div>

              {/* Anomalies */}
              {selectedVolume.anomalies.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-amber-900 mb-1">Anomalies Detected</div>
                      <ul className="text-sm text-amber-800 space-y-1">
                        {selectedVolume.anomalies.map((anomaly: string, idx: number) => (
                          <li key={idx}>• {anomaly}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Capacity Trend */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Capacity Trend (Last 30 days)</h3>
                <div style={{ width: '100%', height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedVolume.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                      />
                      <Line type="monotone" dataKey="capacity" stroke="#0066CC" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Fix Suggestions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Fix Suggestions</h3>
                <div className="space-y-2">
                  {selectedVolume.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-gray-900">{suggestion.title}</div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            suggestion.effort === 'Low'
                              ? 'bg-green-50 text-green-700'
                              : suggestion.effort === 'High'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {suggestion.effort} effort
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">{suggestion.impact}</div>
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Apply recommendation →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Node Detail Panel */}
      {selectedNode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50"
          onClick={() => setSelectedNode(null)}
          role="presentation"
        >
          <div
            className="flex h-full max-h-[100dvh] w-full max-w-[600px] flex-col bg-white shadow-2xl animate-in slide-in-from-right"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
                  {isPrivateSovereignNode(selectedNode) && (
                    <ShieldCheck className="h-5 w-5 shrink-0 text-purple-600" aria-label="Dark Site" />
                  )}
                  {selectedNode.name}
                </h2>
                <p className="text-sm text-gray-500">Hardware Node Details</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
            <div className="space-y-6">
              {isPrivateSovereignNode(selectedNode) && (
                <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
                  <div className="text-sm text-purple-900">
                    <span className="font-semibold">Dark Site.</span> This shows the
                    hardware NetApp shipped. Live status, utilization, and software version
                    aren't shown — NetApp has no connectivity into this environment.
                  </div>
                </div>
              )}

              {/* Node Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Model</div>
                  <div className="text-lg font-semibold text-gray-900">{selectedNode.model}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Serial Number</div>
                  <div className="text-lg font-semibold text-gray-900">{selectedNode.serialNumber}</div>
                </div>
                {isPrivateSovereignNode(selectedNode) ? (
                  <>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">Disks</div>
                      <div className="text-lg font-semibold text-gray-900">{selectedNode.disks}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">Site Location</div>
                      <div className="text-lg font-semibold text-gray-900">{selectedNode.location}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">ONTAP Version</div>
                      <div className="text-lg font-semibold text-gray-900">{selectedNode.ontapVersion}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-xs text-gray-600 mb-1">Uptime</div>
                      <div className="text-lg font-semibold text-gray-900">{selectedNode.uptime}</div>
                    </div>
                  </>
                )}
              </div>

              {isPrivateSovereignNode(selectedNode) ? null : (
                <>
              {/* Performance Metrics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Metrics</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">CPU Utilization</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${selectedNode.cpuUtilization > 80 ? 'bg-red-500' : selectedNode.cpuUtilization > 60 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${selectedNode.cpuUtilization}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{selectedNode.cpuUtilization}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Memory</span>
                    <span className="text-sm font-medium text-gray-900">{selectedNode.memoryUsed}/{selectedNode.memoryTotal} GB</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Disks</span>
                    <span className="text-sm font-medium text-gray-900">{selectedNode.disks}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Location</span>
                    <span className="text-sm font-medium text-gray-900">{selectedNode.location}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">System Status</h3>
                <div
                  className={`p-4 rounded-lg border ${
                    selectedNode.status === 'Healthy'
                      ? 'bg-green-50 border-green-200'
                      : selectedNode.status === 'Critical'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div
                    className={`font-semibold mb-1 ${
                      selectedNode.status === 'Healthy'
                        ? 'text-green-900'
                        : selectedNode.status === 'Critical'
                          ? 'text-red-900'
                          : 'text-amber-900'
                    }`}
                  >
                    {selectedNode.status}
                  </div>
                  <div
                    className={`text-sm ${
                      selectedNode.status === 'Healthy'
                        ? 'text-green-700'
                        : selectedNode.status === 'Critical'
                          ? 'text-red-700'
                          : 'text-amber-700'
                    }`}
                  >
                    {selectedNode.status === 'Healthy'
                      ? 'All systems operating normally'
                      : selectedNode.status === 'Critical'
                        ? 'Service impact risk — escalate to storage operations'
                        : 'High CPU utilization detected - investigate workload distribution'}
                  </div>
                </div>
              </div>
                </>
              )}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}