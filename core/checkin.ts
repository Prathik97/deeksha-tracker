import { dateRange, getDayNumber, toLocalDate } from './dates';
import { getPradakshinaStatus, isPradakshinaSatisfied } from './pradakshina';
import { getActiveRules, getOrderedActiveRules, getPradakshinaMethod } from './rules';
import type {
  CheckinAnswers,
  CheckinContext,
  DateInput,
  DayEntry,
  EntryStatus,
  Enrollment,
  Progress,
  VrataTemplate,
} from './types';

/**
 * Apply one day's check-in and return a NEW progress object. Never mutates `progress`, never does I/O.
 *
 * - Mandatory rule answered false -> id goes into flags[]; the check-in is never blocked.
 * - Optional rule answered null (skip) -> stored as null. A mandatory rule explicitly set to null throws.
 * - Rules not mentioned keep their existing answer (or null for a new entry), so partial entries can be completed later.
 * - If an entry for `date` already exists, its entry_status and logged_at are kept.
 * - Completion is evaluated on the last day of the vrata, and only if pradakshina is satisfied.
 */
export function applyCheckin(
  progress: Progress,
  date: string,
  answers: CheckinAnswers,
  entryStatus: EntryStatus,
  ctx: CheckinContext,
): Progress {
  const { template, enrollment, loggedAt } = ctx;
  const dayNumber = getDayNumber(enrollment.start_date, date, enrollment.timezone);
  if (dayNumber < 1 || dayNumber > template.duration_days) {
    throw new Error(`${date} is day ${dayNumber}, outside the vrata (1-${template.duration_days})`);
  }

  const active = getActiveRules(template, enrollment);
  const activeIds = new Set(active.map((r) => r.id));
  const next: Progress = structuredClone(progress);
  const existing = next.days[date];

  const rulesChecked: Record<string, boolean | null> = {};
  for (const rule of active) {
    rulesChecked[rule.id] = existing?.rules_checked[rule.id] ?? null;
  }
  for (const [id, value] of Object.entries(answers.rules ?? {})) {
    if (!activeIds.has(id)) throw new Error(`Unknown or disabled rule: ${id}`);
    const rule = active.find((r) => r.id === id)!;
    if (value === null && rule.mandatory) {
      throw new Error(`Rule "${id}" is mandatory and cannot be skipped (answer true or false)`);
    }
    rulesChecked[id] = value;
  }

  const flags = active.filter((r) => r.mandatory && rulesChecked[r.id] === false).map((r) => r.id);

  const pradakshinaDone = answers.pradakshina_done ?? existing?.pradakshina_done ?? false;
  const entry: DayEntry = {
    day_number: dayNumber,
    entry_status: existing?.entry_status ?? entryStatus,
    logged_at: existing?.logged_at ?? loggedAt,
    rules_checked: rulesChecked,
    flags,
    mantra_method: answers.mantra_method !== undefined ? answers.mantra_method : (existing?.mantra_method ?? null),
    pradakshina_done: pradakshinaDone,
    notes: answers.notes ?? existing?.notes ?? '',
  };
  next.days[date] = entry;

  const dates = new Set(next.pradakshina_dates);
  if (pradakshinaDone) dates.add(date);
  else dates.delete(date);
  next.pradakshina_dates = [...dates].sort();

  const specialKey = `day_${dayNumber}`;
  const special = template.special_days[specialKey];
  if (special && answers.special_actions) {
    const valid = new Set(special.actions.map((a) => a.id));
    const done = { ...(next.special_actions_done[specialKey] ?? {}) };
    for (const [id, value] of Object.entries(answers.special_actions)) {
      if (!valid.has(id)) throw new Error(`Unknown action "${id}" for ${specialKey}`);
      done[id] = value;
    }
    next.special_actions_done[specialKey] = done;
  }

  if (dayNumber === template.duration_days) {
    next.is_complete = isPradakshinaSatisfied(template, enrollment, next.pradakshina_dates);
  }
  return next;
}

