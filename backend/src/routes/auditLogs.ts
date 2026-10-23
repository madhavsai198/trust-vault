// src/routes/auditLogs.ts
// ─────────────────────────────────────────────────────────────
// Audit Log query endpoints.
//
// ⚠️  SECURITY NOTICE:
//     Only authenticated ADMINISTRATORS (Role.ADMIN) can query
//     the complete audit trail. Owners and Viewers receive 403 Forbidden.
//     No endpoints exist to modify, truncate, or delete audit logs.
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import { Role } from '../models/User';
import { AuditAction, AuditOutcome } from '../models/AuditLog';
import { auditService } from '../services/auditService';

const router = Router();

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  actorId: z.string().optional(),
  documentId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  outcome: z.nativeEnum(AuditOutcome).optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
});

// ── GET /api/v1/audit-logs ─────────────────────────────────────
// Retrieve paginated audit trail. Strictly restricted to ADMIN.
router.get(
  '/',
  requireAuth,
  requireRole(Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = auditQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid audit query parameters',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { page, limit, actorId, documentId, action, outcome, startDate, endDate } = parsed.data;

      const result = await auditService.queryLogs({
        page,
        limit,
        actorId,
        documentId,
        action,
        outcome,
        startDate,
        endDate,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
