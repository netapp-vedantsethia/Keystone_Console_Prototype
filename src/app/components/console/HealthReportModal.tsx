import { X, FileDown } from 'lucide-react';
import { useState } from 'react';
import { BpCheckbox } from '@netapp/blueprint/react';
import { mockSubscriptions } from '../../data/mockData';
import { downloadSubscriptionsListCsv } from '../../utils/subscriptionsCsv';
import { Button } from '../ui/button';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

function healthTone(health: string): StatusTone {
  switch (health) {
    case 'healthy':
      return 'green';
    case 'warning':
      return 'amber';
    case 'critical':
      return 'red';
    default:
      return 'gray';
  }
}

interface HealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HealthReportModal({ isOpen, onClose }: HealthReportModalProps) {
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  if (!isOpen) return null;

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedSubscriptions([]);
      setSelectAll(false);
    } else {
      setSelectedSubscriptions(mockSubscriptions.map(sub => sub.id));
      setSelectAll(true);
    }
  };

  const handleToggleSubscription = (id: string) => {
    setSelectedSubscriptions(prev => {
      if (prev.includes(id)) {
        const newSelection = prev.filter(subId => subId !== id);
        setSelectAll(newSelection.length === mockSubscriptions.length);
        return newSelection;
      } else {
        const newSelection = [...prev, id];
        setSelectAll(newSelection.length === mockSubscriptions.length);
        return newSelection;
      }
    });
  };

  const handleDownload = () => {
    const selected = mockSubscriptions.filter((sub) =>
      selectedSubscriptions.includes(sub.id),
    );
    downloadSubscriptionsListCsv(
      selected,
      selected.length === mockSubscriptions.length
        ? 'subscriptions-list.csv'
        : `subscriptions-list-${selected.length}-selected.csv`,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#e0e0e0] px-6 py-4">
          <h2 className="text-[20px] font-normal leading-[32px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
            Generate Health Report
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-[#404040]" />
          </Button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          <p className="text-[14px] font-normal leading-[24px] text-[#404040] font-['SF_Pro',sans-serif] mb-4">
            Select the subscriptions you want to include in the health report:
          </p>

          {/* Select All */}
          <div className="mb-3 pb-3 border-b border-[#e0e0e0]">
            <BpCheckbox
              checked={selectAll}
              onChange={handleSelectAll}
              label={`Select all subscriptions (${mockSubscriptions.length})`}
            />
          </div>

          {/* Subscription List */}
          <div className="space-y-2">
            {mockSubscriptions.map((subscription) => {
              const isSelected = selectedSubscriptions.includes(subscription.id);
              
              return (
                <div
                  key={subscription.id}
                  className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded transition-colors border border-[#e0e0e0]"
                  onClick={() => handleToggleSubscription(subscription.id)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <BpCheckbox
                      checked={isSelected}
                      onChange={() => handleToggleSubscription(subscription.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-medium leading-[24px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                        {subscription.number}
                      </span>
                      <StatusBadge tone={healthTone(subscription.healthStatus)} label={subscription.health} />
                    </div>
                    <div className="flex items-center gap-4 text-[12px] font-normal leading-[20px] text-[#707070] font-['SF_Pro',sans-serif]">
                      <span>{subscription.customer}</span>
                      <span>•</span>
                      <span>{subscription.account}</span>
                      <span>•</span>
                      <span>{subscription.trackingId}</span>
                      <span>•</span>
                      <span>{subscription.region}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {subscription.serviceLevels.map((level, idx) => (
                        <StatusBadge key={idx} tone="gray" label={level} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#e0e0e0] bg-gray-50 px-6 py-4">
          <div className="text-[14px] font-normal leading-[24px] text-[#404040] font-['SF_Pro',sans-serif]">
            {selectedSubscriptions.length} subscription(s) selected
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleDownload} disabled={selectedSubscriptions.length === 0} className="flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Download Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
