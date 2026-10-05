import type { Role } from '../generated/prisma/enums.js';

// Set by requireAuth.
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: Role };
    }
  }
}

export {};
