import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2, Upload } from 'lucide-react';
import { BpCheckbox, BpDropdown, BpTextField } from '@netapp/blueprint/react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import {
  AP_PORTAL_PROVIDERS,
  invoiceDeliveryPreferenceForSubscription,
  mockSubscriptions,
  type ApPortalProvider,
  type InvoiceDeliveryMethod,
  type Subscription,
} from '../../data/mockData';

interface InvoiceDeliveryPreferencesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Single-subscription scope (subscription-level Billing & Invoices). */
  subscription?: Subscription;
  /**
   * Org-wide entry point (global Billing & Cost → Invoices) — shows an extra scope picker
   * ("Apply to all subscriptions" vs "Select subscriptions") above the same delivery form.
   */
  allowScopeSelection?: boolean;
}

type Scope = 'all' | 'selected';

export function InvoiceDeliveryPreferencesDrawer({
  isOpen,
  onClose,
  subscription,
  allowScopeSelection = false,
}: InvoiceDeliveryPreferencesDrawerProps) {
  const seed = useMemo(
    () => (subscription ? invoiceDeliveryPreferenceForSubscription(subscription.id) : null),
    [subscription],
  );

  const [scope, setScope] = useState<Scope>('all');
  const [selectedSubscriptionIds, setSelectedSubscriptionIds] = useState<string[]>(
    subscription ? [subscription.id] : [],
  );
  const [primaryMethod, setPrimaryMethod] = useState<InvoiceDeliveryMethod>(seed?.primaryMethod ?? 'email');
  const [apPortalProvider, setApPortalProvider] = useState<ApPortalProvider>(
    seed?.apPortalProvider ?? AP_PORTAL_PROVIDERS[0],
  );
  const [emails, setEmails] = useState<string[]>(
    seed && seed.emails.length > 0 ? seed.emails.map((e) => e.email) : [''],
  );
  const [newEmail, setNewEmail] = useState('');
  const [saved, setSaved] = useState(false);

  const scopeCount = scope === 'all' ? mockSubscriptions.length : selectedSubscriptionIds.length;

  const canSave =
    primaryMethod === 'email'
      ? emails.some((e) => e.trim().length > 0)
      : emails.some((e) => e.trim().length > 0) && Boolean(apPortalProvider);

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (!trimmed) return;
    setEmails((prev) => [...prev, trimmed]);
    setNewEmail('');
  };

  const handleRemoveEmail = (idx: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggleSubscription = (id: string) => {
    setSelectedSubscriptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => {
      setSaved(false);
      onClose();
    }, 700);
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="flex w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">Invoice delivery preferences</SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {subscription
                ? `${subscription.number} · ${subscription.trackingId} · ${subscription.account}`
                : 'Configure how invoices are delivered across your subscriptions'}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-5">
          <div className="space-y-6">
            {allowScopeSelection && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Apply to</label>
                <div className="space-y-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all ${
                      scope === 'all' ? 'border-[#0067c5] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                      className="mt-0.5 h-4 w-4 text-[#0067c5] focus:ring-[#0067c5]"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Apply to all subscriptions</div>
                      <div className="text-xs text-gray-500">
                        Sets one delivery preference for all {mockSubscriptions.length} subscriptions on this account
                      </div>
                    </div>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all ${
                      scope === 'selected' ? 'border-[#0067c5] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      checked={scope === 'selected'}
                      onChange={() => setScope('selected')}
                      className="mt-0.5 h-4 w-4 text-[#0067c5] focus:ring-[#0067c5]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900">Select subscriptions</div>
                      <div className="text-xs text-gray-500">Choose one or more subscriptions to update</div>
                      {scope === 'selected' && (
                        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
                          {mockSubscriptions.map((s) => (
                            <BpCheckbox
                              key={s.id}
                              checked={selectedSubscriptionIds.includes(s.id)}
                              onChange={() => handleToggleSubscription(s.id)}
                              label={
                                <>
                                  <span className="font-medium text-gray-900">{s.trackingId}</span>{' '}
                                  <span className="text-gray-500">{s.account}</span>
                                </>
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Primary delivery method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrimaryMethod('ap-portal')}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    primaryMethod === 'ap-portal' ? 'border-[#0067c5] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">AP Portal</div>
                  <div className="text-xs text-gray-500">Send to an Accounts Payable portal</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPrimaryMethod('email')}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    primaryMethod === 'email' ? 'border-[#0067c5] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">Email</div>
                  <div className="text-xs text-gray-500">Send directly to one or more emails</div>
                </button>
              </div>
            </div>

            {primaryMethod === 'ap-portal' && (
              <div>
                <BpDropdown
                  label="Portal provider"
                  value={apPortalProvider}
                  onValueChange={(value) => setApPortalProvider((value ?? apPortalProvider) as ApPortalProvider)}
                  showClearButton={false}
                  options={AP_PORTAL_PROVIDERS.map((p) => ({ value: p, label: p }))}
                />

                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    A backup email is required when AP Portal is the primary method, so billing still reaches you if
                    portal delivery fails.
                  </span>
                </div>

                {seed && seed.portalDeliveryErrors.length > 0 && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold text-red-800">Recent portal delivery failures</div>
                    <ul className="mt-1 space-y-0.5 text-xs text-red-700">
                      {seed.portalDeliveryErrors.map((err) => (
                        <li key={err.periodLabel}>
                          {err.periodLabel}: {err.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {seed?.onboardingInstructionsFileName ?? 'Upload portal onboarding instructions'}
                </button>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {primaryMethod === 'email' ? 'Delivery email(s)' : 'Backup email(s)'}
              </label>
              <div className="space-y-2">
                {emails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <BpTextField
                        type="email"
                        value={email}
                        onChange={(e) =>
                          setEmails((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                        placeholder="billing@company.com"
                        aria-label={`Delivery email ${idx + 1}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(idx)}
                      className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <BpTextField
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                      placeholder="Add another email"
                      aria-label="Add another email"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {allowScopeSelection && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                This will update delivery preferences for <span className="font-semibold text-gray-900">{scopeCount}</span>{' '}
                subscription{scopeCount === 1 ? '' : 's'}.
              </div>
            )}
          </div>
        </SheetBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || (allowScopeSelection && scope === 'selected' && selectedSubscriptionIds.length === 0)}
            className="flex items-center gap-2 bg-[#0067c5] text-[14px] font-[590] text-white hover:bg-[#0056a6]"
          >
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </>
            ) : (
              'Save preferences'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
