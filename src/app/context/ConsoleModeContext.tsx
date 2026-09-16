import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { mockSubscriptions, activeMockSubscriptions, type Subscription } from '../data/mockData';

/**
 * Keystone's two navigation contexts: the standard fleet ("Console") and the sovereign-only
 * fleet ("Console Local" — Dark Site + Sovereign subscriptions). Switched from the header's
 * main-nav switcher (see `ConsoleHeader` / `ConsoleSwitcherPanel`); everything else (left nav
 * items, screen routing) stays identical between the two, only the underlying data differs.
 */
export type ConsoleMode = 'console' | 'console-local';

/** The only two subscriptions that live in Console Local — every other subscription is Console. */
export const CONSOLE_LOCAL_SUBSCRIPTION_IDS: readonly string[] = ['1789858612', '1789858613'];

export function isConsoleLocalSubscriptionId(subscriptionId: string): boolean {
  return CONSOLE_LOCAL_SUBSCRIPTION_IDS.includes(subscriptionId);
}

export function consoleModeForSubscriptionId(subscriptionId: string): ConsoleMode {
  return isConsoleLocalSubscriptionId(subscriptionId) ? 'console-local' : 'console';
}

interface ConsoleModeContextValue {
  mode: ConsoleMode;
  setMode: (mode: ConsoleMode) => void;
  /** Every subscription (any lifecycle status) that belongs to the current mode. */
  scopedSubscriptions: Subscription[];
  /** Active-only subscriptions that belong to the current mode — the common case for fleet KPIs. */
  scopedActiveSubscriptions: Subscription[];
  /** True when a subscription id belongs to the currently selected mode. */
  isInScope: (subscriptionId: string) => boolean;
}

const ConsoleModeContext = createContext<ConsoleModeContextValue | null>(null);

export function ConsoleModeProvider({
  mode,
  setMode,
  children,
}: {
  mode: ConsoleMode;
  setMode: (mode: ConsoleMode) => void;
  children: ReactNode;
}) {
  const value = useMemo<ConsoleModeContextValue>(() => {
    const scopedSubscriptions = mockSubscriptions.filter((s) => consoleModeForSubscriptionId(s.id) === mode);
    const scopedActiveSubscriptions = activeMockSubscriptions.filter(
      (s) => consoleModeForSubscriptionId(s.id) === mode,
    );
    const scopedIds = new Set(scopedSubscriptions.map((s) => s.id));
    return {
      mode,
      setMode,
      scopedSubscriptions,
      scopedActiveSubscriptions,
      isInScope: (subscriptionId: string) => scopedIds.has(subscriptionId),
    };
  }, [mode, setMode]);

  return <ConsoleModeContext.Provider value={value}>{children}</ConsoleModeContext.Provider>;
}

export function useConsoleMode(): ConsoleModeContextValue {
  const ctx = useContext(ConsoleModeContext);
  if (!ctx) {
    throw new Error('useConsoleMode must be used within a ConsoleModeProvider');
  }
  return ctx;
}
