import { describe, expect, it } from 'vitest';
import { addDays, sofiaToUtc, todayInSofia, utcToSofia, weekdayOf } from '../../src/lib/time.js';

// Sofia switches to summer time on 2026-03-29 (03:00 → 04:00 local, 01:00Z)
// and back on 2026-10-25 (04:00 → 03:00 local, 01:00Z).
const h = (hour: number, minute = 0) => hour * 60 + minute;

describe('sofiaToUtc', () => {
  it.each([
    ['2026-03-28', '2026-03-28T07:00:00.000Z'],
    ['2026-03-29', '2026-03-29T06:00:00.000Z'],
    ['2026-10-24', '2026-10-24T06:00:00.000Z'],
    ['2026-10-25', '2026-10-25T07:00:00.000Z'],
  ])('converts 09:00 on %s to %s', (date, utc) => {
    expect(sofiaToUtc(date, h(9)).toISOString()).toBe(utc);
  });

  it('moves a skipped local time forward (03:30 on 2026-03-29 is 04:30 summer time)', () => {
    expect(sofiaToUtc('2026-03-29', h(3, 30)).toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('takes the first occurrence of a repeated local time (03:30 on 2026-10-25)', () => {
    expect(sofiaToUtc('2026-10-25', h(3, 30)).toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('converts local midnight', () => {
    expect(sofiaToUtc('2026-10-25', 0).toISOString()).toBe('2026-10-24T21:00:00.000Z');
  });
});

describe('utcToSofia', () => {
  it.each([
    ['2026-03-28', h(9)],
    ['2026-03-29', h(9)],
    ['2026-10-24', h(9)],
    ['2026-10-25', h(9)],
    ['2026-10-25', h(17, 30)],
    ['2026-12-31', h(23, 30)],
  ])('gives back %s at minute %i after sofiaToUtc', (date, minutes) => {
    expect(utcToSofia(sofiaToUtc(date, minutes))).toEqual({ date, minutes });
  });

  it('maps both UTC instants of a repeated hour to the same local time', () => {
    const local = { date: '2026-10-25', minutes: h(3, 30) };
    expect(utcToSofia(new Date('2026-10-25T00:30:00Z'))).toEqual(local);
    expect(utcToSofia(new Date('2026-10-25T01:30:00Z'))).toEqual(local);
  });
});

describe('todayInSofia', () => {
  it.each([
    ['2026-10-24T20:59:00Z', '2026-10-24'],
    ['2026-10-24T21:30:00Z', '2026-10-25'],
    ['2026-03-28T21:59:00Z', '2026-03-28'],
    ['2026-03-28T22:30:00Z', '2026-03-29'],
    ['2026-12-31T22:00:00Z', '2027-01-01'],
  ])('at %s is %s', (now, date) => {
    expect(todayInSofia(new Date(now))).toBe(date);
  });
});

describe('weekdayOf', () => {
  it.each([
    ['2026-10-25', 0],
    ['2026-10-26', 1],
    ['2026-10-31', 6],
  ])('%s is weekday %i (0 = Sunday)', (date, weekday) => {
    expect(weekdayOf(date)).toBe(weekday);
  });
});

describe('addDays', () => {
  it.each([
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-10-24', 2, '2026-10-26'],
  ])('%s %i days is %s', (date, days, result) => {
    expect(addDays(date, days)).toBe(result);
  });
});
