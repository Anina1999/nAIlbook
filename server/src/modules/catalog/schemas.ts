import { z } from 'zod';
import { contactFields, profileFields } from '../auth/schemas.js';

const id = z.coerce.number().int().positive();

export const idParams = z.object({ id });

// A repeated parameter arrives as an array and is rejected. An empty or blank
// one is no filter: the service treats an empty string as missing.
export const searchQuery = z.object({
  city: z.string().trim().optional(),
  service: z.string().trim().optional(),
});

// The same rules as registering a manicurist (auth/schemas.ts).
export const profileBody = z.object({ ...contactFields, ...profileFields });

export const serviceBody = z.object({
  name: z
    .string({ error: 'Въведете име на услугата.' })
    .trim()
    .min(1, { error: 'Въведете име на услугата.' })
    .max(80, { error: 'Името трябва да е най-много 80 символа.' }),
  // Empty, blank or missing is saved as null.
  description: z
    .string()
    .trim()
    .max(300, { error: 'Описанието трябва да е най-много 300 символа.' })
    .nullish()
    .transform((value) => value || null),
  durationMin: z
    .number({ error: 'Въведете продължителност в минути.' })
    .int({ error: 'Продължителността трябва да е от 15 до 480 минути, през 15 минути.' })
    .min(15, { error: 'Продължителността трябва да е от 15 до 480 минути, през 15 минути.' })
    .max(480, { error: 'Продължителността трябва да е от 15 до 480 минути, през 15 минути.' })
    .multipleOf(15, { error: 'Продължителността трябва да е от 15 до 480 минути, през 15 минути.' }),
  priceCents: z
    .number({ error: 'Въведете цена.' })
    .int({ error: 'Цената трябва да е в цели евроцентове.' })
    .min(0, { error: 'Цената трябва да е от 0 до 1000 €.' })
    .max(100000, { error: 'Цената трябва да е от 0 до 1000 €.' }),
});

// Minutes from midnight, Sofia local time, on the 30-minute slot grid.
const dayMinute = z
  .number()
  .int()
  .min(0, { error: 'Часът трябва да е между 00:00 и 24:00.' })
  .max(1440, { error: 'Часът трябва да е между 00:00 и 24:00.' })
  .multipleOf(30, { error: 'Изберете час през 30 минути, например 09:00 или 09:30.' });

const workingDay = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMin: dayMinute,
    endMin: dayMinute,
  })
  .refine((day) => day.startMin < day.endMin, { error: 'Краят трябва да е след началото.', path: ['endMin'] });

// The full week: a day that is not listed is not a working day.
export const workingHoursBody = z.object({
  workingHours: z.array(workingDay).superRefine((days, ctx) => {
    const seen = new Set<number>();
    days.forEach((day, index) => {
      if (seen.has(day.weekday)) {
        ctx.addIssue({ code: 'custom', message: 'Всеки ден може да се въведе само веднъж.', path: [index, 'weekday'] });
      }
      seen.add(day.weekday);
    });
  }),
});

export type SearchFilters = z.output<typeof searchQuery>;
export type ProfileInput = z.output<typeof profileBody>;
export type ServiceInput = z.output<typeof serviceBody>;
export type WorkingDay = z.output<typeof workingDay>;
