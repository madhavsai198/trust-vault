// src/models/AuditLog.ts
// ─────────────────────────────────────────────────────────────
// Application-level audit log.
//
// ⚠️  IMPORTANT: This is an APPLICATION audit trail only.
//     Records are stored in MongoDB and are NOT cryptographically
//     tamper-proof. A sufficiently privileged DB operator can
//     modify or delete entries. For regulated tamper-evident
//     requirements, consider append-only log stores or WORM storage.
//
// Privacy safeguards:
//   • No passwords, session tokens, or cookie values are stored.
//   • No document file contents are stored.
//   • Raw request bodies are never stored.
//   • metadata is a bounded, controlled object — never arbitrary
//     user-supplied blobs.
//
// Schema decisions documented for technical review:
//   • actorId is nullable: events like LOGIN_FAILED can fire before
//     a valid session is established.
//   • documentId is nullable: auth events are not document-specific.
//   • requestId enables correlation between audit entries and
//     application logs for a single HTTP request.
//   • Indexes on timestamp, actorId, documentId, action and outcome
//     support the admin dashboard query patterns.
// ─────────────────────────────────────────────────────────────

import { Schema, model, Document as MongooseDoc, Types } from 'mongoose';

// ── Event types ───────────────────────────────────────────────
// Only this fixed set is accepted. New event types must be added
// here deliberately — never passed in from user input.
export enum AuditAction {
  // Authentication
  LOGIN_SUCCESS            = 'LOGIN_SUCCESS',
  LOGIN_FAILED             = 'LOGIN_FAILED',
  LOGOUT_SUCCESS           = 'LOGOUT_SUCCESS',
  REGISTER_SUCCESS         = 'REGISTER_SUCCESS',

  // Documents
  DOCUMENT_UPLOADED        = 'DOCUMENT_UPLOADED',
  DOCUMENT_VIEWED          = 'DOCUMENT_VIEWED',
  DOCUMENT_DOWNLOADED      = 'DOCUMENT_DOWNLOADED',
  DOCUMENT_UPDATED         = 'DOCUMENT_UPDATED',
  DOCUMENT_DELETED         = 'DOCUMENT_DELETED',

  // Access control failures
  DOCUMENT_ACCESS_DENIED   = 'DOCUMENT_ACCESS_DENIED',
  DOCUMENT_UPDATE_DENIED   = 'DOCUMENT_UPDATE_DENIED',
  DOCUMENT_DELETE_DENIED   = 'DOCUMENT_DELETE_DENIED',
  UPLOAD_REJECTED          = 'UPLOAD_REJECTED',

  // Permissions
  PERMISSION_GRANTED       = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED       = 'PERMISSION_REVOKED',
  PERMISSION_CHANGE_DENIED = 'PERMISSION_CHANGE_DENIED',
}

// ── Outcome types ─────────────────────────────────────────────
export enum AuditOutcome {
  SUCCESS        = 'SUCCESS',
  DENIED         = 'DENIED',
  SYSTEM_FAILURE = 'SYSTEM_FAILURE', // unexpected server error during an action
}

// ── TypeScript interface ──────────────────────────────────────
export interface IAuditLog extends MongooseDoc {
  _id: Types.ObjectId;

  /** User who performed the action. Null when actor is not authenticated (e.g. LOGIN_FAILED). */
  actorId: Types.ObjectId | null;

  /** The audited event type. Validated against AuditAction enum. */
  action: AuditAction;

  /** Document involved in the event. Null for authentication events. */
  documentId: Types.ObjectId | null;

  /** Target user in permission events (the user receiving/losing access). */
  targetUserId: Types.ObjectId | null;

  /** Whether the action succeeded, was denied, or caused a server failure. */
  outcome: AuditOutcome;

  /** UUID correlating this audit entry to the corresponding HTTP request log. */
  requestId: string;

  /**
   * Controlled, bounded metadata for extra context.
   * NEVER contains passwords, tokens, cookies, document content, or raw bodies.
   */
  metadata: Record<string, string | number | boolean | null>;

  /** Automatically set by Mongoose timestamps option (mirrors createdAt for clarity). */
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Mongoose schema ───────────────────────────────────────────
const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    action: {
      type: String,
      required: [true, 'Action is required'],
      enum: {
        values: Object.values(AuditAction),
        message: 'Invalid audit action: {VALUE}',
      },
      index: true,
    },

    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
      index: true,
    },

    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    outcome: {
      type: String,
      required: [true, 'Outcome is required'],
      enum: {
        values: Object.values(AuditOutcome),
        message: 'Invalid audit outcome: {VALUE}',
      },
      index: true,
    },

    requestId: {
      type: String,
      required: [true, 'Request ID is required'],
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      // Validate that metadata is a flat object of primitives only.
      // This prevents accidental storage of sensitive nested objects.
      validate: {
        validator: (v: unknown): boolean => {
          if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
          return Object.values(v as Record<string, unknown>).every(
            (val) =>
              val === null ||
              typeof val === 'string' ||
              typeof val === 'number' ||
              typeof val === 'boolean'
          );
        },
        message: 'metadata must be a flat object of primitive values',
      },
    },

    // `timestamp` mirrors `createdAt` for semantic clarity in dashboard queries.
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    // Audit logs are append-only; __v is irrelevant noise.
    versionKey: false,
  }
);

// ── Compound indexes for admin dashboard query patterns ───────
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ documentId: 1, timestamp: -1 });
auditLogSchema.index({ outcome: 1, timestamp: -1 });

const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
