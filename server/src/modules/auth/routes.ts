import { Router } from 'express';
import { parse } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { geocodeStudio } from '../../middleware/geocode-studio.js';
import { requireFreeEmail } from '../../middleware/require-free-email.js';
import { validateBody } from '../../middleware/validate.js';
import { loginSchema, registerSchema, type RegisterInput } from './schemas.js';
import * as auth from './service.js';

export const authRouter = Router();

// The geocoder (an outside call) runs last, only for a valid body with a free email.
authRouter.post('/register', validateBody(registerSchema), requireFreeEmail, geocodeStudio, async (req, res) => {
  const input: RegisterInput = req.body;
  res.status(201).json(await auth.register(input, req.coordinates));
});

authRouter.post('/login', async (req, res) => {
  const input = parse(loginSchema, req.body);
  res.json(await auth.login(input));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await auth.getMe(req.user!.id) });
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  await auth.logout(req.user!.id);
  res.status(204).end();
});
