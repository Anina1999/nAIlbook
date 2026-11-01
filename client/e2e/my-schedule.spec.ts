import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { contentOverflow, horizontalOverflow } from './layout';
import { API_URL } from './ports';

// Every test makes its own manicurist (and client) through the API with a unique email
// and name, so the seed's bookings never get in the way and a second run passes too.

const PASSWORD = 'parola123';
const SERVICE_NAME = 'Гел лак';
const CLIENT_NAME = 'Калина Тестова';
const CLIENT_PHONE = '0888 123 456';

type ApiBooking = {
  id: number;
  startAt: string;
  endAt: string;
};

// --- Sofia dates, computed here on their own so the test does not reuse the app's helpers ---

const TZ = 'Europe/Sofia';

function sofiaDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instant)
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

// --- API helpers ---

function unique(testInfo: TestInfo): string {
  return `${testInfo.project.name}-${Date.now()}`;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * A new manicurist with one service and every weekday 09:00–18:00, so tomorrow is a
 * working day whatever today is.
 */
async function createManicurist(request: APIRequestContext, testInfo: TestInfo) {
  const id = unique(testInfo);
  const res = await request.post(`${API_URL}/auth/register`, {
    data: {
      role: 'MANICURIST',
      // A unique name too: a manicurist with a service shows on `/`, where home.spec.ts
      // finds the cards and markers by name.
      name: `Галя Графикова ${id}`,
      email: `e2e-schedule-manicurist-${id}@example.com`,
      password: PASSWORD,
      city: 'София',
      address: 'ул. „Тестова“ 2',
    },
  });
  expect(res.status()).toBe(201);
  const { token, user } = (await res.json()) as { token: string; user: { id: number } };

  const created = await request.post(`${API_URL}/me/services`, {
    headers: auth(token),
    data: { name: SERVICE_NAME, description: '', durationMin: 60, priceCents: 3500 },
  });
  expect(created.status()).toBe(201);
  const { service } = (await created.json()) as { service: { id: number } };

  const hours = await request.put(`${API_URL}/me/working-hours`, {
    headers: auth(token),
    data: { workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 540, endMin: 1080 })) },
  });
  expect(hours.status()).toBe(200);

  return { token, id: user.id, serviceId: service.id };
}

async function registerClient(request: APIRequestContext, testInfo: TestInfo) {
  const res = await request.post(`${API_URL}/auth/register`, {
    data: {
      role: 'CLIENT',
      name: CLIENT_NAME,
      email: `e2e-schedule-client-${unique(testInfo)}@example.com`,
      password: PASSWORD,
      phone: CLIENT_PHONE,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { token: string };
}

/** The client books the first free time tomorrow with the manicurist's service. */
async function bookTomorrow(
  request: APIRequestContext,
  manicurist: { id: number; serviceId: number },
  clientToken: string,
): Promise<ApiBooking> {
  const date = addDays(sofiaDate(new Date()), 1);
  const slotsRes = await request.get(
    `${API_URL}/manicurists/${manicurist.id}/slots?serviceId=${manicurist.serviceId}&date=${date}`,
  );
  expect(slotsRes.status()).toBe(200);
  const { slots } = (await slotsRes.json()) as { slots: string[] };
  expect(slots.length).toBeGreaterThan(0);

  const booked = await request.post(`${API_URL}/bookings`, {
    headers: auth(clientToken),
    data: { manicuristId: manicurist.id, serviceId: manicurist.serviceId, startAt: slots[0] },
  });
  expect(booked.status()).toBe(201);
  return ((await booked.json()) as { booking: ApiBooking }).booking;
}

// --- Page helpers ---

function mainNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Основно меню' });
}

/** The shown day: the section named by its heading, the long date. */
function daySection(page: Page, date: string): Locator {
  return page.getByRole('region', { name: longDate(date) });
}

/** Logged in with a token from the API: the app reads it from localStorage at startup. */
async function logInWith(page: Page, token: string) {
  await page.addInitScript((value) => localStorage.setItem('nailbook.token', value), token);
}

test('a manicurist opens the schedule from the header and cancels a booking', async ({ page, request }, testInfo) => {
  const manicurist = await createManicurist(request, testInfo);
  const client = await registerClient(request, testInfo);
  const booking = await bookTomorrow(request, manicurist, client.token);
  const tomorrow = addDays(sofiaDate(new Date()), 1);

  await logInWith(page, manicurist.token);
  await page.goto('/');
  const scheduleLink = mainNav(page).getByRole('link', { name: 'Моят график' });
  await scheduleLink.click();
  await expect(page).toHaveURL((url) => url.pathname === '/schedule');
  await expect(page.getByRole('heading', { level: 1, name: 'Моят график' })).toBeVisible();
  await expect(scheduleLink).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Следващ ден' }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('date') === tomorrow);
  const day = daySection(page, tomorrow);
  await expect(day.getByRole('heading', { level: 2 })).toHaveText(longDate(tomorrow));

  const row = day.getByRole('listitem');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`${sofiaClock(booking.startAt)}–${sofiaClock(booking.endAt)}`);
  await expect(row).toContainText(SERVICE_NAME);
  await expect(row).toContainText('35,00 €');
  await expect(row).toContainText(CLIENT_NAME);
  await expect(row.getByRole('link', { name: CLIENT_PHONE })).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await contentOverflow(page)).toBe(0);

  await row.getByRole('button', { name: 'Отмени часа' }).click();
  const reasonField = row.getByRole('textbox', { name: 'Причина за отмяната' });
  await expect(reasonField).toBeFocused();
  await reasonField.fill('Болест');
  await row.getByRole('button', { name: 'Потвърди отмяната' }).click();

  await expect(day.getByRole('status')).toHaveText('Часът е отменен.');
  await expect(day.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(row).toContainText('Отменен от вас.');
  await expect(row).toContainText('Причина: Болест');
  await expect(row.getByRole('button', { name: 'Отмени часа' })).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await contentOverflow(page)).toBe(0);
});

test('a booking the client cancelled shows who cancelled it and why', async ({ page, request }, testInfo) => {
  const manicurist = await createManicurist(request, testInfo);
  const client = await registerClient(request, testInfo);
  const booking = await bookTomorrow(request, manicurist, client.token);
  const cancelled = await request.patch(`${API_URL}/bookings/${booking.id}/cancel`, {
    headers: auth(client.token),
    data: { reason: 'Пътувам' },
  });
  expect(cancelled.status()).toBe(200);
  const tomorrow = addDays(sofiaDate(new Date()), 1);

  await logInWith(page, manicurist.token);
  await page.goto(`/schedule?date=${tomorrow}`);

  const row = daySection(page, tomorrow).getByRole('listitem');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Отменен');
  await expect(row).toContainText('Отменен от клиента.');
  await expect(row).toContainText('Причина: Пътувам');
  await expect(row.getByRole('button', { name: 'Отмени часа' })).toHaveCount(0);
});

test('a client who opens the schedule is sent to the home page', async ({ page, request }, testInfo) => {
  const { token } = await registerClient(request, testInfo);
  await logInWith(page, token);
  await page.goto('/schedule');
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(mainNav(page).getByRole('link', { name: 'Моят график' })).toHaveCount(0);
});
