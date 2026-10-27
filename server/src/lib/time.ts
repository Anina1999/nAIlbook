// Sofia time helpers. Rules: .claude/skills/scheduling-engine/SKILL.md (Time model).
// Dates are Sofia-local "YYYY-MM-DD" strings, times of day are minutes from
// local midnight, instants are UTC Dates. No fixed +2/+3 offsets, so the
// times stay right across daylight-saving changes. Inputs are assumed valid;
// the routes validate them with zod first.

const SOFIA = 'Europe/Sofia';
const DAY_MS = 86_400_000;

const sofiaFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: SOFIA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function sofiaParts(at: Date) {
  const parts = sofiaFormat.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

// Minutes Sofia is ahead of UTC at the given instant.
function sofiaOffsetMin(at: Date): number {
  const p = sofiaParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

function toDateString(utcMidnightMs: number): string {
  return new Date(utcMidnightMs).toISOString().slice(0, 10);
}

function parseDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  return toDateString(parseDate(date) + days * DAY_MS);
}

// The same day of the month `months` later, or the last day of that month
// when it is shorter (29 February becomes 28 February).
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const lastDayOfTarget = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return toDateString(Date.UTC(year, month - 1 + months, Math.min(day, lastDayOfTarget)));
}

// A Sofia date as a UTC range [from, to). Working hours end by midnight, so no
// booking from the day before reaches into it.
export function sofiaDayRange(date: string): { from: Date; to: Date } {
  return { from: sofiaToUtc(date, 0), to: sofiaToUtc(addDays(date, 1), 0) };
}

// 0 = Sunday, as in WorkingHours.weekday.
export function weekdayOf(date: string): number {
  return new Date(parseDate(date)).getUTCDay();
}

export function todayInSofia(now: Date): string {
  return utcToSofia(now).date;
}

export function utcToSofia(at: Date): { date: string; minutes: number } {
  const p = sofiaParts(at);
  return { date: toDateString(Date.UTC(p.year, p.month - 1, p.day)), minutes: p.hour * 60 + p.minute };
}

// A Sofia wall-clock time on a Sofia date, as a UTC instant. Tries the offsets
// in force a day before and a day after, and keeps those that give back the
// same wall-clock time. A time that occurs twice (autumn) takes the earlier
// instant; a time that does not exist (spring) moves forward by the gap.
export function sofiaToUtc(date: string, minutes: number): Date {
  const wallAsUtc = parseDate(date) + minutes * 60_000;
  const before = wallAsUtc - sofiaOffsetMin(new Date(wallAsUtc - DAY_MS)) * 60_000;
  const after = wallAsUtc - sofiaOffsetMin(new Date(wallAsUtc + DAY_MS)) * 60_000;

  const matches = [before, after].filter((utc) => {
    const local = utcToSofia(new Date(utc));
    return local.date === date && local.minutes === minutes;
  });
  return new Date(matches.length > 0 ? Math.min(...matches) : before);
}
