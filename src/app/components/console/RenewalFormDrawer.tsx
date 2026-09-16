import { useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { StatusBadge } from '../ui/StatusBadge';
import { BpCheckbox } from '@netapp/blueprint/react';
import { Subscription } from '../../data/mockData';
import {
  buildRenewalTrackerStages,
  RENEWAL_TRACKER_STAGE_NAMES,
  nextServiceRequestId,
  type ConsoleServiceRequest,
} from '../../data/consoleOperationsMock';
import { addServiceRequest, getServiceRequests } from '../../data/serviceRequestsStore';

interface RenewalFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription;
  /** Called with the newly-created, trackable service request right after a successful submit. */
  onSubmitted?: (request: ConsoleServiceRequest) => void;
}

export function RenewalFormDrawer({
  isOpen,
  onClose,
  subscription,
  onSubmitted,
}: RenewalFormDrawerProps) {
  const [renewalType, setRenewalType] = useState<'auto' | 'manual'>('auto');
  const [version, setVersion] = useState<'v2' | 'v3'>('v2');
  const [termLength, setTermLength] = useState<'1' | '2' | '3'>('1');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = () => {
    const requestDate = new Date().toISOString().slice(0, 10);
    const newExpiry = new Date(subscription.endDate);
    newExpiry.setFullYear(newExpiry.getFullYear() + parseInt(termLength, 10));
    const isAutoRenewal = renewalType === 'auto';

    const request: ConsoleServiceRequest = {
      id: nextServiceRequestId(getServiceRequests()),
      subscriptionId: subscription.id,
      type: 'Renewal',
      requestedBy: subscription.account,
      requestDate,
      status: isAutoRenewal ? 'Completed' : 'Pending Approval',
      priority: 'Medium',
      assignedTo: 'NetApp Account Team',
      lastUpdated: 'Just now',
      currentTerm: `Expires ${new Date(subscription.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      requestedTerm: `${termLength} year${termLength !== '1' ? 's' : ''} (${version === 'v3' ? 'Version 3' : 'Version 2'})`,
      expirationDate: newExpiry.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      estimatedCost: isAutoRenewal ? 'Same as current term' : 'Pending finance review',
      renewalNotes: isAutoRenewal
        ? 'Auto-renewal enabled with existing pricing and service levels.'
        : `Manual renewal requested for ${termLength} year(s) on ${version === 'v3' ? 'Version 3' : 'Version 2'}.`,
      billingContact: 'Pending confirmation',
      stages: buildRenewalTrackerStages(
        isAutoRenewal ? RENEWAL_TRACKER_STAGE_NAMES.length : 1,
        requestDate,
      ),
    };

    addServiceRequest(request);
    onSubmitted?.(request);
    onClose();
  };

  const currentExpiry = new Date(subscription.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const daysUntilExpiry = Math.floor((new Date(subscription.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const newExpiryDate = new Date(subscription.endDate);
  newExpiryDate.setFullYear(newExpiryDate.getFullYear() + parseInt(termLength));

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[700px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">
              Renew Subscription
            </SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {subscription.number} · {subscription.trackingId} · {subscription.account}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-4">
        <div className="space-y-6">
          {/* Expiration Information */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif] leading-[24px]">
                  Subscription <span className="font-[590]">{subscription.number}</span> will expire on{' '}
                  <span className="font-[590]">{currentExpiry}</span>.
                </p>
                <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mt-1">
                  {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} remaining
                </p>
              </div>
            </div>
          </div>

          {/* Renewal Type Selection */}
          <div>
            <label className="block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-3">
              Renewal Type
            </label>
            <div className="space-y-3">
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  renewalType === 'auto'
                    ? 'border-[#0067c5] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setRenewalType('auto')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    renewalType === 'auto' ? 'border-[#0067c5]' : 'border-gray-300'
                  }`}>
                    {renewalType === 'auto' && (
                      <div className="w-3 h-3 rounded-full bg-[#0067c5]"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                      Auto-Renewal (Recommended)
                    </p>
                    <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                      Subscription will automatically renew with the same terms before expiration
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  renewalType === 'manual'
                    ? 'border-[#0067c5] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setRenewalType('manual')}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    renewalType === 'manual' ? 'border-[#0067c5]' : 'border-gray-300'
                  }`}>
                    {renewalType === 'manual' && (
                      <div className="w-3 h-3 rounded-full bg-[#0067c5]"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                      Manual Renewal
                    </p>
                    <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                      Submit a renewal request now with custom terms
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Version Selection */}
          <div>
            <label className="block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-3">
              Subscription Version
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  version === 'v2'
                    ? 'border-[#0067c5] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setVersion('v2')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[16px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                    Version 2
                  </span>
                  {version === 'v2' && <CheckCircle2 className="w-5 h-5 text-[#0067c5]" />}
                </div>
                <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                  Current version with existing service levels
                </p>
              </div>

              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  version === 'v3'
                    ? 'border-[#0067c5] bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setVersion('v3')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[16px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                    Version 3
                  </span>
                  {version === 'v3' && <CheckCircle2 className="w-5 h-5 text-[#0067c5]" />}
                </div>
                <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                  Upgrade to latest version with enhanced features
                </p>
                <StatusBadge tone="green" label="Recommended" className="mt-2 inline-block" />
              </div>
            </div>
          </div>

          {/* Term Length */}
          <div>
            <label className="block text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-3">
              Renewal Term Length
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['1', '2', '3'] as const).map((term) => (
                <div
                  key={term}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all text-center ${
                    termLength === term
                      ? 'border-[#0067c5] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setTermLength(term)}
                >
                  <div className="text-[20px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                    {term}
                  </div>
                  <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    Year{term !== '1' ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Expiration Date */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                New Expiration Date
              </span>
            </div>
            <p className="text-[16px] font-[590] text-green-700 font-['SF_Pro',sans-serif]">
              {newExpiryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mt-1">
              After renewal for {termLength} year{termLength !== '1' ? 's' : ''}
            </p>
          </div>

          {/* Terms and Conditions */}
          <div className="p-4 border border-gray-200 rounded-lg">
            <BpCheckbox
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              label={
                <>
                  I agree to the{' '}
                  <a href="#" className="text-[#0067c5] hover:underline font-[590]">
                    renewal terms and conditions
                  </a>
                </>
              }
              details="The subscription will continue with the same pricing and service levels"
            />
          </div>

          {/* Important Note */}
          {renewalType === 'auto' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                    Auto-Renewal Notice
                  </p>
                  <p className="text-[13px] font-normal text-gray-700 font-['SF_Pro',sans-serif]">
                    You can cancel auto-renewal at any time before the expiration date. 
                    For any issues, contact support.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        </SheetBody>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="text-[14px] font-[590]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!agreedToTerms}
            className="bg-[#0067c5] hover:bg-[#0056a6] text-white text-[14px] font-[590]"
          >
            {renewalType === 'auto' ? 'Enable Auto-Renewal' : 'Submit Renewal Request'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}