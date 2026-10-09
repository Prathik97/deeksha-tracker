import { getMissedDates } from './checkin';
import { diffDays, getDayNumber, toLocalDate } from './dates';
import { getMissedPlannedDays, getPradakshinaStatus, isPlannedDay, isPlannedDaysSet } from './pradakshina';
import { getActiveRules } from './rules';
import type {
  Category,
  DateInput,
  Enrollment,
  PradakshinaStatus,
  Progress,
  Resource,
  RuleCategory,
  VrataTemplate,
} from './types';

export interface BriefingRule {
  id: string;
  label: string;
  category: RuleCategory;
  mandatory: boolean;
  /** Resource shown inline with this rule (e.g. the mantra video). */
  resource: Resource | null;
}

export interface Briefing {
  /** active: day within the vrata. not_started / ended / complete: nothing else to do today. */
  status: 'active' | 'not_started' | 'ended' | 'complete';
  date: string;
  devotee_name: string;
  temple: { name: string; city: string };
  day_number: number;
  duration_days: number;
  days_left: number;
  /** Days until start_date when status is not_started. */
  days_until_start: number;
  start_date: string;
  /** Active rules of category "morning", in template order. */
  morning: BriefingRule[];
  /** Active rules of every other category, grouped in category_order. */
  all_day: BriefingRule[];
  pradakshina: PradakshinaStatus;
  special_day: { label: string; actions: { id: string; label: string; done: boolean }[] } | null;
  earlier_flags: { date: string; rules: string[] }[];
  missed_dates: string[];
  /** The devotee's planned pradakshina day numbers (empty = not set). */
  planned_days: number[];
  /** Today is a planned day and no session is logged for it yet. */
  planned_today: boolean;
  /** Planned days that passed with no session logged. */
  missed_planned_days: number[];
  /** Set when no plan exists from Day 8 on; carries the days left to plan with. */
  no_plan_warning: { days_remaining: number } | null;
}

function toBriefingRule(template: VrataTemplate, rule: VrataTemplate['rules'][number]): BriefingRule {
  return {
    id: rule.id,
    label: rule.label,
    category: rule.category,
    mandatory: rule.mandatory,
    resource: rule.resource ? (template.resources[rule.resource] ?? null) : null,
  };
}

/** Everything the morning briefing shows, as data. Rendering to text lives in render.ts. */
export function buildBriefing(
  template: VrataTemplate,
  enrollment: Enrollment,
  progress: Progress,
  today: DateInput,
): Briefing {
  const date = toLocalDate(today, enrollment.timezone);
  const dayNumber = getDayNumber(enrollment.start_date, date, enrollment.timezone);
  const order = (c: Category) => template.category_order.indexOf(c);
  const active = getActiveRules(template, enrollment);

  const morning = active.filter((r) => r.category === 'morning').map((r) => toBriefingRule(template, r));
  const allDay = active
    .filter((r) => r.category !== 'morning')
    .map((r, i) => ({ r, i }))
    .sort((a, b) => order(a.r.category) - order(b.r.category) || a.i - b.i)
    .map((x) => toBriefingRule(template, x.r));

  let status: Briefing['status'] = 'active';
  if (progress.is_complete) status = 'complete';
  else if (dayNumber < 1) status = 'not_started';
  else if (dayNumber > template.duration_days) status = 'ended';

  const labels = new Map(template.rules.map((r) => [r.id, r.label]));
  const earlierFlags = Object.entries(progress.days)
    .filter(([d, e]) => d < date && e.flags.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, e]) => ({ date: d, rules: e.flags.map((id) => labels.get(id) ?? id) }));

  const special = template.special_days[`day_${dayNumber}`];
  const doneActions = progress.special_actions_done[`day_${dayNumber}`] ?? {};

  return {
    status,
    date,
    devotee_name: enrollment.devotee.name,
    temple: { name: template.temple.name, city: template.temple.city },
    day_number: dayNumber,
    duration_days: template.duration_days,
    days_left: Math.max(template.duration_days - dayNumber, 0),
    days_until_start: Math.max(diffDays(date, enrollment.start_date), 0),
    start_date: enrollment.start_date,
    morning,
    all_day: allDay,
    pradakshina: getPradakshinaStatus(template, enrollment, progress, date),
    special_day:
      status === 'active' && special
        ? { label: special.label, actions: special.actions.map((a) => ({ ...a, done: doneActions[a.id] === true })) }
        : null,
    earlier_flags: earlierFlags,
    missed_dates: status === 'active' ? getMissedDates(template, enrollment, progress, date) : [],
    planned_days: [...(enrollment.planned_pradakshina_days ?? [])].sort((a, b) => a - b),
    planned_today:
      status === 'active' && isPlannedDay(enrollment, dayNumber) && !progress.pradakshina_dates.includes(date),
    missed_planned_days: status === 'active' ? getMissedPlannedDays(enrollment, progress, date) : [],
    no_plan_warning:
      status === 'active' && !isPlannedDaysSet(enrollment) && dayNumber >= 8
        ? { days_remaining: Math.max(template.duration_days - dayNumber, 0) }
        : null,
  };
}
