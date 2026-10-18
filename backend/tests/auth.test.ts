// tests/auth.test.ts
// ─────────────────────────────────────────────────────────────
// Tests for the authentication endpoints.
//
// Strategy:
//   - We use mongodb-memory-server (in-memory MongoDB) so tests
//     run without a real Atlas connection and are fully isolated.
//   - Each test suite clears the User collection in beforeEach.
//   - We test: registration, login, logout, /me, invalid inputs,
//     unauthenticated access, and role escalation prevention.
//
// WHY in-memory DB for tests?
//   Real DB tests are slow and fragile (depend on network).
//   An in-memory DB gives us full Mongoose behaviour at zero cost.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/server';
import User, { Role } from '../src/models/User';

// ── In-memory MongoDB setup ───────────────────────────────────
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 60000,
    },
  });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clear users between tests for a clean state
  await User.deleteMany({});
});

// ── Helper ────────────────────────────────────────────────────
async function registerUser(
  name = 'Test User',
  email = 'test@example.com',
  password = 'SecurePass@123'
) {
  return request(app).post('/auth/register').send({ name, email, password });
}

// ─────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────
describe('POST /auth/register', () => {
  it('creates a new user and returns 201', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('always assigns VIEWER role — never trusts client role', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Attacker', email: 'atk@example.com', password: 'Pass@1234', role: 'ADMIN' });
    expect(res.status).toBe(201);
    // Even though the client sent role: ADMIN, the server must assign VIEWER
    expect(res.body.user.role).toBe(Role.VIEWER);
  });

  it('never returns passwordHash in response', async () => {
    const res = await registerUser();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('argon2');
  });

  it('sets an HttpOnly cookie named token', async () => {
    const res = await registerUser();
    const cookie = res.headers['set-cookie'] as unknown as string[];
    expect(cookie).toBeDefined();
    const tokenCookie = cookie.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toContain('HttpOnly');
  });

  it('rejects duplicate email with 409', async () => {
    await registerUser();
    const res = await registerUser();  // same email again
    expect(res.status).toBe(409);
  });

  it('rejects short password with 400', async () => {
    const res = await registerUser('User', 'u@example.com', '123');
    expect(res.status).toBe(400);
  });

  it('rejects invalid email with 400', async () => {
    const res = await registerUser('User', 'not-an-email', 'ValidPass@123');
    expect(res.status).toBe(400);
  });

  it('rejects missing name with 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'u@example.com', password: 'ValidPass@123' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
describe('POST /auth/login', () => {
  beforeEach(async () => {
    await registerUser('Login User', 'login@example.com', 'MyPassword@99');
  });

  it('returns 200 and sets cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'MyPassword@99' });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'] as unknown as string[];
    expect(cookie?.some((c: string) => c.startsWith('token='))).toBe(true);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPassword!' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'SomePass@123' });
    expect(res.status).toBe(401);
  });

  it('uses same error message for wrong password and unknown email (anti-enumeration)', async () => {
    const wrongPass = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'WrongPassword!' });
    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'SomePass@123' });
    expect(wrongPass.body.error).toBe(unknownEmail.body.error);
  });

  it('never returns passwordHash in login response', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'MyPassword@99' });
    expect(res.body.user?.passwordHash).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────
describe('POST /auth/logout', () => {
  it('returns 200 and clears the token cookie', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'] as unknown as string[];
    // Cookie should be cleared (maxAge=0 or expires in the past)
    const tokenCookie = cookie?.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});

// ─────────────────────────────────────────────────────────────
// CURRENT USER (/me)
// ─────────────────────────────────────────────────────────────
describe('GET /auth/me', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the authenticated user when cookie is valid', async () => {
    // Register and capture the cookie
    const reg = await registerUser('Me User', 'me@example.com', 'MePass@123!');
    const cookies = reg.headers['set-cookie'] as unknown as string[];

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 with a tampered token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', ['token=this.is.a.fake.jwt']);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// ROLE ESCALATION ATTEMPTS
// ─────────────────────────────────────────────────────────────
describe('Role escalation prevention', () => {
  it('a registered user always gets VIEWER, even if ADMIN is requested in body', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Hacker', email: 'hack@example.com', password: 'Hack@Pass1', role: 'ADMIN' });
    expect(res.body.user.role).toBe(Role.VIEWER);
  });

  it('DB confirms the role is VIEWER despite escalation attempt', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Hacker', email: 'hack@example.com', password: 'Hack@Pass1', role: 'ADMIN' });
    const dbUser = await User.findOne({ email: 'hack@example.com' });
    expect(dbUser?.role).toBe(Role.VIEWER);
  });
});
