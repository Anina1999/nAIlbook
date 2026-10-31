import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures';
import { API_URL } from './ports';

// Every test makes its own manicurist (and client) through the API with a unique email,
// so the seed's days off and bookings never get in the way and a second run passes too.

const PASSWORD = 'parola123';

type ApiBooking = {
  id: number;
  startAt: string;
  endAt: string;
  status: 'BOOKED' | 'CANCELLED';
  cancelledBy: 'CLIENT' | 'MANICURIST' | null;
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

function uniqueEmail(tag: string, testInfo: TestInfo): string {
  return `e2e-days-off-${tag}-${testInfo.project.name}-${Date.now()}@example.com`;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function registerManicurist(request: APIRequestContext, testInfo: TestInfo) {
  const res = await request.post(`${API_URL}/auth/register`, {
    data: {
      role: 'MANICURIST',
      name: 'Деница Тестова',
      email: uniqueEmail('manicurist', testInfo),
      password: PASSWORD,
      city: 'София',
      address: 'ул. „Тестова“ 1',
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { token: string; user: { id: number } };
}

async function registerClient(request: APIRequestContext, testInfo: TestInfo, name: string) {
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { role: 'CLIENT', name, email: uniqueEmail('client', testInfo), password: PASSWORD, phone: '0888 123 456' },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { token: string };
}

// --- Page helpers ---

function mainNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Основно меню' });
}

function listSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Предстоящи почивни дни' });
}

function formSection(page: Page): Locator {
  return page.getByRole('region', { name: 'Добави почивен ден' });
}

/** Logged in with a token from the API: the app reads it from localStorage at startup. */
async function logInWith(page: Page, token: string) {
  await page.addInitScript((value) => localStorage.setItem('nailbook.token', value), token);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('a manicurist opens days off from the header, adds a day and removes it', async ({ page, request }, testInfo) => {
  const { token } = await registerManicurist(request, testInfo);
  await logInWith(page, token);
  await page.goto('/');

  await mainNav(page).getByRole('link', { name: 'Почивни дни' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/days-off');
  await expect(page.getByRole('heading', { level: 1, name: 'Почивни дни' })).toBeVisible();
  await expect(mainNav(page).getByRole('link', { name: 'Почивни дни' })).toHaveAttribute('aria-current', 'page');
  await expect(listSection(page)).toContainText('Нямате планирани почивни дни.');

  const date = addDays(sofiaDate(new Date()), 10);
  const field = formSection(page).getByLabel('Дата');
  await field.fill(date);
  await formSection(page).getByRole('button', { name: 'Добави' }).click();

  await expect(formSection(page).getByRole('status')).toHaveText('Почивният ден е добавен.');
  await expect(field).toHaveValue('');
  await expect(listSection(page).getByRole('listitem')).toHaveText([new RegExp(longDate(date))]);
  expect(await horizontalOverflow(page)).toBe(0);

  await listSection(page).getByRole('button', { name: `Премахни ${longDate(date)}` }).click();
  await expect(listSection(page).getByRole('status')).toHaveText('Почивният ден е премахнат.');
  await expect(listSection(page)).toContainText('Нямате планирани почивни дни.');
  await expect(listSection(page).getByRole('listitem')).toHaveCount(0);
});

test('a day with a booking shows it, and after the booking is cancelled the day is marked', async ({
  page,
  request,
}, testInfo) => {
  const manicurist = await registerManicurist(request, testInfo);
  const manicuristAuth = auth(manicurist.token);

  // One service and every weekday 09:00–18:00, so tomorrow is a working day whatever today is.
  const created = await request.post(`${API_URL}/me/services`, {
    headers: manicuristAuth,
    data: { name: 'Гел лак', description: '', durationMin: 60, priceCents: 3500 },
  });
  expect(created.status()).toBe(201);
  const { service } = (await created.json()) as { service: { id: number } };
  const hours = await request.put(`${API_URL}/me/working-hours`, {
    headers: manicuristAuth,
    data: { workingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 540, endMin: 1080 })) },
  });
  expect(hours.status()).toBe(200);

  // A new client books the first free time tomorrow.
  const clientName = 'Калина Тестова';
  const client = await registerClient(request, testInfo, clientName);
  const date = addDays(sofiaDate(new Date()), 1);
  const slotsRes = await request.get(
    `${API_URL}/manicurists/${manicurist.user.id}/slots?serviceId=${service.id}&date=${date}`,
  );
  const { slots } = (await slotsRes.json()) as { slots: string[] };
  expect(slots.length).toBeGreaterThan(0);
  const booked = await request.post(`${API_URL}/bookings`, {
    headers: auth(client.token),
    data: { manicuristId: manicurist.user.id, serviceId: service.id, startAt: slots[0] },
  });
  expect(booked.status()).toBe(201);
  const { booking } = (await booked.json()) as { booking: ApiBooking };

  await logInWith(page, manicurist.token);
  await page.goto('/days-off');
  const field = formSection(page).getByLabel('Дата');
  await field.fill(date);
  const add = formSection(page).getByRole('button', { name: 'Добави' });
  await add.click();

  // The warning lists the booking with its time, service, client and phone.
  const conflict = formSection(page).getByRole('region', { name: `Часове на ${longDate(date)}` });
  const row = conflict.getByRole('listitem');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(`${sofiaClock(booking.startAt)}–${sofiaClock(booking.endAt)}`);
  await expect(row).toContainText('Гел лак');
  await expect(row).toContainText(clientName);
  await expect(row.getByRole('link', { name: '0888 123 456' })).toBeVisible();
  await expect(listSection(page).getByRole('listitem')).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBe(0);

  await row.getByRole('button', { name: 'Отмени часа' }).click();
  const reason = row.getByRole('textbox', { name: 'Причина за отмяната' });
  await expect(reason).toBeFocused();
  await reason.fill('Почивен ден');
  await row.getByRole('button', { name: 'Потвърди отмяната' }).click();

  await expect(conflict.getByRole('status')).toHaveText(
    'Всички часове на тази дата са отменени. Вече можете да отбележите деня като почивен.',
  );
  await expect(conflict.getByRole('listitem')).toHaveCount(0);
  await expect(field).toHaveValue(date);

  // «Добави» tries the same date again.
  await add.click();
  await expect(formSection(page).getByRole('status').first()).toHaveText('Почивният ден е добавен.');
  await expect(listSection(page).getByRole('listitem')).toHaveText([new RegExp(longDate(date))]);
  await expect(conflict).toHaveCount(0);

  // The client's booking is cancelled by the manicurist.
  const mine = await request.get(`${API_URL}/bookings/mine`, { headers: auth(client.token) });
  const { upcoming } = (await mine.json()) as { upcoming: ApiBooking[] };
  expect(upcoming.find((b) => b.id === booking.id)).toMatchObject({ status: 'CANCELLED', cancelledBy: 'MANICURIST' });
});

test('a client who opens days off is sent to the home page', async ({ page, request }, testInfo) => {
  const { token } = await registerClient(request, testInfo, 'Елица Тестова');
  await logInWith(page, token);
  await page.goto('/days-off');
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(mainNav(page).getByRole('link', { name: 'Почивни дни' })).toHaveCount(0);
});
