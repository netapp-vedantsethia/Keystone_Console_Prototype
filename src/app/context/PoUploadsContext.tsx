import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { mockPoUploadEntries, type PoUploadEntry } from '../data/mockData';

interface PoUploadsContextValue {
  uploads: PoUploadEntry[];
  addUpload: (entry: PoUploadEntry) => void;
  updateUpload: (entry: PoUploadEntry) => void;
  remapUpload: (entryId: string, newSubscriptionId: string) => void;
}

const PoUploadsContext = createContext<PoUploadsContextValue | null>(null);

/**
 * PO uploads are submitted from two surfaces — Billing & Cost's Purchase Orders tab and the
 * Cart's "Upload PO Document" action — that mount as separate screens (see `App.tsx`), never at
 * the same time. Lifting the queue here (above both) keeps a PO uploaded from either place
 * visible in both, instead of two screens each owning a disconnected copy of the same data.
 */
export function PoUploadsProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<PoUploadEntry[]>(mockPoUploadEntries);

  const value = useMemo<PoUploadsContextValue>(
    () => ({
      uploads,
      addUpload: (entry) => setUploads((prev) => [entry, ...prev]),
      updateUpload: (entry) => setUploads((prev) => prev.map((u) => (u.id === entry.id ? entry : u))),
      remapUpload: (entryId, newSubscriptionId) =>
        setUploads((prev) =>
          prev.map((u) =>
            u.id === entryId
              ? {
                  ...u,
                  mappedSubscriptionIds: [newSubscriptionId],
                  omStatus: 'pending',
                  reviewedBy: undefined,
                  reviewedAt: undefined,
                  purchaseOrderId: undefined,
                }
              : u,
          ),
        ),
    }),
    [uploads],
  );

  return <PoUploadsContext.Provider value={value}>{children}</PoUploadsContext.Provider>;
}

export function usePoUploads(): PoUploadsContextValue {
  const ctx = useContext(PoUploadsContext);
  if (!ctx) throw new Error('usePoUploads must be used within a PoUploadsProvider');
  return ctx;
}
