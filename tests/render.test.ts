import { describe, expect, it } from 'vitest';
import { buildBriefing } from '../core/briefing';
import { applyCheckin, summarizeCheckin } from '../core/checkin';
import { renderBriefing, renderEndMessage } from '../core/render';
import { allYes, ctx, DAY, emptyProgress, realEnrollment, realProgress, realTemplate } from './helpers';

const render = (progress = realProgress, day = 2) =>
  renderBriefing(buildBriefing(realTemplate, realEnrollment, progress, DAY(day)));

describe('buildBriefing', () => {
  it('returns structured data, not text', () => {
    const b = buildBriefing(realTemplate, realEnrollment, realProgress, DAY(2));
    expect(b).toMatchObject({ status: 'active', day_number: 2, days_left: 14, devotee_name: 'Prathik Kumar MP' });
    expect(b.morning.map((r) => r.id)).toEqual(['morning_bath', 'mantra_108', 'sankalpa_mind']);
    expect(b.all_day.map((r) => r.id)).not.toContain('no_onion');
    expect(b.morning[1].resource?.url).toContain('youtu.be');
    expect(b.pradakshina).toMatchObject({ done: 1, required: 4 });
  });
  it('reports non-active states', () => {
    expect(buildBriefing(realTemplate, realEnrollment, realProgress, '2026-10-05')).toMatchObject({ status: 'not_started', days_until_start: 4 });
    expect(buildBriefing(realTemplate, realEnrollment, realProgress, DAY(17)).status).toBe('ended');
    expect(buildBriefing(realTemplate, realEnrollment, { ...realProgress, is_complete: true }, DAY(16)).status).toBe('complete');
  });
  it('lists missed days and earlier flags', () => {
    const flagged = applyCheckin(emptyProgress(), DAY(2), { rules: { ...allYes, vegetarian: false } }, 'on_time', ctx());
    const b = buildBriefing(realTemplate, realEnrollment, flagged, DAY(4));
    expect(b.missed_dates).toEqual([DAY(1), DAY(3)]);
    expect(b.earlier_flags).toEqual([{ date: DAY(2), rules: ['Strictly vegetarian — no non-veg'] }]);
  });
});

describe('renderBriefing', () => {
  it('puts the video link inline directly under the mantra step, before the next step', () => {
    const lines = render().split('\n');
    const mantra = lines.findIndex((l) => l.includes('Chant Karya Siddhi Anjaneya Mantra 108 times'));
    const sankalpa = lines.findIndex((l) => l.includes('Hold your Sankalpa'));
    const url = lines.findIndex((l) => l.includes('https://youtu.be/mmkcfmbe8eI'));
    expect(mantra).toBeGreaterThan(-1);
    expect(url).toBeGreaterThan(mantra);
    expect(url).toBeLessThan(sankalpa);
    expect(lines.filter((l) => l.includes('youtu.be'))).toHaveLength(1);
  });
  it('shows no warning line when on track', () => {
    expect(render()).not.toContain('Plan your temple visits');
  });
  it('shows Day 1 special actions with done marks', () => {
    const out = render(realProgress, 1);
    expect(out).toContain('Day 1 — Starting actions');
    expect(out).toContain('[x] Visit temple');
  });
  it('renders short messages for non-active states', () => {
    expect(renderBriefing(buildBriefing(realTemplate, realEnrollment, realProgress, '2026-10-05'))).toBe('Deeksha starts in 4 day(s), on 2026-10-09.');
  });
});

describe('renderEndMessage', () => {
  it('normal day', () => {
    const p = applyCheckin(realProgress, DAY(2), { rules: { ...allYes } }, 'on_time', ctx());
    expect(renderEndMessage(summarizeCheckin(realTemplate, realEnrollment, p, DAY(2)))).toBe(
      'Day 2 logged. 14 days left. Pradakshinas: 1/4. Keep going.',
    );
  });
  it('adds a Flagged line for mandatory "no" answers', () => {
    const p = applyCheckin(realProgress, DAY(2), { rules: { ...allYes, no_tobacco: false } }, 'on_time', ctx());
    expect(renderEndMessage(summarizeCheckin(realTemplate, realEnrollment, p, DAY(2)))).toContain('Flagged: No cigarettes or tobacco.');
  });
  it('Day 16 complete', () => {
    const p = applyCheckin(emptyProgress([DAY(1), DAY(5), DAY(9)]), DAY(16), { pradakshina_done: true }, 'on_time', ctx());
    expect(renderEndMessage(summarizeCheckin(realTemplate, realEnrollment, p, DAY(16)))).toBe('Deeksha complete. 16 days done. Go untie the coconut.');
  });
  it('Day 16 with sessions short is not complete', () => {
    const p = applyCheckin(emptyProgress([DAY(1)]), DAY(16), { pradakshina_done: false }, 'on_time', ctx());
    expect(renderEndMessage(summarizeCheckin(realTemplate, realEnrollment, p, DAY(16)))).toContain('3 pradakshina session(s) missing');
  });
});
