import { useLayoutEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

const CATALOG_BASE = `${import.meta.env.BASE_URL}catalog/`;

type PersonaOption = {
  /** Matches the `appPersona` value the catalog's persona-switcher reads from localStorage. */
  id: 'customer' | 'sales' | 'deal-desk';
  name: string;
  role: string;
  /** Page to land on after signing in, or null when the persona's home is the Console itself. */
  landingPage: string | null;
};

const PERSONAS: PersonaOption[] = [
  { id: 'customer', name: 'AUMOVIO Germany GmbH', role: 'Customer — Console', landingPage: null },
  { id: 'sales', name: 'Derek Keller', role: 'Sales — Sales dashboard', landingPage: 'sales-dashboard.html' },
  { id: 'deal-desk', name: 'Laura Ramirez', role: 'Deal desk — Deal dashboard', landingPage: 'index.html' },
];

/**
 * Dropdown for the header's Organization menu, listing the organization alongside the seller and
 * deal-desk personas so the demo can cross over into their catalog screens via the sign-in page.
 * `.bp-header__panel` is `display: contents`, so the panel positions itself against the open
 * trigger rather than inheriting any anchoring from Blueprint.
 */
export function ConsoleOrganizationPanel({
  organizationName,
  onDismiss,
}: {
  organizationName: string;
  onDismiss: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const trigger = document.querySelector('.bp-header__menus [aria-expanded="true"]');
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const maxLeft = window.innerWidth - panel.offsetWidth - 8;
    setPosition({ top: rect.bottom + 12, left: Math.max(8, Math.min(rect.left, maxLeft)) });
  }, []);

  const selectPersona = (option: PersonaOption) => {
    onDismiss();
    if (!option.landingPage) {
      try {
        localStorage.setItem('appPersona', option.id);
      } catch {
        /* ignore private mode / blocked storage */
      }
      return;
    }
    /* Internal personas sign in first; login.html stores the persona once credentials are submitted. */
    const params = new URLSearchParams({ persona: option.id, redirect: option.landingPage });
    window.location.href = `${CATALOG_BASE}login.html?${params.toString()}`;
  };

  return (
    <>
      <div className="fixed inset-0" onClick={onDismiss} />
      <div
        ref={panelRef}
        role="menu"
        aria-label="Organization and persona"
        className="fixed z-10 w-[288px] rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
          visibility: position ? 'visible' : 'hidden',
        }}
      >
        <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Organization
        </p>
        <p className="px-4 pb-2 text-sm text-gray-900">{organizationName}</p>

        <div className="my-1 border-t border-gray-200" />

        <p className="px-4 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Switch persona
        </p>
        {PERSONAS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            onClick={() => selectPersona(option)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-gray-900">{option.name}</span>
              <span className="block truncate text-xs text-gray-500">{option.role}</span>
            </span>
            {option.landingPage === null && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
          </button>
        ))}
      </div>
    </>
  );
}
