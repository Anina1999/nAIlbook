import { defineConfig } from 'vitest/config';

// Test-only values, not secrets. test.db is ignored by the *.db rule in .gitignore.
export const TEST_DATABASE_URL = 'file:./test.db';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret',
    },
    globalSetup: ['tests/setup/global-setup.ts'],
    // All API test files share one SQLite file.
    fileParallelism: false,
  },
});
