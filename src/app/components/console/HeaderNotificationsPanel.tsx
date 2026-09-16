import { useMemo, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { BpDropdown, BpNotificationIcon, type BpNotificationIconProps } from '@netapp/blueprint/react';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import {
  formatSubscriptionIdentity,
  getSubscriptionById,
  type PlatformNavigateOptions,
} from '../../data/mockData';
import { mockConsoleActiveAlerts, overviewRecentAlerts, type ConsoleActiveAlert } from '../../data/consoleOperationsMock';

type BpNotificationTone = NonNullable<BpNotificationIconProps['tone']>;

const SEVERITY_TONE: Record<ConsoleActiveAlert['severity'], BpNotificationTone> = {
  Critical: 'error',
  Warning: 'warning',
  Info: 'information',
};

const ALL_SERVICES = 'all-services';
const ALL_TYPES = 'all-types';

function subscriptionLine(alert: ConsoleActiveAlert): string {
  if (alert.subscriptionId) {
    const sub = getSubscriptionById(alert.subscriptionId);
    return sub ? formatSubscriptionIdentity(sub) : alert.subscriptionId;
  }
  return alert.multiSubscriptionLabel ?? 'Multiple subscriptions';
}

/**
 * Blueprint slide-out panel (Figma node `85534:107120`, "Notification panel") for the header
 * bell's `BpHeader.Invocable` panel — a right-anchored drawer (not a dropdown) with filters,
 * per-item dismiss, and a "Dismiss all" bulk action, styled after the design's notification
 * card (`BpNotificationIcon` tone glyph + title/action + description + metadata footer).
 */
export function HeaderNotificationsPanel({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
}) {
  const [serviceFilter, setServiceFilter] = useState(ALL_SERVICES);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const allAlerts = useMemo(() => overviewRecentAlerts(mockConsoleActiveAlerts.length), []);
  const visibleAlerts = allAlerts.filter((alert) => !dismissedIds.has(alert.id));

  const serviceOptions = useMemo(() => {
    const services = Array.from(new Set(allAlerts.map((alert) => alert.category))).sort();
    return [
      { value: ALL_SERVICES, label: 'All services' },
      ...services.map((service) => ({ value: service, label: service })),
    ];
  }, [allAlerts]);

  const typeOptions = [
    { value: ALL_TYPES, label: 'All types' },
    { value: 'Critical', label: 'Critical' },
    { value: 'Warning', label: 'Warning' },
    { value: 'Info', label: 'Info' },
  ];

  const filteredAlerts = visibleAlerts.filter((alert) => {
    if (serviceFilter !== ALL_SERVICES && alert.category !== serviceFilter) return false;
    if (typeFilter !== ALL_TYPES && alert.severity !== typeFilter) return false;
    return true;
  });

  const dismissOne = (id: string) => setDismissedIds((prev) => new Set(prev).add(id));
  const dismissAll = () => setDismissedIds(new Set(allAlerts.map((alert) => alert.id)));

  const goToAlert = (alert: ConsoleActiveAlert) => {
    onClose();
    onNavigate('support', undefined, { highlightAlertId: alert.id });
  };

  const viewHistory = () => {
    onClose();
    onNavigate('support', undefined, { supportTab: 'monitors' });
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex w-[480px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
        <div className="shrink-0 border-b border-gray-200 bg-background px-6 py-4 pr-14">
          <SheetHeader className="flex-row items-center gap-2 space-y-0 p-0">
            <Bell className="h-5 w-5 shrink-0 text-gray-700" aria-hidden="true" />
            <SheetTitle className="font-['SF_Pro',sans-serif]">
              Notifications ({visibleAlerts.length})
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <BpDropdown
              variant="underline"
              label="Filter services"
              value={serviceFilter}
              onValueChange={(value) => setServiceFilter(value ?? ALL_SERVICES)}
              options={serviceOptions}
              showClearButton={false}
              menuAriaLabel="Filter by service"
            />
            <BpDropdown
              variant="underline"
              label="Filter type"
              value={typeFilter}
              onValueChange={(value) => setTypeFilter(value ?? ALL_TYPES)}
              options={typeOptions}
              showClearButton={false}
              menuAriaLabel="Filter by type"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissAll}
            disabled={visibleAlerts.length === 0}
            className="shrink-0 text-blue-600 hover:text-blue-700"
          >
            Dismiss all
          </Button>
        </div>

        <SheetBody className="px-6 py-4">
          {filteredAlerts.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              {visibleAlerts.length === 0 ? 'No active notifications.' : 'No notifications match your filters.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="group relative rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  <button
                    type="button"
                    onClick={() => dismissOne(alert.id)}
                    aria-label="Dismiss notification"
                    className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex gap-3 pr-6">
                    <BpNotificationIcon tone={SEVERITY_TONE[alert.severity]} size={20} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{alert.title}</span>{' '}
                        <button
                          type="button"
                          onClick={() => goToAlert(alert)}
                          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          View details
                        </button>
                      </p>
                      <p className="mt-1 text-sm text-gray-600">{alert.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                        <span>{alert.firstDetected}</span>
                        <span className="text-gray-300">|</span>
                        <span>Service: {alert.category}</span>
                        <span className="text-gray-300">|</span>
                        <span className="truncate">{subscriptionLine(alert)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetBody>

        <div className="shrink-0 border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={viewHistory}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            View notification history
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
