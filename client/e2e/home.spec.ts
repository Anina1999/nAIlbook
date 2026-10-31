import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { API_URL } from './ports';

// Other tests register manicurists in the same e2e.db, so these tests never hard-code
// how many cards there are: they read it from the counter.

const MARIA = 'Мария Петрова';

function carousel(page: Page) {
  return page.getByRole('region', { name: 'Маникюристи' });
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** «Показана 1 от 6» for one card in view, «Показани 1–3 от 6» for more. */
function shownText(start: number, perView: number, total: number): string {
  const end = Math.min(start + perView - 1, total);
  return start === end ? `Показана ${start} от ${total}` : `Показани ${start}–${end} от ${total}`;
}

/** Waits for the first view and reads the number of results and of cards in view from the counter. */
async function readCounter(page: Page): Promise<{ total: number; perView: number }> {
  const counter = carousel(page).getByRole('status');
  await expect(counter).toHaveText(/^Показан[аи] 1(–\d+)? от \d+$/);
  const [, last, total] = (await counter.textContent())!.match(/^Показан[аи] 1(?:–(\d+))? от (\d+)$/)!;
  return { total: Number(total), perView: last ? Number(last) : 1 };
}

/** The names on the cards, in the carousel's order (also the slides out of view). */
function cardNames(page: Page): Promise<string[]> {
  return carousel(page).getByRole('heading', { level: 3 }).allTextContents();
}

/** The card's name: a button stretched over the card, pressed on the active card. */
function cardButton(page: Page, name: string) {
  return carousel(page).getByRole('button', { name, exact: true });
}

function cardOf(page: Page, name: string) {
  // The inner locator is matched inside each article, so it starts from the page, not the region.
  return carousel(page)
    .getByRole('article')
    .filter({ has: page.getByRole('button', { name, exact: true }) });
}

function mapSection(page: Page) {
  return page.getByRole('region', { name: 'Студиа на картата' });
}

/** Every marker on the map: buttons named «<име> на картата». */
function markers(page: Page) {
  return mapSection(page).getByRole('button', { name: / на картата$/ });
}

function marker(page: Page, name: string) {
  return mapSection(page).getByRole('button', { name: `${name} на картата`, exact: true });
}

/** Asserts that `name` is the active card and its marker the active marker, and that `other` is not. */
async function expectActive(page: Page, name: string, other: string) {
  await expect(cardButton(page, name)).toHaveAttribute('aria-pressed', 'true');
  await expect(marker(page, name)).toHaveAttribute('aria-pressed', 'true');
  await expect(cardButton(page, other)).toHaveAttribute('aria-pressed', 'false');
  await expect(marker(page, other)).toHaveAttribute('aria-pressed', 'false');
}

test('«Запази час» on a card opens the manicurist at the free times, with the focus on them', async ({ page }) => {
  const res = await page.request.get(`${API_URL}/manicurists?city=${encodeURIComponent('София')}`);
  const { manicurists } = (await res.json()) as { manicurists: { id: number; name: string }[] };
  const maria = manicurists.find((m) => m.name === MARIA);
  expect(maria).toBeDefined();

  // Headless Chromium starts a smooth scroll late and runs it slowly, sometimes past the
  // timeout. Under reduced motion the scroll is instant, so the test checks where the page
  // lands and the focus, not the animation.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByLabel('Град').fill('София');
  await page.getByRole('button', { name: 'Търсене' }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('city') === 'София');

  await carousel(page).getByRole('link', { name: `Запази час при ${MARIA}`, exact: true }).click();

  await expect(page).toHaveURL((url) => url.pathname === `/manicurists/${maria!.id}` && url.hash === '#schedule');
  const schedule = page.getByRole('region', { name: 'Свободни часове' });
  await expect(schedule.getByRole('table')).toBeInViewport();
  await expect(schedule.getByRole('heading', { name: 'Свободни часове', exact: true })).toBeFocused();
});

test('the carousel moves with the arrows and the keyboard, goes round, and fits 375px', async ({ page }) => {
  await page.goto('/');
  const counter = carousel(page).getByRole('status');
  await expect(counter).toHaveText(/^Показан[аи] 1(–\d+)? от \d+$/);

  // The project's viewport sets how many cards are in view; the counter starts with them.
  const [, last, total] = (await counter.textContent())!.match(/^Показан[аи] 1(?:–(\d+))? от (\d+)$/)!;
  const count = Number(total);
  const perView = last ? Number(last) : 1;
  await expect(carousel(page).getByRole('article')).toHaveCount(count);
  expect(count).toBeGreaterThan(perView);

  const previous = carousel(page).getByRole('button', { name: 'Предишни' });
  const next = carousel(page).getByRole('button', { name: 'Следващи' });

  await next.click();
  await expect(counter).toHaveText(shownText(2, perView, count));
  await previous.click();
  await expect(counter).toHaveText(shownText(1, perView, count));

  // The arrow keys move it too, while the carousel is on screen (Swiper's Keyboard module
  // checks that) and no field has the focus.
  await carousel(page).scrollIntoViewIfNeeded();
  await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText(shownText(2, perView, count));
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText(shownText(1, perView, count));

  // From the last view, «Следващи» goes back to the first cards.
  for (let start = 2; start <= count - perView + 1; start++) {
    await next.click();
    await expect(counter).toHaveText(shownText(start, perView, count));
  }
  await next.click();
  await expect(counter).toHaveText(shownText(1, perView, count));

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(counter).toHaveText(shownText(1, 1, count));
  expect(await horizontalOverflow(page)).toBe(0);
});

test('the map has a marker for every result, and the first card and its marker start active', async ({ page }) => {
  await page.goto('/');
  const { total } = await readCounter(page);
  const names = await cardNames(page);
  expect(names).toHaveLength(total);

  await expect(markers(page)).toHaveCount(total);
  for (const name of names) await expect(marker(page, name)).toHaveCount(1);
  await expectActive(page, names[0], names[1]);
});

test('a click on a card makes it and its marker active, and the URL stays the same', async ({ page }) => {
  // A click can change the active card only while more than one card is in view: with one,
  // the card in view is always the active one.
  await page.setViewportSize({ width: 1280, height: 900 });
  const service = 'Гел лак';
  const res = await page.request.get(`${API_URL}/manicurists?service=${encodeURIComponent(service)}`);
  const { manicurists } = (await res.json()) as { manicurists: { name: string; city: string }[] };
  expect(manicurists.length).toBeGreaterThan(1);
  const [first, second] = manicurists;

  await page.goto('/');
  await page.getByLabel('Услуга').fill(service);
  await page.getByRole('button', { name: 'Търсене' }).click();
  const onSearch = (url: URL) =>
    url.pathname === '/' && [...url.searchParams.keys()].join() === 'service' && url.searchParams.get('service') === service;
  await expect(page).toHaveURL(onSearch);
  await expect(cardButton(page, second.name)).toBeVisible();
  await expectActive(page, first.name, second.name);

  // The name button is stretched over the card, so a real click on the city text selects it.
  // A mouse click at the city's position, because the button covers the text on purpose.
  const city = cardOf(page, second.name).getByText(second.city, { exact: true });
  await city.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = await city.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expectActive(page, second.name, first.name);
  await expect(page).toHaveURL(onSearch);
});

test('choosing the marker of a card out of view makes that card active and brings it into view', async ({
  page,
}) => {
  await page.goto('/');
  const { total, perView } = await readCounter(page);
  expect(total).toBeGreaterThan(perView);
  const names = await cardNames(page);
  const lastName = names[names.length - 1];

  // Focus and Enter, not a mouse click: two studios in one city overlap at the zoom that
  // shows the whole country, so a click could land on the other one.
  const lastMarker = marker(page, lastName);
  await lastMarker.focus();
  await page.keyboard.press('Enter');

  await expectActive(page, lastName, names[0]);
  await expect(lastMarker).toBeFocused();
  // The view ends at the last card now; the counter says so too.
  await expect(carousel(page).getByRole('status')).toHaveText(shownText(total - perView + 1, perView, total));
  await carousel(page).scrollIntoViewIfNeeded();
  await expect(cardOf(page, lastName)).toBeInViewport({ ratio: 0.9 });
});

test('«Следващи» makes the second card and its marker active', async ({ page }) => {
  await page.goto('/');
  const { total, perView } = await readCounter(page);
  expect(total).toBeGreaterThan(perView);
  const names = await cardNames(page);

  await carousel(page).getByRole('button', { name: 'Следващи' }).click();

  await expect(carousel(page).getByRole('status')).toHaveText(shownText(2, perView, total));
  await expectActive(page, names[1], names[0]);
});

test('a new search starts with its first card and marker active', async ({ page }) => {
  const city = 'София';
  const res = await page.request.get(`${API_URL}/manicurists?city=${encodeURIComponent(city)}`);
  const { manicurists } = (await res.json()) as { manicurists: { name: string }[] };
  expect(manicurists.length).toBeGreaterThan(1);
  const [first, second] = manicurists;

  await page.goto('/');
  const { total, perView } = await readCounter(page);
  expect(total).toBeGreaterThan(perView);
  const names = await cardNames(page);
  await carousel(page).getByRole('button', { name: 'Следващи' }).click();
  await expectActive(page, names[1], names[0]);

  await page.getByLabel('Град').fill(city);
  await page.getByRole('button', { name: 'Търсене' }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('city') === city);

  await expect(carousel(page).getByRole('article')).toHaveCount(manicurists.length);
  await expect(markers(page)).toHaveCount(manicurists.length);
  await expect(carousel(page).getByRole('status')).toHaveText(/^Показан[аи] 1(–\d+)? от \d+$/);
  await expectActive(page, first.name, second.name);
});