/** Dates from start_date to `today - 1` (capped at the last vrata day) that have no entry. */
export function getMissedDates(
  template: VrataTemplate,
  enrollment: Enrollment,
  progress: Progress,
  today: DateInput,
): string[] {
  const todayDate = toLocalDate(today, enrollment.timezone);
  const dayNumber = getDayNumber(enrollment.start_date, todayDate, enrollment.timezone);
  if (dayNumber < 2) return [];
  const lastDay = Math.min(dayNumber - 1, template.duration_days);
  const lastDate = dateRange(enrollment.start_date, todayDate)[lastDay - 1];
  return dateRange(enrollment.start_date, lastDate).filter((d) => !progress.days[d]);
}

export type Question =
  | { kind: 'rule'; rule_id: string; label: string; category: string; mandatory: boolean }
  | { kind: 'mantra_method' }
  | { kind: 'pradakshina'; rounds: number }
  | { kind: 'special_action'; action_id: string; label: string };

/**
 * Questions still to ask for `date`, in template.category_order. Rules already answered (non-null)
 * in an existing entry are not asked again. The mantra_method question is only needed when
 * mantra_108 is answered true, so it is listed here and the caller decides based on the answer.
 */
export function getQuestions(
  template: VrataTemplate,
  enrollment: Enrollment,
  progress: Progress,
  date: string,
): Question[] {
  const existing = progress.days[date];
  const dayNumber = getDayNumber(enrollment.start_date, date, enrollment.timezone);
  const questions: Question[] = [];

  for (const rule of getOrderedActiveRules(template, enrollment)) {
    if (existing && existing.rules_checked[rule.id] !== null && existing.rules_checked[rule.id] !== undefined) continue;
    questions.push({ kind: 'rule', rule_id: rule.id, label: rule.label, category: rule.category, mandatory: rule.mandatory });
    if (rule.id === 'mantra_108') questions.push({ kind: 'mantra_method' });
  }
  const method = getPradakshinaMethod(template, enrollment);
  if (!existing) questions.push({ kind: 'pradakshina', rounds: method.rounds_per_session });

  const special = template.special_days[`day_${dayNumber}`];
  if (special) {
    const doneMap = progress.special_actions_done[`day_${dayNumber}`] ?? {};
    for (const a of special.actions) {
      if (doneMap[a.id] === undefined) questions.push({ kind: 'special_action', action_id: a.id, label: a.label });
    }
  }
  return questions;
}

export type ParsedAnswer = true | false | null | 'invalid';

/** y / yes / 1 -> true; n / no / 0 -> false; skip / na -> null (only if not mandatory), else 'invalid'. */
export function parseAnswer(input: string, mandatory: boolean): ParsedAnswer {
  const v = input.trim().toLowerCase();
  if (['y', 'yes', '1'].includes(v)) return true;
  if (['n', 'no', '0'].includes(v)) return false;
  if (['skip', 'na'].includes(v) && !mandatory) return null;
  return 'invalid';
}

export interface CheckinSummary {
  day_number: number;
  days_left: number;
  pradakshina_done: number;
  pradakshina_required: number;
  flagged: string[];
  is_complete: boolean;
  is_last_day: boolean;
}

/** Facts for the end-of-checkin message, derived from the updated progress. */
export function summarizeCheckin(
  template: VrataTemplate,
  enrollment: Enrollment,
  progress: Progress,
  date: string,
): CheckinSummary {
  const entry = progress.days[date];
  const status = getPradakshinaStatus(template, enrollment, progress, date);
  const labels = new Map(template.rules.map((r) => [r.id, r.label]));
  return {
    day_number: entry.day_number,
    days_left: template.duration_days - entry.day_number,
    pradakshina_done: status.done,
    pradakshina_required: status.required,
    flagged: entry.flags.map((id) => labels.get(id) ?? id),
    is_complete: progress.is_complete,
    is_last_day: entry.day_number === template.duration_days,
  };
}
