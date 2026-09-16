import { EyeOff, ShieldCheck } from 'lucide-react';
import { Subscription, includedBurstHeadroomTib } from '../../data/mockData';

interface SovereignCommitmentsTabProps {
  subscription: Subscription;
}

/**
 * Contracted SLA targets shown for Dark Site subscriptions. These mirror the same
 * per-level targets used in `SLATab.tsx` (availability SLO + P90 latency) — duplicated here as a
 * small static lookup because this view only ever shows the *contracted* number, never a
 * measured one, so it doesn't need any of that tab's live-telemetry machinery.
 */
const SERVICE_LEVEL_TARGETS: Record<string, { availabilityPct: number | null; p90Ms: number | null; platform: 'ONTAP' | 'StorageGRID' }> = {
  extreme: { availabilityPct: 99.999, p90Ms: 1, platform: 'ONTAP' },
  premium: { availabilityPct: 99.999, p90Ms: 2, platform: 'ONTAP' },
  performance: { availabilityPct: 99.999, p90Ms: 4, platform: 'ONTAP' },
  standard: { availabilityPct: 99.999, p90Ms: 4, platform: 'ONTAP' },
  value: { availabilityPct: 99.999, p90Ms: 17, platform: 'ONTAP' },
  object: { availabilityPct: null, p90Ms: null, platform: 'StorageGRID' },
  s3: { availabilityPct: null, p90Ms: null, platform: 'StorageGRID' },
};

export function SovereignCommitmentsTab({ subscription }: SovereignCommitmentsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
        <div className="text-sm text-purple-900">
          <span className="font-semibold">Service level commitments only.</span> This subscription
          runs inside your own environment, so NetApp cannot measure real-time compliance. The
          figures below are the contracted targets from your order form — not live telemetry.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {subscription.serviceLevelBreakdown.map((row) => {
          const target = SERVICE_LEVEL_TARGETS[row.level.toLowerCase()];
          return (
            <div key={row.level} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">{row.level}</h3>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  Committed
                </span>
              </div>
              <div className="mb-4">
                <div className="text-2xl font-semibold text-gray-900">{row.committed} TiB</div>
                <div className="text-xs text-gray-500">Minimum committed capacity</div>
              </div>
              <div className="space-y-2 border-t border-gray-100 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Included burst pool (contractual)</span>
                  <span className="font-medium text-gray-900">{includedBurstHeadroomTib(row.committed)} TiB</span>
                </div>
                {target?.availabilityPct != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Availability target</span>
                    <span className="font-medium text-gray-900">{target.availabilityPct}%</span>
                  </div>
                )}
                {target?.p90Ms != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Performance target</span>
                    <span className="font-medium text-gray-900">P90 &lt; {target.p90Ms} ms</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-gray-400">
                  <span className="flex items-center gap-1">
                    <EyeOff className="h-3 w-3" /> Measured usage
                  </span>
                  <span>Not visible to NetApp</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
        Need proof of compliance for an audit or regulator? Your on-site team can export local
        telemetry directly — NetApp never receives or stores it for Dark Site
        subscriptions.
      </div>
    </div>
  );
}
