// src/middleware/auth.ts
// ─────────────────────────────────────────────────────────────
// Two middleware functions:
//
//  requireAuth  — verifies the JWT from the HttpOnly cookie.
//                 Rejects with 401 if missing or invalid.
//                 Attaches `req.user` for downstream handlers.
//
//  requireRole  — higher-order function that returns a middleware
//                 checking that req.user has one of the allowed roles.
//                 Rejects with 403 if role is insufficient.
//
// WHY HttpOnly cookie instead of Authorization header?
//   JavaScript cannot read HttpOnly cookies, so XSS attacks
//   cannot steal the token. This is the recommended approach
//   for browser-based applications.
//
// WHY not trust req.body.role?
//   The role is embedded in the signed JWT by the server at login.
//   The client never sends its own role claim — the JWT signature
//   would fail if tampered with.
// ─────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../models/User';

// ── Extend Express Request to carry the decoded user payload ──
export interface AuthPayload {
  userId: string;
  role: Role;
}

// Augment Express's Request type globally
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// ── requireAuth ───────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'Not authenticated — please log in' });
    return;
  }

  const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'trustvault-ci-test-jwt-secret-do-not-use-in-production-1234567890' : undefined);
  if (!secret) {
    // This is a server configuration error, not the client's fault.
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as AuthPayload;
    req.user = payload;  // attach to request for downstream use
    next();
  } catch {
    // Token is expired, malformed, or signature is invalid
    res.status(401).json({ error: 'Session expired or invalid — please log in again' });
  }
}

// ── requireRole ───────────────────────────────────────────────
// Usage: router.delete('/doc/:id', requireAuth, requireRole(Role.ADMIN, Role.OWNER), handler)
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      // Return 403 Forbidden — the client is authenticated but not authorised.
      // Do NOT reveal what roles are required (information disclosure).
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
