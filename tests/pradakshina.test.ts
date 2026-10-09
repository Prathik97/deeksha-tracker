import { describe, expect, it } from 'vitest';
import { getPradakshinaStatus, isPradakshinaSatisfied } from '../core/pradakshina';
import { DAY, emptyProgress, realEnrollment, realTemplate } from './helpers';

const sessions = (n: number) => Array.from({ length: n }, (_, i) => DAY(i + 1));
const status = (done: number, day: number) =>
  getPradakshinaStatus(realTemplate, realEnrollment, emptyProgress(sessions(done)), DAY(day));

describe('getPradakshinaStatus — four_days', () => {
  it.each([0, 1, 2, 3, 4])('%i sessions done -> remaining %i away from 4', (done) => {
    const s = status(done, 2);
    expect(s.done).toBe(done);
    expect(s.required).toBe(4);
    expect(s.remaining).toBe(4 - done);
    expect(s.rounds_per_session).toBe(16);
    expect(s.scope).toBe('vrata');
  });

  describe('no warning when on track', () => {
    it('Day 2 with 0 done', () => expect(status(0, 2).warning).toBeNull());
    it('Day 8 with 0 done (8 days left, 4 remaining)', () => expect(status(0, 8).warning).toBeNull());
    it('Day 12 with 1 done (4 days left, 3 remaining)', () => expect(status(1, 12).warning).toBeNull());
    it('Day 14 with 3 done (2 days left, 1 remaining)', () => expect(status(3, 14).warning).toBeNull());
    it('any day with all 4 done', () => {
      for (const day of [1, 8, 15, 16]) expect(status(4, day).warning).toBeNull();
    });
  });

  describe('urgent warning when days_left <= sessions_remaining', () => {
    it('Day 12 with 0 done: exactly at threshold (4 days left, 4 remaining)', () => {
      expect(status(0, 12).warning).toBe(
        'You have 4 pradakshina session(s) left and only 4 day(s) remaining. Plan your temple visits now.',
      );
    });
    it('Day 11 with 0 done: one day before threshold (5 left, 4 remaining) -> none', () => {
      expect(status(0, 11).warning).toBeNull();
    });
    it('Day 13 with 1 done (3 days left, 3 remaining)', () => {
      expect(status(1, 13).warning).toContain('3 pradakshina session(s) left and only 3 day(s)');
    });
    it('Day 14 with 2 done (2 days left, 2 remaining)', () => {
      expect(status(2, 14).warning).toContain('2 pradakshina session(s) left and only 2 day(s)');
    });
    it('Day 15 with 3 done (1 day left, 1 remaining)', () => {
      expect(status(3, 15).warning).toContain('1 pradakshina session(s) left and only 1 day(s)');
    });
    it('Day 16 with 3 done (0 days left, 1 remaining)', () => {
      expect(status(3, 16).warning).toContain('only 0 day(s) remaining');
    });
  });

  it('gives no warning outside the vrata', () => {
    expect(status(0, 17).warning).toBeNull();
    expect(getPradakshinaStatus(realTemplate, realEnrollment, emptyProgress(), '2026-10-01').warning).toBeNull();
  });

  it('does not report negative remaining if more sessions than required', () => {
    expect(status(5, 5).remaining).toBe(0);
  });
});

describe('getPradakshinaStatus — weekly_twice', () => {
  const weekly = { ...realEnrollment, pradakshina_method: 'weekly_twice' };
  const at = (dates: string[], day: number) => getPradakshinaStatus(realTemplate, weekly, emptyProgress(dates), DAY(day));

  it('counts only sessions in the current 7-day window', () => {
    const s = at([DAY(1), DAY(9)], 10);
    expect(s).toMatchObject({ scope: 'week', done: 1, required: 2, remaining: 1, rounds_per_session: 41 });
  });
  it('warns when days left in the week <= sessions needed', () => {
    expect(at([], 6).warning).toBe('You still need 2 pradakshina session(s) this week. Only 1 day(s) left in the week.');
    expect(at([], 5).warning).toContain('Only 2 day(s) left'); // threshold: 2 left, 2 needed
    expect(at([], 4).warning).toBeNull();
  });
  it('clamps the last window to the vrata end (days 15-16)', () => {
    expect(at([], 15).warning).toContain('Only 1 day(s) left in the week');
  });
});

describe('isPradakshinaSatisfied', () => {
  it('four_days needs 4 sessions', () => {
    expect(isPradakshinaSatisfied(realTemplate, realEnrollment, sessions(3))).toBe(false);
    expect(isPradakshinaSatisfied(realTemplate, realEnrollment, sessions(4))).toBe(true);
  });
});
