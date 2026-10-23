// src/routes/documents.ts
// ─────────────────────────────────────────────────────────────
// Document management API endpoints:
//
//  POST   /api/v1/documents              — Upload private document
//  GET    /api/v1/documents              — List user's documents
//  GET    /api/v1/documents/:id          — Get document metadata
//  PATCH  /api/v1/documents/:id          — Update metadata (title/category)
//  DELETE /api/v1/documents/:id          — Delete document & storage file
//  GET    /api/v1/documents/:id/download — Stream download with safe headers
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { pipeline } from 'stream/promises';
import { z } from 'zod';
import { isValidObjectId } from 'mongoose';
import { requireAuth } from '../middleware/auth';
import Document, { DocumentCategory } from '../models/Document';
import Permission, { PermissionLevel } from '../models/Permission';
import User, { Role } from '../models/User';
import { getStorageService } from '../services/storage';
import { documentAccessService, DocumentAccessError } from '../services/documentAccess';
import {
  validateUploadedFile,
  MAX_FILE_SIZE_BYTES,
  sanitizeFilename,
} from '../lib/fileValidation';
import { auditService } from '../services/auditService';
import { AuditAction, AuditOutcome } from '../models/AuditLog';
import { getRequestId } from '../middleware/requestId';

const router = Router();

// ── Multer In-Memory Storage Configuration ───────────────────
// We use memory storage so the file can be inspected (magic bytes)
// before ever hitting disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

// Helper to format safe document response (hiding internal storageKey)
function toSafeDocument(
  doc: {
    _id: unknown;
    ownerId: unknown;
    title: string;
    category: string;
    originalFilename: string;
    detectedMimeType: string;
    sizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
  },
  accessLevel?: string
) {
  return {
    id:               doc._id,
    ownerId:          doc.ownerId,
    title:            doc.title,
    category:         doc.category,
    originalFilename: doc.originalFilename,
    detectedMimeType: doc.detectedMimeType,
    sizeBytes:        doc.sizeBytes,
    createdAt:        doc.createdAt,
    updatedAt:        doc.updatedAt,
    ...(accessLevel && { accessLevel }),
  };
}

// ── Zod Schemas ──────────────────────────────────────────────
const uploadMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(150, 'Title cannot exceed 150 characters'),
  category: z
    .nativeEnum(DocumentCategory, {
      message: 'Invalid category',
    })
    .default(DocumentCategory.OTHER),
});

const patchMetadataSchema = z
  .object({
    title: z.string().trim().min(1).max(150).optional(),
    category: z.nativeEnum(DocumentCategory).optional(),
  })
  .strict(); // Disallows any unauthorized fields like ownerId or storageKey

