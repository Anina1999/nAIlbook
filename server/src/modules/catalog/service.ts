// Search, the public manicurist page and the manicurist's own profile,
// services, working hours and days off. Removed services and days off
// (deletedAt set) are never read.
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sofiaDayRange, todayInSofia } from '../../lib/time.js';
import { canMarkDayOff } from '../../scheduling/day-off.js';
import { bookingSelect, toBooking } from '../bookings/booking-shape.js';
import type { ProfileInput, SearchFilters, ServiceInput, WorkingDay } from './schemas.js';

const activeServices = { deletedAt: null } satisfies Prisma.ServiceWhereInput;

// The service object of the API contract (api-conventions, Response shapes).
const serviceSelect = {
  id: true,
  name: true,
  description: true,
  durationMin: true,
  priceCents: true,
} satisfies Prisma.ServiceSelect;

const hoursSelect = { weekday: true, startMin: true, endMin: true } satisfies Prisma.WorkingHoursSelect;

// The public page and the own profile. The email is shown here as a contact;
// search results and bookings never carry one.
const manicuristSelect = {
  city: true,
  address: true,
  bio: true,
  imageUrl: true,
  user: { select: { id: true, name: true, email: true, phone: true } },
  services: { where: activeServices, select: serviceSelect },
  workingHours: { orderBy: { weekday: 'asc' }, select: hoursSelect },
} satisfies Prisma.ManicuristProfileSelect;

type ManicuristRow = Prisma.ManicuristProfileGetPayload<{ select: typeof manicuristSelect }>;

// SQLite sorts and compares Cyrillic by code point, so names are sorted and
// matched in JS (see the search decision in api-conventions).
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'bg');
const lower = (text: string) => text.toLocaleLowerCase('bg');

// The manicurist object of the API contract.
function toManicurist({ user, services, ...profile }: ManicuristRow) {
  return { ...user, ...profile, services: services.sort(byName) };
}

function serviceNotFound() {
  return new AppError('NOT_FOUND', 'Услугата не е намерена.');
}

// Manicurists with at least one active service, filtered by part of the city
// and part of an active service name, ignoring case. An empty filter matches
// everyone who offers a service; a manicurist without one cannot be booked.
export async function searchManicurists(filters: SearchFilters) {
  const city = lower(filters.city ?? '');
  const service = lower(filters.service ?? '');

  const profiles = await prisma.manicuristProfile.findMany({
    where: { services: { some: activeServices } },
    select: {
      city: true,
      imageUrl: true,
      user: { select: { id: true, name: true } },
      services: { where: activeServices, select: { id: true, name: true, durationMin: true, priceCents: true } },
    },
  });

  return profiles
    .filter((p) => lower(p.city).includes(city))
    .filter((p) => !service || p.services.some((s) => lower(s.name).includes(service)))
    .map(({ user, services, ...profile }) => ({ ...user, ...profile, services: services.sort(byName) }))
    .sort(byName);
}

export async function getManicurist(id: number) {
  const profile = await prisma.manicuristProfile.findUnique({ where: { userId: id }, select: manicuristSelect });
  if (!profile) throw new AppError('NOT_FOUND', 'Маникюристът не е намерен.');
  return toManicurist(profile);
}

// Name and phone live in User, the rest in ManicuristProfile; both are saved together.
export async function updateProfile(userId: number, { name, phone, ...profile }: ProfileInput) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { name, phone } });
    const row = await tx.manicuristProfile.update({ where: { userId }, data: profile, select: manicuristSelect });
    return toManicurist(row);
  });
}

export async function createService(manicuristId: number, input: ServiceInput) {
  return prisma.service.create({ data: { ...input, manicuristId }, select: serviceSelect });
}

// A removed service counts as missing (404); someone else's is 403.
async function checkOwnService(db: Prisma.TransactionClient, id: number, manicuristId: number) {
  const service = await db.service.findUnique({ where: { id, ...activeServices }, select: { manicuristId: true } });
  if (!service) throw serviceNotFound();
  if (service.manicuristId !== manicuristId) throw new AppError('FORBIDDEN', 'Нямате достъп до тази услуга.');
}

