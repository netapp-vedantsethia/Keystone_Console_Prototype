import { useMemo } from 'react';
import { AlertTriangle, Mail, Settings } from 'lucide-react';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { invoiceDeliveryPreferenceForSubscription, type Subscription } from '../../data/mockData';

interface InvoiceDeliveryFailuresDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription;
  onManagePreferences: () => void;
}

export function InvoiceDeliveryFailuresDrawer({
  isOpen,
  onClose,
  subscription,
  onManagePreferences,
}: InvoiceDeliveryFailuresDrawerProps) {
  const preference = useMemo(() => invoiceDeliveryPreferenceForSubscription(subscription.id), [subscription.id]);
  const failedEmails = preference.emails.filter((e) => e.status === 'failed');

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="space-y-1 p-0">
            <SheetTitle className="font-['SF_Pro',sans-serif]">Invoice delivery failures</SheetTitle>
            <SheetDescription className="font-['SF_Pro',sans-serif]">
              {subscription.number} · {subscription.trackingId} · {subscription.account}
            </SheetDescription>
          </SheetHeader>
        </div>

        <SheetBody className="px-6 py-5">
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-900">
                <div className="font-semibold">
                  Delivering via {preference.primaryMethod === 'ap-portal' ? preference.apPortalProvider : 'email'}
                </div>
                <p className="mt-1">
                  This is a read-only diagnostic view. To fix delivery, update the delivery preferences.
                </p>
              </div>
            </div>

            {preference.portalDeliveryErrors.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">Affected billing periods</h4>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Period</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preference.portalDeliveryErrors.map((err) => (
                        <tr key={err.periodLabel}>
                          <td className="px-3 py-2 font-medium text-gray-900">{err.periodLabel}</td>
                          <td className="px-3 py-2 text-red-600">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {failedEmails.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900">Email addresses needing cleanup</h4>
                <div className="space-y-2">
                  {failedEmails.map((email) => (
                    <div key={email.email} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <div className="text-sm">
                        <div className="font-medium text-red-900">{email.email}</div>
                        {email.failureDetail && <div className="text-xs text-red-700">{email.failureDetail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preference.portalDeliveryErrors.length === 0 && failedEmails.length === 0 && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                No delivery failures on file for this subscription.
              </div>
            )}
          </div>
        </SheetBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} className="text-[14px] font-[590]">
            Close
          </Button>
          <Button
            onClick={onManagePreferences}
            className="flex items-center gap-2 bg-[#0067c5] text-[14px] font-[590] text-white hover:bg-[#0056a6]"
          >
            <Settings className="h-4 w-4" />
            Manage delivery preferences
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
