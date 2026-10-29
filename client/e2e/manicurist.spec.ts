import { expect, test, type Locator, type Page } from '@playwright/test';
import { API_URL } from './ports';

// Both projects book on the same e2e.db in one run, so a test always takes the
// first free time and never asserts exact times or counts. The slot rules
// themselves are covered by the API tests.

const CLIENT = { email: 'client@example.com', password: 'nailbook123', name: 'Анна Иванова' };
const MARIA = 'Мария Петрова';
const SERVICE = /^Класически маникюр/;
const EMPTY_WEEK = 'Няма свободни часове през тази седмица. Изберете следваща седмица.';

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

function nextWeek(page: Page): Locator {
  return page.getByRole('button', { name: 'Следваща седмица' });
}

function previousWeek(page: Page): Locator {
  return page.getByRole('button', { name: 'Предишна седмица' });
}

function serviceRadios(page: Page): Locator {
  return page.getByRole('group', { name: 'Изберете услуга' }).getByRole('radio');
}

/** Waits until the week on screen has loaded: a free time or the empty message, and no «Зареждане…». */
async function weekLoaded(page: Page) {
  await expect(freeTimes(page).first().or(schedule(page).getByText(EMPTY_WEEK))).toBeVisible();
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
 * turns on after the router re-renders; `check()` would test it too early.
 */
async function pickService(page: Page) {
  const radio = page.getByRole('radio', { name: SERVICE });
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

test('a guest picks a time, logs in, comes back to the same service and week and books', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: MARIA }).click();
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
  await openMaria(page);
  await pickService(page);
  const serviceId = new URL(page.url()).searchParams.get('service');
  const withWeek = (monday: string) => `?service=${serviceId}&week=${monday}`;

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
  await openMaria(page);
  expect(await horizontalOverflow(page)).toBe(0);

  // Tab into the radio group, Space picks the first service, an arrow moves to the next one.
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
