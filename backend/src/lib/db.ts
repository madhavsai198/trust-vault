// src/lib/db.ts
// ─────────────────────────────────────────────────────────────
// MongoDB connection using Mongoose.
//
// WHY a separate module?
//   Keeping DB logic in its own file means server.ts stays clean,
//   and we can easily mock this module in unit tests without
//   starting a real database connection.
//
// WHY connectWithRetry?
//   On first deploy, the server and DB may start at the same time.
//   A single retry loop prevents the whole process from crashing
//   just because the DB wasn't ready yet.
// ─────────────────────────────────────────────────────────────

import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

/**
 * Connect to MongoDB Atlas using the MONGODB_URI environment variable.
 * Retries up to MAX_RETRIES times before giving up.
 */
export async function connectDB(attempt = 1): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill in your credentials.'
    );
  }

  try {
    await mongoose.connect(uri, {
      // These options are the Mongoose v7+ recommended defaults
      serverSelectionTimeoutMS: 5000, // fail fast if Atlas is unreachable
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error(`❌ MongoDB connection attempt ${attempt} failed:`, (err as Error).message);

    if (attempt < MAX_RETRIES) {
      console.log(`   Retrying in ${RETRY_DELAY_MS / 1000}s… (${attempt}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }

    // All retries exhausted — crash intentionally so the process
    // manager (e.g. PM2 / Docker) can restart it.
    throw new Error(`Could not connect to MongoDB after ${MAX_RETRIES} attempts.`);
  }
}

/**
 * Gracefully close the MongoDB connection.
 * Called when the process receives SIGINT or SIGTERM.
 */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('🔌 MongoDB disconnected');
}

// ── Mongoose connection event listeners ───────────────────────
// These log connection state changes at runtime — very helpful
// when debugging Atlas network issues.
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});
