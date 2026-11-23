import { useSyncExternalStore } from 'react';

/**
 * Tracks the most recent Capacity Add SLA request per subscription so the 12-month cooldown
 * (`capacityAddEligibility`) is enforced within a session immediately after a request is
 * submitted from the Capacity Add sub-tab — otherwise the guardrail would only reflect the
 * hand-authored `lastCapacityAddDate` seeded in mock data and never update after a live request.
 */

const STORAGE_KEY = 'consoleCapacityAddRequests';

function readPersisted(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

let lastAddDateBySubscriptionId: Record<string, string> = readPersisted();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lastAddDateBySubscriptionId));
  } catch {
    /* storage unavailable — the cooldown still holds for this session */
  }
}

/** Records a Capacity Add SLA request date (ISO) for a subscription, superseding any earlier date. */
export function recordCapacityAdd(subscriptionId: string, dateIso: string): void {
  if (!subscriptionId) return;
  lastAddDateBySubscriptionId = { ...lastAddDateBySubscriptionId, [subscriptionId]: dateIso };
  persist();
  emit();
}

/** Most recent session-recorded Capacity Add date for a subscription, if any. */
export function getSessionLastCapacityAddDate(subscriptionId: string): string | undefined {
  return lastAddDateBySubscriptionId[subscriptionId];
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): Record<string, string> {
  return lastAddDateBySubscriptionId;
}

/** Reactive read of the session-recorded Capacity Add date, so eligibility updates immediately after a request. */
export function useSessionLastCapacityAddDate(subscriptionId: string): string | undefined {
  const map = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return map[subscriptionId];
}