// ── POST /api/v1/documents ────────────────────────────────────
// Handles multipart file upload with server-side validation.
router.post(
  '/',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    // Multer single file middleware wrapper for custom error handling
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: `File size exceeds the limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
          });
          return;
        }
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
      } else if (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.UPLOAD_REJECTED,
          outcome: AuditOutcome.DENIED,
          requestId: getRequestId(req),
          metadata: { reason: 'No file attached' },
        });
        res.status(400).json({ error: 'No file attached to upload request' });
        return;
      }

      // 1. Validate metadata fields
      const metaResult = uploadMetadataSchema.safeParse(req.body);
      if (!metaResult.success) {
        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.UPLOAD_REJECTED,
          outcome: AuditOutcome.DENIED,
          requestId: getRequestId(req),
          metadata: { reason: 'Metadata validation failed' },
        });
        res.status(400).json({
          error: 'Validation failed',
          details: metaResult.error.flatten().fieldErrors,
        });
        return;
      }

      const { title, category } = metaResult.data;

      // 2. Validate file (magic bytes, size, allowlist, sanitize name)
      const fileValidation = validateUploadedFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      if (!fileValidation.valid) {
        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.UPLOAD_REJECTED,
          outcome: AuditOutcome.DENIED,
          requestId: getRequestId(req),
          metadata: { reason: fileValidation.error || 'Invalid file format or content' },
        });
        res.status(400).json({ error: fileValidation.error });
        return;
      }

      const originalFilename = fileValidation.sanitizedFilename!;
      const detectedMimeType = fileValidation.detectedMimeType!;
      const sizeBytes = req.file.buffer.length;

      // 3. Generate server-side random storage key (UUID + extension)
      const ext = path.extname(originalFilename).toLowerCase();
      const storageKey = `${crypto.randomUUID()}${ext}`;

      const storageService = getStorageService();

      // 4. Save to private storage first
      await storageService.saveFile(storageKey, req.file.buffer);

      // 5. Persist document record in MongoDB
      //    Owner ID is strictly taken from verified JWT session, NEVER from client body.
      try {
        const doc = await Document.create({
          ownerId: req.user!.userId,
          title,
          category,
          storageKey,
          originalFilename,
          detectedMimeType,
          sizeBytes,
        });

        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.DOCUMENT_UPLOADED,
          documentId: doc._id,
          outcome: AuditOutcome.SUCCESS,
          requestId: getRequestId(req),
          metadata: {
            title: doc.title,
            category: doc.category,
            sizeBytes: doc.sizeBytes,
            mimeType: doc.detectedMimeType,
          },
        });

        res.status(201).json({
          message: 'Document uploaded successfully',
          document: toSafeDocument(doc),
        });
      } catch (dbErr) {
        // If DB write fails, immediately clean up the file to prevent orphaned storage objects!
        await storageService.deleteFile(storageKey).catch(() => {});
        throw dbErr;
      }
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/documents ─────────────────────────────────────
// Lists documents owned by or actively shared with the authenticated user.
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category, search } = req.query;

    const filter: Record<string, unknown> = {};

    let userPermMap = new Map<string, PermissionLevel>();

    if (req.user!.role !== Role.ADMIN) {
      // Find all active permissions granted to this user
      const activePerms = await Permission.find({
        userId: req.user!.userId,
        revokedAt: null,
      });

      userPermMap = new Map(
        activePerms.map((p) => [p.documentId.toString(), p.permission])
      );

      const sharedDocIds = activePerms.map((p) => p.documentId);

      // Return documents owned by user OR actively shared with user
      filter.$or = [
        { ownerId: req.user!.userId },
        { _id: { $in: sharedDocIds } },
      ];
    }

    if (
      category &&
      typeof category === 'string' &&
      Object.values(DocumentCategory).includes(category as DocumentCategory)
    ) {
      filter.category = category;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    const docs = await Document.find(filter).sort({ createdAt: -1 });

    const safeDocs = docs.map((doc) => {
      let accessLevel = 'OWNER';
      if (req.user!.role === Role.ADMIN) {
        accessLevel = 'ADMIN';
      } else if (doc.ownerId.toString() !== req.user!.userId) {
        accessLevel = userPermMap.get(doc._id.toString()) || 'READ';
      }
      return toSafeDocument(doc, accessLevel);
    });

    res.status(200).json({
      documents: safeDocs,
      count: safeDocs.length,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/documents/recipients/list ─────────────────────
// Returns registered users (excluding current user) for the sharing dropdown.
router.get('/recipients/list', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find({ _id: { $ne: req.user!.userId } })
      .select('name email role')
      .sort({ name: 1 });

    res.status(200).json({
      users: users.map((u) => ({
        id:    u._id,
        name:  u.name,
        email: u.email,
        role:  u.role,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/documents/:id ─────────────────────────────────
// Get metadata for a specific document.
router.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doc = await documentAccessService.getDocumentWithAccess(
      req.params.id,
      req.user!,
      'read'
    );

    const accessLevel = await documentAccessService.getUserAccessLevel(req.user!, doc);

    await auditService.record({
      actorId: req.user!.userId,
      action: AuditAction.DOCUMENT_VIEWED,
      documentId: doc._id,
      outcome: AuditOutcome.SUCCESS,
      requestId: getRequestId(req),
      metadata: { title: doc.title, accessLevel },
    });

    res.status(200).json({
      document: toSafeDocument(doc, accessLevel),
    });
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      if (err.statusCode === 403) {
        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.DOCUMENT_ACCESS_DENIED,
          documentId: req.params.id,
          outcome: AuditOutcome.DENIED,
          requestId: getRequestId(req),
        });
      }
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── PATCH /api/v1/documents/:id ───────────────────────────────
// Update permitted metadata fields (title, category).
// Permitted for document OWNER or shared user with EDIT permission.
router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doc = await documentAccessService.getDocumentWithAccess(
      req.params.id,
      req.user!,
      'modify'
    );

    const result = patchMetadataSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed or disallowed fields present',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }

    if (result.data.title !== undefined) {
      doc.title = result.data.title;
    }
    if (result.data.category !== undefined) {
      doc.category = result.data.category;
    }

    await doc.save();

    await auditService.record({
      actorId: req.user!.userId,
      action: AuditAction.DOCUMENT_UPDATED,
      documentId: doc._id,
      outcome: AuditOutcome.SUCCESS,
      requestId: getRequestId(req),
      metadata: {
        updatedTitle: result.data.title !== undefined,
        updatedCategory: result.data.category !== undefined,
      },
    });

    res.status(200).json({
      message: 'Document metadata updated successfully',
      document: toSafeDocument(doc),
    });
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      if (err.statusCode === 403) {
        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.DOCUMENT_UPDATE_DENIED,
          documentId: req.params.id,
          outcome: AuditOutcome.DENIED,
          requestId: getRequestId(req),
        });
      }
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── DELETE /api/v1/documents/:id ──────────────────────────────
// Deletes both the storage file and the DB document.
// Only OWNER (or ADMIN) can delete.
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doc = await documentAccessService.getDocumentWithAccess(
      req.params.id,
      req.user!,
      'delete'
    );

    const storageService = getStorageService();

    // 1. Delete physical file from private storage
    await storageService.deleteFile(doc.storageKey);

    // 2. Clean up any associated permissions
    await Permission.deleteMany({ documentId: doc._id });

    // 3. Delete database record
    await Document.findByIdAndDelete(doc._id);

    await auditService.record({
      actorId: req.user!.userId,
      action: AuditAction.DOCUMENT_DELETED,
      documentId: doc._id,
      outcome: AuditOutcome.SUCCESS,
      requestId: getRequestId(req),
      metadata: { title: doc.title },
    });

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      if (err.statusCode === 403) {
        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.DOCUMENT_DELETE_DENIED,
          documentId: req.params.id,
          outcome: AuditOutcome.DENIED,
          requestId: getRequestId(req),
        });
      }
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── GET /api/v1/documents/:id/download ────────────────────────
// Streams the document through the backend with hardened security headers.
router.get('/:id/download', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doc = await documentAccessService.getDocumentWithAccess(
      req.params.id,
      req.user!,
      'read'
    );

    const storageService = getStorageService();
    const fileStream = await storageService.getFileStream(doc.storageKey);

    const safeFilename = sanitizeFilename(doc.originalFilename);

    await auditService.record({
      actorId: req.user!.userId,
      action: AuditAction.DOCUMENT_DOWNLOADED,
      documentId: doc._id,
      outcome: AuditOutcome.SUCCESS,
      requestId: getRequestId(req),
      metadata: { filename: safeFilename, sizeBytes: doc.sizeBytes },
    });

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(safeFilename)}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
    );
    res.setHeader('Content-Type', doc.detectedMimeType);
    res.setHeader('Content-Length', doc.sizeBytes);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    await pipeline(fileStream, res);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      if (err.statusCode === 403) {
        await auditService.record({
          actorId: req.user!.userId,
          action: AuditAction.DOCUMENT_ACCESS_DENIED,
          documentId: req.params.id,
          outcome: AuditOutcome.DENIED,
          requestId: getRequestId(req),
        });
      }
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// PERMISSIONS / SHARING ENDPOINTS (PHASE 4)
// ─────────────────────────────────────────────────────────────

const grantPermissionSchema = z.object({
  permission: z.nativeEnum(PermissionLevel, {
    message: 'Permission must be either READ or EDIT',
  }),
});

// ── PUT /api/v1/documents/:id/permissions/:userId ─────────────
// Grants or updates READ/EDIT permission for a recipient user.
// Strictly restricted to the document OWNER (or system ADMIN).
router.put(
  '/:id/permissions/:userId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, userId: recipientUserId } = req.params;

      // 1. Validate IDs
      if (!isValidObjectId(id)) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      if (!isValidObjectId(recipientUserId)) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // 2. Authorize sharing management (Owner or Admin only)
      const doc = await documentAccessService.getDocumentWithAccess(
        id,
        req.user!,
        'share'
      );

      // 3. Prevent sharing with self (owner already has full ownership)
      if (doc.ownerId.toString() === recipientUserId) {
        res.status(400).json({ error: 'Owner already has full access to this document' });
        return;
      }

      // 4. Verify recipient user exists in database
      const recipient = await User.findById(recipientUserId);
      if (!recipient) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // 5. Validate permission level (READ or EDIT)
      const parseResult = grantPermissionSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Invalid permission payload',
          details: parseResult.error.flatten().fieldErrors,
        });
        return;
      }

      const { permission } = parseResult.data;

      // 6. Atomic race-safe upsert on { documentId, userId }
      //    Derives grantedBy strictly from the verified session (req.user.userId).
      //    Resets revokedAt to null if previously revoked.
      const permDoc = await Permission.findOneAndUpdate(
        { documentId: doc._id, userId: recipient._id },
        {
          $set: {
            permission,
            grantedBy: req.user!.userId,
            revokedAt: null,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )
        .populate('userId', 'name email role')
        .populate('grantedBy', 'name email role');

      await auditService.record({
        actorId: req.user!.userId,
        action: AuditAction.PERMISSION_GRANTED,
        documentId: doc._id,
        targetUserId: recipient._id,
        outcome: AuditOutcome.SUCCESS,
        requestId: getRequestId(req),
        metadata: { permission },
      });

      res.status(200).json({
        message: `Granted ${permission} permission to ${recipient.email}`,
        permission: {
          id:         permDoc!._id,
          documentId: permDoc!.documentId,
          permission: permDoc!.permission,
          user:       permDoc!.userId,
          grantedBy:  permDoc!.grantedBy,
          revokedAt:  permDoc!.revokedAt,
          createdAt:  permDoc!.createdAt,
          updatedAt:  permDoc!.updatedAt,
        },
      });
    } catch (err) {
      if (err instanceof DocumentAccessError) {
        if (err.statusCode === 403) {
          await auditService.record({
            actorId: req.user!.userId,
            action: AuditAction.PERMISSION_CHANGE_DENIED,
            documentId: req.params.id,
            targetUserId: req.params.userId,
            outcome: AuditOutcome.DENIED,
            requestId: getRequestId(req),
          });
        }
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

// ── GET /api/v1/documents/:id/permissions ─────────────────────
// Lists all permissions (active & historical) for a document.
// Restricted to the document OWNER (or system ADMIN).
router.get(
  '/:id/permissions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const doc = await documentAccessService.getDocumentWithAccess(
        id,
        req.user!,
        'share'
      );

      const perms = await Permission.find({ documentId: doc._id })
        .populate('userId', 'name email role')
        .populate('grantedBy', 'name email role')
        .sort({ createdAt: -1 });

      res.status(200).json({
        documentId: doc._id,
        permissions: perms.map((p) => ({
          id:         p._id,
          documentId: p.documentId,
          permission: p.permission,
          user:       p.userId,
          grantedBy:  p.grantedBy,
          revokedAt:  p.revokedAt,
          createdAt:  p.createdAt,
          updatedAt:  p.updatedAt,
        })),
      });
    } catch (err) {
      if (err instanceof DocumentAccessError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

// ── DELETE /api/v1/documents/:id/permissions/:userId ──────────
// Revokes permission for a recipient. Immediate effect on subsequent requests.
// Restricted to the document OWNER (or system ADMIN).
router.delete(
  '/:id/permissions/:userId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id, userId: recipientUserId } = req.params;

      if (!isValidObjectId(id) || !isValidObjectId(recipientUserId)) {
        res.status(404).json({ error: 'Document or user not found' });
        return;
      }

      const doc = await documentAccessService.getDocumentWithAccess(
        id,
        req.user!,
        'share'
      );

      // Cannot revoke owner's own access
      if (doc.ownerId.toString() === recipientUserId) {
        res.status(400).json({ error: 'Cannot revoke owner access' });
        return;
      }

      // Find active permission
      const perm = await Permission.findOne({
        documentId: doc._id,
        userId: recipientUserId,
        revokedAt: null,
      });

      if (!perm) {
        res.status(404).json({ error: 'Active permission not found for this user' });
        return;
      }

      // Record revocation timestamp
      perm.revokedAt = new Date();
      await perm.save();

      await auditService.record({
        actorId: req.user!.userId,
        action: AuditAction.PERMISSION_REVOKED,
        documentId: doc._id,
        targetUserId: recipientUserId,
        outcome: AuditOutcome.SUCCESS,
        requestId: getRequestId(req),
      });

      res.status(200).json({ message: 'Permission revoked successfully' });
    } catch (err) {
      if (err instanceof DocumentAccessError) {
        if (err.statusCode === 403) {
          await auditService.record({
            actorId: req.user!.userId,
            action: AuditAction.PERMISSION_CHANGE_DENIED,
            documentId: req.params.id,
            targetUserId: req.params.userId,
            outcome: AuditOutcome.DENIED,
            requestId: getRequestId(req),
          });
        }
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      next(err);
    }
  }
);

export default router;
