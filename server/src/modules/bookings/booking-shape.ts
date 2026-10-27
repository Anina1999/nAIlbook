// The booking object of the API contract, shared by the bookings module and
// the days-off conflict answer in the catalog module.
import type { Prisma } from '../../generated/prisma/client.js';

// The fields of a booking the API returns. No email: it is never public.
export const bookingSelect = {
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
export function toBooking({ manicurist, ...booking }: BookingRow) {
  const { user, ...profile } = manicurist;
  return { ...booking, manicurist: { ...user, ...profile } };
}

export type PublicBooking = ReturnType<typeof toBooking>;
