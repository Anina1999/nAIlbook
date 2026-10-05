import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';

// Any request that no router handled.
export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('NOT_FOUND', 'Ресурсът не е намерен.'));
}

// Turns every error into { error: { code, message, details } }.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let error: AppError;
  if (err instanceof AppError) {
    error = err;
  } else if (isJsonParseError(err)) {
    error = new AppError('VALIDATION_ERROR', 'Невалиден JSON.');
  } else {
    console.error(err);
    error = new AppError('INTERNAL_ERROR', 'Възникна грешка. Моля, опитайте отново.');
  }

  res.status(error.status).json({
    error: { code: error.code, message: error.message, details: error.details },
  });
}

// express.json() marks a body it cannot parse with type 'entity.parse.failed'.
function isJsonParseError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed';
}
