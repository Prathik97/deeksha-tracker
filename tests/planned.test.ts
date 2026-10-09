import { describe, expect, it } from 'vitest';
import { buildBriefing } from '../core/briefing';
import {
  getMissedPlannedDays,
  isPlannedDay,
  isPlannedDaysSet,
  validatePlannedDays,
} from '../core/pradakshina';
import { renderBriefing } from '../core/render';
import { validateEnrollment } from '../core/validate';
import type { Enrollment } from '../core/types';
import { DAY, emptyProgress, realEnrollment, realTemplate } from './helpers';

const withPlan = (days?: number[]): Enrollment => {
  const e: Enrollment = { ...realEnrollment };
  if (days === undefined) delete e.planned_pradakshina_days;
  else e.planned_pradakshina_days = days;
  return e;
};
const planned = withPlan([3, 9, 10, 16]);
const briefing = (e: Enrollment, day: number, dates: string[] = []) =>
  buildBriefing(realTemplate, e, emptyProgress(dates), DAY(day));

describe('isPlannedDay / isPlannedDaysSet', () => {
  it('true on a planned day, false otherwise', () => {
    for (const n of [3, 9, 10, 16]) expect(isPlannedDay(planned, n)).toBe(true);
    for (const n of [1, 2, 4, 8, 11, 15]) expect(isPlannedDay(planned, n)).toBe(false);
  });
  it('false for an empty or absent plan', () => {
    expect(isPlannedDay(withPlan([]), 3)).toBe(false);
    expect(isPlannedDay(withPlan(undefined), 3)).toBe(false);
  });
  it('isPlannedDaysSet is false for [] or absent, true when days are chosen', () => {
    expect(isPlannedDaysSet(withPlan([]))).toBe(false);
    expect(isPlannedDaysSet(withPlan(undefined))).toBe(false);
    expect(isPlannedDaysSet(planned)).toBe(true);
  });
});

describe('getMissedPlannedDays', () => {
  it('is empty when all planned days are in the future', () => {
    expect(getMissedPlannedDays(planned, emptyProgress(), DAY(1))).toEqual([]);
    expect(getMissedPlannedDays(planned, emptyProgress(), DAY(2))).toEqual([]);
  });
  it('does not count today as missed', () => {
    expect(getMissedPlannedDays(planned, emptyProgress(), DAY(3))).toEqual([]);
  });
  it('returns planned days that passed with no session', () => {
    expect(getMissedPlannedDays(planned, emptyProgress(), DAY(4))).toEqual([3]);
    expect(getMissedPlannedDays(planned, emptyProgress(), DAY(11))).toEqual([3, 9, 10]);
  });
  it('ignores planned days that have a session logged', () => {
    expect(getMissedPlannedDays(planned, emptyProgress([DAY(3), DAY(9)]), DAY(11))).toEqual([10]);
  });
  it('a session on an unplanned day does not cover a missed planned day', () => {
    expect(getMissedPlannedDays(planned, emptyProgress([DAY(4)]), DAY(5))).toEqual([3]);
  });
  it('is empty when no plan is set', () => {
    expect(getMissedPlannedDays(withPlan([]), emptyProgress(), DAY(12))).toEqual([]);
  });
});

describe('validatePlannedDays', () => {
  it('accepts 4 distinct future days, including today', () => {
    expect(validatePlannedDays([1, 6, 11, 15], 1, 16)).toEqual([]);
    expect(validatePlannedDays([3, 9, 10, 16], 2, 16)).toEqual([]);
  });
  it('rejects the wrong count', () => {
    expect(validatePlannedDays([3, 9, 10], 1, 16)[0]).toMatch(/exactly 4/);
    expect(validatePlannedDays([3, 9, 10, 12, 16], 1, 16)[0]).toMatch(/exactly 4/);
  });
  it('rejects out-of-range, passed, duplicate and non-integer days', () => {
    expect(validatePlannedDays([0, 5, 6, 7], 1, 16).join()).toMatch(/outside 1-16/);
    expect(validatePlannedDays([5, 6, 7, 17], 1, 16).join()).toMatch(/outside 1-16/);
    expect(validatePlannedDays([2, 5, 6, 7], 3, 16).join()).toMatch(/Day 2 has already passed/);
    expect(validatePlannedDays([5, 5, 6, 7], 1, 16).join()).toMatch(/Duplicate day\(s\): 5/);
    expect(validatePlannedDays([5, 6.5, 7, 8], 1, 16).join()).toMatch(/not a whole number/);
    expect(validatePlannedDays([5, NaN, 7, 8], 1, 16).join()).toMatch(/not a whole number/);
  });
});

