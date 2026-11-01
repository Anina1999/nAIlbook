import type { Page } from '@playwright/test';

// No horizontal scroll at 375px takes both checks (testing skill, E2E): the layout clips
// sideways overflow (`overflow-x: clip` on `.app`), so the page's scroll width alone stays 0
// even when content runs off the screen.

/** How far the page scrolls sideways. */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * How far the header's and the main column's content reaches past the window's right edge.
 * Elements a widget places off-screen on purpose, inside a box that clips them, are left out:
 * - Swiper's `.swiper-wrapper` and everything in it: the carousel's slides out of view sit
 *   past the edge, clipped by `.swiper`. The carousel and its arrows are still checked.
 * - Leaflet's `.leaflet-pane`s and everything in them: the tiles and the markers sit in map
 *   coordinates far outside the map, clipped by `.leaflet-container`. The map box and its
 *   controls are still checked.
 */
export async function contentOverflow(page: Page) {
  return page.evaluate(() => {
    const elements = [...document.querySelectorAll('header *, main *')].filter(
      (element) => !element.closest('.swiper-wrapper, .leaflet-pane'),
    );
    const right = Math.max(...elements.map((element) => element.getBoundingClientRect().right));
    return Math.max(0, right - document.documentElement.clientWidth);
  });
}
