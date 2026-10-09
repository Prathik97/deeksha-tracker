import { describe, expect, it } from 'vitest';
import { applyCheckin } from '../core/checkin';
import { buildGrid, shortDate, unansweredRules } from '../next-app/lib/view';
import { allYes, ctx, DAY, emptyProgress, realEnrollment, realProgress, realTemplate } from './helpers';

const plan = { ...realEnrollment, planned_pradakshina_days: [3, 9, 10, 16] };
const grid = (progress = realProgress, today = DAY(1), e = plan) => buildGrid(realTemplate, e, progress, today);

describe('shortDate', () => {
  it('formats YYYY-MM-DD as "Oct 11"', () => {
    expect(shortDate('2026-10-11')).toBe('Oct 11');
    expect(shortDate('2026-11-01')).toBe('Nov 1');
  });
});

describe('buildGrid', () => {
  it('has 16 cards with dates from the start date', () => {
    const g = grid();
    expect(g).toHaveLength(16);
    expect(g[0]).toMatchObject({ day_number: 1, date: '2026-10-09', label: 'Oct 9' });
    expect(g[15]).toMatchObject({ day_number: 16, date: '2026-10-24', label: 'Oct 24' });
  });
  it('Day 1 (logged, all answered) is completed and is today on Day 1', () => {
    expect(grid()[0]).toMatchObject({ state: 'completed', is_today: true, flagged: false });
  });
  it('when the date rolls over, Day 2 becomes today (open) and Day 1 stays completed', () => {
    const g = grid(realProgress, DAY(2));
    expect(g[0]).toMatchObject({ state: 'completed', is_today: false });
    expect(g[1]).toMatchObject({ state: 'open', is_today: true });
    expect(g[2].state).toBe('future');
  });
  it('past days with no entry are "missed"', () => {
    expect(grid(realProgress, DAY(4))[1].state).toBe('missed');
  });
  it('marks planned pradakshina days', () => {
    expect(grid().filter((d) => d.planned).map((d) => d.day_number)).toEqual([3, 9, 10, 16]);
  });
  it('a mandatory "no" flags the day', () => {
    const p = applyCheckin(emptyProgress(), DAY(2), { rules: { ...allYes, vegetarian: false } }, 'on_time', ctx());
    expect(grid(p, DAY(2))[1]).toMatchObject({ state: 'completed', flagged: true });
  });
  it('a mandatory rule left unanswered makes the day partial', () => {
    const p = applyCheckin(emptyProgress(), DAY(2), { rules: { morning_bath: true } }, 'on_time', ctx());
    expect(grid(p, DAY(2))[1].state).toBe('partial');
  });
});

describe('unansweredRules', () => {
  const rules = [
    { id: 'a', mandatory: true },
    { id: 'b', mandatory: false },
  ];
  it('skipped optional rules count as answered; null mandatory rules do not', () => {
    const entry = { rules_checked: { a: null, b: null } } as never;
    expect(unansweredRules(rules, entry).map((r) => r.id)).toEqual(['a']);
  });
  it('everything is unanswered when there is no entry', () => {
    expect(unansweredRules(rules, null)).toHaveLength(2);
  });
});
