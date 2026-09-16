import { BpServiceNav, BpTag } from '@netapp/blueprint/react';
import type { ConsoleMode } from '../../context/ConsoleModeContext';

interface ConsoleLeftNavProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  consoleMode: ConsoleMode;
}

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'billing-cost', label: 'Billing & Invoices' },
  { id: 'assets', label: 'Assets' },
  { id: 'support', label: 'Operations Center' },
];

export function ConsoleLeftNav({ activeScreen, onNavigate, consoleMode }: ConsoleLeftNavProps) {
  return (
    <div
      className="fixed z-40"
      style={{
        left: 0,
        top: '72px',
        bottom: 0,
        width: '228px',
      }}
    >
      <BpServiceNav
        serviceLabel="Keystone"
        items={navItems}
        selectedItemId={activeScreen}
        onItemSelect={(id) => onNavigate(id)}
        className="h-full"
      />
      {consoleMode === 'console-local' && (
        <div
          className="pointer-events-none absolute flex items-center"
          style={{ top: 0, right: 'var(--space-150, 12px)', height: '56px' }}
        >
          <BpTag color="purple">Sovereign</BpTag>
        </div>
      )}
    </div>
  );
}
