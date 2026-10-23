// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // Argon2id hashing is deliberately slow (that's the security point).
    // Increase timeout so auth tests don't flake.
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'trustvault-ci-test-jwt-secret-do-not-use-in-production-1234567890',
      JWT_EXPIRES_IN_SECONDS: '28800',
    },
  },
});
