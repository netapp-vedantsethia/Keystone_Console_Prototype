import { useState } from 'react';
import { Mail, Phone, User, Edit2, ArrowLeft } from 'lucide-react';
import { BpTabGroup } from '@netapp/blueprint/react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import cabinetImage from 'figma:asset/914d1386efd6de1573af706f3b67cb36c6711fe7.png';
import cablingDiagram from 'figma:asset/18cbe5dbe9d889d8d8ba7ce3b6a620f35be92a79.png';
import cablingLegend from 'figma:asset/bfad51764669d78d2c2367feb75538225db99115.png';

interface DeploymentDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToTracker?: () => void;
}

export function DeploymentDesignModal({
  isOpen,
  onClose,
  onReturnToTracker,
}: DeploymentDesignModalProps) {
  const [activeTab, setActiveTab] = useState<'cabinet' | 'cabling'>('cabinet');
  const [showContactCard, setShowContactCard] = useState(false);

  const handleReturnToTracker = () => {
    onClose();
    if (onReturnToTracker) {
      onReturnToTracker();
    }
  };

  const handleEditClick = () => {
    setShowContactCard(true);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[900px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[900px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-4 p-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <SheetTitle className="font-['SF_Pro',sans-serif]">
                  Deployment Design
                </SheetTitle>
                <SheetDescription className="font-['SF_Pro',sans-serif]">
                  Approved cabinet configuration and cabling design
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

        {/* Tabs */}
        <div className="mt-4">
          <BpTabGroup
            tabs={[
              { id: 'cabinet', label: 'Cabinet View' },
              { id: 'cabling', label: 'Cabling' },
            ]}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as 'cabinet' | 'cabling')}
            horizontalResizing="hug"
            tablistAriaLabel="Deployment design sections"
          />
        </div>
        </div>

        <SheetBody className="px-6 py-4">
        {/* Tab Content */}
        {activeTab === 'cabinet' && (
          <div className="space-y-6">
            {/* Contact Card - Only show when Edit is clicked */}
            {showContactCard && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                        Contact Deployment PM
                      </div>
                      <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mb-2">
                        Edit Design over Live call for alignment
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                          Sarah Mitchell
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          <a
                            href="mailto:sarah.mitchell@netapp.com"
                            className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                          >
                            sarah.mitchell@netapp.com
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-500" />
                          <a
                            href="tel:+14085551234"
                            className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                          >
                            +1 (408) 555-1234
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cabinet Configuration Image */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                  Cabinet Configuration
                </div>
                <Button
                  variant="outline"
                  onClick={handleEditClick}
                  className="flex items-center gap-2 text-[13px] font-[590]"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
              </div>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 flex items-center justify-center">
                <img
                  src={cabinetImage}
                  alt="Cabinet Configuration"
                  className="max-w-[600px] w-full h-auto rounded-lg shadow-sm"
                  style={{ imageRendering: 'auto' }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cabling' && (
          <div className="space-y-6">
            {/* Contact Card - Only show when Edit is clicked */}
            {showContactCard && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-1">
                        Contact Deployment PM
                      </div>
                      <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif] mb-2">
                        Edit Design over Live call for alignment
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                          Sarah Mitchell
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-gray-500" />
                          <a
                            href="mailto:sarah.mitchell@netapp.com"
                            className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                          >
                            sarah.mitchell@netapp.com
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-gray-500" />
                          <a
                            href="tel:+14085551234"
                            className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                          >
                            +1 (408) 555-1234
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cabling Details */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                  Cabling Specifications
                </div>
                <Button
                  variant="outline"
                  onClick={handleEditClick}
                  className="flex items-center gap-2 text-[13px] font-[590]"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
              </div>
              
              {/* Cabling Diagram */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-4 flex items-center justify-center">
                <img
                  src={cablingDiagram}
                  alt="Cabling Diagram"
                  className="max-w-[650px] w-full h-auto rounded-lg shadow-sm"
                  style={{ imageRendering: 'auto' }}
                />
              </div>
              
              {/* Cabling Legend */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-3">
                  Cable Legend
                </div>
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-center">
                  <img
                    src={cablingLegend}
                    alt="Cabling Legend"
                    className="max-w-[400px] w-full h-auto rounded shadow-sm"
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}