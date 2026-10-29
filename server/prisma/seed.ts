// Demo data: 5 manicurists in 3 cities, one client with a past booking, an
// upcoming one and a packed day of five back-to-back bookings with Maria (one
// ends at 12:10, so 12:10 is offered as a start), and one future day off. Dates
// are relative to today in Sofia, so the demo stays valid whenever it runs.
// Safe to run again: it clears all rows first.
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';
import { addDays, sofiaToUtc, todayInSofia, weekdayOf } from '../src/lib/time.js';

// Demo password for every account. It is also listed in the README.
const DEMO_PASSWORD = 'nailbook123';

// --- Date helpers ------------------------------------------------------------

// First date in [from, from + 13] whose weekday is in `weekdays`.
function firstDateOn(from: string, weekdays: number[]): string {
  for (let i = 0; i < 14; i++) {
    const date = addDays(from, i);
    if (weekdays.includes(weekdayOf(date))) return date;
  }
  throw new Error('No matching weekday');
}

// Last date in [from - 13, from] whose weekday is in `weekdays`.
function lastDateOn(from: string, weekdays: number[]): string {
  for (let i = 0; i < 14; i++) {
    const date = addDays(from, -i);
    if (weekdays.includes(weekdayOf(date))) return date;
  }
  throw new Error('No matching weekday');
}

const h = (hour: number, minute = 0) => hour * 60 + minute;

// --- Demo data ---------------------------------------------------------------

type ManicuristSeed = {
  name: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  bio: string;
  weekdays: number[];
  startMin: number;
  endMin: number;
  services: { name: string; description?: string; durationMin: number; priceCents: number }[];
};

const MON_FRI = [1, 2, 3, 4, 5];

const manicurists: ManicuristSeed[] = [
  {
    name: 'Мария Петрова',
    email: 'maria@example.com',
    phone: '0888 000 001',
    city: 'София',
    address: 'ул. „Примерна“ 12',
    bio: 'Класически и гел маникюр, 8 години опит.',
    weekdays: MON_FRI,
    startMin: h(9),
    endMin: h(18),
    services: [
      { name: 'Класически маникюр', durationMin: 60, priceCents: 2500 },
      { name: 'Гел лак', description: 'Включва оформяне и грижа за кожичките.', durationMin: 90, priceCents: 3500 },
      { name: 'Премахване на гел', durationMin: 30, priceCents: 1000 },
      { name: 'Педикюр', durationMin: 90, priceCents: 3500 },
      { name: 'Парафинова терапия за ръце', durationMin: 40, priceCents: 2000 },
      { name: 'Ноктопластика', durationMin: 180, priceCents: 6000 },
      { name: 'Смяна на дизайн / счупен нокът', durationMin: 30, priceCents: 1000 },
    ],
  },
  {
    name: 'Елена Георгиева',
    email: 'elena@example.com',
    phone: '0888 000 002',
    city: 'София',
    address: 'бул. „Демо“ 45',
    bio: 'Маникюр и нокътен дизайн.',
    weekdays: [2, 3, 4, 5, 6],
    startMin: h(10),
    endMin: h(19),
    services: [
      { name: 'Гел лак', durationMin: 60, priceCents: 3000 },
      { name: 'Ноктопластика', description: 'Изграждане с гел.', durationMin: 120, priceCents: 5500 },
    ],
  },
  {
    name: 'Ива Димитрова',
    email: 'iva@example.com',
    phone: '0888 000 003',
    city: 'Пловдив',
    address: 'ул. „Тестова“ 3',
    bio: 'Спокойна обстановка и качествени продукти.',
    weekdays: MON_FRI,
    startMin: h(8, 30),
    endMin: h(16, 30),
    services: [
      { name: 'Класически маникюр', durationMin: 60, priceCents: 2000 },
      { name: 'Гел лак', durationMin: 90, priceCents: 3000 },
      { name: 'Педикюр', durationMin: 60, priceCents: 3000 },
      { name: 'Премахване на гел', durationMin: 30, priceCents: 800 },
    ],
  },
  {
    name: 'Десислава Стоянова',
    email: 'desislava@example.com',
    phone: '0888 000 004',
    city: 'Пловдив',
    address: 'ул. „Образец“ 27',
    bio: 'Работя следобед, удобно след работа.',
    weekdays: [1, 3, 5],
    startMin: h(12),
    endMin: h(20),
    services: [
      { name: 'Гел лак', durationMin: 60, priceCents: 2800 },
      { name: 'Ноктопластика', durationMin: 150, priceCents: 5000 },
    ],
  },
  {
    name: 'Габриела Николова',
    email: 'gabriela@example.com',
    phone: '0888 000 005',
    city: 'Велико Търново',
    address: 'ул. „Демонстрационна“ 8',
    bio: 'Маникюр и педикюр в центъра на града.',
    weekdays: MON_FRI,
    startMin: h(9),
    endMin: h(17),
    services: [
      { name: 'Класически маникюр', durationMin: 60, priceCents: 1800 },
      { name: 'Педикюр', durationMin: 90, priceCents: 2800 },
    ],
  },
];

