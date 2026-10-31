import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { contentOverflow, horizontalOverflow } from './layout';
import { API_URL } from './ports';

// The demo client's seed bookings are only read here, never cancelled. Other specs of
// the same run book times for the demo client too, so the default week is computed from
// the API, not assumed. The cancel flow uses a new client with a booking of its own.

const CLIENT = { email: 'client@example.com', password: 'nailbook123', name: 'Анна Иванова' };
const MARIA = 'Мария Петрова';
/** The seed's upcoming booking of the demo client: Maria, «Гел лак» (90 min), 11:00. */
const SEED_SERVICE = 'Гел лак';
const SEED_TIME = '11:00–12:30';
/** Maria works Monday to Friday (server/prisma/seed.ts). */
const MARIA_WEEKDAYS = [1, 2, 3, 4, 5];

type ApiBooking = {
  id: number;
  startAt: string;
  endAt: string;
  status: 'BOOKED' | 'CANCELLED';
  serviceName: string;
  manicurist: { id: number; name: string };
};

// --- Sofia dates, computed here on their own so the test does not reuse the app's helpers ---

const TZ = 'Europe/Sofia';

function sofiaDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function sofiaToday(): string {
  return sofiaDate(new Date());
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

/** The last date up to `from` (inclusive) whose weekday is in `weekdays`. */
function lastOn(from: string, weekdays: number[]): string {
  let date = from;
  while (!weekdays.includes(weekdayOf(date))) date = addDays(date, -1);
  return date;
}

/** «11:00» on the Sofia clock for a UTC ISO time. */
function sofiaClock(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(iso),
  );
}

/** «вторник, 3 ноември 2026 г.» */
function longDate(date: string): string {
  return new Intl.DateTimeFormat('bg-BG', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(noon(date));
}

/** «2 – 8 ноември 2026 г.», the title of the week that starts on `monday`. */
function weekTitle(monday: string): string {
  return new Intl.DateTimeFormat('bg-BG', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' }).formatRange(
    noon(monday),
    noon(addDays(monday, 6)),
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Page helpers ---

function mainNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Основно меню' });
}

function upcomingSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Предстоящи' });
}

function pastSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Минали' });
}

/** A booking on the board: its name starts with its full date and its time range. */
function bookingButton(page: Page, date: string, times: string): Locator {
  return upcomingSection(page).getByRole('button', { name: new RegExp(`^${escapeRegExp(`${longDate(date)}, ${times}`)}`) });
}

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Имейл').fill(CLIENT.email);
  await page.getByLabel('Парола').fill(CLIENT.password);
  await page.getByRole('button', { name: 'Влез' }).click();
  await expect(mainNav(page).getByText(CLIENT.name)).toBeVisible();
}

async function myBookings(request: APIRequestContext, token: string): Promise<{ upcoming: ApiBooking[]; past: ApiBooking[] }> {
  const res = await request.get(`${API_URL}/bookings/mine`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  return res.json();
}

test('the demo client sees the upcoming week and the past booking, and a booking selects its studio', async ({
  page,
  request,
}) => {
  await logIn(page);
  await mainNav(page).getByRole('link', { name: 'Моите часове' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/my-bookings');
  await expect(page.getByRole('heading', { level: 1, name: 'Моите часове' })).toBeVisible();

  // The default week is the week of the soonest upcoming BOOKED booking.
  const token = await page.evaluate(() => localStorage.getItem('nailbook.token'));
  expect(token).not.toBeNull();
  const { upcoming } = await myBookings(request, token!);
  const soonest = upcoming.find((booking) => booking.status === 'BOOKED');
  expect(soonest).toBeDefined();
  const defaultWeek = mondayOf(sofiaDate(new Date(soonest!.startAt)));
  await expect(upcomingSection(page).getByRole('heading', { level: 3, name: weekTitle(defaultWeek) })).toBeVisible();

  // The seed's 11:00 booking with Maria: in the default week on a fresh database; other
  // specs may have booked an earlier time for the demo client, so step on to its week.
  const seed = upcoming.find(
    (b) => b.manicurist.name === MARIA && b.serviceName === SEED_SERVICE && sofiaClock(b.startAt) === '11:00',
  );
  expect(seed).toBeDefined();
  const seedDate = sofiaDate(new Date(seed!.startAt));
  for (let week = defaultWeek; week < mondayOf(seedDate); week = addDays(week, 7)) {
    await upcomingSection(page).getByRole('button', { name: 'Следваща седмица' }).click();
  }
  await expect(upcomingSection(page).getByRole('heading', { level: 3, name: weekTitle(mondayOf(seedDate)) })).toBeVisible();

  const booking = bookingButton(page, seedDate, SEED_TIME);
  await expect(booking).toContainText(MARIA);
  await booking.click();
  await expect(booking).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: longDate(seedDate) })).toContainText(SEED_SERVICE);
  const marker = page
    .getByRole('region', { name: 'Карта на студиата' })
    .getByRole('button', { name: `${MARIA} на картата`, exact: true });
  await expect(marker).toHaveAttribute('aria-pressed', 'true');

  // The seed's past booking: Maria's last working day before today, «Класически маникюр».
  const pastDate = lastOn(addDays(sofiaToday(), -1), MARIA_WEEKDAYS);
  const pastRow = pastSection(page).getByRole('listitem').filter({ hasText: longDate(pastDate) });
  await expect(pastRow).toContainText('Класически маникюр');
  await expect(pastRow).toContainText(MARIA);
  await expect(pastSection(page).getByRole('button')).toHaveCount(0);

  expect(await horizontalOverflow(page)).toBe(0);
  expect(await contentOverflow(page)).toBe(0);
});

