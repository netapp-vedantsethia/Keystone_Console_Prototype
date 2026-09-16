import { Shield, Database, Zap, TrendingUp, CheckCircle, Plus } from 'lucide-react';
import { isDarkSite, Subscription } from '../../data/mockData';
import { StatusBadge } from '../ui/StatusBadge';

interface AddonsTabProps {
  subscription: Subscription;
}

export function AddonsTab({ subscription }: AddonsTabProps) {
  // All available add-ons offered by Keystone
  const allAddons = [
    {
      id: 'adp',
      name: 'Advanced Data Protection',
      subtitle: 'MetroCluster',
      description: 'Continuous availability and disaster recovery for mission-critical applications',
      icon: Shield,
      color: '#28a745',
      pricing: '+$5,000/mo',
      benefits: ['Zero RPO/RTO', 'Automatic failover', 'Synchronous replication']
    },
    {
      id: 'dii',
      name: 'Data Infrastructure Insights',
      subtitle: 'DII',
      description: 'AI-powered analytics and observability across your entire data infrastructure',
      icon: TrendingUp,
      color: '#0066CC',
      pricing: '+$2,500/mo',
      benefits: ['Performance monitoring', 'Capacity forecasting', 'Cost optimization']
    },
    {
      id: 'sla',
      name: 'Enhanced SLA Guarantees',
      subtitle: 'Performance, Availability, Sustainability',
      description: 'Premium SLA guarantees for performance, availability, and sustainability metrics',
      icon: CheckCircle,
      color: '#7c3aed',
      pricing: '+$3,000/mo',
      benefits: ['99.999% availability', 'Performance guarantees', 'Carbon offset tracking']
    },
    {
      id: 'burst',
      name: 'Additional Burst Capacity',
      subtitle: 'Extended burst allowance',
      description: 'Increase burst capacity limits and duration for unpredictable workload spikes',
      icon: Zap,
      color: '#ff6b35',
      pricing: '+$1,500/mo',
      benefits: ['Extended burst windows', '50% higher burst limits', 'Priority support']
    },
    {
      id: 'nrnvc',
      name: 'NRNVC',
      subtitle: 'Non-Returnable, Non-Volatile Components',
      description: 'Keep decommissioned hardware for security and compliance requirements',
      icon: Database,
      color: '#404040',
      pricing: '+$800/mo',
      benefits: ['Hardware retention', 'Data destruction', 'Compliance documentation']
    },
    {
      id: 'nrd',
      name: 'NRD',
      subtitle: 'Non-Returnable Drives',
      description: 'Retain failed drives for data security and compliance',
      icon: Database,
      color: '#737373',
      pricing: '+$500/mo',
      benefits: ['Drive retention', 'Secure destruction', 'Audit trail']
    },
    {
      id: 'tiering',
      name: 'Data Tiering',
      subtitle: 'FabricPool cloud tiering',
      description: 'Automatically tier cold data to low-cost object storage',
      icon: Database,
      color: '#3498db',
      pricing: '+$1,200/mo',
      benefits: ['Reduce capacity costs', 'Automated tiering', 'Multi-cloud support']
    },
    {
      id: 'usps',
      name: 'USPS',
      subtitle: 'US Public Sector',
      description: 'Enhanced security and compliance for US government and public sector',
      icon: Shield,
      color: '#dc3545',
      pricing: 'Contact sales',
      benefits: ['FedRAMP certified', 'FIPS 140-2', 'Dedicated support']
    }
  ];

  // Check which add-ons are currently subscribed
  const subscribedAddons = subscription.addOns || [];

  // Burst capacity isn't offerable on Dark Site: NetApp never sees usage, so it can
  // never measure — let alone bill or extend — burst for these subscriptions.
  const offerableAddons = isDarkSite(subscription)
    ? allAddons.filter((addon) => addon.id !== 'burst')
    : allAddons;

  const activeAddons = offerableAddons.filter(addon => 
    subscribedAddons.some(sub => 
      addon.name.toLowerCase().includes(sub.toLowerCase()) || 
      addon.subtitle.toLowerCase().includes(sub.toLowerCase())
    )
  );

  const availableAddons = offerableAddons.filter(addon => 
    !subscribedAddons.some(sub => 
      addon.name.toLowerCase().includes(sub.toLowerCase()) || 
      addon.subtitle.toLowerCase().includes(sub.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      {/* Active Add-ons */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Add-ons ({activeAddons.length})</h2>
          <p className="text-sm text-gray-600">Add-on services currently included with this subscription</p>
        </div>
        
        {activeAddons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAddons.map(addon => {
              const Icon = addon.icon;
              return (
                <div key={addon.id} className="bg-white border-2 border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${addon.color}15` }}>
                      <Icon className="w-5 h-5" style={{ color: addon.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">{addon.name}</h3>
                          <p className="text-xs text-gray-600">{addon.subtitle}</p>
                        </div>
                        <StatusBadge tone="green" label="Active" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">{addon.description}</p>
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1">Benefits:</div>
                    <ul className="space-y-1">
                      {addon.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-900">{addon.pricing}</span>
                    <button className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 transition-colors">
                      Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">No active add-ons for this subscription</p>
          </div>
        )}
      </div>

      {/* Available Add-ons */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Available Add-ons ({availableAddons.length})</h2>
          <p className="text-sm text-gray-600">Enhance your subscription with these additional services</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableAddons.map(addon => {
            const Icon = addon.icon;
            return (
              <div key={addon.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${addon.color}15` }}>
                    <Icon className="w-5 h-5" style={{ color: addon.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">{addon.name}</h3>
                    <p className="text-xs text-gray-600">{addon.subtitle}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-3">{addon.description}</p>
                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-1">Key benefits:</div>
                  <ul className="space-y-1">
                    {addon.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                        <CheckCircle className="w-3 h-3 text-gray-400" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-900">{addon.pricing}</span>
                  <button className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
