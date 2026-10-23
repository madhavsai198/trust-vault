// src/middleware/requestId.ts
// ─────────────────────────────────────────────────────────────
// Correlation ID middleware.
//
// Extracts 'X-Request-Id' from incoming request header if present,
// or generates a new cryptographic UUID. Attaches it to req.requestId
// and sets the 'X-Request-Id' response header for client correlation.
// ─────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const reqId = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : crypto.randomUUID();
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export function getRequestId(req: Request): string {
  return req.requestId || (req.headers['x-request-id'] as string) || crypto.randomUUID();
}
