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
  /** `latitude` and `longitude` are the studio coordinates, for the map. */
  manicurist: {
    id: number;
    name: string;
    phone: string;
    city: string;
    address: string;
    latitude: number;
    longitude: number;
  };
};

/** The client's own bookings: upcoming until they end, soonest first; past latest first. Cancelled ones included. */
export type MyBookings = {
  upcoming: Booking[];
  past: Booking[];
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

/** The logged-in client's bookings. A load, so it takes the signal. */
export function getMyBookings(signal?: AbortSignal): Promise<MyBookings> {
  return request<MyBookings>('/bookings/mine', { signal });
}

/** Cancels a booking with a reason, sent as typed. A submit, so it takes no signal and is never aborted. */
export function cancelBooking(id: number, reason: string): Promise<{ booking: Booking }> {
  return request<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: 'PATCH', body: { reason } });
}

/** The manicurist's bookings on one Sofia date (`YYYY-MM-DD`), by start time; cancelled ones included. */
export type DaySchedule = {
  date: string;
  bookings: Booking[];
};

/** The logged-in manicurist's bookings on a Sofia date. A load, so it takes the signal. */
export function getSchedule(date: string, signal?: AbortSignal): Promise<DaySchedule> {
  const params = new URLSearchParams({ date });
  return request<DaySchedule>(`/bookings/schedule?${params}`, { signal });
}
