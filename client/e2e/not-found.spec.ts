import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { contentOverflow, horizontalOverflow } from './layout';
import { API_URL } from './ports';

// The 404 page and the server-down page. The server is "down" for the page only:
// `page.route` aborts every request the app sends to the API, while the test's own
// `request` fixture still reaches the server.

const NETWORK_ERROR_MESSAGE = 'Няма връзка със сървъра. Проверете връзката и опитайте отново.';
const PASSWORD = 'nailbook123';
/** Every request of the app to the E2E API. */
const API_ROUTES = `${API_URL}/**`;

async function expectNoOverflowAt375(page: Page) {
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await contentOverflow(page)).toBe(0);
}

async function takeApiDown(page: Page) {
  await page.route(API_ROUTES, (route) => route.abort('connectionrefused'));
}

test('an unknown path shows the 404 page inside the layout, with a link home', async ({ page }) => {
  await page.goto('/no-such-page');

  await expect(page.getByText('404', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Страницата не е намерена' })).toBeVisible();
  await expect(page.getByText('Адресът може да е сгрешен или страницата вече не съществува.')).toBeVisible();
  // Inside the layout: the header with the logo stays.
  await expect(page.getByRole('banner').getByRole('link', { name: 'nAIlbook — начало' })).toBeVisible();
  await expectNoOverflowAt375(page);

  await page.getByRole('link', { name: 'Към началната страница' }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(page.getByRole('heading', { level: 1, name: 'Намерете маникюрист във вашия град' })).toBeVisible();
});

test('with the server down, / shows only the message, and «Зареди отново» loads the page again', async ({ page }) => {
  await takeApiDown(page);
  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText(NETWORK_ERROR_MESSAGE);
  await expect(page.getByRole('button', { name: 'Зареди отново' })).toBeVisible();
  // No hero and no search: only the message and the button.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await expect(page.getByLabel('Град')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Търсене' })).toHaveCount(0);
  // The header stays.
  await expect(page.getByRole('banner').getByRole('link', { name: 'nAIlbook — начало' })).toBeVisible();
  await expectNoOverflowAt375(page);

  await page.unroute(API_ROUTES);
  await page.getByRole('button', { name: 'Зареди отново' }).click();

  await expect(page.getByLabel('Град')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Търсене' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Намерете маникюрист във вашия град' })).toBeVisible();
});

test('with the server down, a logged-in client on /my-bookings sees the message and keeps the token', async ({
  page,
  request,
}, testInfo) => {
  const registered = await request.post(`${API_URL}/auth/register`, {
    data: {
      role: 'CLIENT',
      name: 'Сия Тестова',
      email: `e2e-not-found-${testInfo.project.name}-${Date.now()}@example.com`,
      password: PASSWORD,
    },
  });
  expect(registered.status()).toBe(201);
  const { token } = (await registered.json()) as { token: string };
  // Logged in as the new client: the app reads the token from localStorage at startup.
  await page.addInitScript((value) => localStorage.setItem('nailbook.token', value), token);
  await takeApiDown(page);

  await page.goto('/my-bookings');

  await expect(page.getByRole('alert')).toHaveText(NETWORK_ERROR_MESSAGE);
  await expect(page.getByRole('button', { name: 'Зареди отново' })).toBeVisible();
  // /me never answered, so the user is not sent to /login and the token stays.
  await expect(page).toHaveURL((url) => url.pathname === '/my-bookings');
  expect(await page.evaluate(() => localStorage.getItem('nailbook.token'))).toBe(token);
  await expectNoOverflowAt375(page);
});
