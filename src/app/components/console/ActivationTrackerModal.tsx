import { CheckCircle2, Circle, Clock, Download, ChevronDown, ChevronUp, MapPin, Mail, Phone, Package } from 'lucide-react';
import { useState } from 'react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';
import { DeploymentDesignModal } from './DeploymentDesignModal';
import { SiteReadinessModal } from './SiteReadinessModal';
import { DeploymentPlanModal } from './DeploymentPlanModal';
import { PLATFORM_REFERENCE_DATE } from '../../data/dateShift';

/** `MM/DD/YYYY` date `days` from "today" — keeps this tracker's milestones current on every load. */
function offsetDateLabel(days: number): string {
  const d = new Date(PLATFORM_REFERENCE_DATE);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

const HARDWARE_DELIVERY_OFFSET_DAYS = 8;
const INSTALL_PLAN_OFFSET_DAYS = 19;
const ACTIVATION_OFFSET_DAYS = 26;

interface ActivationStage {
  name: string;
  status: 'completed' | 'in-progress' | 'pending';
  completedDate?: string;
  estimatedDate?: string;
  details?: string;
}

const STAGE_STATUS_TONE: Record<ActivationStage['status'], StatusTone> = {
  completed: 'green',
  'in-progress': 'blue',
  pending: 'gray',
};

const STAGE_STATUS_LABEL: Record<ActivationStage['status'], string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  pending: 'Pending',
};

interface ActivationTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId: string;
  subscriptionName: string;
}

