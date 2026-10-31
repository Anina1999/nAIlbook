import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { contentOverflow, horizontalOverflow } from './layout';
import { API_URL } from './ports';

const CLIENT = { email: 'client@example.com', password: 'nailbook123', name: 'Анна Иванова' };

function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Основно меню' });
}

function uniqueEmail(projectName: string) {
  return `e2e-${projectName}-${Date.now()}@example.com`;
}

const REQUIRED_NOTE = 'Полетата със * са задължителни.';

/**
 * «Име» by its accessible name. getByLabel matches the label's raw text, which also
 * holds the aria-hidden ` *`; the role query checks the name a screen reader hears.
 */
function nameField(page: Page) {
  return page.getByRole('textbox', { name: 'Име', exact: true });
}

/** Fills the fields every role has. The phone is not one of them: only a manicurist has it, and it is optional. */
async function fillContactFields(page: Page, fields: { name: string; email: string }) {
  await nameField(page).fill(fields.name);
  await page.getByLabel('Имейл').fill(fields.email);
  await page.getByLabel('Парола').fill('parola123');
}

async function logIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Имейл').fill(CLIENT.email);
  await page.getByLabel('Парола').fill(CLIENT.password);
  await page.getByRole('button', { name: 'Влез' }).click();
  await expect(mainNav(page).getByText(CLIENT.name)).toBeVisible();
}

test('a guest registers as a client without a phone field and sees their name in the menu', async ({
  page,
}, testInfo) => {
  await page.goto('/register');
  await expect(nameField(page)).toBeVisible();
  await expect(page.getByLabel('Телефон')).toHaveCount(0);

  await fillContactFields(page, { name: 'Мила Тестова', email: uniqueEmail(testInfo.project.name) });
  await page.getByRole('button', { name: 'Регистрирай се' }).click();

  await expect(mainNav(page).getByText('Мила Тестова')).toBeVisible();
});

test('a manicurist registers without a phone and sees their name in the menu', async ({ page }, testInfo) => {
  await page.goto('/register');
  await page.getByLabel('Маникюрист').check();
  await expect(page.getByLabel('Телефон')).toHaveValue('');
  await fillContactFields(page, { name: 'Нели Тестова', email: uniqueEmail(testInfo.project.name) });
  await page.getByLabel('Град').fill('София');
  await page.getByLabel('Адрес').fill('ул. Тестова 2');
  await page.getByRole('button', { name: 'Регистрирай се' }).click();

  await expect(mainNav(page).getByText('Нели Тестова')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('the required fields of /register are marked for screen readers and the optional ones are not', async ({
  page,
}) => {
  await page.goto('/register');
  await expect(nameField(page)).toHaveAttribute('aria-required', 'true');

  await page.getByLabel('Маникюрист').check();
  await expect(page.getByLabel('Град')).toHaveAttribute('aria-required', 'true');
  await expect(page.getByLabel('Телефон')).not.toHaveAttribute('aria-required');
  await expect(page.getByLabel('Описание')).not.toHaveAttribute('aria-required');
});

test('the required-fields note is on /register and not on /login', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByText(REQUIRED_NOTE)).toBeVisible();

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  await expect(page.getByText(REQUIRED_NOTE)).toHaveCount(0);
});

test('a manicurist without a city sees the error under «Град»', async ({ page }, testInfo) => {
  await page.goto('/register');
  await page.getByLabel('Маникюрист').check();
  await fillContactFields(page, { name: 'Вера Тестова', email: uniqueEmail(testInfo.project.name) });
  await page.getByLabel('Адрес').fill('ул. Тестова 1');
  await page.getByRole('button', { name: 'Регистрирай се' }).click();

  await expect(page.getByLabel('Град')).toHaveAccessibleDescription('Въведете град.');
});

test('a client logs in and stays logged in after a reload', async ({ page }) => {
  await logIn(page);

  await page.reload();

  await expect(mainNav(page).getByText(CLIENT.name)).toBeVisible();
});

test('a wrong password shows the server message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Имейл').fill(CLIENT.email);
  await page.getByLabel('Парола').fill('wrong-password');
  await page.getByRole('button', { name: 'Влез' }).click();

  await expect(page.getByRole('alert')).toContainText('Грешен имейл или парола.');
});

test('registering with a taken email shows the server message', async ({ page }) => {
  await page.goto('/register');
  await fillContactFields(page, { name: 'Анна Друга', email: CLIENT.email });
  await page.getByRole('button', { name: 'Регистрирай се' }).click();

  await expect(page.getByRole('alert')).toContainText('Този имейл вече е регистриран.');
});

test('logout returns the guest menu and revokes the token', async ({ page, request }) => {
  await logIn(page);
  const token = await page.evaluate(() => localStorage.getItem('nailbook.token'));
  expect(token).not.toBeNull();

  await mainNav(page).getByRole('button', { name: 'Изход' }).click();

  await expect(mainNav(page).getByRole('link', { name: 'Вход' })).toBeVisible();
  await expect(mainNav(page).getByRole('link', { name: 'Регистрация' })).toBeVisible();
  const res = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(401);
});

test('login works with the keyboard alone', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel('Имейл');
  await expect(email).toBeVisible();

  for (let i = 0; i < 10; i++) {
    if (await email.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(email).toBeFocused();

  await page.keyboard.type(CLIENT.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Парола')).toBeFocused();
  await page.keyboard.type(CLIENT.password);
  await page.keyboard.press('Enter');

  await expect(mainNav(page).getByText(CLIENT.name)).toBeVisible();
});

test('the login and register forms have no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await contentOverflow(page)).toBe(0);

  await page.goto('/register');
  await page.getByLabel('Маникюрист').check();
  await expect(page.getByLabel('Град')).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);
  expect(await contentOverflow(page)).toBe(0);
});
