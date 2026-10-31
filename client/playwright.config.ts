import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, CLIENT_PORT, CLIENT_URL } from './e2e/ports';

// E2E tests run against their own server and client with their own database
// (server/e2e.db, seeded before every run). See the testing skill, E2E.
export default defineConfig({
  testDir: 'e2e',
  // All tests share one seeded database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: CLIENT_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: [
    {
      // No .env and no watch: every setting comes from env below.
      command: 'npm run e2e:server',
      cwd: '../server',
      url: `${API_URL}/manicurists`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: 'file:./e2e.db',
        // Test-only value, not a secret.
        JWT_SECRET: 'e2e-secret',
        PORT: String(API_PORT),
        CLIENT_ORIGIN: CLIENT_URL,
        // The fake geocoder: E2E never calls Nominatim.
        GEOCODER: 'fake',
      },
    },
    {
      command: `npx vite --port ${CLIENT_PORT} --strictPort`,
      url: CLIENT_URL,
      reuseExistingServer: false,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
