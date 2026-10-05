import bcrypt from 'bcrypt';
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
