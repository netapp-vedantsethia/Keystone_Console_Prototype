import { useState } from 'react';
import { Mail, Phone, User, ArrowLeft, MapPin, Clock, Plus, Check } from 'lucide-react';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Button } from '../ui/button';
import { BpTextField } from '@netapp/blueprint/react';
import { shiftDatesDeep } from '../../data/dateShift';

interface DataCentreContact {
  name: string;
  phone: string;
  email: string;
}

interface EngineerSchedule {
  day: number;
  date: string;
  engineers: {
    name: string;
    phone: string;
    email: string;
  }[];
}

interface DeliverableItem {
  id: string;
  label: string;
  checked: boolean;
  color: 'blue' | 'pink' | 'green';
}

interface DeploymentPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToTracker?: () => void;
}

export function DeploymentPlanModal({
  isOpen,
  onClose,
  onReturnToTracker,
}: DeploymentPlanModalProps) {
  const [showContactForm, setShowContactForm] = useState(false);
  const [dataCentreContact, setDataCentreContact] = useState<DataCentreContact | null>(null);
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([
    { id: '1', label: 'Rack & Stack', checked: false, color: 'blue' },
    { id: '2', label: 'Loading ONTAP', checked: false, color: 'blue' },
    { id: '3', label: 'Licenses', checked: false, color: 'blue' },
    { id: '4', label: 'Cabling Storage Switches', checked: false, color: 'blue' },
    { id: '5', label: 'Cabling Cluster Switches', checked: false, color: 'pink' },
    { id: '6', label: 'HA Testing Failover & Giveback Testing', checked: false, color: 'pink' },
    { id: '7', label: 'ASUP Testing', checked: false, color: 'pink' },
    { id: '8', label: 'Aggregate Creation', checked: false, color: 'green' },
    { id: '9', label: 'Create ifgrp, vlans, broadcast domains and replication interface', checked: false, color: 'green' },
  ]);
  
  // Dates are timeline-shifted (see `dateShift.ts`) so the install plan always reads as
  // "coming up soon" relative to today, no matter when the prototype is opened.
  const engineerSchedules: EngineerSchedule[] = shiftDatesDeep([
    {
      day: 1,
      date: '06/17/2026',
      engineers: [
        { name: 'Michael Chen', phone: '+1 (408) 555-2341', email: 'm.chen@netapp.com' },
        { name: 'Lisa Rodriguez', phone: '+1 (408) 555-2342', email: 'l.rodriguez@netapp.com' },
        { name: 'David Park', phone: '+1 (408) 555-2343', email: 'd.park@netapp.com' }
      ]
    },
    {
      day: 2,
      date: '06/18/2026',
      engineers: [
        { name: 'Michael Chen', phone: '+1 (408) 555-2341', email: 'm.chen@netapp.com' },
        { name: 'Lisa Rodriguez', phone: '+1 (408) 555-2342', email: 'l.rodriguez@netapp.com' }
      ]
    },
    {
      day: 3,
      date: '06/19/2026',
      engineers: [
        { name: 'Michael Chen', phone: '+1 (408) 555-2341', email: 'm.chen@netapp.com' },
        { name: 'Lisa Rodriguez', phone: '+1 (408) 555-2342', email: 'l.rodriguez@netapp.com' }
      ]
    }
  ]);

  const toggleDeliverable = (id: string) => {
    setDeliverables(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const handleAddContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setDataCentreContact({
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
    });
    setShowContactForm(false);
  };

  const completedDeliverables = deliverables.filter(d => d.checked).length;
  const totalDeliverables = deliverables.length;
  const completionPercentage = Math.round((completedDeliverables / totalDeliverables) * 100);

  const getCheckboxColor = (color: 'blue' | 'pink' | 'green') => {
    switch (color) {
      case 'blue':
        return 'bg-blue-600 border-blue-600';
      case 'pink':
        return 'bg-pink-600 border-pink-600';
      case 'green':
        return 'bg-green-700 border-green-700';
    }
  };

  const getCheckboxColorUnchecked = (color: 'blue' | 'pink' | 'green') => {
    switch (color) {
      case 'blue':
        return 'border-blue-400';
      case 'pink':
        return 'border-pink-400';
      case 'green':
        return 'border-green-500';
    }
  };

  const handleReturnToTracker = () => {
    onClose();
    if (onReturnToTracker) {
      onReturnToTracker();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[900px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[900px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="p-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <SheetTitle className="font-['SF_Pro',sans-serif]">
                  Install Plan
                </SheetTitle>
                <SheetDescription className="font-['SF_Pro',sans-serif]">
                  Installation schedule and deliverables
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
        </div>

        <SheetBody className="px-6 py-4">
        <div className="space-y-6">
          {/* Install Plan & Keystone Deliverables Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Install Plan */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-[14px] font-[590] text-blue-600 font-['SF_Pro',sans-serif] mb-4">
                Install Plan
              </div>
              <div className="space-y-2.5">
                {engineerSchedules.map((schedule) => {
                  const dotColor =
                    schedule.day === 1 ? 'border-blue-600' : schedule.day === 2 ? 'border-pink-600' : 'border-green-700';
                  return (
                    <div key={schedule.day} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 ${dotColor} flex items-center justify-center flex-shrink-0 bg-white`} />
                      <div className="text-[14px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                        Day {schedule.day} <span className="text-gray-600">({schedule.date})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Keystone Deliverables */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="text-[14px] font-[590] text-blue-600 font-['SF_Pro',sans-serif] mb-3">
                Keystone Deliverables
              </div>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[24px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                    {completionPercentage}%
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Deliverables List */}
              <div className="space-y-2">
                {deliverables.map((deliverable) => (
                  <div 
                    key={deliverable.id} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 py-1 px-2 rounded transition-colors"
                    onClick={() => toggleDeliverable(deliverable.id)}
                  >
                    <div 
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        deliverable.checked 
                          ? getCheckboxColor(deliverable.color)
                          : `bg-white ${getCheckboxColorUnchecked(deliverable.color)}`
                      }`}
                    >
                      {deliverable.checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="text-[13px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif] flex-1">
                      {deliverable.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Access Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-4">
              Access Details
            </div>
            
            <div className="space-y-4">
              {/* Address */}
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    Data Centre Address
                  </div>
                  <div className="text-[14px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif] mt-1">
                    2600 Technology Drive, Building 3, Suite 100
                    <br />
                    Santa Clara, CA 95054
                  </div>
                </div>
              </div>

              {/* Working Hours */}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-gray-500 mt-1" />
                <div>
                  <div className="text-[13px] font-normal text-gray-600 font-['SF_Pro',sans-serif]">
                    Working Hours
                  </div>
                  <div className="text-[14px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif] mt-1">
                    8:00 AM - 6:00 PM PST (Monday - Friday)
                  </div>
                </div>
              </div>

              {/* Data Centre Contact */}
              <div className="border-t border-gray-200 pt-4">
                {!dataCentreContact && !showContactForm && (
                  <Button
                    variant="outline"
                    onClick={() => setShowContactForm(true)}
                    className="flex items-center gap-2 text-[13px] font-[590]"
                  >
                    <Plus className="w-4 h-4" />
                    Add Data Centre Contact
                  </Button>
                )}

                {showContactForm && (
                  <form onSubmit={handleAddContact} className="space-y-3">
                    <div className="text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-2">
                      Data Centre Contact
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <BpTextField type="text" name="name" placeholder="Name" required aria-label="Contact name" />
                      <BpTextField type="tel" name="phone" placeholder="Phone" required aria-label="Contact phone" />
                      <BpTextField type="email" name="email" placeholder="Email" required aria-label="Contact email" />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" className="text-[13px] font-[590]">
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowContactForm(false)}
                        className="text-[13px] font-[590]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {dataCentreContact && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-2">
                      Data Centre Contact
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        <div className="text-[13px] font-normal text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                          {dataCentreContact.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-500" />
                        <a
                          href={`tel:${dataCentreContact.phone}`}
                          className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                        >
                          {dataCentreContact.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                        <a
                          href={`mailto:${dataCentreContact.email}`}
                          className="text-[13px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                        >
                          {dataCentreContact.email}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Installation Engineers Schedule */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-4">
              Installation Engineers Schedule
            </div>
            
            <div className="space-y-4">
              {engineerSchedules.map((schedule) => {
                const getDayColor = (day: number) => {
                  switch (day) {
                    case 1: return 'border-blue-600 bg-blue-50';
                    case 2: return 'border-pink-600 bg-pink-50';
                    case 3: return 'border-green-700 bg-green-50';
                    default: return 'border-gray-300 bg-gray-50';
                  }
                };

                return (
                  <div key={schedule.day} className={`border-l-4 ${getDayColor(schedule.day)} rounded-r-lg p-4`}>
                    <div className="text-[13px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif] mb-3">
                      Day {schedule.day} - {schedule.date}
                    </div>
                    <div className="space-y-3">
                      {schedule.engineers.map((engineer) => (
                        <div key={engineer.name} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-[14px] font-[590] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
                                {engineer.name}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-gray-500" />
                                  <a
                                    href={`tel:${engineer.phone}`}
                                    className="text-[12px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                                  >
                                    {engineer.phone}
                                  </a>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Mail className="w-3 h-3 text-gray-500" />
                                  <a
                                    href={`mailto:${engineer.email}`}
                                    className="text-[12px] text-blue-600 hover:text-blue-700 font-['SF_Pro',sans-serif]"
                                  >
                                    {engineer.email}
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}