// The booking object of the API contract, shared by the bookings module and
// the days-off conflict answer in the catalog module.
import type { Prisma } from '../../generated/prisma/client.js';

// The fields of a booking the API returns. No email: bookings never carry one.
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
  manicurist: {
    select: {
      city: true,
      address: true,
      latitude: true,
      longitude: true,
      user: { select: { id: true, name: true, phone: true } },
    },
  },
} satisfies Prisma.BookingSelect;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

// The booking object of the API contract (api-conventions, Response shapes).
// The manicurist keys are written out, so their order is the contract's:
// id, name, phone, city, address, latitude, longitude.
export function toBooking({ manicurist, ...booking }: BookingRow) {
  const { user, city, address, latitude, longitude } = manicurist;
  return {
    ...booking,
    manicurist: { id: user.id, name: user.name, phone: user.phone, city, address, latitude, longitude },
  };
}

export type PublicBooking = ReturnType<typeof toBooking>;
