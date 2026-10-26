// Slots, booking, my bookings, schedule and cancel. The rules are in
// scheduling/ (see the scheduling-engine skill); this file loads the data,
// calls them and throws AppError from a failed check.
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { addDays, sofiaToUtc, utcToSofia } from '../../lib/time.js';
import { canCancel, validateBooking } from '../../scheduling/booking.js';
import { calculateAvailableSlots } from '../../scheduling/slots.js';
import type { CreateBookingInput } from './schemas.js';

// The fields of a booking the API returns. No email: it is never public.
const bookingSelect = {
  id: true,
  startAt: true,
  endAt: true,
  status: true,
  cancelledBy: true,
  cancelReason: true,
  serviceId: true,
  serviceName: true,
  priceCents: true,
  client: { select: { id: true, name: true, phone: true } },
  manicurist: { select: { city: true, address: true, user: { select: { id: true, name: true, phone: true } } } },
} satisfies Prisma.BookingSelect;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

// The booking object of the API contract (api-conventions, Response shapes).
function toBooking({ manicurist, ...booking }: BookingRow) {
  const { user, ...profile } = manicurist;
  return { ...booking, manicurist: { ...user, ...profile } };
}

export type PublicBooking = ReturnType<typeof toBooking>;

// A Sofia date as a UTC range [from, to). Working hours end by midnight, so no
// booking from the day before reaches into it.
function dayWindow(date: string) {
  return { gte: sofiaToUtc(date, 0), lt: sofiaToUtc(addDays(date, 1), 0) };
}

// What the scheduling checks need for one manicurist and one Sofia date: the
// weekly hours, the date if it is an active day off, and its active bookings.
async function loadDay(db: Prisma.TransactionClient, manicuristId: number, date: string) {
  const [workingHours, dayOff, bookings] = await Promise.all([
    db.workingHours.findMany({ where: { manicuristId }, select: { weekday: true, startMin: true, endMin: true } }),
    db.dayOff.findFirst({ where: { manicuristId, date, deletedAt: null }, select: { date: true } }),
    db.booking.findMany({
      where: { manicuristId, status: 'BOOKED', startAt: dayWindow(date) },
      select: { startAt: true, endAt: true, status: true },
    }),
  ]);
  return { workingHours, daysOff: dayOff ? [dayOff.date] : [], bookings };
}

function serviceNotFound() {
  return new AppError('NOT_FOUND', 'Услугата не е намерена.');
}

export async function getSlots(manicuristId: number, serviceId: number, date: string, now: Date) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { durationMin: true, manicuristId: true },
  });
  // Also covers an unknown manicurist: no service belongs to them.
  if (!service || service.manicuristId !== manicuristId) throw serviceNotFound();

  const { workingHours, daysOff, bookings } = await loadDay(prisma, manicuristId, date);
  const slots = calculateAvailableSlots(service, date, workingHours, daysOff, bookings, now);
  return { date, dayOff: daysOff.length > 0, slots };
}

// The check and the insert run in one transaction. The adapter runs one
// transaction at a time, so of two clients racing for a slot the second one
// sees the first booking and gets 409 SLOT_TAKEN.
export async function createBooking(clientId: number, input: CreateBookingInput, now: Date) {
  return prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, name: true, durationMin: true, priceCents: true, manicuristId: true },
    });
    const day = await loadDay(tx, input.manicuristId, utcToSofia(input.startAt).date);

    const result = validateBooking({ manicuristId: input.manicuristId, service, startAt: input.startAt, ...day, now });
    if (!result.ok) throw new AppError(result.code, result.message, result.details);

    const booking = await tx.booking.create({
      data: {
        clientId,
        manicuristId: input.manicuristId,
        serviceId: service!.id,
        serviceName: service!.name,
        priceCents: service!.priceCents,
        startAt: input.startAt,
        endAt: result.endAt,
      },
      select: bookingSelect,
    });
    return toBooking(booking);
  });
}

// Upcoming until the booking ends (endAt >= now), soonest first; past ones
// latest first. Cancelled bookings stay in, so the reason can be shown.
export async function listMine(clientId: number, now: Date) {
  const rows = await prisma.booking.findMany({
    where: { clientId },
    orderBy: { startAt: 'asc' },
    select: bookingSelect,
  });
  const bookings = rows.map(toBooking);
  return {
    upcoming: bookings.filter((b) => b.endAt >= now),
    past: bookings.filter((b) => b.endAt < now).reverse(),
  };
}

// Every booking of the manicurist on a Sofia date, cancelled ones included.
export async function getSchedule(manicuristId: number, date: string) {
  const rows = await prisma.booking.findMany({
    where: { manicuristId, startAt: dayWindow(date) },
    orderBy: { startAt: 'asc' },
    select: bookingSelect,
  });
  return rows.map(toBooking);
}

export async function cancelBooking(id: number, userId: number, reason: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { clientId: true, manicuristId: true, startAt: true, endAt: true, status: true },
    });
    if (!booking) throw new AppError('NOT_FOUND', 'Часът не е намерен.');

    const result = canCancel(booking, userId, now);
    if (!result.ok) throw new AppError(result.code, result.message, result.details);

    const updated = await tx.booking.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledBy: result.cancelledBy, cancelReason: reason },
      select: bookingSelect,
    });
    return toBooking(updated);
  });
}
