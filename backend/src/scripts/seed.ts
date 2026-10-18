// src/scripts/seed.ts
// ─────────────────────────────────────────────────────────────
// Development seed script — creates one user per role for testing.
//
// HOW TO RUN:
//   npx ts-node src/scripts/seed.ts
//
// SECURITY:
//   • Passwords are read from environment variables (SEED_* variables).
//   • Fallback passwords are used ONLY for local dev — never in production.
//   • Never commit real passwords to Git.
//   • This script is for development/testing only.
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import User, { Role } from '../models/User';

const seedUsers = [
  {
    name:     'Admin User',
    email:    'admin@trustvault.dev',
    password: process.env.SEED_ADMIN_PASSWORD  ?? 'AdminDev@123!',
    role:     Role.ADMIN,
  },
  {
    name:     'Owner User',
    email:    'owner@trustvault.dev',
    password: process.env.SEED_OWNER_PASSWORD  ?? 'OwnerDev@123!',
    role:     Role.OWNER,
  },
  {
    name:     'Viewer User',
    email:    'viewer@trustvault.dev',
    password: process.env.SEED_VIEWER_PASSWORD ?? 'ViewerDev@123!',
    role:     Role.VIEWER,
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  console.log('🌱 Connecting to MongoDB…');
  await mongoose.connect(uri);
  console.log('✅ Connected');

  for (const u of seedUsers) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`   ⏭  Skipping ${u.email} — already exists`);
      continue;
    }

    const passwordHash = await argon2.hash(u.password);
    await User.create({ ...u, passwordHash });
    console.log(`   ✅ Created ${u.role}: ${u.email}`);
  }

  await mongoose.disconnect();
  console.log('🌱 Seed complete');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
