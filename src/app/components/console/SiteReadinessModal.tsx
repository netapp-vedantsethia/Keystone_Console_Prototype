import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BpCheckbox, BpTabGroup } from '@netapp/blueprint/react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';

interface CustomerRequirement {
  id: string;
  label: string;
  details?: string;
  checked: boolean;
}

interface RequirementSection {
  title: string;
  items: CustomerRequirement[];
}

// Initial customer requirements with random completion
const initialCustomerRequirements: RequirementSection[] = [
  {
    title: 'Network Connectivity',
    items: [
      { id: 'net-1', label: 'Network drops to rack', details: '4x 10Gbe (2 per switch)', checked: true },
      { id: 'net-2', label: 'Switch Ports (Customer Switch)', details: '4x 10Gbe ports', checked: true },
      { id: 'net-3', label: 'Network Cables (Cat 6a or better)', details: '4 cables @ ~10ft each', checked: true },
      { id: 'net-4', label: 'Transceivers for Customer Switch', details: '4x 10Gbase-T or 10Gbase-SR (match NetApp optics)', checked: true },
    ]
  },
  {
    title: 'Customer Equipment',
    items: [
      { id: 'equip-1', label: 'Customer Rack Space', details: '42 RU standard rack (NetApp uses 12 RU)', checked: true },
      { id: 'equip-2', label: 'Customer Network Switch', details: '10Gbe capable, VLAN support', checked: true },
      { id: 'equip-3', label: 'Rack rails and mounting hardware', details: 'Included with customer rack', checked: true },
    ]
  },
  {
    title: 'Power Distribution',
    items: [
      { id: 'power-1', label: 'PDU (Power Distribution Unit)', details: '2x PDUs, one per power feed', checked: true },
      { id: 'power-2', label: 'Power Outlets (C13)', details: '8x C13 outlets (4 per PDU)', checked: true },
      { id: 'power-3', label: 'Circuit Rating', details: '2x 20A circuits minimum (208V)', checked: true },
    ]
  },
  {
    title: 'Power Draw',
    items: [
      { id: 'draw-1', label: 'Typical Power Consumption', details: '3.2 kW (1.6 kW per feed)', checked: true },
      { id: 'draw-2', label: 'Maximum Power Consumption', details: '4.8 kW (2.4 kW per feed)', checked: true },
    ]
  },
  {
    title: 'Cooling',
    items: [
      { id: 'cool-1', label: 'Cooling Capacity (Typical)', details: '10,923 BTU/hr', checked: true },
      { id: 'cool-2', label: 'Cooling Capacity (Maximum)', details: '16,384 BTU/hr', checked: true },
      { id: 'cool-3', label: 'Airflow Direction', details: 'Front-to-back cooling', checked: true },
    ]
  },
  {
    title: 'IP Requirements',
    items: [
      { id: 'ip-1', label: 'Storage Management IPs', details: '2 IP addresses', checked: true },
      { id: 'ip-2', label: 'Data Network IPs', details: '4 IP addresses', checked: true },
      { id: 'ip-3', label: 'Cluster Management IP', details: '1 IP address', checked: true },
      { id: 'ip-4', label: 'Node Management IPs', details: '2 IP addresses', checked: true },
      { id: 'ip-5', label: 'Service Processor IPs', details: '2 IP addresses', checked: true },
    ]
  },
  {
    title: 'Monitoring VMs (Optional)',
    items: [
      { id: 'vm-1', label: 'AutoSupport Gateway VM', details: '1 IP address, 2 vCPU, 4GB RAM', checked: true },
      { id: 'vm-2', label: 'Monitoring/Analytics VM', details: '1 IP address, 4 vCPU, 8GB RAM', checked: true },
    ]
  }
];

// NetApp Provided equipment - all items provided and checked
const netAppProvidedEquipment: RequirementSection[] = [
  {
    title: 'Storage Controllers',
    items: [
      { id: 'na-ctrl-1', label: 'AFF A400 Storage Controllers', details: '2x HA pair nodes', checked: true },
      { id: 'na-ctrl-2', label: 'NVRAM Cards', details: 'Included in controllers', checked: true },
      { id: 'na-ctrl-3', label: 'Controller Flash Cache', details: 'Included in controllers', checked: true },
    ]
  },
  {
    title: 'Storage Shelves',
    items: [
      { id: 'na-shelf-1', label: 'DS224C SSD Shelf', details: '1x 24-drive shelf', checked: true },
      { id: 'na-shelf-2', label: 'SSD Drives (3.84TB)', details: '24x Enterprise SSDs', checked: true },
    ]
  },
  {
    title: 'Network Equipment',
    items: [
      { id: 'na-net-1', label: 'Cluster Interconnect Switches', details: '2x 10/25GbE switches', checked: true },
      { id: 'na-net-2', label: 'SFP+ Transceivers (10GbE)', details: '8x 10GBase-SR modules', checked: true },
      { id: 'na-net-3', label: 'QSFP+ Transceivers (40GbE)', details: '4x 40GBase-SR4 modules', checked: true },
    ]
  },
  {
    title: 'Cables',
    items: [
      { id: 'na-cable-1', label: 'Cluster Interconnect Cables', details: '4x Twinax cables', checked: true },
      { id: 'na-cable-2', label: 'Storage Shelf SAS Cables', details: '4x Mini-SAS HD cables', checked: true },
      { id: 'na-cable-3', label: 'Fiber Optic Cables (10m)', details: '8x Multi-mode LC-LC', checked: true },
      { id: 'na-cable-4', label: 'Management Network Cables', details: '2x Cat6 Ethernet cables', checked: true },
    ]
  },
  {
    title: 'Power & Mounting',
    items: [
      { id: 'na-power-1', label: 'Power Cables (C13)', details: '8x power cords', checked: true },
      { id: 'na-power-2', label: 'Rack Mount Rails', details: 'Included with equipment', checked: true },
      { id: 'na-power-3', label: 'Cable Management Kit', details: 'Included with equipment', checked: true },
    ]
  },
  {
    title: 'Documentation & Software',
    items: [
      { id: 'na-doc-1', label: 'ONTAP Software License', details: 'Pre-installed on controllers', checked: true },
      { id: 'na-doc-2', label: 'Installation Guide', details: 'Physical and digital documentation', checked: true },
      { id: 'na-doc-3', label: 'Configuration Worksheets', details: 'Pre-deployment planning docs', checked: true },
    ]
  }
];

