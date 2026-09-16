import { BP_MAIN_NAV_DIALOG_ID, BpMainNavItem } from '@netapp/blueprint/react';
import type { ConsoleMode } from '../../context/ConsoleModeContext';

const OPTIONS: { id: ConsoleMode; label: string }[] = [
  { id: 'console', label: 'Console' },
  { id: 'console-local', label: 'Console Local' },
];

/**
 * Global app switcher for the header's main-nav invocable (Blueprint main-nav pattern — see
 * `BpHeader.Invocable` in `ConsoleHeader`). Reuses Blueprint's `bp-main-nav-drawer` / `bp-main-nav`
 * markup (Figma `83553:54574` / `83553:54619`) so this renders as the same full-height sidebar that
 * overlaps the page content below the header, just like `BpMainNav`'s own drawer. `BpMainNavPanel`
 * isn't part of Blueprint's public React API, so the categories column is composed by hand from the
 * exported `BpMainNavItem` row plus the drawer's own CSS classes, keeping the exact visual spec.
 * Rendered inline (not portaled) so it inherits the header's own stacking context and sits above the
 * fixed left nav without fighting Blueprint's built-in drawer z-index.
 */
export function ConsoleSwitcherPanel({
  mode,
  onSelect,
  onDismiss,
}: {
  mode: ConsoleMode;
  onSelect: (mode: ConsoleMode) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bp-main-nav-drawer" onClick={onDismiss}>
      <div className="bp-main-nav-drawer__modal" onClick={(e) => e.stopPropagation()}>
        <div
          id={BP_MAIN_NAV_DIALOG_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Switch console"
          className="bp-main-nav-drawer__panel"
        >
          <nav className="bp-main-nav" aria-label="Switch console">
            <div className="bp-main-nav__categories">
              <ul className="bp-main-nav__categories-list">
                {OPTIONS.map((opt) => (
                  <BpMainNavItem
                    key={opt.id}
                    id={opt.id}
                    label={opt.label}
                    selected={opt.id === mode}
                    onItemSelect={() => {
                      onSelect(opt.id);
                      onDismiss();
                    }}
                  />
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
