import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { parse } from '../lib/validate.js';

// Parses req.body with the schema (400 VALIDATION_ERROR on failure) and
// replaces it with zod's output, so the next steps get trimmed, typed values.
export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = parse(schema, req.body);
    next();
  };
}
