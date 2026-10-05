import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';

// Prisma 7 talks to SQLite through a driver adapter. DATABASE_URL is a
// "file:" URL relative to server/, the same path the Prisma CLI uses.
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
