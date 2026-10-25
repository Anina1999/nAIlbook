// Inputs for the pure scheduling functions. Plain shapes, so Prisma rows fit
// them as they are while scheduling/ never imports Prisma.

import type { ErrorCode } from '../lib/errors.js';

export type BookingStatus = 'BOOKED' | 'CANCELLED';
export type CancelledBy = 'CLIENT' | 'MANICURIST';

export interface ServiceInput {
  durationMin: number;
}

// Minutes from midnight, Sofia local time. weekday: 0 = Sunday.
export interface WorkingHoursInput {
  weekday: number;
  startMin: number;
  endMin: number;
}

// startAt and endAt are UTC instants.
export interface BookingInput {
  startAt: Date;
  endAt: Date;
  status: BookingStatus;
}

export interface BookableService extends ServiceInput {
  manicuristId: number;
}

export interface CancellableBooking extends BookingInput {
  clientId: number;
  manicuristId: number;
}

export interface ValidateBookingInput {
  manicuristId: number;
  service: BookableService | null;
  startAt: Date;
  workingHours: WorkingHoursInput[];
  daysOff: string[];
  bookings: BookingInput[];
  now: Date;
}

// What every check returns. On a failure the route throws
// new AppError(code, message, details); the message is in Bulgarian.
export interface CheckFailure<D = undefined> {
  ok: false;
  code: ErrorCode;
  message: string;
  details?: D;
}

export type CheckResult<T extends object = object, D = undefined> = ({ ok: true } & T) | CheckFailure<D>;
