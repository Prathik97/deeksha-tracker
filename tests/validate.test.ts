import { describe, expect, it } from 'vitest';
import { validateEnrollment, validateProgress, validateReferences, validateTemplate } from '../core/validate';
import { realEnrollment, realProgress, realTemplate } from './helpers';

const clone = <T>(o: T): T => structuredClone(o);

describe('validation — real data files pass', () => {
  it('template', () => expect(validateTemplate(realTemplate)).toEqual({ valid: true, errors: [] }));
  it('enrollment', () => expect(validateEnrollment(realEnrollment)).toEqual({ valid: true, errors: [] }));
  it('progress', () => expect(validateProgress(realProgress)).toEqual({ valid: true, errors: [] }));
  it('template + enrollment agree', () => expect(validateReferences(realTemplate, realEnrollment).valid).toBe(true));
});

describe('validation — invalid files fail', () => {
  it('template missing a required field', () => {
    const t = clone(realTemplate) as Partial<typeof realTemplate>;
    delete t.rules;
    const r = validateTemplate(t);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('rules');
  });
  it('template with an unknown category', () => {
    const t = clone(realTemplate);
    (t.rules[0] as { category: string }).category = 'evening';
    expect(validateTemplate(t).valid).toBe(false);
  });
  it('enrollment missing start_date', () => {
    const e = clone(realEnrollment) as Partial<typeof realEnrollment>;
    delete e.start_date;
    const r = validateEnrollment(e);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('start_date');
  });
  it('enrollment with a malformed date and time', () => {
    expect(validateEnrollment({ ...realEnrollment, start_date: '09-10-2026' }).valid).toBe(false);
    expect(validateEnrollment({ ...realEnrollment, reminder_time: '9am' }).valid).toBe(false);
  });
  it('progress missing a required field in a day entry', () => {
    const p = clone(realProgress);
    delete (p.days['2026-10-09'] as Partial<(typeof p.days)[string]>).logged_at;
    const r = validateProgress(p);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toContain('logged_at');
  });
  it('progress with a bad entry_status or extra field', () => {
    const p = clone(realProgress);
    (p.days['2026-10-09'] as { entry_status: string }).entry_status = 'early';
    expect(validateProgress(p).valid).toBe(false);
    expect(validateProgress({ ...realProgress, sessions_done: 1 }).valid).toBe(false);
  });
  it('progress with duplicate pradakshina dates', () => {
    expect(validateProgress({ ...realProgress, pradakshina_dates: ['2026-10-09', '2026-10-09'] }).valid).toBe(false);
  });
});

describe('validateReferences', () => {
  it('flags unknown method, rule override, version and template mismatches', () => {
    const e = { ...realEnrollment, pradakshina_method: 'daily', template_version: 2, template_id: 'other', rule_overrides: { ghost: false } };
    const r = validateReferences(realTemplate, e);
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(4);
  });
});
