// Inputs for the pure scheduling functions. Plain shapes, so Prisma rows fit
// them as they are while scheduling/ never imports Prisma.

export type BookingStatus = 'BOOKED' | 'CANCELLED';

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
