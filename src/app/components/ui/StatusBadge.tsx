import { BpColorBadge, type BpColorBadgeColor } from '@netapp/blueprint/react';

/**
 * The app's existing status-color helpers (e.g. `getHealthBadgeColor`, `getSlaBadgeColor`,
 * `getUrgencyColor`) each return one of these semantic tones. `BpColorBadge` only ships five
 * color families (`blue|green|orange|red|grey`), so `amber`/`yellow` collapse onto `orange` and
 * `indigo`/`purple` collapse onto `blue` — the closest Blueprint tone in each case.
 */
export type StatusTone = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';

const TONE_TO_BP_COLOR: Record<StatusTone, BpColorBadgeColor> = {
  green: 'green',
  red: 'red',
  amber: 'orange',
  blue: 'blue',
  purple: 'blue',
  gray: 'grey',
};

export interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

/** Thin adapter over `BpColorBadge` for the app's existing semantic status-tone vocabulary. */
export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return <BpColorBadge color={TONE_TO_BP_COLOR[tone]} label={label} className={className} />;
}
