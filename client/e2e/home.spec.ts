import { expect, test, type Page } from '@playwright/test';
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
