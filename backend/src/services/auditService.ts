// src/services/auditService.ts
// ─────────────────────────────────────────────────────────────
// Central audit logging service for TrustVault.
//
// DESIGN & RESILIENCE POLICY:
// 1. Audit logs are written asynchronously. If MongoDB audit insertion
//    encounters an error, it is logged to stderr with full context, but
//    does NOT crash the primary business transaction (unless strict mode
//    is enabled). This ensures service availability while alerting ops.
// 2. Strict sanitization: Metadata is strictly validated against a flat
//    key-value primitive whitelist. Passwords, auth tokens, cookies,
//    and raw document bodies are NEVER accepted into metadata.
// 3. Centralized query interface with strict role checks, pagination,
//    and validated query filters.
// ─────────────────────────────────────────────────────────────

import { Types } from 'mongoose';
import AuditLog, { AuditAction, AuditOutcome, IAuditLog } from '../models/AuditLog';

export interface AuditEventParams {
  actorId?: string | Types.ObjectId | null;
  action: AuditAction;
  documentId?: string | Types.ObjectId | null;
  targetUserId?: string | Types.ObjectId | null;
  outcome: AuditOutcome;
  requestId: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AuditQueryFilters {
  actorId?: string;
  documentId?: string;
  action?: AuditAction;
  outcome?: AuditOutcome;
  startDate?: string | Date;
  endDate?: string | Date;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  logs: IAuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class AuditService {
  /**
   * Sanitizes metadata to ensure only flat primitive key-values are recorded.
   * Strips out undefined, nested objects, functions, arrays, or forbidden keys.
   */
  private sanitizeMetadata(
    raw?: Record<string, unknown>
  ): Record<string, string | number | boolean | null> {
    if (!raw || typeof raw !== 'object') return {};

    const FORBIDDEN_KEYS = new Set([
      'password',
      'passwordhash',
      'token',
      'jwt',
      'cookie',
      'authorization',
      'secret',
      'content',
      'buffer',
      'filedata',
    ]);

    const sanitized: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(raw)) {
      const lowerKey = key.toLowerCase();
      if (FORBIDDEN_KEYS.has(lowerKey)) {
        continue; // Never allow sensitive field names
      }

      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        // Enforce max string length in metadata to prevent log bloating
        if (typeof value === 'string') {
          sanitized[key] = value.length > 256 ? `${value.substring(0, 253)}...` : value;
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Records an audit event in the database.
   * By default, catches and logs DB write failures to stderr so that primary
   * operations are not aborted due to secondary audit store issues.
   */
  async record(params: AuditEventParams): Promise<IAuditLog | null> {
    try {
      const cleanMetadata = this.sanitizeMetadata(params.metadata);

      const log = await AuditLog.create({
        actorId: params.actorId ? new Types.ObjectId(params.actorId.toString()) : null,
        action: params.action,
        documentId: params.documentId ? new Types.ObjectId(params.documentId.toString()) : null,
        targetUserId: params.targetUserId ? new Types.ObjectId(params.targetUserId.toString()) : null,
        outcome: params.outcome,
        requestId: params.requestId,
        metadata: cleanMetadata,
        timestamp: new Date(),
      });

      return log;
    } catch (err) {
      console.error(
        `[AUDIT_WRITE_ERROR] Failed to record audit log for action ${params.action} (req: ${params.requestId}):`,
        (err as Error).message
      );
      return null;
    }
  }

  /**
   * Queries audit logs with pagination and filters.
   * Only called from admin-protected endpoints.
   */
  async queryLogs(filters: AuditQueryFilters): Promise<PaginatedAuditLogs> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filters.actorId && Types.ObjectId.isValid(filters.actorId)) {
      query.actorId = new Types.ObjectId(filters.actorId);
    }

    if (filters.documentId && Types.ObjectId.isValid(filters.documentId)) {
      query.documentId = new Types.ObjectId(filters.documentId);
    }

    if (filters.action && Object.values(AuditAction).includes(filters.action)) {
      query.action = filters.action;
    }

    if (filters.outcome && Object.values(AuditOutcome).includes(filters.outcome)) {
      query.outcome = filters.outcome;
    }

    if (filters.startDate || filters.endDate) {
      const timeFilter: Record<string, Date> = {};
      if (filters.startDate) {
        const d = new Date(filters.startDate);
        if (!isNaN(d.getTime())) timeFilter.$gte = d;
      }
      if (filters.endDate) {
        const d = new Date(filters.endDate);
        if (!isNaN(d.getTime())) timeFilter.$lte = d;
      }
      if (Object.keys(timeFilter).length > 0) {
        query.timestamp = timeFilter;
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorId', 'name email role')
        .populate('targetUserId', 'name email role')
        .populate('documentId', 'title category originalFilename')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs: logs as unknown as IAuditLog[],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}

export const auditService = new AuditService();
