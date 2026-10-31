import type { Role } from '../generated/prisma/enums.js';
import type { Coordinates } from '../lib/geocoder.js';

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth.
      user?: { id: number; role: Role };
      // Set by geocodeStudio when the studio address was looked up; undefined
      // for a client registration or a profile save that keeps city and address.
      coordinates?: Coordinates;
    }
  }
}

export {};
