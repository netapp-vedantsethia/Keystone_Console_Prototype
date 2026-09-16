import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { IcRestoreIcon } from '@netapp/blueprint/icons/react/ic_restore';
import { formatConsoleLastUpdated } from '../../data/mockData';
import { ConsoleBreadcrumbs } from './ConsoleBreadcrumbs';
import { Button } from '../ui/button';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface ConsolePageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  /** When omitted, the label uses the current local date/time (updated when refresh is clicked). */
  lastUpdated?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
}

export function ConsolePageHeader({
  breadcrumbs,
  title,
  subtitle,
  lastUpdated: lastUpdatedProp,
  actions,
  onRefresh,
}: ConsolePageHeaderProps) {
  const [lastUpdatedLocal, setLastUpdatedLocal] = useState(() =>
    formatConsoleLastUpdated(),
  );
  const displayLastUpdated = lastUpdatedProp ?? lastUpdatedLocal;

  const handleRefresh = useCallback(() => {
    setLastUpdatedLocal(formatConsoleLastUpdated());
    onRefresh?.();
  }, [onRefresh]);

  return (
    <div className="bg-white border-b border-[#e0e0e0]">
      <div className="px-5 py-4">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="mb-4">
            <ConsoleBreadcrumbs items={breadcrumbs} />
          </div>
        )}

        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-normal leading-[36px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {displayLastUpdated && (
              <div className="flex items-center gap-2">
                {onRefresh && (
                  <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="Refresh">
                    <IcRestoreIcon className="w-4 h-4" />
                  </Button>
                )}
                <p className="text-[14px] font-normal leading-[24px] text-[#404040] font-['SF_Pro',sans-serif]">
                  {displayLastUpdated}
                </p>
              </div>
            )}
            {actions}
          </div>
        </div>

        {/* Subtitle/Tracking ID */}
        {subtitle && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[16px] font-normal leading-[28px] text-[#1c1c1c] font-['SF_Pro',sans-serif]">
              {subtitle}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
