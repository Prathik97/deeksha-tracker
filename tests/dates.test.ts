import { describe, expect, it } from 'vitest';
import { getDayNumber } from '../core/dates';

const START = '2026-10-09';
const TZ = 'Asia/Calcutta';

describe('getDayNumber', () => {
  it('is 0 the day before the start (before start)', () => {
    expect(getDayNumber(START, '2026-10-08', TZ)).toBe(0);
  });
  it('is negative further before the start', () => {
    expect(getDayNumber(START, '2026-10-01', TZ)).toBe(-7);
  });
  it('is 1 on the start date', () => {
    expect(getDayNumber(START, '2026-10-09', TZ)).toBe(1);
  });
  it('is 2 on the next day', () => {
    expect(getDayNumber(START, '2026-10-10', TZ)).toBe(2);
  });
  it('is 16 on the last day', () => {
    expect(getDayNumber(START, '2026-10-24', TZ)).toBe(16);
  });
  it('is 17 the day after the end (not clamped)', () => {
    expect(getDayNumber(START, '2026-10-25', TZ)).toBe(17);
  });

  describe('timezone rollover at midnight IST', () => {
    it('23:59:59 IST on Oct 9 is still Day 1', () => {
      expect(getDayNumber(START, new Date('2026-10-09T18:29:59Z'), TZ)).toBe(1);
    });
    it('00:00:00 IST on Oct 10 is Day 2', () => {
      expect(getDayNumber(START, new Date('2026-10-09T18:30:00Z'), TZ)).toBe(2);
    });
    it('00:00:00 IST on the start date is Day 1, one second earlier is Day 0', () => {
      expect(getDayNumber(START, new Date('2026-10-08T18:30:00Z'), TZ)).toBe(1);
      expect(getDayNumber(START, new Date('2026-10-08T18:29:59Z'), TZ)).toBe(0);
    });
    it('uses the enrollment timezone, not UTC: 02:00 IST Oct 10 is 20:30 UTC Oct 9', () => {
      expect(getDayNumber(START, new Date('2026-10-09T20:30:00Z'), TZ)).toBe(2);
      expect(getDayNumber(START, new Date('2026-10-09T20:30:00Z'), 'UTC')).toBe(1);
    });
  });

  it('rejects malformed date strings', () => {
    expect(() => getDayNumber(START, '10/10/2026', TZ)).toThrow();
  });
});
