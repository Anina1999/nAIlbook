import express from 'express';
import cors from 'cors';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/routes.js';
import { bookingsRouter, slotsRouter } from './modules/bookings/routes.js';

// Builds the Express app without listening, so tests can pass it to Supertest.
export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/manicurists', slotsRouter);

app.use(notFound);
app.use(errorHandler);
