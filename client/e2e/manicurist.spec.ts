import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { API_URL } from './ports';

// Both projects book on the same e2e.db in one run, so a test always takes the
// first free time and never asserts exact times or counts. The slot rules
// themselves are covered by the API tests.

const CLIENT = { email: 'client@example.com', password: 'nailbook123', name: 'Анна Иванова' };
const MARIA = 'Мария Петрова';
const SERVICE = /^Класически маникюр/;
/** 40 minutes, so a booking at a grid time ends off the grid. */
const PARAFFIN = /^Парафинова терапия за ръце/;
const PARAFFIN_MIN = 40;
/** A busy block's accessible name: «Заето 11:30–12:10». */
const BUSY = /^Заето \d{2}:\d{2}–\d{2}:\d{2}$/;

// --- Sofia dates, computed here on their own so the test does not reuse the app's helpers ---

const TZ = 'Europe/Sofia';

function sofiaToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** A `YYYY-MM-DD` date at 12:00 UTC, which is the same calendar day in Sofia. */
function noon(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function addDays(date: string, n: number): string {
  const next = noon(date);
  next.setUTCDate(next.getUTCDate() + n);
  return next.toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  return noon(date).getUTCDay();
}

/** The Monday of the week a date is in. */
function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** The first date from `from` on (inclusive) whose weekday is in `weekdays`. */
function firstOn(from: string, weekdays: number[]): string {
  let date = from;
  while (!weekdays.includes(weekdayOf(date))) date = addDays(date, 1);
  return date;
}

/** Today + 12 calendar months; a shorter month uses its last day (scheduling-engine). */
function limitDate(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

/** The seeded day off: Maria's first Wednesday on or after today + 7 days (server/prisma/seed.ts). */
function seededDayOff(today: string): string {
  return firstOn(addDays(today, 7), [3]);
}

/** «09:00» on the Sofia clock for a UTC ISO time. */
function sofiaClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
}

/** «12:10» → 730. */
function toMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

/** 730 → «12:10». */
function toClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** «вторник, 3 ноември 2026 г.», the start of a free time's accessible name and a column's full date. */
function longDate(date: string): string {
  return new Intl.DateTimeFormat('bg-BG', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(noon(date));
}

// --- Page helpers ---

function schedule(page: Page): Locator {
  return page.getByRole('region', { name: 'Свободни часове' });
}

/** The free times: buttons named «<full date>, HH:mm». */
function freeTimes(page: Page): Locator {
  return schedule(page).getByRole('button', { name: /, \d{2}:\d{2}$/ });
}

/** The free times of one date: their names start with its full date. */
function freeTimesOn(page: Page, date: string): Locator {
  const escaped = longDate(date).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return schedule(page).getByRole('button', { name: new RegExp(`^${escaped}, \\d{2}:\\d{2}$`) });
}

/** The «Заето» blocks of the shown week. */
function busyCells(page: Page): Locator {
  return schedule(page).getByRole('cell', { name: BUSY });
}

/** One «Заето» block by its times; the same times can be busy on more than one date. */
function busyCell(page: Page, from: string, to: string): Locator {
  return schedule(page).getByRole('cell', { name: `Заето ${from}–${to}`, exact: true });
}

function nextWeek(page: Page): Locator {
  return page.getByRole('button', { name: 'Следваща седмица' });
}

function previousWeek(page: Page): Locator {
  return page.getByRole('button', { name: 'Предишна седмица' });
}

function serviceRadios(page: Page): Locator {
  return page.getByRole('group', { name: 'Изберете услуга' }).getByRole('radio');
}

/**
 * Waits until the week on screen has loaded: the table is there and not busy, and the
 * status line no longer says «Зареждане…» (it may hold the empty-week message instead).
 * A week can have no free time at all, so this does not wait for one.
 */
async function weekLoaded(page: Page) {
  const table = schedule(page).getByRole('table');
  await expect(table).toBeVisible();
  await expect(table).toHaveAttribute('aria-busy', 'false');
  await expect(schedule(page).getByRole('status').filter({ hasText: 'Зареждане…' })).toHaveCount(0);
}

/** Goes on to the next week when the shown one has no free time left (late on the last working day). */
async function showWeekWithFreeTime(page: Page) {
  await weekLoaded(page);
  if ((await freeTimes(page).count()) === 0) await nextWeek(page).click();
  await expect(freeTimes(page).first()).toBeVisible();
}

async function mariaId(page: Page): Promise<number> {
  const res = await page.request.get(`${API_URL}/manicurists?city=${encodeURIComponent('София')}`);
  const { manicurists } = (await res.json()) as { manicurists: { id: number; name: string }[] };
  const maria = manicurists.find((m) => m.name === MARIA);
  expect(maria).toBeDefined();
  return maria!.id;
}

async function openMaria(page: Page, query = '') {
  await page.goto(`/manicurists/${await mariaId(page)}${query}`);
  await expect(page.getByRole('heading', { level: 1, name: MARIA })).toBeVisible();
}

/**
 * Picks a service. The radio's `checked` comes from the URL (`?service=`), so it
 * turns on after the router re-renders; `check()` would test it too early. Without
 * `?service` the first service is already checked, and clicking it changes nothing.
 */
async function pickService(page: Page, service: RegExp = SERVICE) {
  const radio = page.getByRole('radio', { name: service });
  await radio.click();
  await expect(radio).toBeChecked();
}

/** Presses Tab until `target` has the focus. A week has many free times, so the limit is high. */
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 200; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

type PackedDay = {
  date: string;
  /** The Sofia times of a busy block that ends off the grid, with a free start right after it. */
  from: string;
  to: string;
};

/**
 * A date of Maria's with a booking that ends off the 30-minute grid, is not followed
 * at once by another booking and leaves at least 40 minutes before the next booking or
 * the end of her hours, so «Парафинова терапия за ръце» is offered at its end. Read
 * from the API, so it holds whatever the other tests have booked. It starts tomorrow,
 * because a time later today could pass while the test runs.
 */
async function packedDay(page: Page): Promise<PackedDay> {
  const id = await mariaId(page);
  const res = await page.request.get(`${API_URL}/manicurists/${id}`);
  const { manicurist } = (await res.json()) as {
    manicurist: { workingHours: { weekday: number; startMin: number; endMin: number }[] };
  };
  for (let date = addDays(sofiaToday(), 1), i = 0; i < 60; date = addDays(date, 1), i++) {
    const hours = manicurist.workingHours.find((h) => h.weekday === weekdayOf(date));
    if (!hours) continue;
    const slots = await page.request.get(`${API_URL}/manicurists/${id}/slots?date=${date}`);
    const { busy } = (await slots.json()) as { busy: { startAt: string; endAt: string }[] };
    const blocks = busy.map((b) => ({ start: toMinutes(sofiaClock(b.startAt)), end: toMinutes(sofiaClock(b.endAt)) }));
    for (const block of blocks) {
      if (block.end % 30 === 0 || blocks.some((other) => other.start === block.end)) continue;
      const next = Math.min(hours.endMin, ...blocks.filter((o) => o.start > block.end).map((o) => o.start));
      if (next - block.end >= PARAFFIN_MIN) return { date, from: toClock(block.start), to: toClock(block.end) };
    }
  }
  throw new Error('No date with a booking that ends off the grid');
}

/**
 * The first free time X of the shown week whose date also offers X+30 and X+60, so
 * two 40-minute bookings at X and X+40 fit. Returns the date part of its name
 * («<full date>, ») and X, or null.
 */
async function backToBackStart(page: Page): Promise<{ prefix: string; time: string } | null> {
  await weekLoaded(page);
  const names = await freeTimes(page).evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  const offered = new Set(names);
  for (const name of names) {
    const prefix = name.slice(0, -5);
    const time = name.slice(-5);
    const minutes = toMinutes(time);
    if (offered.has(prefix + toClock(minutes + 30)) && offered.has(prefix + toClock(minutes + 60))) {
      return { prefix, time };
    }
  }
  return null;
}

test('a guest picks a time, logs in, comes back to the same service and week and books', async ({ page }) => {
  await page.goto('/');
  // «Запази час» is the only way from a card to the manicurist's page.
  await page.getByRole('link', { name: `Запази час при ${MARIA}`, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: MARIA })).toBeVisible();

  await pickService(page);
  await showWeekWithFreeTime(page);
  const weekTitle = await schedule(page).getByRole('heading', { level: 3 }).textContent();
  const bookingUrl = page.url();

  await freeTimes(page).first().click();
  await page.getByRole('button', { name: 'Запази час' }).click();

  await expect(page).toHaveURL((url) => url.pathname === '/login');
  await page.getByLabel('Имейл').fill(CLIENT.email);
  await page.getByLabel('Парола').fill(CLIENT.password);
  await page.getByRole('button', { name: 'Влез' }).click();

  // Back on the same service and week; the time is picked again.
  await expect(page).toHaveURL(bookingUrl);
  await expect(page.getByRole('radio', { name: SERVICE })).toBeChecked();
  await expect(schedule(page).getByRole('heading', { level: 3 })).toHaveText(weekTitle!);

  const slot = freeTimes(page).first();
  await expect(slot).toBeVisible();
  const name = (await slot.getAttribute('aria-label'))!;
  await slot.click();
  await page.getByRole('button', { name: 'Запази час' }).click();

  await expect(page.getByText('Часът е запазен.')).toBeVisible();
  await expect(schedule(page).getByRole('button', { name, exact: true })).toHaveCount(0);
});

test('the week table has only working days, the day off, no past times and stops at the limit', async ({ page }) => {
  const today = sofiaToday();

  // Without ?service the first service is chosen: its free times and the busy blocks show
  // at once, and the week still changes.
  const packed = await packedDay(page);
  await openMaria(page, `?week=${mondayOf(packed.date)}`);
  await expect(serviceRadios(page).first()).toBeChecked();
  await weekLoaded(page);
  await expect(busyCells(page).first()).toBeVisible();
  await expect(freeTimes(page).first()).toBeVisible();
  await nextWeek(page).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('week') === addDays(mondayOf(packed.date), 7));
  await weekLoaded(page);
  await expect(freeTimes(page).first()).toBeVisible();

  // The rest needs only some service, so the default one does.
  const withWeek = (monday: string) => `?week=${monday}`;

  // The day off's week: Monday to Friday columns, «Почивен ден» in the day off's column.
  const dayOff = seededDayOff(today);
  await openMaria(page, withWeek(mondayOf(dayOff)));
  await weekLoaded(page);
  await expect(page.getByRole('columnheader', { name: longDate(dayOff) })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /^(събота|неделя),/ })).toHaveCount(0);
  await expect(schedule(page).getByText('Почивен ден')).toBeVisible();
  await expect(freeTimesOn(page, dayOff)).toHaveCount(0);

  // The current week: a working day before today has no free time.
  await openMaria(page, withWeek(mondayOf(today)));
  await weekLoaded(page);
  if (weekdayOf(today) === 1) {
    await expect(previousWeek(page)).toBeDisabled();
  } else {
    // Monday is a working day and, when today is not Monday, always in the past.
    await expect(freeTimesOn(page, mondayOf(today))).toHaveCount(0);
  }

  // The week that holds the 12-month limit cannot go further.
  await openMaria(page, withWeek(mondayOf(limitDate(today))));
  await weekLoaded(page);
  await expect(nextWeek(page)).toBeDisabled();
  await expect(previousWeek(page)).toBeEnabled();
});

