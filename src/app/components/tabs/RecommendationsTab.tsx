import * as React from 'react';
import {
  getRecommendationsForSubscription,
  type Recommendation,
} from '../../data/mockData';
import {
  FileText,
  Shield,
  HardDrive,
  Activity,
  Server,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { BpCard, BpCardProperty } from '@netapp/blueprint/react';

const categoryIcons = {
  renew: RotateCcw,
  upgrade: Server,
  security: Shield,
  capacity: HardDrive,
  performance: Activity,
  collector: Server,
} as const;

const categoryHeaderClass: Record<keyof typeof categoryIcons, string> = {
  renew: 'bg-blue-50 border-blue-100',
  upgrade: 'bg-purple-50 border-purple-100',
  security: 'bg-red-50 border-red-100',
  capacity: 'bg-amber-50 border-amber-100',
  performance: 'bg-green-50 border-green-100',
  collector: 'bg-orange-50 border-orange-100',
};

const categoryIconClass: Record<keyof typeof categoryIcons, string> = {
  renew: 'text-blue-600',
  upgrade: 'text-purple-600',
  security: 'text-red-600',
  capacity: 'text-amber-600',
  performance: 'text-green-600',
  collector: 'text-orange-600',
};

const categoryBadgeTone: Record<keyof typeof categoryIcons, StatusTone> = {
  renew: 'blue',
  upgrade: 'purple',
  security: 'red',
  capacity: 'amber',
  performance: 'green',
  collector: 'amber',
};

export type RecommendationsUiContext = 'subscription' | 'console';

export interface RecommendationsTabProps {
  subscriptionId: string;
  uiContext: RecommendationsUiContext;
  /** Called when the user clicks Take Action (navigate to the relevant tab). */
  onNavigateToTab?: (tab: string) => void;
}

export function RecommendationsTab({
  subscriptionId,
  uiContext,
  onNavigateToTab,
}: RecommendationsTabProps) {
  const recommendations = getRecommendationsForSubscription(subscriptionId);

  const groupedRecommendations = recommendations.reduce(
    (acc, rec) => {
      if (!acc[rec.category]) {
        acc[rec.category] = [];
      }
      acc[rec.category].push(rec);
      return acc;
    },
    {} as Record<string, Recommendation[]>,
  );

  const getImpactTone = (impact: string): StatusTone => {
    switch (impact) {
      case 'high':
        return 'green';
      case 'medium':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getUrgencyTone = (urgency: string): StatusTone => {
    switch (urgency) {
      case 'critical':
        return 'red';
      case 'high':
        return 'amber';
      case 'medium':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getEffortTone = (effort: string): StatusTone => {
    switch (effort) {
      case 'low':
        return 'green';
      case 'medium':
        return 'amber';
      case 'high':
        return 'red';
      default:
        return 'gray';
    }
  };

  const handleTakeAction = (rec: Recommendation) => {
    const tab =
      uiContext === 'console' ? rec.actionConsoleTab : rec.actionSubscriptionTab;
    onNavigateToTab?.(tab);
  };

  const categoryLabel = (category: string) => {
    switch (category) {
      case 'renew':
        return 'Renew/Modify';
      case 'upgrade':
        return 'Upgrade Hardware/ONTAP/Firmware';
      case 'security':
        return 'Security Vulnerabilities';
      case 'capacity':
        return 'Capacity Optimization';
      case 'performance':
        return 'Performance Risk';
      default:
        return 'Collector Health';
    }
  };

  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-900">No recommendations</p>
        <p className="mt-1 text-sm text-gray-600">
          There are no active recommendations for this subscription.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <BpCard>
          <BpCardProperty value={recommendations.length} property="Total recommendations" />
          <div className="mt-1 text-xs text-gray-500">For this subscription</div>
        </BpCard>
        <BpCard>
          <BpCardProperty
            value={recommendations.filter((r) => r.urgency === 'critical').length}
            property="Critical urgency"
          />
          <div className="mt-1 text-xs text-red-700">Requires immediate action</div>
        </BpCard>
        <BpCard>
          <BpCardProperty
            value={recommendations.filter((r) => r.urgency === 'high').length}
            property="High urgency"
          />
          <div className="mt-1 text-xs text-amber-700">Review within 7 days</div>
        </BpCard>
        <BpCard>
          <BpCardProperty
            value={recommendations.filter((r) => r.effort === 'low' && r.impact === 'high').length}
            property="Quick wins"
          />
          <div className="mt-1 text-xs text-green-700">High impact, low effort</div>
        </BpCard>
      </div>

      {Object.entries(groupedRecommendations).map(([category, recs]) => {
        const cat = category as keyof typeof categoryIcons;
        const Icon = categoryIcons[cat] ?? FileText;
        const headerClass = categoryHeaderClass[cat] ?? 'bg-gray-50 border-gray-100';
        const iconClass = categoryIconClass[cat] ?? 'text-gray-600';
        const badgeTone = categoryBadgeTone[cat] ?? 'gray';

        return (
          <div key={category} className="rounded-lg border border-gray-200 bg-white">
            <div className={`border-b p-4 ${headerClass}`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${iconClass}`} />
                <h3 className="text-lg font-semibold capitalize text-gray-900">
                  {categoryLabel(category)}
                </h3>
                <StatusBadge
                  tone={badgeTone}
                  label={`${recs.length} ${recs.length === 1 ? 'recommendation' : 'recommendations'}`}
                  className="ml-auto"
                />
              </div>
            </div>

            <div className="space-y-3 p-4">
              {recs.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border border-gray-200 p-4 transition-all hover:border-blue-500 hover:shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 text-sm font-semibold text-gray-900">
                        {rec.title}
                      </div>
                      <div className="text-sm text-gray-600">{rec.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={getImpactTone(rec.impact)}
                        label={`${rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1)} Impact`}
                      />
                      <StatusBadge
                        tone={getUrgencyTone(rec.urgency)}
                        label={`${rec.urgency.charAt(0).toUpperCase() + rec.urgency.slice(1)} Urgency`}
                      />
                      <StatusBadge
                        tone={getEffortTone(rec.effort)}
                        label={`${rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1)} Effort`}
                      />
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => handleTakeAction(rec)}>
                      <span className="flex items-center gap-2">Review <ChevronRight className="h-4 w-4" /></span> 
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="mb-1 text-sm font-semibold text-blue-900">
          How Recommendations Work
        </div>
        <div className="text-sm text-blue-800">
          Recommendations are scoped to this subscription and sourced from the same catalog
          used across the console. Use Take Action to open the tab where you can address
          the item (billing, volumes, SLA, support, or collectors).
        </div>
      </div>
    </div>
  );
}
