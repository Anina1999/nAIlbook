// Search, the public manicurist page and the manicurist's own profile,
// services and working hours. Removed services (deletedAt set) are never read.
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
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

// The public page. No email: it is never public.
const manicuristSelect = {
  city: true,
  address: true,
  bio: true,
  imageUrl: true,
  user: { select: { id: true, name: true, phone: true } },
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

// Every manicurist, filtered by part of the city and part of an active
// service name, ignoring case. An empty filter matches everyone.
export async function searchManicurists(filters: SearchFilters) {
  const city = lower(filters.city ?? '');
  const service = lower(filters.service ?? '');

  const profiles = await prisma.manicuristProfile.findMany({
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
