import { useSyncExternalStore } from 'react';
import { mockConsoleServiceRequests, type ConsoleServiceRequest } from './consoleOperationsMock';

/**
 * Minimal external store for service requests created during a session (e.g. Modify / Renew
 * submissions from the Subscription Detail page or Operations Center). There is no global
 * app-level state store in this prototype, so this module keeps newly-created requests in sync
 * across every screen that reads/lists service requests, without prop-drilling through `App.tsx`.
 */
let requests: ConsoleServiceRequest[] = [...mockConsoleServiceRequests];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Prepends a newly-created service request so it appears first in every list view. */
export function addServiceRequest(request: ConsoleServiceRequest): void {
  requests = [request, ...requests];
  emit();
}

export function getServiceRequests(): ConsoleServiceRequest[] {
  return requests;
}

export function getServiceRequestById(id: string): ConsoleServiceRequest | undefined {
  return requests.find((r) => r.id === id);
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** Reactive read of the full (mock + session-created) service request list. */
export function useServiceRequests(): ConsoleServiceRequest[] {
  return useSyncExternalStore(subscribe, getServiceRequests, getServiceRequests);
}
