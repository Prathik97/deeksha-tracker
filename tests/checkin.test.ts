import { describe, expect, it } from 'vitest';
import { applyCheckin, getMissedDates, getQuestions, parseAnswer, summarizeCheckin } from '../core/checkin';
import type { Progress } from '../core/types';
import { allYes, ctx, DAY, emptyProgress, realEnrollment, realProgress, realTemplate } from './helpers';

const deepFreeze = <T>(o: T): T => {
  Object.values(o as object).forEach((v) => typeof v === 'object' && v !== null && deepFreeze(v));
  return Object.freeze(o);
};

describe('applyCheckin', () => {
  it('stores a full on-time entry', () => {
    const next = applyCheckin(emptyProgress(), DAY(2), { rules: { ...allYes }, mantra_method: 'video' }, 'on_time', ctx());
    expect(next.days[DAY(2)]).toEqual({
      day_number: 2,
      entry_status: 'on_time',
      logged_at: '2026-10-10T09:03:00+05:30',
      rules_checked: allYes,
      flags: [],
      mantra_method: 'video',
      pradakshina_done: false,
      notes: '',
    });
  });

  it('is immutable: input is untouched and a new object is returned', () => {
    const input = deepFreeze(emptyProgress([DAY(1)]));
    const next = applyCheckin(input, DAY(2), { rules: { ...allYes }, pradakshina_done: true }, 'on_time', ctx());
    expect(next).not.toBe(input);
    expect(input.days).toEqual({});
    expect(input.pradakshina_dates).toEqual([DAY(1)]);
    expect(next.pradakshina_dates).toEqual([DAY(1), DAY(2)]);
  });

  describe('mandatory rules', () => {
    it('answered false -> appears in flags[] and does not block the check-in', () => {
      const next = applyCheckin(
        emptyProgress(),
        DAY(3),
        { rules: { ...allYes, vegetarian: false, no_alcohol: false } },
        'on_time',
        ctx(),
      );
      expect(next.days[DAY(3)].flags).toEqual(['vegetarian', 'no_alcohol']);
      expect(next.days[DAY(3)].rules_checked.vegetarian).toBe(false);
    });
    it('optional rule answered false is stored but not flagged', () => {
      const next = applyCheckin(emptyProgress(), DAY(3), { rules: { ...allYes, celibacy: false } }, 'on_time', ctx());
      expect(next.days[DAY(3)].flags).toEqual([]);
      expect(next.days[DAY(3)].rules_checked.celibacy).toBe(false);
    });
    it('skip (null) on a mandatory rule is rejected', () => {
      expect(() => applyCheckin(emptyProgress(), DAY(3), { rules: { vegetarian: null } }, 'on_time', ctx())).toThrow(/mandatory/);
    });
  });

  describe('optional rules', () => {
    it('skip -> null stored, not flagged', () => {
      const next = applyCheckin(emptyProgress(), DAY(3), { rules: { ...allYes, celibacy: null, no_harsh_speech: null } }, 'on_time', ctx());
      expect(next.days[DAY(3)].rules_checked.celibacy).toBeNull();
      expect(next.days[DAY(3)].rules_checked.no_harsh_speech).toBeNull();
      expect(next.days[DAY(3)].flags).toEqual([]);
    });
    it('rules not answered are stored as null', () => {
      const next = applyCheckin(emptyProgress(), DAY(3), { rules: { morning_bath: true } }, 'on_time', ctx());
      expect(next.days[DAY(3)].rules_checked.mantra_108).toBeNull();
    });
  });

  describe('disabled rules', () => {
    it('are not stored and cannot be answered', () => {
      const next = applyCheckin(emptyProgress(), DAY(3), { rules: { ...allYes } }, 'on_time', ctx());
      expect(Object.keys(next.days[DAY(3)].rules_checked)).not.toContain('no_onion');
      expect(Object.keys(next.days[DAY(3)].rules_checked)).not.toContain('no_tamasic_media');
      expect(() => applyCheckin(emptyProgress(), DAY(3), { rules: { no_onion: true } }, 'on_time', ctx())).toThrow(/disabled/);
    });
  });

  describe('back-fill', () => {
    it('late entry for yesterday stores entry_status "late" and the given logged_at', () => {
      const next = applyCheckin(
        emptyProgress(),
        DAY(2),
        { rules: { ...allYes } },
        'late',
        ctx('2026-10-11T09:05:00+05:30'),
      );
      expect(next.days[DAY(2)].entry_status).toBe('late');
      expect(next.days[DAY(2)].logged_at).toBe('2026-10-11T09:05:00+05:30');
      expect(next.days[DAY(2)].day_number).toBe(2);
    });
    it('completing an existing entry keeps its original status and logged_at', () => {
      const first = applyCheckin(emptyProgress(), DAY(2), { rules: { morning_bath: true } }, 'on_time', ctx('2026-10-10T09:00:00+05:30'));
      const second = applyCheckin(first, DAY(2), { rules: { mantra_108: true } }, 'late', ctx('2026-10-10T21:00:00+05:30'));
      expect(second.days[DAY(2)].entry_status).toBe('on_time');
      expect(second.days[DAY(2)].logged_at).toBe('2026-10-10T09:00:00+05:30');
      expect(second.days[DAY(2)].rules_checked.morning_bath).toBe(true);
      expect(second.days[DAY(2)].rules_checked.mantra_108).toBe(true);
    });
    it('getMissedDates lists days with no entry up to yesterday', () => {
      const p = applyCheckin(emptyProgress(), DAY(2), { rules: { ...allYes } }, 'on_time', ctx());
      expect(getMissedDates(realTemplate, realEnrollment, p, DAY(5))).toEqual([DAY(1), DAY(3), DAY(4)]);
      expect(getMissedDates(realTemplate, realEnrollment, p, DAY(1))).toEqual([]);
      expect(getMissedDates(realTemplate, realEnrollment, realProgress, DAY(2))).toEqual([]);
    });
  });

  describe('pradakshina', () => {
    it('done -> date added to pradakshina_dates (sorted, no duplicates)', () => {
      let p = applyCheckin(emptyProgress([DAY(5)]), DAY(2), { pradakshina_done: true }, 'on_time', ctx());
      p = applyCheckin(p, DAY(2), { pradakshina_done: true }, 'on_time', ctx());
      expect(p.pradakshina_dates).toEqual([DAY(2), DAY(5)]);
      expect(p.days[DAY(2)].pradakshina_done).toBe(true);
    });
    it('not done -> date not added', () => {
      const p = applyCheckin(emptyProgress(), DAY(2), { pradakshina_done: false }, 'on_time', ctx());
      expect(p.pradakshina_dates).toEqual([]);
    });
  });

  describe('completion', () => {
    const dayOf = (n: number) => DAY(n);
    it('Day 16 with all 4 sessions done -> is_complete true', () => {
      const prior = emptyProgress([dayOf(1), dayOf(5), dayOf(9)]);
      const next = applyCheckin(prior, dayOf(16), { rules: { ...allYes }, pradakshina_done: true }, 'on_time', ctx());
      expect(next.pradakshina_dates).toHaveLength(4);
      expect(next.is_complete).toBe(true);
    });
    it('Day 16 reached but sessions short -> is_complete false', () => {
      const prior = emptyProgress([dayOf(1), dayOf(5)]);
      const next = applyCheckin(prior, dayOf(16), { rules: { ...allYes }, pradakshina_done: true }, 'on_time', ctx());
      expect(next.pradakshina_dates).toHaveLength(3);
      expect(next.is_complete).toBe(false);
      const summary = summarizeCheckin(realTemplate, realEnrollment, next, dayOf(16));
      expect(summary).toMatchObject({ is_last_day: true, is_complete: false, pradakshina_done: 3, pradakshina_required: 4 });
    });
    it('a day before Day 16 never completes the deeksha', () => {
      const prior = emptyProgress([dayOf(1), dayOf(2), dayOf(3)]);
      const next = applyCheckin(prior, dayOf(15), { pradakshina_done: true }, 'on_time', ctx());
      expect(next.pradakshina_dates).toHaveLength(4);
      expect(next.is_complete).toBe(false);
    });
  });

  describe('day range', () => {
    it('rejects dates outside the vrata', () => {
      expect(() => applyCheckin(emptyProgress(), '2026-10-08', {}, 'on_time', ctx())).toThrow(/outside the vrata/);
      expect(() => applyCheckin(emptyProgress(), '2026-10-25', {}, 'on_time', ctx())).toThrow(/outside the vrata/);
    });
  });

  describe('special days', () => {
    it('stores Day 1 actions under special_actions_done.day_1', () => {
      const next = applyCheckin(emptyProgress(), DAY(1), { special_actions: { visit_temple: true, tie_thread: false } }, 'on_time', ctx());
      expect(next.special_actions_done.day_1).toEqual({ visit_temple: true, tie_thread: false });
    });
    it('rejects an unknown action', () => {
      expect(() => applyCheckin(emptyProgress(), DAY(1), { special_actions: { nope: true } }, 'on_time', ctx())).toThrow(/Unknown action/);
    });
  });
});

