import { test as base } from '@playwright/test';

// No test calls the OpenStreetMap tile server: its policy forbids automated use, and CI
// must not depend on the network (testing skill, E2E, Local map tiles). Every spec file
// imports `test` and `expect` from here, never from '@playwright/test'.

/** A 1×1 PNG in the map's ground colour (#F2EFE9), built here so the repo holds no binary file. */
const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP49P4lAAWhAstl7N0JAAAAAElFTkSuQmCC',
  'base64',
);

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('https://tile.openstreetmap.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TILE }),
    );
    await use(page);
  },
});

export { expect } from '@playwright/test';
