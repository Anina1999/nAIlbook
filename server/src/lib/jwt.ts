import jwt from 'jsonwebtoken';
import type { Role } from '../generated/prisma/enums.js';
import { config } from './config.js';

export type TokenPayload = { sub: number; role: Role; tokenVersion: number };

// The only algorithm we sign with and the only one we accept.
const ALGORITHM = 'HS256';

export function signToken(user: { id: number; role: Role; tokenVersion: number }): string {
  const payload = { role: user.role, tokenVersion: user.tokenVersion };
  return jwt.sign(payload, config.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: config.jwtExpiresIn,
    subject: String(user.id),
  });
}

// Returns the payload, or null when the token is malformed, expired or badly signed.
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
    if (typeof decoded === 'string') return null;
    const sub = Number(decoded.sub);
    if (!Number.isInteger(sub) || typeof decoded.tokenVersion !== 'number') return null;
    return { sub, role: decoded.role as Role, tokenVersion: decoded.tokenVersion };
  } catch {
    return null;
  }
}