describe('getQuestions', () => {
  it('asks active rules in category order with mantra_method right after mantra_108', () => {
    const qs = getQuestions(realTemplate, realEnrollment, emptyProgress(), DAY(2));
    const ids = qs.map((q) => (q.kind === 'rule' ? q.rule_id : q.kind));
    expect(ids).toEqual([
      'morning_bath', 'mantra_108', 'mantra_method', 'sankalpa_mind',
      'orange_thread', 'vegetarian', 'no_alcohol', 'no_tobacco',
      'no_harsh_speech', 'celibacy', 'pradakshina',
    ]);
  });
  it('asks Day 1 special actions on Day 1 and none on Day 2', () => {
    expect(getQuestions(realTemplate, realEnrollment, emptyProgress(), DAY(1)).filter((q) => q.kind === 'special_action')).toHaveLength(5);
    expect(getQuestions(realTemplate, realEnrollment, emptyProgress(), DAY(2)).filter((q) => q.kind === 'special_action')).toHaveLength(0);
  });
  it('asks nothing for a fully answered day (real Day 1)', () => {
    expect(getQuestions(realTemplate, realEnrollment, realProgress, '2026-10-09')).toEqual([]);
  });
  it('asks only the still-null rules of a partial entry', () => {
    const partial: Progress = applyCheckin(emptyProgress(), DAY(2), { rules: { morning_bath: true } }, 'on_time', ctx());
    const qs = getQuestions(realTemplate, realEnrollment, partial, DAY(2));
    expect(qs.some((q) => q.kind === 'rule' && q.rule_id === 'morning_bath')).toBe(false);
    expect(qs.some((q) => q.kind === 'rule' && q.rule_id === 'mantra_108')).toBe(true);
  });
});

describe('parseAnswer', () => {
  it.each(['y', 'Y', 'yes', ' YES ', '1'])('%j -> true', (s) => expect(parseAnswer(s, true)).toBe(true));
  it.each(['n', 'no', 'No', '0'])('%j -> false', (s) => expect(parseAnswer(s, true)).toBe(false));
  it.each(['skip', 'na', 'NA'])('%j -> null for optional rules', (s) => expect(parseAnswer(s, false)).toBeNull());
  it.each(['skip', 'na'])('%j -> invalid for mandatory rules', (s) => expect(parseAnswer(s, true)).toBe('invalid'));
  it('anything else is invalid', () => expect(parseAnswer('maybe', false)).toBe('invalid'));
});
