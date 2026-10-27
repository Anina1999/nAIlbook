import { describe, expect, it } from 'vitest';
import { addMonths } from '../../src/lib/time.js';
import { lastBookableDate, MAX_MONTHS_AHEAD } from '../../src/scheduling/intervals.js';

describe('addMonths', () => {
  it.each([
    ['2026-10-27', 1, '2026-11-27'],
    ['2026-10-27', 12, '2027-10-27'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-11-05', 14, '2028-01-05'],
    ['2026-10-27', 0, '2026-10-27'],
  ])('keeps the day of the month: %s + %i = %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected);
  });

  it.each([
    ['2026-01-31', 1, '2026-02-28'], // 2026 is not a leap year
    ['2028-01-31', 1, '2028-02-29'], // 2028 is a leap year
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-05-31', 1, '2026-06-30'],
    ['2026-12-31', 2, '2027-02-28'], // across a year end
    ['2026-10-31', 4, '2027-02-28'],
    ['2026-08-31', 12, '2027-08-31'], // the target month is long enough
  ])('uses the last day of a shorter month: %s + %i = %s', (date, months, expected) => {
    expect(addMonths(date, months)).toBe(expected);
  });

  it('turns 29 February into 28 February in a year that is not a leap year', () => {
    expect(addMonths('2028-02-29', 12)).toBe('2029-02-28');
    expect(addMonths('2028-02-29', 24)).toBe('2030-02-28');
  });

  it('keeps 29 February when the target year is a leap year', () => {
    expect(addMonths('2028-02-29', 48)).toBe('2032-02-29');
    expect(addMonths('2027-02-28', 12)).toBe('2028-02-28');
  });
});

describe('MAX_MONTHS_AHEAD', () => {
  it('is 12', () => {
    expect(MAX_MONTHS_AHEAD).toBe(12);
  });
});

// Sofia is UTC+2 in winter and UTC+3 in summer, so the Sofia date changes at
// 22:00Z in winter and at 21:00Z in summer.
describe('lastBookableDate', () => {
  it('is today in Sofia plus 12 months', () => {
    expect(lastBookableDate(new Date('2026-10-27T10:00:00.000Z'))).toBe('2027-10-27');
  });

  it('moves to the next day at Sofia midnight in winter, not at UTC midnight', () => {
    expect(lastBookableDate(new Date('2026-12-10T21:59:00.000Z'))).toBe('2027-12-10'); // 23:59 on the 10th
    expect(lastBookableDate(new Date('2026-12-10T22:00:00.000Z'))).toBe('2027-12-11'); // 00:00 on the 11th
  });

  it('moves to the next day at Sofia midnight in summer', () => {
    expect(lastBookableDate(new Date('2026-06-30T20:59:00.000Z'))).toBe('2027-06-30'); // 23:59 on 30 June
    expect(lastBookableDate(new Date('2026-06-30T21:00:00.000Z'))).toBe('2027-07-01'); // 00:00 on 1 July
  });

  it('does not use the UTC date when Sofia is already on the next day', () => {
    // 00:30 on 1 January in Sofia is still 31 December in UTC.
    expect(lastBookableDate(new Date('2026-12-31T22:30:00.000Z'))).toBe('2028-01-01');
  });

  it('turns 29 February into 28 February', () => {
    expect(lastBookableDate(new Date('2028-02-29T10:00:00.000Z'))).toBe('2029-02-28');
  });
});
