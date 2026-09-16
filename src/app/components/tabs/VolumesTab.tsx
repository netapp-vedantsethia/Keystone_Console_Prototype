import { useMemo, useState } from 'react';
import { getVolumesForSubscription, mockVolumes, Volume, type Subscription } from '../../data/mockData';
import { AlertCircle, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DataTableFooter } from '../ui/DataTable';
import { TABLE_PAGE_SIZE } from '../../constants/tablePagination';
import { slicePage, useTablePagination } from '../../hooks/useTablePagination';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

interface VolumesTabProps {
  /** When set, only volumes for this subscription (e.g. console subscription detail). Omit for all volumes. */
  subscription?: Subscription;
}

export function VolumesTab({ subscription }: VolumesTabProps) {
  const [selectedVolume, setSelectedVolume] = useState<Volume | null>(null);

  const volumes = useMemo(
    () => (subscription ? getVolumesForSubscription(subscription.id) : mockVolumes),
    [subscription]
  );

  const subtitle = subscription
    ? `${volumes.length} volume${volumes.length === 1 ? '' : 's'} for subscription ${subscription.number}`
    : `${volumes.length} volumes across all subscriptions`;

  const { currentPage, setCurrentPage, totalPages, pageSize } = useTablePagination(
    volumes.length,
    TABLE_PAGE_SIZE,
    [subscription?.id]
  );
  const pageVolumes = slicePage(volumes, currentPage, pageSize);

  return (
    <div className="space-y-6">
      {/* Volumes Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Volumes & Workloads</h3>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volume Name</th>
                {!subscription && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subscription</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cluster</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SVM</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity Used</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Snapshot</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Growth Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IOPS</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiering</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Protection</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Anomalies</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pageVolumes.map((volume) => (
                <tr
                  key={volume.id}
                  onClick={() => setSelectedVolume(volume)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">{volume.name}</td>
                  {!subscription && (
                    <td className="px-4 py-3 text-sm text-gray-900">{volume.subscriptionNumber}</td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900">{volume.clusterName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{volume.svm}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{volume.capacityUsed} TiB</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{volume.snapshot} TiB</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={volume.growthRate > 10 ? 'text-red-600 font-medium' : volume.growthRate > 5 ? 'text-amber-600' : 'text-gray-900'}>
                      {volume.growthRate}% /month
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={volume.name !== 'app_data_vol' && volume.latency > 1.0 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                      {volume.latency} ms
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{volume.iops.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge tone="blue" label={volume.tiering} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge tone="green" label={volume.protection} />
                  </td>
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
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={volumes.length}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
          className="border-gray-200 text-gray-600"
        />
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
            aria-labelledby="volume-panel-title"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 id="volume-panel-title" className="text-xl font-semibold text-gray-900">
                  {selectedVolume.name}
                </h2>
                <p className="text-sm text-gray-500">Volume Details & Recommendations</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVolume(null)}
                className="rounded-md p-2 hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
              <div className="space-y-6">
              {/* Volume Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-xs text-gray-600 mb-1">Capacity Used</div>
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
                        {selectedVolume.anomalies.map((anomaly, idx) => (
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
                        <StatusBadge
                          tone={
                            suggestion.effort === 'Low'
                              ? 'green'
                              : suggestion.effort === 'High'
                                ? 'red'
                                : ('amber' as StatusTone)
                          }
                          label={`${suggestion.effort} effort`}
                        />
                      </div>
                      <div className="text-sm text-gray-600 mb-3">{suggestion.impact}</div>
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Apply recommendation →
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Metrics</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">IOPS</span>
                    <span className="text-sm font-medium text-gray-900">{selectedVolume.iops.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Throughput</span>
                    <span className="text-sm font-medium text-gray-900">{selectedVolume.throughput} MB/s</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Tiering Policy</span>
                    <span className="text-sm font-medium text-gray-900">{selectedVolume.tiering}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Protection</span>
                    <span className="text-sm font-medium text-gray-900">{selectedVolume.protection}</span>
                  </div>
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