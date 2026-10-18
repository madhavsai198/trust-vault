// src/server.ts
// ─────────────────────────────────────────────────────────────
// Entry point for the TrustVault Express server.
//
// WHY we separate `app` from `listen`:
//   Exporting `app` without calling listen() lets test files
//   import it and use supertest without binding to a real port.
//   This is a standard pattern in Node.js testing.
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';           // loads .env into process.env
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import documentsRouter from './routes/documents';
import { connectDB, disconnectDB } from './lib/db';

// ── App setup ────────────────────────────────────────────────
const app = express();

// Parse incoming JSON bodies
app.use(express.json());

// Parse cookies — required to read the HttpOnly JWT token
app.use(cookieParser());

// CORS — only allow requests from the configured frontend origin.
// credentials: true is required for cookies to be sent cross-origin.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,   // allow cookies in cross-origin requests
  })
);

// ── Routes ───────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/auth',   authRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/documents',        documentsRouter); // Convenient alias

// 404 handler — catches any route that didn't match above
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
// The `_next` parameter is required by Express to recognise this as
// an error handler (4-argument signature).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // In production, never leak stack traces to the client (THREATS.md T06)
  const isDev = process.env.NODE_ENV !== 'production';
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { detail: err.message }),
  });
});

// ── Start listening (only when run directly, not in tests) ───
const PORT = Number(process.env.PORT) || 4000;

if (require.main === module) {
  // Connect to MongoDB first, then start the HTTP server.
  // Tests import `app` directly and skip this block entirely,
  // so no real DB connection is needed to run tests.
  connectDB()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`TrustVault API running on http://localhost:${PORT}`);
      });

      // ── Graceful shutdown ─────────────────────────────────
      // When the process is killed (Ctrl+C or Docker stop),
      // stop accepting new connections and close the DB cleanly.
      const shutdown = async (signal: string) => {
        console.log(`\n${signal} received. Shutting down gracefully…`);
        server.close(async () => {
          await disconnectDB();
          process.exit(0);
        });
      };

      process.on('SIGINT',  () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    })
    .catch((err: Error) => {
      console.error('Fatal: could not start server —', err.message);
      process.exit(1);
    });
}

export default app;
