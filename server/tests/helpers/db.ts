import { prisma } from '../../src/lib/prisma.js';

// The app's client. In tests DATABASE_URL points to test.db (vitest.config.ts).
export { prisma };

// Deletes all rows, child to parent. Add every new model here.
export async function resetDb() {
  await prisma.booking.deleteMany();
  await prisma.dayOff.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.service.deleteMany();
  await prisma.manicuristProfile.deleteMany();
  await prisma.user.deleteMany();
}
