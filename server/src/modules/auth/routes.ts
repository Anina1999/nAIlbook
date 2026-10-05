import { Router } from 'express';
import { parse } from '../../lib/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginSchema, registerSchema } from './schemas.js';
import * as auth from './service.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const input = parse(registerSchema, req.body);
  res.status(201).json(await auth.register(input));
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
