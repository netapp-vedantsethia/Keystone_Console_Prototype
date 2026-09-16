import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { BpTextField, BpDropdown } from '@netapp/blueprint/react';
import {
  mockSubscriptions,
  formatSubscriptionOptionLabel,
} from '../../data/mockData';

type NewCaseForm = {
  title: string;
  priority: string;
  subscriptionId: string;
  description: string;
  affectedSystems: string;
};

function emptyForm(subscriptionId: string): NewCaseForm {
  return {
    title: '',
    priority: 'P2',
    subscriptionId,
    description: '',
    affectedSystems: '',
  };
}

export interface OpenSupportCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select this subscription when the modal opens */
  defaultSubscriptionId?: string;
}

export function OpenSupportCaseModal({
  open,
  onOpenChange,
  defaultSubscriptionId,
}: OpenSupportCaseModalProps) {
  const [newCase, setNewCase] = useState<NewCaseForm>(() => emptyForm(''));

  useEffect(() => {
    if (!open) return;
    const id =
      defaultSubscriptionId &&
      mockSubscriptions.some((s) => s.id === defaultSubscriptionId)
        ? defaultSubscriptionId
        : '';
    setNewCase(emptyForm(id));
  }, [open, defaultSubscriptionId]);

  if (!open) return null;

  const handleClose = () => onOpenChange(false);

  const handleSubmit = () => {
    console.log('Submitting case:', newCase);
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Open New Support Case</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-2 hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <div className="space-y-4">
            <BpTextField
              label="Case title"
              value={newCase.title}
              onChange={(e) => setNewCase({ ...newCase, title: e.target.value })}
              placeholder="Brief description of the issue"
            />

            <BpDropdown
              label="Priority"
              value={newCase.priority}
              onValueChange={(value) => setNewCase({ ...newCase, priority: value ?? 'P2' })}
              showClearButton={false}
              options={[
                { value: 'P1', label: 'P1 - Critical (Production Down)' },
                { value: 'P2', label: 'P2 - High (Severe Impact)' },
                { value: 'P3', label: 'P3 - Medium (Moderate Impact)' },
                { value: 'P4', label: 'P4 - Low (Minor Impact)' },
              ]}
            />

            <BpDropdown
              label="Subscription"
              value={newCase.subscriptionId || undefined}
              onValueChange={(value) => setNewCase({ ...newCase, subscriptionId: value ?? '' })}
              placeholder="Select subscription"
              searchable
              options={mockSubscriptions.map((s) => ({ value: s.id, label: formatSubscriptionOptionLabel(s) }))}
            />

            <BpTextField
              label="Affected systems"
              optional
              value={newCase.affectedSystems}
              onChange={(e) => setNewCase({ ...newCase, affectedSystems: e.target.value })}
              placeholder="e.g., sfo-prod-cluster-01, sfo-prod-vol-03"
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
              <textarea
                value={newCase.description}
                onChange={(e) => setNewCase({ ...newCase, description: e.target.value })}
                placeholder="Detailed description of the issue, symptoms, error messages, and steps to reproduce"
                className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                rows={6}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Submit Case
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
