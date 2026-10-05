import { afterAll, describe, expect, it } from 'vitest';
import { prisma, resetDb } from '../helpers/db.js';

afterAll(() => prisma.$disconnect());

describe('test database', () => {
  it('uses test.db, not the dev database', () => {
    expect(process.env.DATABASE_URL).toBe('file:./test.db');
  });

  it('resetDb() deletes the rows of every model', async () => {
    const manicurist = await prisma.user.create({
      data: {
        email: 'm@example.com',
        passwordHash: 'x',
        name: 'M',
        phone: '0',
        role: 'MANICURIST',
        profile: {
          create: {
            city: 'София',
            address: 'a',
            bio: 'b',
            services: { create: { name: 'S', durationMin: 60, priceCents: 2500 } },
            workingHours: { create: { weekday: 1, startMin: 540, endMin: 1080 } },
            daysOff: { create: { date: '2030-01-02' } },
          },
        },
      },
      include: { profile: { include: { services: true } } },
    });
    const client = await prisma.user.create({
      data: { email: 'c@example.com', passwordHash: 'x', name: 'C', phone: '0', role: 'CLIENT' },
    });
    const service = manicurist.profile!.services[0];
    await prisma.booking.create({
      data: {
        clientId: client.id,
        manicuristId: manicurist.id,
        serviceId: service.id,
        serviceName: service.name,
        priceCents: service.priceCents,
        startAt: new Date('2030-01-07T07:00:00Z'),
        endAt: new Date('2030-01-07T08:00:00Z'),
      },
    });

    await resetDb();

    const counts = await Promise.all([
      prisma.booking.count(),
      prisma.dayOff.count(),
      prisma.workingHours.count(),
      prisma.service.count(),
      prisma.manicuristProfile.count(),
      prisma.user.count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
