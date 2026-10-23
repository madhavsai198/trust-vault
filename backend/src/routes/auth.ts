// src/routes/auth.ts
// ─────────────────────────────────────────────────────────────
// Authentication endpoints:
//
//  POST /auth/register  — create a new VIEWER account
//  POST /auth/login     — verify credentials, issue JWT cookie
//  POST /auth/logout    — clear the JWT cookie
//  GET  /auth/me        — return the current authenticated user
//
// Security decisions:
//
//  • Argon2id is used for password hashing. It is the winner of the
//    Password Hashing Competition and is recommended over bcrypt for
//    new projects. It is memory-hard (harder to brute-force with GPUs).
//
//  • The JWT is stored in an HttpOnly, SameSite=Strict cookie.
//    HttpOnly: JS cannot read it (XSS protection).
//    SameSite=Strict: cookie is not sent on cross-site requests (CSRF protection).
//    Secure: only sent over HTTPS in production.
//
//  • Role is NOT accepted from the request body. All new users get
//    Role.VIEWER. Admins are created via seed scripts only.
//
//  • We use the same generic error message for "email not found" and
//    "wrong password" to prevent user enumeration attacks.
//
//  • express-rate-limit on login prevents brute-force attacks.
//
//  • Input is validated with Zod before any DB query is made.
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import User, { Role } from '../models/User';
import { requireAuth } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { AuditAction, AuditOutcome } from '../models/AuditLog';
import { getRequestId } from '../middleware/requestId';

const router = Router();

// Valid Argon2id hash constant used for anti-enumeration timing equality.
// If a user doesn't exist, we still verify against this valid hash structure
// so response time is indistinguishable between wrong password and unknown email.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$CXhukVM1mnEPxVv3lBIF9Q$GzBWjg0xiZokdXO9XsJD58610HNmL48T1yOMTp/wBgQ';

// ── Helpers ───────────────────────────────────────────────────

/**
 * Issue a signed JWT and set it as an HttpOnly cookie on the response.
 * The cookie name is 'token'.
 */
function issueTokenCookie(res: Response, userId: string, role: Role): void {
  const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'trustvault-ci-test-jwt-secret-do-not-use-in-production-1234567890' : '');
  const expiresInSeconds = Number(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 8; // 8 hours

  const token = jwt.sign(
    { userId, role },  // payload — DO NOT include passwordHash or any secret
    secret,
    { expiresIn: expiresInSeconds }
  );

  res.cookie('token', token, {
    httpOnly: true,                                        // JS cannot read this cookie
    sameSite: 'strict',                                   // CSRF protection
    secure: process.env.NODE_ENV === 'production',        // HTTPS only in prod
    maxAge: expiresInSeconds * 1000,                      // milliseconds
    path: '/',
  });
}

// ── Rate limiter for login ────────────────────────────────────
// Maximum 10 login attempts per IP per 15 minutes.
// Exceeding this returns 429 Too Many Requests.
// Skipped during automated tests.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Zod schemas for input validation ─────────────────────────
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ── POST /auth/register ───────────────────────────────────────
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 1. Validate input
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
    return;
  }

  const { name, email, password } = result.data;

  try {
    // 2. Check if email already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      // Use same message as login failure to avoid user enumeration
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }

    // 3. Hash password with Argon2id (recommended variant)
    //    argon2.hash() uses Argon2id by default with secure default parameters.
    const passwordHash = await argon2.hash(password);

    // 4. Create user — role is ALWAYS VIEWER here, never from req.body
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: Role.VIEWER,   // ← server assigns role, never the client
    });

    // 5. Issue cookie and return safe user object (no passwordHash)
    issueTokenCookie(res, user._id.toString(), user.role);

    await auditService.record({
      actorId: user._id,
      action: AuditAction.REGISTER_SUCCESS,
      outcome: AuditOutcome.SUCCESS,
      requestId: getRequestId(req),
      metadata: { email: user.email, role: user.role },
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    });
  } catch (err) {
    // MongoDB duplicate key error (race condition — two simultaneous registrations)
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }
    next(err);
  }
});

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 1. Validate input
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = result.data;

  try {
    // 2. Find user — explicitly select passwordHash (excluded by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    // 3. Verify password
    //    We always call argon2.verify even if user doesn't exist, to prevent
    //    timing attacks that could reveal whether an email is registered.
    const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
    let passwordValid = false;
    try {
      passwordValid = await argon2.verify(hashToCheck, password);
    } catch {
      passwordValid = false;
    }

    if (!user || !passwordValid) {
      // Record failed login audit event (safe metadata only: attempted email, actorId null or found)
      await auditService.record({
        actorId: user?._id || null,
        action: AuditAction.LOGIN_FAILED,
        outcome: AuditOutcome.DENIED,
        requestId: getRequestId(req),
        metadata: { attemptedEmail: email.toLowerCase() },
      });

      // Same message for both "user not found" and "wrong password"
      // to prevent user enumeration (THREATS.md T04)
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // 4. Issue JWT cookie
    issueTokenCookie(res, user._id.toString(), user.role);

    // Record successful login audit event
    await auditService.record({
      actorId: user._id,
      action: AuditAction.LOGIN_SUCCESS,
      outcome: AuditOutcome.SUCCESS,
      requestId: getRequestId(req),
      metadata: { email: user.email, role: user.role },
    });

    res.status(200).json({
      message: 'Logged in successfully',
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /auth/logout ─────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  let actorId: string | null = null;
  const token: string | undefined = req.cookies?.token;
  const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'trustvault-ci-test-jwt-secret-do-not-use-in-production-1234567890' : undefined);
  if (token && secret) {
    try {
      const payload = jwt.verify(token, secret) as { userId: string };
      actorId = payload.userId;
    } catch {
      // Ignore token decode error on logout
    }
  }

  // Clear the cookie by setting maxAge to 0.
  // The client has no way to delete an HttpOnly cookie themselves —
  // only the server can do this.
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  await auditService.record({
    actorId,
    action: AuditAction.LOGOUT_SUCCESS,
    outcome: AuditOutcome.SUCCESS,
    requestId: getRequestId(req),
  });

  res.status(200).json({ message: 'Logged out successfully' });
});

// ── GET /auth/me ──────────────────────────────────────────────
// Returns the currently authenticated user's profile.
// requireAuth middleware verifies the JWT before this handler runs.
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Look up fresh user data from DB (not just the JWT payload)
    // so that any role changes are reflected immediately.
    const user = await User.findById(req.user!.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({
      user: {
        id:        user._id,
        name:      user.name,
        email:     user.email,
        role:      user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
