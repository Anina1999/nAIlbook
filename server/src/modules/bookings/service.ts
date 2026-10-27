// Slots, booking, my bookings, schedule and cancel. The rules are in
// scheduling/ (see the scheduling-engine skill); this file loads the data,
// calls them and throws AppError from a failed check.
import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { sofiaDayRange, utcToSofia } from '../../lib/time.js';
import { canCancel, validateBooking } from '../../scheduling/booking.js';
import { calculateAvailableSlots } from '../../scheduling/slots.js';
import { bookingSelect, toBooking } from './booking-shape.js';
import type { CreateBookingInput } from './schemas.js';

// What the scheduling checks need for one manicurist and one Sofia date: the
// weekly hours, the date if it is an active day off, and its active bookings.
async function loadDay(db: Prisma.TransactionClient, manicuristId: number, date: string) {
  const { from, to } = sofiaDayRange(date);
  const [workingHours, dayOff, bookings] = await Promise.all([
    db.workingHours.findMany({ where: { manicuristId }, select: { weekday: true, startMin: true, endMin: true } }),
    db.dayOff.findFirst({ where: { manicuristId, date, deletedAt: null }, select: { date: true } }),
    db.booking.findMany({
      where: { manicuristId, status: 'BOOKED', startAt: { gte: from, lt: to } },
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
    where: { id: serviceId, deletedAt: null },
    select: { durationMin: true, manicuristId: true },
  });
  // Also covers a removed service and an unknown manicurist: no service belongs to them.
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
      // A removed service is missing, so validateBooking answers NOT_FOUND.
      where: { id: input.serviceId, deletedAt: null },
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
  const { from, to } = sofiaDayRange(date);
  const rows = await prisma.booking.findMany({
    where: { manicuristId, startAt: { gte: from, lt: to } },
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
