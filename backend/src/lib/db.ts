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

const RETRY_DELAY_MS = 1500;
let memoryServerInstance: any = null;

async function connectMemoryDB(): Promise<void> {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServerInstance = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(memoryServerInstance.getUri());
  console.log('✅ In-memory development database connected');

  // Seed default test accounts so dev login works immediately
  try {
    const argon2 = await import('argon2');
    const User = (await import('../models/User')).default;
    const { Role } = await import('../models/User');

    const seedUsers = [
      {
        name:     'Admin User',
        email:    'admin@trustvault.dev',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'AdminDev@123!',
        role:     Role.ADMIN,
      },
      {
        name:     'Owner User',
        email:    'owner@trustvault.dev',
        password: process.env.SEED_OWNER_PASSWORD ?? 'OwnerDev@123!',
        role:     Role.OWNER,
      },
      {
        name:     'Viewer User',
        email:    'viewer@trustvault.dev',
        password: process.env.SEED_VIEWER_PASSWORD ?? 'ViewerDev@123!',
        role:     Role.VIEWER,
      },
    ];

    for (const u of seedUsers) {
      const existing = await User.findOne({ email: u.email });
      if (!existing) {
        const passwordHash = await argon2.hash(u.password);
        await User.create({ ...u, passwordHash });
      }
    }
    console.log('🌱 Seeded default dev accounts (admin, owner, viewer)');
  } catch (seedErr) {
    console.error('Notice: dev auto-seed skipped:', (seedErr as Error).message);
  }
}

/**
 * Connect to MongoDB Atlas using the MONGODB_URI environment variable.
 * In development, automatically falls back to an in-memory database if Atlas is unreachable
 * (e.g. current IP not yet added to Atlas Network Access whitelist).
 */
export async function connectDB(attempt = 1): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    if (process.env.NODE_ENV !== 'production') {
      return connectMemoryDB();
    }
    throw new Error(
      'MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill in your credentials.'
    );
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000, // fail fast if Atlas is unreachable
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.warn(`❌ MongoDB Atlas attempt ${attempt} failed:`, (err as Error).message);

    if (attempt < 2) {
      console.log(`   Retrying in ${RETRY_DELAY_MS / 1000}s… (${attempt}/2)`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }

    // In development, gracefully fall back to in-memory MongoDB
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  MongoDB Atlas cluster unreachable (check your Atlas IP whitelist).');
      console.log('🌱 Starting isolated in-memory development database for local testing...');
      return connectMemoryDB();
    }

    throw new Error(`Could not connect to MongoDB after ${attempt} attempts.`);
  }
}

/**
 * Gracefully close the MongoDB connection.
 * Called when the process receives SIGINT or SIGTERM.
 */
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
  }
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
