import { useState } from 'react';
import { BP_MAIN_NAV_DIALOG_ID, BpHeader } from '@netapp/blueprint/react';
import { IcHeaderAssistantIcon } from '@netapp/blueprint/icons/react/ic_header_assistant';
import { IcHeaderNotificationIcon } from '@netapp/blueprint/icons/react/ic_header_notification';
import { IcHeaderHelpIcon } from '@netapp/blueprint/icons/react/ic_header_help';
import { IcHeaderUserIcon } from '@netapp/blueprint/icons/react/ic_header_user';
import { platformMspCustomer, platformProgramLabel, type PlatformNavigateOptions } from "../../data/mockData";
import { mockConsoleActiveAlerts } from '../../data/consoleOperationsMock';
import { HeaderNotificationsPanel } from './HeaderNotificationsPanel';
import { ConsoleSwitcherPanel } from './ConsoleSwitcherPanel';
import { ConsoleOrganizationPanel } from './ConsoleOrganizationPanel';
import type { ConsoleMode } from '../../context/ConsoleModeContext';

interface ConsoleHeaderProps {
  currentUser: {
    name: string;
    role: string;
    customerType: string;
  };
  onNavigate?: (screen: string, subscriptionId?: string, options?: PlatformNavigateOptions) => void;
  consoleMode: ConsoleMode;
  onConsoleModeChange: (mode: ConsoleMode) => void;
}

export function ConsoleHeader({ currentUser, onNavigate, consoleMode, onConsoleModeChange }: ConsoleHeaderProps) {
  const [activeControlId, setActiveControlId] = useState<string | null>(null);
  const criticalAlertCount = mockConsoleActiveAlerts.filter((a) => a.severity === 'Critical').length;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 shadow-sm"
      style={{ height: '72px' }}
    >
      <BpHeader
        productName="Console"
        productTag={consoleMode === 'console-local' ? { color: 'blue', children: 'Local' } : undefined}
        className="h-full"
        activeControlId={activeControlId}
        onActiveControlChange={setActiveControlId}
      >
        <BpHeader.Invocable
          id="main-nav"
          slot="switcher"
          controlsId={BP_MAIN_NAV_DIALOG_ID}
          panel={
            <ConsoleSwitcherPanel
              mode={consoleMode}
              onSelect={(mode) => {
                onConsoleModeChange(mode);
                setActiveControlId(null);
              }}
              onDismiss={() => setActiveControlId(null)}
            />
          }
          trigger={(api) => <BpHeader.ServiceSwitcherTrigger {...api} ariaLabel="Switch console" />}
        />
        <BpHeader.Invocable
          id="organization"
          slot="menus"
          panel={
            <ConsoleOrganizationPanel
              organizationName={platformMspCustomer()}
              onDismiss={() => setActiveControlId(null)}
            />
          }
          trigger={(api) => (
            <BpHeader.MenuTrigger {...api} label="Organization" value={platformMspCustomer()} />
          )}
        />
        <BpHeader.Invocable
          id="project"
          slot="menus"
          panel={null}
          trigger={(api) => (
            <BpHeader.MenuTrigger {...api} label="Project" value={platformProgramLabel()} />
          )}
        />
        <BpHeader.Invocable
          id="assistant"
          slot="icons"
          panel={null}
          trigger={(api) => <BpHeader.IconTrigger {...api} icon={IcHeaderAssistantIcon} ariaLabel="AI Assistant" />}
        />
        <BpHeader.Invocable
          id="notifications"
          slot="icons"
          panel={
            <HeaderNotificationsPanel
              onClose={() => setActiveControlId(null)}
              onNavigate={(screen, subscriptionId, options) => {
                onNavigate?.(screen, subscriptionId, options);
              }}
            />
          }
          trigger={(api) => (
            <BpHeader.IconTrigger {...api} icon={IcHeaderNotificationIcon} ariaLabel="Notifications" badgeCount={criticalAlertCount} />
          )}
        />
        <BpHeader.Invocable
          id="help"
          slot="icons"
          panel={null}
          trigger={(api) => <BpHeader.IconTrigger {...api} icon={IcHeaderHelpIcon} ariaLabel="Help" />}
        />
        <BpHeader.Invocable
          id="user"
          slot="icons"
          panel={null}
          trigger={(api) => <BpHeader.IconTrigger {...api} icon={IcHeaderUserIcon} ariaLabel={currentUser.name} />}
        />
      </BpHeader>
    </div>
  );
}
