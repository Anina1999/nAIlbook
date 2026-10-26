import { Router } from 'express';
import { parse } from '../../lib/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { idParams, profileBody, searchQuery, serviceBody, workingHoursBody } from './schemas.js';
import * as catalog from './service.js';

// Mounted at /api/manicurists, next to the slots router. Public.
export const catalogRouter = Router();

catalogRouter.get('/', async (req, res) => {
  const filters = parse(searchQuery, req.query);
  res.json({ manicurists: await catalog.searchManicurists(filters) });
});

catalogRouter.get('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json({ manicurist: await catalog.getManicurist(id) });
});

// Mounted at /api/me. The logged-in manicurist's own data; ownership is
// checked in the service.
export const meRouter = Router();

meRouter.put('/profile', requireAuth, requireRole('MANICURIST'), async (req, res) => {
  const input = parse(profileBody, req.body);
  res.json({ manicurist: await catalog.updateProfile(req.user!.id, input) });
});

meRouter.post('/services', requireAuth, requireRole('MANICURIST'), async (req, res) => {
  const input = parse(serviceBody, req.body);
  res.status(201).json({ service: await catalog.createService(req.user!.id, input) });
});

meRouter.put('/services/:id', requireAuth, requireRole('MANICURIST'), async (req, res) => {
  const { id } = parse(idParams, req.params);
  const input = parse(serviceBody, req.body);
  res.json({ service: await catalog.updateService(id, req.user!.id, input) });
});

meRouter.delete('/services/:id', requireAuth, requireRole('MANICURIST'), async (req, res) => {
  const { id } = parse(idParams, req.params);
  await catalog.removeService(id, req.user!.id);
  res.status(204).end();
});

meRouter.put('/working-hours', requireAuth, requireRole('MANICURIST'), async (req, res) => {
  const { workingHours } = parse(workingHoursBody, req.body);
  res.json({ workingHours: await catalog.replaceWorkingHours(req.user!.id, workingHours) });
});