// Bookings keep their own serviceName and priceCents, so an edit does not change them.
export async function updateService(id: number, manicuristId: number, input: ServiceInput) {
  return prisma.$transaction(async (tx) => {
    await checkOwnService(tx, id, manicuristId);
    return tx.service.update({ where: { id }, data: input, select: serviceSelect });
  });
}

// Soft delete: bookings point to the service, so the row stays.
export async function removeService(id: number, manicuristId: number) {
  await prisma.$transaction(async (tx) => {
    await checkOwnService(tx, id, manicuristId);
    await tx.service.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}

// Replaces the whole week. Existing bookings are not checked: they stay even
// outside the new hours, and the manicurist can cancel them.
export async function replaceWorkingHours(manicuristId: number, days: WorkingDay[]) {
  return prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { manicuristId } });
    await tx.workingHours.createMany({ data: days.map((day) => ({ ...day, manicuristId })) });
    return tx.workingHours.findMany({ where: { manicuristId }, orderBy: { weekday: 'asc' }, select: hoursSelect });
  });
}

// Days off. Only active rows (deletedAt: null) are ever read, and a date is a
// Sofia "YYYY-MM-DD" string, so SQLite compares and sorts it in date order.
const activeDaysOff = { deletedAt: null } satisfies Prisma.DayOffWhereInput;
const dayOffSelect = { id: true, date: true } satisfies Prisma.DayOffSelect;

// Active days off in [from, to] as ascending dates. A user who is not a
// manicurist is as missing as an unknown id.
export async function listDaysOff(manicuristId: number, from: string, to: string) {
  const profile = await prisma.manicuristProfile.findUnique({ where: { userId: manicuristId }, select: { userId: true } });
  if (!profile) throw new AppError('NOT_FOUND', 'Маникюристът не е намерен.');

  const rows = await prisma.dayOff.findMany({
    where: { manicuristId, ...activeDaysOff, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  return rows.map((row) => row.date);
}

// The manicurist's own active days off from today (Sofia) on, ascending.
export async function listOwnDaysOff(manicuristId: number, now: Date) {
  return prisma.dayOff.findMany({
    where: { manicuristId, ...activeDaysOff, date: { gte: todayInSofia(now) } },
    orderBy: { date: 'asc' },
    select: dayOffSelect,
  });
}

// The check and the write run in one transaction, so a booking cannot slip in
// between them (see createBooking). A removed row for the date is reused.
export async function markDayOff(manicuristId: number, date: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const { from, to } = sofiaDayRange(date);
    const [existing, bookings] = await Promise.all([
      tx.dayOff.findUnique({ where: { manicuristId_date: { manicuristId, date } }, select: { id: true, deletedAt: true } }),
      tx.booking.findMany({
        where: { manicuristId, status: 'BOOKED', startAt: { gte: from, lt: to } },
        orderBy: { startAt: 'asc' },
        select: bookingSelect,
      }),
    ]);

    const result = canMarkDayOff(date, existing && !existing.deletedAt ? [date] : [], bookings.map(toBooking), now);
    if (!result.ok) throw new AppError(result.code, result.message, result.details);

    if (existing) {
      return tx.dayOff.update({ where: { id: existing.id }, data: { deletedAt: null }, select: dayOffSelect });
    }
    return tx.dayOff.create({ data: { manicuristId, date }, select: dayOffSelect });
  });
}

// Soft delete: a removed or unknown row is 404, someone else's is 403.
export async function removeDayOff(id: number, manicuristId: number) {
  await prisma.$transaction(async (tx) => {
    const dayOff = await tx.dayOff.findUnique({ where: { id, ...activeDaysOff }, select: { manicuristId: true } });
    if (!dayOff) throw new AppError('NOT_FOUND', 'Почивният ден не е намерен.');
    if (dayOff.manicuristId !== manicuristId) throw new AppError('FORBIDDEN', 'Нямате достъп до този почивен ден.');
    await tx.dayOff.update({ where: { id }, data: { deletedAt: new Date() } });
  });
}
