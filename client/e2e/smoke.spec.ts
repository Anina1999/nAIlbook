import { expect, test } from '@playwright/test';
import { API_URL } from './ports';

test('the home page opens', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'nAIlbook' })).toBeVisible();
});

test('the home page has no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('the API runs on the seeded E2E database', async ({ request }) => {
  const res = await request.get(`${API_URL}/manicurists`);

  expect(res.status()).toBe(200);
  // Other tests may register manicurists, so check for the seeded ones rather than an exact count.
  const { manicurists } = (await res.json()) as { manicurists: { name: string }[] };
  expect(manicurists.map((m) => m.name)).toEqual(
    expect.arrayContaining([
      'Мария Петрова',
      'Елена Георгиева',
      'Ива Димитрова',
      'Десислава Стоянова',
      'Габриела Николова',
    ]),
  );
});
