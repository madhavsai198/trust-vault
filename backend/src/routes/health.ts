// src/routes/health.ts
// ─────────────────────────────────────────────────────────────
// Health-check route — now also reports MongoDB connection state.
//
// Mongoose connection states:
//   0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

const DB_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

// GET /health
router.get('/', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;

  res.status(200).json({
    status: 'ok',
    service: 'TrustVault API',
    timestamp: new Date().toISOString(),
    database: DB_STATES[dbState] ?? 'unknown',
  });
});

export default router;
