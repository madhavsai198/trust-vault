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
import { requireAuth } from '../middleware/auth';
import Document, { DocumentCategory } from '../models/Document';
import { getStorageService } from '../services/storage';
import { documentAccessService, DocumentAccessError } from '../services/documentAccess';
import {
  validateUploadedFile,
  MAX_FILE_SIZE_BYTES,
  sanitizeFilename,
} from '../lib/fileValidation';
import { Role } from '../models/User';

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
function toSafeDocument(doc: {
  _id: unknown;
  ownerId: unknown;
  title: string;
  category: string;
  originalFilename: string;
  detectedMimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}) {
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
        res.status(400).json({ error: 'No file attached to upload request' });
        return;
      }

      // 1. Validate metadata fields
      const metaResult = uploadMetadataSchema.safeParse(req.body);
      if (!metaResult.success) {
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
// Lists documents owned by the authenticated user (or all if ADMIN).
router.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { category, search } = req.query;

    const filter: Record<string, unknown> = {};

    // Standard users only see documents they own
    if (req.user!.role !== Role.ADMIN) {
      filter.ownerId = req.user!.userId;
    }

    if (category && typeof category === 'string' && Object.values(DocumentCategory).includes(category as DocumentCategory)) {
      filter.category = category;
    }

    if (search && typeof search === 'string' && search.trim()) {
      // Escape regex special chars to prevent regex injection attacks
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    const docs = await Document.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      documents: docs.map(toSafeDocument),
      count: docs.length,
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

    res.status(200).json({
      document: toSafeDocument(doc),
    });
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── PATCH /api/v1/documents/:id ───────────────────────────────
// Update permitted metadata fields (title, category).
router.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Authorize modification
    const doc = await documentAccessService.getDocumentWithAccess(
      req.params.id,
      req.user!,
      'modify'
    );

    // 2. Validate input — strictly disallows modifying ownerId, storageKey, sizeBytes, etc.
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

    res.status(200).json({
      message: 'Document metadata updated successfully',
      document: toSafeDocument(doc),
    });
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── DELETE /api/v1/documents/:id ──────────────────────────────
// Deletes both the storage file and the DB document.
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

    // 2. Delete database record
    await Document.findByIdAndDelete(doc._id);

    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (err) {
    if (err instanceof DocumentAccessError) {
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
    // 1. Recheck current permissions on every request
    const doc = await documentAccessService.getDocumentWithAccess(
      req.params.id,
      req.user!,
      'read'
    );

    const storageService = getStorageService();

    // 2. Obtain file read stream from private storage
    const fileStream = await storageService.getFileStream(doc.storageKey);

    // 3. Set hardened response headers
    // - Content-Disposition with sanitized filename
    // - Prevent MIME sniffing
    // - Aggressive no-cache so revoked permissions cannot be bypassed via browser cache
    const safeFilename = sanitizeFilename(doc.originalFilename);
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

    // 4. Stream response
    await pipeline(fileStream, res);
  } catch (err) {
    if (err instanceof DocumentAccessError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
