import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';

export function emailTaken() {
  return new AppError('EMAIL_TAKEN', 'Този имейл вече е регистриран.');
}

// 409 EMAIL_TAKEN when the email is already registered. Use after
// validateBody, which has trimmed and lowercased it. Two registrations at the
// same moment can both pass; the service turns the unique-index error into the
// same 409.
export async function requireFreeEmail(req: Request, _res: Response, next: NextFunction) {
  const email: string = req.body.email;
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw emailTaken();
  next();
}