test('a client cancels an upcoming booking with a reason and it shows as cancelled', async ({
  page,
  request,
}, testInfo) => {
  const email = `e2e-my-bookings-${testInfo.project.name}-${Date.now()}@example.com`;
  const registered = await request.post(`${API_URL}/auth/register`, {
    data: { role: 'CLIENT', name: 'Вера Тестова', email, password: 'parola123' },
  });
  expect(registered.status()).toBe(201);
  const { token } = (await registered.json()) as { token: string };

  // A manicurist with no seed bookings (not Maria), and the first free time from tomorrow on.
  const list = await request.get(`${API_URL}/manicurists`);
  const { manicurists } = (await list.json()) as {
    manicurists: { id: number; name: string; services: { id: number }[] }[];
  };
  const manicurist = manicurists.find((m) => m.name !== MARIA && m.services.length > 0);
  expect(manicurist).toBeDefined();
  const serviceId = manicurist!.services[0].id;
  let startAt: string | undefined;
  for (let date = addDays(sofiaToday(), 1), i = 0; !startAt && i < 30; date = addDays(date, 1), i++) {
    const res = await request.get(`${API_URL}/manicurists/${manicurist!.id}/slots?serviceId=${serviceId}&date=${date}`);
    const { slots } = (await res.json()) as { slots: string[] };
    startAt = slots[0];
  }
  expect(startAt).toBeDefined();
  const booked = await request.post(`${API_URL}/bookings`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { manicuristId: manicurist!.id, serviceId, startAt },
  });
  expect(booked.status()).toBe(201);
  const { booking: created } = (await booked.json()) as { booking: ApiBooking };

  // Logged in as the new client: the app reads the token from localStorage at startup.
  await page.addInitScript((value) => localStorage.setItem('nailbook.token', value), token);
  await page.goto('/my-bookings');

  const date = sofiaDate(new Date(created.startAt));
  const booking = bookingButton(page, date, `${sofiaClock(created.startAt)}–${sofiaClock(created.endAt)}`);
  await booking.click();
  await expect(booking).toHaveAttribute('aria-pressed', 'true');

  const details = page.getByRole('region', { name: longDate(date) });
  await details.getByRole('button', { name: 'Отмени часа' }).click();
  const reason = details.getByRole('textbox', { name: 'Причина за отмяната' });
  await expect(reason).toBeFocused();
  await reason.fill('Промяна в плановете');
  await expect(details.getByText('19/200')).toBeVisible();
  await details.getByRole('button', { name: 'Потвърди отмяната' }).click();

  await expect(details.getByRole('status')).toHaveText('Часът е отменен.');
  await expect(booking).toContainText('Отменен');
  await expect(booking).toHaveAttribute('aria-pressed', 'true');
  await expect(details).toContainText('Отменен от вас.');
  await expect(details).toContainText('Причина: Промяна в плановете');
  await expect(details.getByRole('button', { name: 'Отмени часа' })).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await contentOverflow(page)).toBe(0);
});

test('a guest who opens my bookings is sent to login and comes back after it', async ({ page }) => {
  await page.goto('/my-bookings');
  await expect(page).toHaveURL((url) => url.pathname === '/login');

  await page.getByLabel('Имейл').fill(CLIENT.email);
  await page.getByLabel('Парола').fill(CLIENT.password);
  await page.getByRole('button', { name: 'Влез' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/my-bookings');
  await expect(page.getByRole('heading', { level: 1, name: 'Моите часове' })).toBeVisible();
});
