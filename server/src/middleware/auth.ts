import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/enums.js';
import { AppError } from '../lib/errors.js';
import { verifyToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

// Checks the Bearer token and loads the user. The token is rejected when the
// user no longer exists or tokenVersion has changed since it was signed
// (logout increments it). req.user takes the role from the database, not the token.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw new AppError('UNAUTHORIZED', 'Моля, влезте в профила си.');

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('UNAUTHORIZED', 'Сесията е изтекла. Моля, влезте отново.');
  }

  req.user = { id: user.id, role: user.role };
  next();
}

// Use after requireAuth.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('FORBIDDEN', 'Нямате достъп до това действие.');
    }
    next();
  };
}
