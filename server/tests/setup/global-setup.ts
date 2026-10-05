import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { TEST_DATABASE_URL } from '../../vitest.config.js';

// Runs once per test run: a fresh test.db that matches the migrations.
export default function setup() {
  rmSync('test.db', { force: true });
  rmSync('test.db-journal', { force: true });
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
