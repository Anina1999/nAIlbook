import { z } from 'zod';
import { AppError } from './errors.js';

// zod's default messages in Bulgarian, for every schema in the app.
z.config(z.locales.bg());

// Parses body, params or query with a zod schema. On failure throws
// 400 VALIDATION_ERROR with one { path, message } entry per issue,
// so the client can show each message next to its input.
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError('VALIDATION_ERROR', 'Невалидни данни.', details);
  }
  return result.data;
}
