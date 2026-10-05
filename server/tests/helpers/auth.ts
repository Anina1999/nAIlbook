import type { Role } from '../../src/generated/prisma/enums.js';
import { signToken } from '../../src/lib/jwt.js';

type TokenUser = { id: number; role: Role; tokenVersion: number };

// Signs a token exactly like the app does ({ sub, role, tokenVersion }).
// Every test except the auth tests uses this instead of /login.
export function tokenFor(user: TokenUser): string {
  return signToken(user);
}

export function authHeader(user: TokenUser): { Authorization: string } {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}
