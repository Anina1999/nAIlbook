import { request } from './client';

export type BookingStatus = 'BOOKED' | 'CANCELLED';

/**
 * A booking. `serviceName` and `priceCents` are the snapshot from booking time;
 * `cancelledBy` and `cancelReason` are null while it is BOOKED.
 */
export type Booking = {
  id: number;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  cancelledBy: 'CLIENT' | 'MANICURIST' | null;
  cancelReason: string | null;
  serviceId: number;
  serviceName: string;
  priceCents: number;
  client: { id: number; name: string; phone: string };
  manicurist: { id: number; name: string; phone: string; city: string; address: string };
};

export type BookingInput = {
  manicuristId: number;
  serviceId: number;
  /** A start time from /slots, as a UTC ISO string. */
  startAt: string;
};

/** Books a slot. A submit, so it takes no signal and is never aborted. */
export function createBooking(input: BookingInput): Promise<{ booking: Booking }> {
  return request<{ booking: Booking }>('/bookings', { method: 'POST', body: input });
}