test('at 375px the page has no horizontal scroll and a time is booked with the keyboard alone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  // A packed week: the busy blocks fit too.
  const packed = await packedDay(page);
  await openMaria(page, `?week=${mondayOf(packed.date)}`);
  await weekLoaded(page);
  await expect(busyCells(page).first()).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);

  await openMaria(page);
  expect(await horizontalOverflow(page)).toBe(0);

  // Tab into the radio group (the first service is checked by default), Space keeps it,
  // an arrow moves to the next one.
  const radios = serviceRadios(page);
  await tabTo(page, radios.first());
  await page.keyboard.press('Space');
  await expect(radios.first()).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toBeChecked();
  await expect(radios.nth(1)).toBeFocused();

  await weekLoaded(page);
  if ((await freeTimes(page).count()) === 0) {
    await tabTo(page, nextWeek(page));
    await page.keyboard.press('Enter');
  }
  const slot = freeTimes(page).first();
  await expect(slot).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);

  await tabTo(page, slot);
  await page.keyboard.press('Space');
  await expect(slot).toHaveAttribute('aria-pressed', 'true');

  const book = page.getByRole('button', { name: 'Запази час' });
  await tabTo(page, book);
  expect(await horizontalOverflow(page)).toBe(0);
  await page.keyboard.press('Enter');

  // A guest is sent to log in.
  await expect(page).toHaveURL((url) => url.pathname === '/login');
});

