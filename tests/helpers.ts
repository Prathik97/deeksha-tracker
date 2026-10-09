import template from '../data/templates/karya-siddhi-anjaneya-16day.json';
import enrollment from '../data/devotees/user_001/enrollment.json';
import progress from '../data/devotees/user_001/progress.json';
import type { CheckinContext, Enrollment, Progress, VrataTemplate } from '../core/types';

export const realTemplate = template as unknown as VrataTemplate;
export const realEnrollment = enrollment as unknown as Enrollment;
export const realProgress = progress as unknown as Progress;

/** Start date 2026-10-09 (Day 1), Day 16 = 2026-10-24. */
export const DAY = (n: number): string => {
  const d = new Date(Date.UTC(2026, 9, 9 + n - 1));
  return d.toISOString().slice(0, 10);
};

export function emptyProgress(pradakshinaDates: string[] = []): Progress {
  return {
    enrollment_id: realEnrollment.enrollment_id,
    is_complete: false,
    pradakshina_dates: pradakshinaDates,
    special_actions_done: {},
    days: {},
  };
}

export function ctx(loggedAt = '2026-10-10T09:03:00+05:30'): CheckinContext {
  return { template: realTemplate, enrollment: realEnrollment, loggedAt };
}

/** Answers that satisfy every active rule with `true`. */
export const allYes = {
  morning_bath: true,
  mantra_108: true,
  sankalpa_mind: true,
  orange_thread: true,
  vegetarian: true,
  no_alcohol: true,
  no_tobacco: true,
  no_harsh_speech: true,
  celibacy: true,
} as const;