describe('enrollment schema: planned_pradakshina_days', () => {
  const v = (days: unknown) => validateEnrollment({ ...realEnrollment, planned_pradakshina_days: days }).valid;
  it('is optional', () => expect(validateEnrollment(withPlan(undefined)).valid).toBe(true));
  it('accepts [] and up to 4 days in 1-16', () => {
    expect(v([])).toBe(true);
    expect(v([4, 8, 12, 15])).toBe(true);
    expect(v([1, 16])).toBe(true);
  });
  it('rejects more than 4, out of range, non-integer and duplicates', () => {
    expect(v([1, 2, 3, 4, 5])).toBe(false);
    expect(v([0])).toBe(false);
    expect(v([17])).toBe(false);
    expect(v([1.5])).toBe(false);
    expect(v([3, 3])).toBe(false);
  });
});

describe('briefing: planned days', () => {
  it('sets planned_today on a planned day and renders the callout', () => {
    const b = briefing(planned, 3);
    expect(b.planned_today).toBe(true);
    expect(renderBriefing(b)).toContain('TODAY IS A PLANNED PRADAKSHINA DAY — 16 rounds at the temple');
  });
  it('does not set planned_today on other days or once the session is logged', () => {
    expect(briefing(planned, 4).planned_today).toBe(false);
    expect(briefing(planned, 3, [DAY(3)]).planned_today).toBe(false);
    expect(renderBriefing(briefing(planned, 4))).not.toContain('PLANNED PRADAKSHINA DAY');
  });
  it('lists the plan in the briefing', () => {
    expect(briefing(planned, 2).planned_days).toEqual([3, 9, 10, 16]);
    expect(renderBriefing(briefing(planned, 2))).toContain('Planned days: Day 3, Day 9, Day 10, Day 16');
    expect(renderBriefing(briefing(withPlan([]), 2))).toContain('Planned days: not set');
  });

  describe('missed planned day warning', () => {
    it('appears for each passed planned day with no session', () => {
      const b = briefing(planned, 11);
      expect(b.missed_planned_days).toEqual([3, 9, 10]);
      const out = renderBriefing(b);
      expect(out).toContain('Day 3 was a planned pradakshina day with no session logged. Reschedule or mark it done.');
      expect(out).toContain('Day 9 was a planned pradakshina day');
      expect(out).toContain('Day 10 was a planned pradakshina day');
    });
    it('does not appear when the session was logged or the day has not come yet', () => {
      expect(briefing(planned, 5, [DAY(3)]).missed_planned_days).toEqual([]);
      expect(renderBriefing(briefing(planned, 2))).not.toContain('was a planned pradakshina day');
    });
  });

  describe('no-plan warning', () => {
    it('does not appear before Day 8', () => {
      expect(briefing(withPlan([]), 7).no_plan_warning).toBeNull();
      expect(renderBriefing(briefing(withPlan([]), 7))).not.toContain("haven't picked");
    });
    it('appears from Day 8 when the plan is empty or absent', () => {
      for (const e of [withPlan([]), withPlan(undefined)]) {
        const b = briefing(e, 8);
        expect(b.no_plan_warning).toEqual({ days_remaining: 8 });
        expect(renderBriefing(b)).toContain("You haven't picked your 4 pradakshina days yet and only 8 days remain. Set them now.");
      }
      expect(briefing(withPlan([]), 14).no_plan_warning).toEqual({ days_remaining: 2 });
    });
    it('does not appear once a plan is set', () => {
      expect(briefing(planned, 8).no_plan_warning).toBeNull();
    });
  });
});
