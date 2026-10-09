import { addDays, getDayNumber } from './dates';
import { getPradakshinaMethod } from './rules';
import type { DateInput, Enrollment, PradakshinaStatus, Progress, VrataTemplate } from './types';

/** Week window (1-based) containing day_number, as inclusive start/end dates clamped to the vrata. */
function weekWindow(template: VrataTemplate, enrollment: Enrollment, dayNumber: number) {
  const week = Math.floor((dayNumber - 1) / 7) + 1;
  const startDay = (week - 1) * 7 + 1;
  const endDay = Math.min(week * 7, template.duration_days);
  return {
    week,
    start: addDays(enrollment.start_date, startDay - 1),
    end: addDays(enrollment.start_date, endDay - 1),
    endDay,
  };
}

/**
 * Pradakshina progress and warning for `today`.
 *
 * four_days: sessions counted across the whole vrata; warns when days_left <= remaining.
 * weekly_twice: sessions counted in the current 7-day window (last window clamped to the vrata);
 *               warns when days left in the window <= sessions still needed.
 */
export function getPradakshinaStatus(
  template: VrataTemplate,
  enrollment: Enrollment,
  progress: Progress,
  today: DateInput,
): PradakshinaStatus {
  const method = getPradakshinaMethod(template, enrollment);
  const dayNumber = getDayNumber(enrollment.start_date, today, enrollment.timezone);
  const inRange = dayNumber >= 1 && dayNumber <= template.duration_days;
  const base = {
    method: enrollment.pradakshina_method,
    method_label: method.label,
    rounds_per_session: method.rounds_per_session,
  };

  if (method.sessions_per_week !== undefined) {
    const clampedDay = Math.min(Math.max(dayNumber, 1), template.duration_days);
    const win = weekWindow(template, enrollment, clampedDay);
    const done = progress.pradakshina_dates.filter((d) => d >= win.start && d <= win.end).length;
    const required = method.sessions_per_week;
    const remaining = Math.max(required - done, 0);
    const daysLeftInWeek = Math.max(win.endDay - clampedDay, 0);
    const warning =
      inRange && remaining > 0 && daysLeftInWeek <= remaining
        ? `You still need ${remaining} pradakshina session(s) this week. Only ${daysLeftInWeek} day(s) left in the week.`
        : null;
    return { ...base, scope: 'week', done, required, remaining, warning };
  }

  const required = method.total_sessions_required ?? 0;
  const done = progress.pradakshina_dates.length;
  const remaining = Math.max(required - done, 0);
  const daysLeft = template.duration_days - dayNumber;
  const warning =
    inRange && remaining > 0 && daysLeft <= remaining
      ? `You have ${remaining} pradakshina session(s) left and only ${daysLeft} day(s) remaining. Plan your temple visits now.`
      : null;
  return { ...base, scope: 'vrata', done, required, remaining, warning };
}

/**
 * Whether the whole-vrata pradakshina requirement is met.
 * four_days: total sessions. weekly_twice: every week window has its sessions
 * (the short last-week case is an open decision; it is applied as written).
 */
export function isPradakshinaSatisfied(
  template: VrataTemplate,
  enrollment: Enrollment,
  pradakshinaDates: string[],
): boolean {
  const method = getPradakshinaMethod(template, enrollment);
  if (method.sessions_per_week !== undefined) {
    const weeks = Math.ceil(template.duration_days / 7);
    for (let w = 1; w <= weeks; w++) {
      const win = weekWindow(template, enrollment, (w - 1) * 7 + 1);
      const count = pradakshinaDates.filter((d) => d >= win.start && d <= win.end).length;
      if (count < method.sessions_per_week) return false;
    }
    return true;
  }
  return pradakshinaDates.length >= (method.total_sessions_required ?? 0);
}

// ---------- planned pradakshina days ----------

/** Number of days a devotee picks in the plan. */
export const PLANNED_DAYS_COUNT = 4;

export function isPlannedDaysSet(enrollment: Enrollment): boolean {
  return (enrollment.planned_pradakshina_days?.length ?? 0) > 0;
}

export function isPlannedDay(enrollment: Enrollment, dayNumber: number): boolean {
  return enrollment.planned_pradakshina_days?.includes(dayNumber) ?? false;
}

/**
 * Planned day numbers that are already past (before today) with no pradakshina session logged
 * on their date. Planned days today or in the future are never "missed".
 */
export function getMissedPlannedDays(enrollment: Enrollment, progress: Progress, today: DateInput): number[] {
  const todayNumber = getDayNumber(enrollment.start_date, today, enrollment.timezone);
  const done = new Set(progress.pradakshina_dates);
  return [...(enrollment.planned_pradakshina_days ?? [])]
    .filter((n) => n < todayNumber && !done.has(addDays(enrollment.start_date, n - 1)))
    .sort((a, b) => a - b);
}

/**
 * Problems with a proposed plan (empty list = valid): exactly PLANNED_DAYS_COUNT whole numbers,
 * each from today's day number up to the last day, no duplicates. Today itself is allowed.
 */
export function validatePlannedDays(
  days: number[],
  currentDayNumber: number,
  durationDays: number,
): string[] {
  const errors: string[] = [];
  if (days.length !== PLANNED_DAYS_COUNT) errors.push(`Enter exactly ${PLANNED_DAYS_COUNT} day numbers (got ${days.length}).`);
  const earliest = Math.max(currentDayNumber, 1);
  for (const n of days) {
    if (!Number.isInteger(n)) errors.push(`${n} is not a whole number.`);
    else if (n < 1 || n > durationDays) errors.push(`Day ${n} is outside 1-${durationDays}.`);
    else if (n < earliest) errors.push(`Day ${n} has already passed (today is Day ${currentDayNumber}).`);
  }
  const dupes = days.filter((n, i) => days.indexOf(n) !== i);
  if (dupes.length > 0) errors.push(`Duplicate day(s): ${[...new Set(dupes)].join(', ')}.`);
  return errors;
}
