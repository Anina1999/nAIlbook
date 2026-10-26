import { Router } from 'express';
import { parse } from '../../lib/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { cancelBody, createBookingBody, idParams, scheduleQuery, slotsQuery } from './schemas.js';
import * as bookings from './service.js';

// The clock is read only here; the service and scheduling/ get now as a parameter.

// Mounted at /api/manicurists. Public: a guest can see the free slots.
export const slotsRouter = Router();

slotsRouter.get('/:id/slots', async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { serviceId, date } = parse(slotsQuery, req.query);
  res.json(await bookings.getSlots(id, serviceId, date, new Date()));
});

// Mounted at /api/bookings.
export const bookingsRouter = Router();

bookingsRouter.post('/', requireAuth, requireRole('CLIENT'), async (req, res) => {
  const input = parse(createBookingBody, req.body);
  const booking = await bookings.createBooking(req.user!.id, input, new Date());
  res.status(201).json({ booking });
});

bookingsRouter.get('/mine', requireAuth, requireRole('CLIENT'), async (req, res) => {
  res.json(await bookings.listMine(req.user!.id, new Date()));
});

bookingsRouter.get('/schedule', requireAuth, requireRole('MANICURIST'), async (req, res) => {
  const { date } = parse(scheduleQuery, req.query);
  res.json({ date, bookings: await bookings.getSchedule(req.user!.id, date) });
});

// The client or the manicurist of the booking; canCancel decides which.
bookingsRouter.patch('/:id/cancel', requireAuth, async (req, res) => {
  const { id } = parse(idParams, req.params);
  const { reason } = parse(cancelBody, req.body);
  res.json({ booking: await bookings.cancelBooking(id, req.user!.id, reason, new Date()) });
});