export function ActivationTrackerModal({
  isOpen,
  onClose,
  subscriptionId,
  subscriptionName,
}: ActivationTrackerModalProps) {
  const activationStages: ActivationStage[] = [
    {
      name: 'Deployment Design',
      status: 'completed',
      completedDate: offsetDateLabel(-35),
      details: 'Data Center Layout & Finalized Deployment Design'
    },
    {
      name: 'Site Readiness',
      status: 'completed',
      completedDate: offsetDateLabel(-28),
      details: 'Review Site Readiness - Space, Power, Cooling, Networking, IPs & VMs, Logistics Details'
    },
    {
      name: 'Hardware Fulfilment',
      status: 'in-progress',
      estimatedDate: offsetDateLabel(HARDWARE_DELIVERY_OFFSET_DAYS + 4),
      details: 'Hardware procurement and delivery in progress - 60% complete'
    },
    {
      name: 'Install Plan',
      status: 'pending',
      estimatedDate: offsetDateLabel(INSTALL_PLAN_OFFSET_DAYS),
      details: 'Install plan creation and approval pending'
    },
    {
      name: 'Subscription Activation',
      status: 'pending',
      estimatedDate: offsetDateLabel(ACTIVATION_OFFSET_DAYS),
      details: 'Subscription activation and validation pending'
    },
  ];

  const completedStages = activationStages.filter(s => s.status === 'completed').length;
  const totalStages = activationStages.length;
  const progressPercentage = (completedStages / totalStages) * 100;

  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [showDeploymentDesign, setShowDeploymentDesign] = useState(false);
  const [showSiteReadiness, setShowSiteReadiness] = useState(false);
  const [showDeploymentPlan, setShowDeploymentPlan] = useState(false);

  const toggleStageExpansion = (stageName: string) => {
    if (stageName === 'Deployment Design') {
      setShowDeploymentDesign(true);
    } else if (stageName === 'Site Readiness') {
      setShowSiteReadiness(true);
    } else if (stageName === 'Install Plan') {
      setShowDeploymentPlan(true);
    } else {
      setExpandedStage(expandedStage === stageName ? null : stageName);
    }
  };

  const handleReturnToTracker = () => {
    setShowDeploymentDesign(false);
    setShowSiteReadiness(false);
    setShowDeploymentPlan(false);
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[700px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">
              Subscription Activation Tracker
            </SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {subscriptionId} - {subscriptionName}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-4">
        {/* Progress Overview */}
        <div className="px-6 py-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Overall Progress</span>
            <span className="text-[14px] font-semibold text-blue-700 font-['SF_Pro',sans-serif]">
              {completedStages} of {totalStages} stages completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-2 text-[13px] text-gray-600 font-['SF_Pro',sans-serif]">
            <span>Expected Activation: {offsetDateLabel(ACTIVATION_OFFSET_DAYS)}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Est. {ACTIVATION_OFFSET_DAYS} days remaining
            </span>
          </div>
        </div>

        {/* Stages Timeline */}
        <div className="mt-6 space-y-6 px-2">
          {activationStages.map((stage, index) => (
            <div key={index} className="relative flex gap-4">
              {/* Timeline connector */}
              {index < activationStages.length - 1 && (
                <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-200"></div>
              )}

              {/* Status Icon */}
              <div className="flex-shrink-0 pt-1">
                {stage.status === 'completed' && (
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                )}
                {stage.status === 'in-progress' && (
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center relative">
                    <Circle className="w-6 h-6 text-blue-600" />
                    <span className="absolute w-3 h-3 bg-blue-600 rounded-full animate-pulse"></span>
                  </div>
                )}
                {stage.status === 'pending' && (
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Circle className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Stage Content */}
              <div className="flex-1 pb-6">
                <button 
                  onClick={() => toggleStageExpansion(stage.name)}
                  className="w-full text-left hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-[16px] font-[590] font-['SF_Pro',sans-serif] ${
                          stage.status === 'completed' ? 'text-[#1c1c1c]' :
                          stage.status === 'in-progress' ? 'text-blue-700' :
                          'text-gray-500'
                        }`}>
                          {stage.name}
                        </h3>
                        {expandedStage === stage.name ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <p className="text-[14px] font-normal text-gray-600 mt-1 font-['SF_Pro',sans-serif]">{stage.details}</p>
                    </div>
                    <div className="ml-4 shrink-0">
                      <StatusBadge tone={STAGE_STATUS_TONE[stage.status]} label={STAGE_STATUS_LABEL[stage.status]} />
                    </div>
                  </div>

                  {/* Date Information */}
                  <div className="flex items-center gap-4 text-[13px] text-gray-500 mt-2 font-['SF_Pro',sans-serif]">
                    {stage.completedDate && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed: {stage.completedDate}
                      </span>
                    )}
                    {stage.estimatedDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Est. Completion: {stage.estimatedDate}
                      </span>
                    )}
                  </div>
                </button>

                {/* Expandable Content - Delivery Tracking for Hardware Fulfilment */}
                {expandedStage === stage.name && stage.name === 'Hardware Fulfilment' && (
                  <div className="mt-4 bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
                    {/* Tracking Number */}
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Tracking Number</span>
                      </div>
                      <span className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">FDX987654321000</span>
                    </div>

                    {/* Delivery Address */}
                    <div className="flex items-start gap-2 mb-3 pb-3 border-b border-gray-200">
                      <MapPin className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] block mb-1">Delivery Address</span>
                        <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                          <div>NetApp Data Center - East</div>
                          <div>201 N Katlian St</div>
                          <div>Dallas, TX</div>
                        </div>
                      </div>
                    </div>

                    {/* Estimated Delivery */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Estimated Delivery</span>
                      </div>
                      <span className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">
                        {offsetDateLabel(HARDWARE_DELIVERY_OFFSET_DAYS)}
                      </span>
                    </div>

                    {/* Delivery Route Map */}
                    <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <svg width="100%" height="180" viewBox="0 0 600 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Map Background Grid */}
                        <defs>
                          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                          </pattern>
                        </defs>
                        <rect width="600" height="180" fill="url(#grid)" />
                        
                        {/* Route Line - from current location to destination */}
                        <path 
                          d="M 200 90 Q 350 70, 500 90" 
                          stroke="#3b82f6" 
                          strokeWidth="3" 
                          fill="none"
                          strokeDasharray="8 4"
                          opacity="0.6"
                        />
                        
                        {/* Current Location - In Transit */}
                        <circle cx="200" cy="90" r="8" fill="#3b82f6" stroke="#fff" strokeWidth="2">
                          <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite"/>
                        </circle>
                        <text x="200" y="120" textAnchor="middle" className="text-[12px] font-['SF_Pro',sans-serif]" fill="#1c1c1c" fontWeight="590">
                          Memphis, TN
                        </text>
                        <text x="200" y="135" textAnchor="middle" className="text-[11px] font-['SF_Pro',sans-serif]" fill="#3b82f6" fontWeight="590">
                          Current Location
                        </text>
                        
                        {/* Destination Point */}
                        <circle cx="500" cy="90" r="8" fill="#22c55e" stroke="#fff" strokeWidth="2"/>
                        <path 
                          d="M 500 75 L 500 90" 
                          stroke="#22c55e" 
                          strokeWidth="2.5"
                        />
                        <circle cx="500" cy="75" r="3" fill="#22c55e"/>
                        <text x="500" y="120" textAnchor="middle" className="text-[12px] font-['SF_Pro',sans-serif]" fill="#1c1c1c" fontWeight="590">
                          Dallas, TX
                        </text>
                        <text x="500" y="135" textAnchor="middle" className="text-[11px] font-['SF_Pro',sans-serif]" fill="#6b7280">
                          Destination
                        </text>
                      </svg>
                    </div>

                    {/* Deployment Project Manager */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-[14px] font-[590] text-blue-700 font-['SF_Pro',sans-serif]">PM</span>
                        </div>
                        <div>
                          <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">Deployment Project Manager</div>
                          <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">Sarah Mitchell</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 ml-10">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <a href="mailto:sarah.mitchell@netapp.com" className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]">
                            sarah.mitchell@netapp.com
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <a href="tel:+14085551234" className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]">
                            +1 (408) 555-1234
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Expandable Content - Subscription Activation */}
                {expandedStage === stage.name && stage.name === 'Subscription Activation' && (
                  <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-[590] text-gray-700 font-['SF_Pro',sans-serif] mb-2">
                          Subscription activation pending - will be activated effective {offsetDateLabel(ACTIVATION_OFFSET_DAYS)}
                        </div>
                        <button className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif] underline">
                          View Subscription Details
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </SheetBody>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-background px-6 py-4">
          <div className="text-[14px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
            <span className="font-[590]">Next milestone:</span> Install Plan (Est. {offsetDateLabel(INSTALL_PLAN_OFFSET_DAYS)})
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2 text-[14px] font-[590]"
          >
            <Download className="w-4 h-4" />
            Download Report
          </Button>
        </div>
      </SheetContent>
    </Sheet>

      {/* Deployment Design Modal */}
      <DeploymentDesignModal 
        isOpen={showDeploymentDesign}
        onClose={handleReturnToTracker}
        onReturnToTracker={handleReturnToTracker}
      />

      {/* Site Readiness Modal */}
      <SiteReadinessModal 
        key={showSiteReadiness ? 'site-readiness-open' : 'site-readiness-closed'}
        isOpen={showSiteReadiness}
        onClose={handleReturnToTracker}
        onReturnToTracker={handleReturnToTracker}
      />

      {/* Deployment Plan Modal */}
      <DeploymentPlanModal 
        isOpen={showDeploymentPlan}
        onClose={handleReturnToTracker}
        onReturnToTracker={handleReturnToTracker}
      />
    </>
  );
}