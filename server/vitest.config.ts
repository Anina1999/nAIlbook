import { defineConfig } from 'vitest/config';

// The test database, globalSetup and fileParallelism come with the Prisma setup.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
