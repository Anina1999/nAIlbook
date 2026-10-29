import { expect, test, type Page } from '@playwright/test';
import { API_URL } from './ports';

// Other tests register manicurists in the same e2e.db, so these tests look for
// the seeded names and never count the results.

function cardTitle(page: Page, name: string) {
  return page.getByRole('heading', { name, exact: true });
}

function hasSearch(params: Record<string, string>) {
  return (url: URL) =>
    url.pathname === '/' &&
    [...url.searchParams.keys()].length === Object.keys(params).length &&
    Object.entries(params).every(([key, value]) => url.searchParams.get(key) === value);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('a search by city and service is kept in the URL and after a reload', async ({ page, request }) => {
  const res = await request.get(`${API_URL}/manicurists?city=${encodeURIComponent('Пловдив')}`);
  const { manicurists } = (await res.json()) as { manicurists: { id: number; name: string }[] };
  const iva = manicurists.find((m) => m.name === 'Ива Димитрова');
  expect(iva).toBeDefined();

  await page.goto('/');
  await page.getByLabel('Град').fill('Пловдив');
  await page.getByLabel('Услуга').fill('Педикюр');
  await page.getByRole('button', { name: 'Търсене' }).click();

  await expect(page).toHaveURL(hasSearch({ city: 'Пловдив', service: 'Педикюр' }));
  await expect(cardTitle(page, 'Ива Димитрова')).toBeVisible();
  await expect(cardTitle(page, 'Мария Петрова')).toHaveCount(0);
  await expect(cardTitle(page, 'Елена Георгиева')).toHaveCount(0);

  await page.reload();

  await expect(page.getByLabel('Град')).toHaveValue('Пловдив');
  await expect(page.getByLabel('Услуга')).toHaveValue('Педикюр');
  await expect(cardTitle(page, 'Ива Димитрова')).toBeVisible();
  await expect(cardTitle(page, 'Мария Петрова')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ива Димитрова' })).toHaveAttribute(
    'href',
    `/manicurists/${iva!.id}`,
  );

  const card = page.getByRole('article').filter({ has: cardTitle(page, 'Ива Димитрова') });
  // Prices always carry their cents; the exact seeded prices are not this test's concern.
  await expect(card.getByText(/^\d+,\d{2} €$/).first()).toBeVisible();

  // The name link is stretched over the card, so a real click on the city text opens the page too.
  // A mouse click at the city's position is used, because the link covers the text on purpose.
  const cityBox = await card.getByText('Пловдив', { exact: true }).boundingBox();
  expect(cityBox).not.toBeNull();
  await page.mouse.click(cityBox!.x + cityBox!.width / 2, cityBox!.y + cityBox!.height / 2);
  await expect(page).toHaveURL((url) => url.pathname === `/manicurists/${iva!.id}`);
});

test('a search with no result offers to clear it and the cleared search shows the manicurists', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Град').fill('Атлантида');
  await page.getByRole('button', { name: 'Търсене' }).click();

  await expect(page.getByText('Не са открити маникюристи в град „Атлантида“.')).toBeVisible();
  await page.getByRole('link', { name: 'Изчистете търсенето' }).click();

  await expect(page).toHaveURL(hasSearch({}));
  await expect(page.getByLabel('Град')).toHaveValue('');
  await expect(cardTitle(page, 'Мария Петрова')).toBeVisible();
  await expect(cardTitle(page, 'Ива Димитрова')).toBeVisible();
});

test('at 375px the search has no horizontal scroll and works with the keyboard alone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(cardTitle(page, 'Мария Петрова')).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);

  const city = page.getByLabel('Град');
  for (let i = 0; i < 10; i++) {
    if (await city.evaluate((el) => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(city).toBeFocused();

  await page.keyboard.type('Велико Търново');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Услуга')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Търсене' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(hasSearch({ city: 'Велико Търново' }));
  await expect(cardTitle(page, 'Габриела Николова')).toBeVisible();
  await expect(cardTitle(page, 'Мария Петрова')).toHaveCount(0);
  expect(await horizontalOverflow(page)).toBe(0);
});
