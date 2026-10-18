// src/models/User.ts
// ─────────────────────────────────────────────────────────────
// Mongoose schema for a TrustVault user.
//
// Security decisions documented here for interview readiness:
//
// 1. ROLES enum is defined server-side only. The client never
//    sends a role — the server always assigns one. This prevents
//    privilege-escalation via a crafted registration body.
//
// 2. `passwordHash` is excluded from all query results by default
//    via `select: false`. You MUST explicitly add .select('+passwordHash')
//    when you need it (login only). This prevents accidental leakage.
//
// 3. Unique index on email with lowercase + trim ensures
//    'Alice@Example.com' and 'alice@example.com' are the same user.
//
// 4. Timestamps (createdAt, updatedAt) are added automatically by
//    Mongoose via the `timestamps: true` option.
// ─────────────────────────────────────────────────────────────

import { Schema, model, Document, Types } from 'mongoose';

// ── Role enum ────────────────────────────────────────────────
export enum Role {
  ADMIN  = 'ADMIN',
  OWNER  = 'OWNER',
  VIEWER = 'VIEWER',
}

// ── TypeScript interface ──────────────────────────────────────
// This gives us type safety when working with user documents in code.
export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;   // never returned in API responses (select: false)
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

// ── Mongoose schema ───────────────────────────────────────────
const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name must be 100 characters or fewer'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,          // creates a unique index in MongoDB
      lowercase: true,       // normalise before saving
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,         // ← NEVER returned by default in queries
    },

    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.VIEWER,  // safest default — least privilege
    },
  },
  {
    timestamps: true,        // adds createdAt and updatedAt automatically
  }
);

// ── Indexes ──────────────────────────────────────────────────
// The unique: true on email already creates an index.
// We add a separate index on role for future admin dashboard queries.
userSchema.index({ role: 1 });

// ── Model ─────────────────────────────────────────────────────
const User = model<IUser>('User', userSchema);
export default User;