test('a packed day shows its busy blocks and offers the time right after a booking that ends off the grid', async ({
  page,
}) => {
  const packed = await packedDay(page);
  await openMaria(page, `?week=${mondayOf(packed.date)}`);
  await pickService(page, PARAFFIN);
  await weekLoaded(page);

  await expect(busyCells(page).first()).toBeVisible();
  // The same times can be busy on another date of the week too.
  await expect(busyCell(page, packed.from, packed.to).first()).toBeVisible();
  await expect(
    schedule(page).getByRole('button', { name: `${longDate(packed.date)}, ${packed.to}`, exact: true }),
  ).toBeVisible();
});

test('a client books two 40-minute times back to back, the second one off the grid', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Имейл').fill(CLIENT.email);
  await page.getByLabel('Парола').fill(CLIENT.password);
  await page.getByRole('button', { name: 'Влез' }).click();
  await expect(page.getByText(CLIENT.name)).toBeVisible();

  await openMaria(page);
  // Logged in again after the reload, so «Запази час» books instead of going to login.
  await expect(page.getByText(CLIENT.name)).toBeVisible();
  await pickService(page, PARAFFIN);

  let start = await backToBackStart(page);
  if (!start) {
    await nextWeek(page).click();
    start = await backToBackStart(page);
  }
  expect(start).not.toBeNull();
  const { prefix, time } = start!;
  const second = toClock(toMinutes(time) + PARAFFIN_MIN);
  const end = toClock(toMinutes(time) + 2 * PARAFFIN_MIN);
  const timeButton = (clock: string) => schedule(page).getByRole('button', { name: prefix + clock, exact: true });

  // The same blocks may already be busy on another date, so count them before.
  const firstBefore = await busyCell(page, time, second).count();
  const secondBefore = await busyCell(page, second, end).count();

  await timeButton(time).click();
  await page.getByRole('button', { name: 'Запази час' }).click();
  await expect(page.getByText('Часът е запазен.')).toBeVisible();

  // The end of the booking, off the grid, is offered once the week has loaded again.
  await expect(timeButton(second)).toBeVisible();
  await timeButton(second).click();
  await expect(page.getByText('Часът е запазен.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Запази час' }).click();
  await expect(page.getByText('Часът е запазен.')).toBeVisible();

  await expect(busyCell(page, time, second)).toHaveCount(firstBefore + 1);
  await expect(busyCell(page, second, end)).toHaveCount(secondBefore + 1);
});

test('the page shows the studio on a map with exactly one marker, a picture with no action', async ({ page }) => {
  await openMaria(page);
  const map = page.getByRole('region', { name: 'Карта на студиото' });
  await expect(map).toBeVisible();

  await expect(map.getByRole('img', { name: `${MARIA} на картата`, exact: true })).toHaveCount(1);
  await expect(map.getByRole('img', { name: / на картата$/ })).toHaveCount(1);
  // Without an action the marker is not a button.
  await expect(map.getByRole('button', { name: / на картата$/ })).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBe(0);
});
