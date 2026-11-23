import { useSyncExternalStore } from 'react';
import { applyOrderedConfigToSubscription } from './mockData';

/**
 * Tracks which subscriptions were activated from a self-service request in this prototype.
 *
 * Activation is a one-way milestone, so the banner it drives has to outlive the navigation that
 * first showed it — it stays on the subscription every time the user comes back. The ordered
 * configuration is stored alongside it and replayed on load, otherwise a page refresh would show
 * an "activated" subscription still carrying its pre-request service level.
 */

const STORAGE_KEY = 'consoleActivatedSubscriptions';

export interface ActivatedSubscription {
  id: string;
  serviceLevel: string;
  committedTib: number;
}

function readPersisted(): ActivatedSubscription[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ActivatedSubscription =>
        !!entry && typeof entry.id === 'string' && typeof entry.serviceLevel === 'string',
    );
  } catch {
    return [];
  }
}

let activated: ActivatedSubscription[] = readPersisted();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activated));
  } catch {
    /* storage unavailable — activation still holds for this session */
  }
}

/** Records an activation and keeps it across reloads. Repeat calls re-apply the latest config. */
export function markSubscriptionActivated(entry: ActivatedSubscription): void {
  if (!entry.id) return;
  activated = [...activated.filter((a) => a.id !== entry.id), entry];
  persist();
  emit();
}

export function isSubscriptionActivated(subscriptionId: string): boolean {
  return activated.some((a) => a.id === subscriptionId);
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): ActivatedSubscription[] {
  return activated;
}

/** Reactive read so the subscription detail banner appears the moment a request completes. */
export function useIsSubscriptionActivated(subscriptionId: string): boolean {
  const entries = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return entries.some((a) => a.id === subscriptionId);
}

/* Re-apply stored orders so a reloaded session matches what the request actually asked for. */
activated.forEach((entry) => {
  applyOrderedConfigToSubscription(entry.id, {
    serviceLevel: entry.serviceLevel,
    committedTib: entry.committedTib,
  });
});
