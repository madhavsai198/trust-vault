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
    hookTimeout: 30000,
  },
});
