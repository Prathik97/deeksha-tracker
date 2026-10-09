import { formatInTimeZone } from 'date-fns-tz';
import type { DateInput } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Calendar date (YYYY-MM-DD) for the given instant in `tz`; strings already in that form pass through. */
export function toLocalDate(input: DateInput, tz: string): string {
  if (typeof input === 'string') {
    if (!ISO_DATE.test(input)) throw new Error(`Invalid date string: ${input}`);
    return input;
  }
  return formatInTimeZone(input, tz, 'yyyy-MM-dd');
}

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function diffDays(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Inclusive list of dates from `from` to `to`; empty if `to` < `from`. */
export function dateRange(from: string, to: string): string[] {
  const n = diffDays(from, to);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

/** ISO timestamp with the timezone's offset, e.g. 2026-10-10T09:03:11+05:30. */
export function nowIso(now: Date, tz: string): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Day number of `today` in the vrata: 1 on start_date, 0 or negative before it,
 * duration+1 and beyond after it. Not clamped. `today` may be an instant or a local date string.
 */
export function getDayNumber(startDate: string, today: DateInput, tz: string): number {
  return diffDays(startDate, toLocalDate(today, tz)) + 1;
}
