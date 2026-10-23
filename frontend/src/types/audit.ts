// src/types/audit.ts
// ─────────────────────────────────────────────────────────────
// TypeScript types for the Phase 5 Security Audit Trail.
// ─────────────────────────────────────────────────────────────

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT_SUCCESS'
  | 'REGISTER_SUCCESS'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_VIEWED'
  | 'DOCUMENT_DOWNLOADED'
  | 'DOCUMENT_UPDATED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_ACCESS_DENIED'
  | 'DOCUMENT_UPDATE_DENIED'
  | 'DOCUMENT_DELETE_DENIED'
  | 'UPLOAD_REJECTED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'PERMISSION_CHANGE_DENIED';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'SYSTEM_FAILURE';

export interface AuditActorRef {
  _id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OWNER' | 'VIEWER';
}

export interface AuditDocRef {
  _id: string;
  title: string;
  category?: string;
  originalFilename?: string;
}

export interface AuditLogEntry {
  _id: string;
  actorId: AuditActorRef | null;
  action: AuditAction;
  documentId: AuditDocRef | null;
  targetUserId: AuditActorRef | null;
  outcome: AuditOutcome;
  requestId: string;
  metadata: Record<string, string | number | boolean | null>;
  timestamp: string;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
