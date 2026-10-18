// tests/health.test.ts
// ─────────────────────────────────────────────────────────────
// Automated tests for the GET /health endpoint.
//
// WHY Vitest + Supertest:
//   - Vitest is the recommended test runner for Vite-based projects
//     but works perfectly in plain Node too.
//   - Supertest lets us send real HTTP requests to the Express app
//     without starting a server on a real port — it handles that
//     internally using Node's http.createServer.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/server';

describe('GET /health', () => {
  it('responds with HTTP 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('returns JSON with status "ok"', async () => {
    const res = await request(app).get('/health');
    expect(res.body.status).toBe('ok');
  });

  it('returns the service name', async () => {
    const res = await request(app).get('/health');
    expect(res.body.service).toBe('TrustVault API');
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await request(app).get('/health');
    // Date.parse returns NaN for invalid dates
    expect(Date.parse(res.body.timestamp)).not.toBeNaN();
  });

  it('returns a database connection state string', async () => {
    const res = await request(app).get('/health');
    // In tests there is no real DB connection, so state is 'disconnected'.
    // We just verify the field is present and is a string.
    expect(typeof res.body.database).toBe('string');
  });
});

describe('GET /nonexistent-route', () => {
  it('responds with HTTP 404', async () => {
    const res = await request(app).get('/some-unknown-route');
    expect(res.status).toBe(404);
  });
});