interface SiteReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToTracker?: () => void;
}

export function SiteReadinessModal({
  isOpen,
  onClose,
  onReturnToTracker,
}: SiteReadinessModalProps) {
  const [activeTab, setActiveTab] = useState<'netapp' | 'customer'>('customer');
  const [requirements, setRequirements] = useState<RequirementSection[]>(initialCustomerRequirements);

  const handleReturnToTracker = () => {
    onClose();
    if (onReturnToTracker) {
      onReturnToTracker();
    }
  };

  const toggleRequirement = (sectionIndex: number, itemId: string) => {
    setRequirements(prev => {
      const newRequirements = [...prev];
      const section = newRequirements[sectionIndex];
      const item = section.items.find(i => i.id === itemId);
      if (item) {
        item.checked = !item.checked;
      }
      return newRequirements;
    });
  };

  // Calculate completion percentage
  const totalItems = requirements.reduce((sum, section) => sum + section.items.length, 0);
  const checkedItems = requirements.reduce(
    (sum, section) => sum + section.items.filter(item => item.checked).length,
    0
  );
  const completionPercentage = Math.round((checkedItems / totalItems) * 100);

  // NetApp equipment stats (always 100%)
  const netAppTotalItems = netAppProvidedEquipment.reduce((sum, section) => sum + section.items.length, 0);
  const netAppCheckedItems = netAppProvidedEquipment.reduce(
    (sum, section) => sum + section.items.filter(item => item.checked).length,
    0
  );
  const netAppCompletionPercentage = 100; // Always 100% for NetApp provided

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[900px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[900px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-4 p-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <SheetTitle className="font-['SF_Pro',sans-serif]">
                  Site Readiness
                </SheetTitle>
                <SheetDescription className="font-['SF_Pro',sans-serif]">
                  Equipment and infrastructure requirements
                </SheetDescription>
              </div>
              {onReturnToTracker && (
                <Button
                  variant="outline"
                  onClick={handleReturnToTracker}
                  className="flex shrink-0 items-center gap-2 text-[13px] font-[590]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Return to Activation Tracker
                </Button>
              )}
            </div>
          </SheetHeader>

        {/* Progress Bars - Above Tabs */}
        <div className="mt-4 space-y-3">
          {/* NetApp Equipment Progress */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                  NetApp Equipment Ready
                </div>
                <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mt-0.5">
                  {netAppCheckedItems} of {netAppTotalItems} items provided
                </div>
              </div>
              <div className="text-[24px] font-[590] text-green-700 font-['SF_Pro',sans-serif]">
                {netAppCompletionPercentage}%
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${netAppCompletionPercentage}%` }}
              />
            </div>
          </div>

          {/* Customer Requirements Progress */}
          <div className={`border rounded-lg p-4 ${
            completionPercentage === 100 
              ? 'bg-green-50 border-green-200' 
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                  Customer Site Readiness
                </div>
                <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mt-0.5">
                  {checkedItems} of {totalItems} requirements completed
                </div>
              </div>
              <div className={`text-[24px] font-[590] font-['SF_Pro',sans-serif] ${
                completionPercentage === 100 ? 'text-green-700' : 'text-blue-700'
              }`}>
                {completionPercentage}%
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  completionPercentage === 100 ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4">
          <BpTabGroup
            tabs={[
              { id: 'netapp', label: 'NetApp Provided' },
              { id: 'customer', label: 'Customer Provided' },
            ]}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as 'netapp' | 'customer')}
            horizontalResizing="hug"
            tablistAriaLabel="Site readiness sections"
          />
        </div>
        </div>

        <SheetBody className="px-6 py-4">
        {/* Tab Content */}
        {activeTab === 'netapp' && (
          <div className="space-y-6">
            {/* NetApp Provided Equipment Checklist */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-6">
                NetApp-Provided (Included in Keystone Subscription)
              </div>
              
              {netAppProvidedEquipment.map((section) => (
                <div key={section.title} className="mb-8 last:mb-0">
                  <div className="text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-3 pb-2 border-b border-gray-200">
                    {section.title}
                  </div>
                  <div className="space-y-2.5">
                    {section.items.map((item) => (
                      <div key={item.id} className="py-2 px-3 rounded opacity-75">
                        <BpCheckbox checked disabled label={item.label} details={item.details} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'customer' && (
          <div className="space-y-6">
            {/* Customer Provided Requirements Checklist */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-6">
                Customer-Provided (Not Included in Subscription)
              </div>
              
              {requirements.map((section, sectionIndex) => (
                <div key={section.title} className="mb-8 last:mb-0">
                  <div className="text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-3 pb-2 border-b border-gray-200">
                    {section.title}
                  </div>
                  <div className="space-y-2.5">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="py-2 px-3 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleRequirement(sectionIndex, item.id)}
                      >
                        <BpCheckbox
                          checked={item.checked}
                          onChange={() => toggleRequirement(sectionIndex, item.id)}
                          onClick={(e) => e.stopPropagation()}
                          label={item.label}
                          details={item.details}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}