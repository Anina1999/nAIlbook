import bcrypt from 'bcrypt';
import type { BookingStatus, CancelledBy } from '../../src/generated/prisma/enums.js';
import { nextWeekday, slotAt } from './dates.js';
import { prisma } from './db.js';

// The password of every user the factories create.
export const TEST_PASSWORD = 'password123';

// Low bcrypt cost keeps the tests fast. Hashed once and reused.
const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 4);

let seq = 0;
const nextEmail = (prefix: string) => `${prefix}${++seq}@example.com`;

type UserOverrides = { email?: string; name?: string; phone?: string };

export function createClient(overrides: UserOverrides = {}) {
  return prisma.user.create({
    data: {
      email: nextEmail('client'),
      name: 'Тест Клиент',
      phone: '0888000000',
      ...overrides,
      passwordHash,
      role: 'CLIENT',
    },
  });
}

type ManicuristOverrides = UserOverrides & { city?: string; address?: string; bio?: string };

// A manicurist ready to be booked: profile, Monday–Friday 09:00–18:00 and
// one 60-minute service. Returns the user with profile, hours and services.
export function createManicurist(overrides: ManicuristOverrides = {}) {
  const { city = 'София', address = 'ул. Тестова 1', bio = '', ...user } = overrides;
  return prisma.user.create({
    data: {
      email: nextEmail('manicurist'),
      name: 'Тест Маникюрист',
      phone: '0888111111',
      ...user,
      passwordHash,
      role: 'MANICURIST',
      profile: {
        create: {
          city,
          address,
          bio,
          workingHours: {
            create: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 18 * 60 })),
          },
          services: { create: { name: 'Класически маникюр', durationMin: 60, priceCents: 2500 } },
        },
      },
    },
    include: { profile: { include: { workingHours: true, services: true } } },
  });
}

type Manicurist = Awaited<ReturnType<typeof createManicurist>>;

type ServiceOverrides = {
  name?: string;
  description?: string | null;
  durationMin?: number;
  priceCents?: number;
  deletedAt?: Date;
};

// One more service of the manicurist: active, or removed when deletedAt is passed.
export function createService(manicurist: { id: number }, overrides: ServiceOverrides = {}) {
  return prisma.service.create({
    data: { name: 'Гел лак', durationMin: 90, priceCents: 4000, ...overrides, manicuristId: manicurist.id },
  });
}

type BookingOverrides = {
  startAt?: Date;
  status?: BookingStatus;
  cancelledBy?: CancelledBy;
  cancelReason?: string;
};

// A booking of the manicurist's first service, inserted directly without
// validation, so tests can set up past and cancelled bookings. The default
// start is next Monday at 10:00 Sofia time.
export function createBooking(
  client: { id: number },
  manicurist: Manicurist,
  overrides: BookingOverrides = {},
) {
  const service = manicurist.profile!.services[0];
  const { startAt = new Date(slotAt(nextWeekday(1), '10:00')), ...rest } = overrides;
  return prisma.booking.create({
    data: {
      clientId: client.id,
      manicuristId: manicurist.id,
      serviceId: service.id,
      serviceName: service.name,
      priceCents: service.priceCents,
      startAt,
      endAt: new Date(startAt.getTime() + service.durationMin * 60_000),
      ...rest,
    },
  });
}

// An active day off, or a removed one when deletedAt is passed.
export function createDayOff(manicurist: { id: number }, date: string, overrides: { deletedAt?: Date } = {}) {
  return prisma.dayOff.create({ data: { manicuristId: manicurist.id, date, ...overrides } });
}