const client = {
  name: 'Анна Иванова',
  email: 'client@example.com',
  phone: '0888 000 100',
};

async function clearAll() {
  // Child-to-parent order, same as resetDb() in the tests.
  await prisma.booking.deleteMany();
  await prisma.dayOff.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.service.deleteMany();
  await prisma.manicuristProfile.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await clearAll();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const created = [];
  for (const m of manicurists) {
    const user = await prisma.user.create({
      data: {
        email: m.email,
        passwordHash,
        name: m.name,
        phone: m.phone,
        role: 'MANICURIST',
        profile: {
          create: {
            city: m.city,
            address: m.address,
            bio: m.bio,
            services: { create: m.services },
            workingHours: {
              create: m.weekdays.map((weekday) => ({ weekday, startMin: m.startMin, endMin: m.endMin })),
            },
          },
        },
      },
      include: { profile: { include: { services: true } } },
    });
    created.push({ seed: m, user, services: user.profile!.services });
  }

  const clientUser = await prisma.user.create({
    data: { ...client, passwordHash, role: 'CLIENT' },
  });

  // Maria: a day off on a Wednesday she normally works, 7–13 days ahead.
  const maria = created[0];
  const today = todayInSofia(new Date());
  const dayOff = firstDateOn(addDays(today, 7), [3]);
  await prisma.dayOff.create({ data: { manicuristId: maria.user.id, date: dayOff } });

  const service = (name: string) => {
    const found = maria.services.find((s) => s.name === name);
    if (!found) throw new Error(`Maria has no service ${name}`);
    return found;
  };

  // Past booking: Maria's last working day before today, 10:00, classic manicure.
  // Upcoming booking: her first working day at least 2 days ahead, 11:00, gel
  // polish. It stays the client's first upcoming booking with Maria.
  const pastDate = lastDateOn(addDays(today, -1), maria.seed.weekdays);
  const upcomingDate = firstDateOn(addDays(today, 2), maria.seed.weekdays);

  // Packed day: her first working day after the upcoming booking that is not
  // the day off. Each booking starts where the one before it ends, so the
  // 11:30 one (40 minutes) ends off the 30-minute grid, at 12:10.
  let packedDate = firstDateOn(addDays(upcomingDate, 1), maria.seed.weekdays);
  if (packedDate === dayOff) packedDate = firstDateOn(addDays(packedDate, 1), maria.seed.weekdays);
  if (packedDate === dayOff || packedDate === upcomingDate) {
    throw new Error('The packed day falls on the day off or on the upcoming booking date');
  }

  const bookings = [
    { date: pastDate, startMin: h(10), service: service('Класически маникюр') },
    { date: upcomingDate, startMin: h(11), service: service('Гел лак') },
    { date: packedDate, startMin: h(9), service: service('Класически маникюр') },
    { date: packedDate, startMin: h(10), service: service('Педикюр') },
    { date: packedDate, startMin: h(11, 30), service: service('Парафинова терапия за ръце') },
    { date: packedDate, startMin: h(14), service: service('Ноктопластика') },
    { date: packedDate, startMin: h(17), service: service('Смяна на дизайн / счупен нокът') },
  ];

  for (const b of bookings) {
    if (b.date === dayOff) throw new Error('Seed booking falls on the day off');
    const startAt = sofiaToUtc(b.date, b.startMin);
    await prisma.booking.create({
      data: {
        clientId: clientUser.id,
        manicuristId: maria.user.id,
        serviceId: b.service.id,
        serviceName: b.service.name,
        priceCents: b.service.priceCents,
        startAt,
        // As the API computes it: the UTC start plus the duration.
        endAt: new Date(startAt.getTime() + b.service.durationMin * 60_000),
      },
    });
  }

  console.log(
    `Seeded ${created.length} manicurists, 1 client, day off ${dayOff}, ` +
      `bookings on ${pastDate} (past), ${upcomingDate} (upcoming) and ${packedDate} (packed day, 5 bookings).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
