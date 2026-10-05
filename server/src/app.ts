import express from 'express';
import cors from 'cors';

// Builds the Express app without listening, so tests can pass it to Supertest.
export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());
