import { addDays, getDayNumber } from '@core/dates';
import { getActiveRules } from '@core/rules';
import type { DayEntry, Enrollment, Progress, Rule, VrataTemplate } from '@core/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-11" -> "Oct 11" (string maths only, no timezone involved). */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export type CardState = 'completed' | 'partial' | 'open' | 'missed' | 'future';

export interface GridDay {
  day_number: number;
  date: string;
  label: string;
  state: CardState;
  is_today: boolean;
  planned: boolean;
  flagged: boolean;
  entry: DayEntry | null;
}

/**
 * Rules the entry still needs an answer for: never asked, or a mandatory rule left null.
 * An optional rule stored as null was skipped on purpose and counts as answered.
 */
export function unansweredRules<T extends { id: string; mandatory: boolean }>(rules: T[], entry: DayEntry | null): T[] {
  return rules.filter((r) => {
    const v = entry?.rules_checked[r.id];
    return v === undefined || (v === null && r.mandatory);
  });
}

export function buildGrid(
  template: VrataTemplate,
  enrollment: Enrollment,
  progress: Progress,
  today: string,
): GridDay[] {
  const todayNumber = getDayNumber(enrollment.start_date, today, enrollment.timezone);
  const rules = getActiveRules(template, enrollment);
  const planned = new Set(enrollment.planned_pradakshina_days ?? []);

  return Array.from({ length: template.duration_days }, (_, i) => {
    const day_number = i + 1;
    const date = addDays(enrollment.start_date, i);
    const entry = progress.days[date] ?? null;
    let state: CardState;
    if (entry) state = unansweredRules(rules, entry).length === 0 ? 'completed' : 'partial';
    else if (day_number > todayNumber) state = 'future';
    else if (day_number === todayNumber) state = 'open';
    else state = 'missed';
    return {
      day_number,
      date,
      label: shortDate(date),
      state,
      is_today: day_number === todayNumber,
      planned: planned.has(day_number),
      flagged: (entry?.flags.length ?? 0) > 0,
      entry,
    };
  });
}
