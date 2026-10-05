import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Невалиден имейл адрес.' }));

// bcrypt ignores everything after 72 bytes, so longer passwords are rejected.
const password = z
  .string()
  .min(8, { error: 'Паролата трябва да е поне 8 символа.' })
  .max(72, { error: 'Паролата трябва да е най-много 72 символа.' });

const requiredText = (message: string) => z.string().trim().min(1, { error: message });

const accountFields = {
  email,
  password,
  name: requiredText('Въведете име.'),
  phone: requiredText('Въведете телефон.'),
};

// ADMIN cannot be chosen at registration: only these two roles are accepted.
export const registerSchema = z.discriminatedUnion(
  'role',
  [
    z.object({ ...accountFields, role: z.literal('CLIENT') }),
    z.object({
      ...accountFields,
      role: z.literal('MANICURIST'),
      city: requiredText('Въведете град.'),
      address: requiredText('Въведете адрес.'),
      bio: z.string().trim().default(''),
    }),
  ],
  { error: 'Изберете тип акаунт: клиент или маникюрист.' },
);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: 'Въведете парола.' }),
});

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
