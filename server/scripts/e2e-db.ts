// Prepares server/e2e.db for the Playwright run: a fresh file, the migrations
// and the demo seed. Playwright's webServer runs it right before the server
// starts, with DATABASE_URL set to e2e.db. It refuses any other database,
// because the seed deletes every row first.
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const E2E_DATABASE_URL = 'file:./e2e.db';

if (process.env.DATABASE_URL !== E2E_DATABASE_URL) {
  console.error(`e2e-db: DATABASE_URL must be ${E2E_DATABASE_URL}, got ${process.env.DATABASE_URL ?? 'nothing'}`);
  process.exit(1);
}

rmSync('e2e.db', { force: true });
rmSync('e2e.db-journal', { force: true });
execSync('npx prisma migrate deploy', { stdio: 'inherit' });
execSync('npx prisma db seed', { stdio: 'inherit' });
