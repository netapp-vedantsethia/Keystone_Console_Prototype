import { useEffect, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { BpTextField, BpDropdown } from '@netapp/blueprint/react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { mockSubscriptions, type PoUploadEntry } from '../../data/mockData';

/**
 * Shared upload-and-map-a-PO flow — used by Billing & Cost's Purchase Orders tab and by the
 * Cart's "Upload PO Document" action, both submitting into the same `PoUploadsContext` queue.
 */
export function UploadPoDrawer({
  isOpen,
  entry,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  entry?: PoUploadEntry;
  onClose: () => void;
  onSubmit: (entry: PoUploadEntry) => void;
}) {
  const isEdit = Boolean(entry);
  const [fileName, setFileName] = useState(entry?.fileName ?? '');
  const [poNumber, setPoNumber] = useState(entry?.poNumber ?? '');
  const [poAmount, setPoAmount] = useState(entry?.poAmountUsd != null ? String(entry.poAmountUsd) : '');
  const [subscriptionId, setSubscriptionId] = useState(entry?.mappedSubscriptionIds[0] ?? mockSubscriptions[0]?.id ?? '');
  const [validityMode, setValidityMode] = useState<'subscription-end' | 'custom'>('subscription-end');
  const [customValidTo, setCustomValidTo] = useState(entry?.validTo ?? '');

  const key = entry?.id ?? 'new';

  useEffect(() => {
    if (!isOpen) return;
    setFileName(entry?.fileName ?? '');
    setPoNumber(entry?.poNumber ?? '');
    setPoAmount(entry?.poAmountUsd != null ? String(entry.poAmountUsd) : '');
    setSubscriptionId(entry?.mappedSubscriptionIds[0] ?? mockSubscriptions[0]?.id ?? '');
    setValidityMode('subscription-end');
    setCustomValidTo(entry?.validTo ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, entry?.id]);

  const selectedSubscription = mockSubscriptions.find((s) => s.id === subscriptionId);
  const canSubmit = Boolean(fileName.trim() && poNumber.trim() && poAmount.trim() && subscriptionId);

  const handleSubmit = () => {
    const validTo = validityMode === 'subscription-end' ? selectedSubscription?.endDate ?? null : customValidTo || null;
    onSubmit({
      id: entry?.id ?? `po-upload-${poNumber || Date.now()}`,
      fileName: fileName.trim(),
      poNumber: poNumber.trim(),
      poAmountUsd: Number(poAmount) || 0,
      mappedSubscriptionIds: subscriptionId ? [subscriptionId] : [],
      validFrom: entry?.validFrom ?? new Date().toISOString().slice(0, 10),
      validTo,
      uploadedAt: entry?.uploadedAt ?? new Date().toISOString().slice(0, 10),
      uploadedBy: entry?.uploadedBy ?? 'Vedant Sethia',
      omStatus: 'pending',
      reviewedBy: undefined,
      reviewedAt: undefined,
      rejectionReason: undefined,
      purchaseOrderId: undefined,
    });
  };

  return (
    <Sheet
      key={key}
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-[520px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">{isEdit ? 'Edit PO' : 'Upload & map new PO'}</SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {isEdit ? `${entry?.poNumber} · ${entry?.fileName}` : 'Upload a signed PO document and map it to a subscription'}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-5">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">PO Document *</label>
              {fileName ? (
                <div className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-gray-700">
                    <FileText className="h-4 w-4 text-gray-400" />
                    {fileName}
                  </span>
                  <button type="button" onClick={() => setFileName('')} className="text-xs font-medium text-red-600 hover:underline">
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-center hover:bg-gray-50">
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="text-sm text-gray-600">Drag &amp; drop or click to browse</span>
                  <span className="text-xs text-gray-400">PDF, PNG, JPG (max 10MB)</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? `${poNumber || 'PO'}_signed.pdf`)}
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <BpTextField
                label="PO number"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2024-78002"
              />
              <BpTextField
                type="number"
                label="PO amount"
                value={poAmount}
                onChange={(e) => setPoAmount(e.target.value)}
                placeholder="e.g. 250000"
              />
            </div>

            <div>
              <BpDropdown
                label="Map to subscription"
                value={subscriptionId}
                onValueChange={(value) => setSubscriptionId(value ?? '')}
                showClearButton={false}
                searchable
                options={mockSubscriptions.map((s) => ({
                  value: s.id,
                  label: `${s.trackingId} — ${s.serviceLevels[0] ?? s.account}`,
                }))}
              />
              <p className="mt-1 text-xs text-gray-500">PO must be mapped to a subscription before OM review</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">PO Validity *</label>
              <div className="space-y-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all ${
                    validityMode === 'subscription-end' ? 'border-[#0067c5] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    checked={validityMode === 'subscription-end'}
                    onChange={() => setValidityMode('subscription-end')}
                    className="mt-0.5 h-4 w-4 text-[#0067c5] focus:ring-[#0067c5]"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Up to subscription end</div>
                    {selectedSubscription && (
                      <div className="text-xs text-gray-500">
                        {new Date(selectedSubscription.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all ${
                    validityMode === 'custom' ? 'border-[#0067c5] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    checked={validityMode === 'custom'}
                    onChange={() => setValidityMode('custom')}
                    className="mt-0.5 h-4 w-4 text-[#0067c5] focus:ring-[#0067c5]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">Custom date</div>
                    {validityMode === 'custom' && (
                      <input
                        type="date"
                        value={customValidTo}
                        onChange={(e) => setCustomValidTo(e.target.value)}
                        className="mt-1.5 rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="mb-1 text-sm font-medium text-blue-900">What happens next?</div>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-blue-900">
                <li>PO will be mapped to the selected subscription</li>
                <li>Submitted for Order Management review</li>
                <li>Once approved, it appears as an active PO card here</li>
              </ul>
            </div>
          </div>
        </SheetBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-[#0067c5] text-[14px] font-[590] text-white hover:bg-[#0056a6]"
          >
            {isEdit ? 'Save changes' : 'Submit for OM review'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
