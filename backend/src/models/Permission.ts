// src/models/Permission.ts
// ─────────────────────────────────────────────────────────────
// Mongoose schema for TrustVault per-document access permissions.
//
// Security principles:
// 1. Granular Access: Supports 'READ' (view metadata & download) and
//    'EDIT' (modify title & category metadata).
// 2. Race-Aware Uniqueness: Compound unique index on { documentId, userId }
//    ensures at most ONE active or historical record per (document, user) pair.
// 3. Explicit Revocation: Revocation sets `revokedAt` timestamp.
//    Active permissions are strictly those with `revokedAt: null`.
// 4. Auditability: `grantedBy` records who granted the permission,
//    strictly derived from the session (never from client request body).
// ─────────────────────────────────────────────────────────────

import { Schema, model, Document as MongooseDoc, Types } from 'mongoose';

export enum PermissionLevel {
  READ = 'READ',
  EDIT = 'EDIT',
}

export interface IPermission extends MongooseDoc {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  userId: Types.ObjectId;
  permission: PermissionLevel;
  grantedBy: Types.ObjectId;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: [true, 'Document ID is required'],
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient User ID is required'],
      index: true,
    },

    permission: {
      type: String,
      enum: {
        values: Object.values(PermissionLevel),
        message: 'Permission must be either READ or EDIT',
      },
      required: [true, 'Permission level is required'],
    },

    grantedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Granted by User ID is required'],
    },

    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring only one record per (documentId, userId) pair.
// This prevents duplicate grants and race conditions.
permissionSchema.index({ documentId: 1, userId: 1 }, { unique: true });

// Index for fast query of active user permissions
permissionSchema.index({ userId: 1, revokedAt: 1 });

const Permission = model<IPermission>('Permission', permissionSchema);
export default Permission;
