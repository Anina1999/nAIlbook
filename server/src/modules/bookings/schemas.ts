import { z } from 'zod';

// A Sofia-local calendar date. z.iso.date() also rejects dates that do not
// exist, such as 2026-02-30.
const date = z.iso.date({ error: 'Изберете валидна дата.' });

const id = z.coerce.number().int().positive();

export const idParams = z.object({ id });

// serviceId is optional: without it the day comes with its busy intervals only.
export const slotsQuery = z.object({
  serviceId: z.coerce.number({ error: 'Изберете услуга.' }).int().positive().optional(),
  date,
});

// startAt is a UTC ISO string, as the slots endpoint returns it. The client
// never sends endAt: the server computes it from the service duration.
export const createBookingBody = z.object({
  manicuristId: z.number().int().positive(),
  serviceId: z.number({ error: 'Изберете услуга.' }).int().positive(),
  startAt: z.iso
    .datetime({ error: 'Изберете свободен час.' })
    .transform((value) => new Date(value)),
});

export const scheduleQuery = z.object({ date });

export const cancelBody = z.object({
  reason: z
    .string({ error: 'Въведете причина за отказа.' })
    .trim()
    .min(1, { error: 'Въведете причина за отказа.' })
    .max(200, { error: 'Причината трябва да е най-много 200 символа.' }),
});

export type CreateBookingInput = z.output<typeof createBookingBody>;
