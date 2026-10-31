import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { geocode } from '../lib/geocoder.js';
import { prisma } from '../lib/prisma.js';

const NOT_FOUND_MESSAGE = 'Не намерихме този адрес в града. Проверете улицата и номера.';

// Finds the studio coordinates and puts them on req.coordinates. It calls an
// outside service, so it goes last in the chain, after validateBody and the
// guards. Two uses:
// - registration (no req.user): only for role MANICURIST;
// - the own profile (after requireAuth): only when the city or the address
//   differs from the saved one, so an unchanged studio keeps its coordinates.
// Not found is 400 VALIDATION_ERROR on address; an unavailable geocoder throws
// its own 503 GEOCODER_UNAVAILABLE.
export async function geocodeStudio(req: Request, _res: Response, next: NextFunction) {
  const { city, address, role }: { city?: string; address?: string; role?: string } = req.body;

  if (req.user) {
    const current = await prisma.manicuristProfile.findUnique({
      where: { userId: req.user.id },
      select: { city: true, address: true },
    });
    if (current && current.city === city && current.address === address) return next();
  } else if (role !== 'MANICURIST') {
    return next();
  }

  const coordinates = await geocode(address!, city!);
  if (!coordinates) {
    throw new AppError('VALIDATION_ERROR', NOT_FOUND_MESSAGE, [{ path: 'address', message: NOT_FOUND_MESSAGE }]);
  }
  req.coordinates = coordinates;
  next();
}
