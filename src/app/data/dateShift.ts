// ---------------------------------------------------------------------------
// Timeline shifting — keeps the whole prototype "live and current" forever
// ---------------------------------------------------------------------------
//
// Every hardcoded date across the mock data layer (subscriptions, invoices, purchase
// orders, alerts, service requests, support cases, ASUP/collector timestamps, SLA
// charts, etc.) was originally authored as if `MOCK_DATA_AUTHORED_AS_OF` were "today" —
// narrative comments next to those literals (e.g. "Expiring soon (~39 days from Apr 9,
// 2026)") all key off that single date. Rather than re-author every literal against
// real "today" (which would go stale again), every date is shifted by the same delta
// as real "now" vs. that original anchor. Because both operands of every "days
// until/since" calculation move together, every relative relationship in the data
// (which invoices are overdue, which subscriptions are expiring soon, which alerts are
// recent) stays correct no matter when the prototype is actually opened — the whole
// mock timeline just slides forward with the calendar, recomputed fresh on every load.

/** The date the mock data's literals were authored against — the "today" baked into them. */
const MOCK_DATA_AUTHORED_AS_OF = new Date('2026-04-09T12:00:00Z');

/** Real "today" — computed once per page load so every relative date/status stays current. */
export const PLATFORM_REFERENCE_DATE = new Date();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between the mock data's original "today" and the real one, applied to every literal below. */
export const TIMELINE_SHIFT_DAYS = Math.round(
  (PLATFORM_REFERENCE_DATE.getTime() - MOCK_DATA_AUTHORED_AS_OF.getTime()) / MS_PER_DAY,
);

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Shifts a `YYYY-MM-DD` date-only literal by `TIMELINE_SHIFT_DAYS`. */
export function shiftIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + TIMELINE_SHIFT_DAYS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Shifts a `MM/DD/YYYY` date-only literal by `TIMELINE_SHIFT_DAYS`, preserving the format. */
export function shiftMdyDate(mdy: string): string {
  const [m, d, y] = mdy.split('/').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + TIMELINE_SHIFT_DAYS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}/${date.getUTCFullYear()}`;
}

/**
 * Shifts a `Mon D` chart-axis label (no year, e.g. "Mar 1", "Apr 22") by `TIMELINE_SHIFT_DAYS`,
 * assuming the label was originally written against `assumedYear`. Returns the original string
 * unchanged if it doesn't match the expected shape.
 */
export function shiftMonthDayLabel(label: string, assumedYear = 2026): string {
  const match = /^([A-Za-z]{3}) (\d{1,2})$/.exec(label.trim());
  if (!match) return label;
  const monthIdx = MONTH_ABBR.indexOf(match[1]);
  if (monthIdx === -1) return label;
  const date = new Date(Date.UTC(assumedYear, monthIdx, Number(match[2])));
  date.setUTCDate(date.getUTCDate() + TIMELINE_SHIFT_DAYS);
  return `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * Shifts every `YYYY-MM-DD` and `MM/DD/YYYY` substring found anywhere inside `text` by
 * `TIMELINE_SHIFT_DAYS`, leaving everything else (time-of-day, timezone labels, surrounding
 * prose) untouched. Safe to run over free text — mock IDs like `SR-2024-001` or `PO-2025-EMEA-01`
 * never happen to contain a full `\d{4}-\d{2}-\d{2}` or `\d{2}/\d{2}/\d{4}` run.
 */
export function shiftAnyDateString(text: string): string {
  let out = text.replace(/\d{4}-\d{2}-\d{2}/g, (m) => shiftIsoDate(m));
  out = out.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, (m) => shiftMdyDate(m));
  return out;
}

/**
 * Recursively walks any mock-data value (object/array/primitive) and shifts every date-shaped
 * string it finds by `TIMELINE_SHIFT_DAYS`, via `shiftAnyDateString`. This is the one function
 * that keeps the whole data model "live" — apply it once to a raw literal array/object and every
 * date field inside it (however deeply nested) comes out correctly shifted, with no per-field
 * bookkeeping required.
 */
export function shiftDatesDeep<T>(value: T): T {
  if (typeof value === 'string') return shiftAnyDateString(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => shiftDatesDeep(v)) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shiftDatesDeep(v);
    }
    return out as T;
  }
  return value;
}
