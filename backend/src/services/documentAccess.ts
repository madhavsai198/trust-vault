// src/services/documentAccess.ts
// ─────────────────────────────────────────────────────────────
// Centralized document authorization and access control service.
//
// Security principles:
// 1. Single Responsibility: Authorization decisions live here, not
//    scattered across route controllers.
// 2. Least Privilege: Only the document owner (or system ADMIN) can read,
//    modify, or delete a document.
// 3. User IDs are NEVER trusted from client inputs (headers/body/params).
//    They are strictly obtained from the verified JWT token payload.
// ─────────────────────────────────────────────────────────────

import { isValidObjectId } from 'mongoose';
import Document, { IDocument } from '../models/Document';
import { AuthPayload } from '../middleware/auth';
import { Role } from '../models/User';

export class DocumentAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'DocumentAccessError';
  }
}

export class DocumentAccessService {
  /**
   * Checks whether the given user is authorized to read/download the document.
   */
  canAccess(user: AuthPayload, doc: IDocument): boolean {
    if (user.role === Role.ADMIN) return true;
    return doc.ownerId.toString() === user.userId;
  }

  /**
   * Checks whether the given user is authorized to update metadata.
   */
  canModify(user: AuthPayload, doc: IDocument): boolean {
    if (user.role === Role.ADMIN) return true;
    return doc.ownerId.toString() === user.userId;
  }

  /**
   * Checks whether the given user is authorized to delete the document.
   */
  canDelete(user: AuthPayload, doc: IDocument): boolean {
    if (user.role === Role.ADMIN) return true;
    return doc.ownerId.toString() === user.userId;
  }

  /**
   * Retrieves a document by ID and verifies authorization for the requested action.
   * Throws 404 if not found, 403 if forbidden.
   */
  async getDocumentWithAccess(
    documentId: string,
    user: AuthPayload,
    action: 'read' | 'modify' | 'delete'
  ): Promise<IDocument> {
    if (!isValidObjectId(documentId)) {
      throw new DocumentAccessError('Document not found', 404);
    }

    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new DocumentAccessError('Document not found', 404);
    }

    let isAuthorized = false;
    switch (action) {
      case 'read':
        isAuthorized = this.canAccess(user, doc);
        break;
      case 'modify':
        isAuthorized = this.canModify(user, doc);
        break;
      case 'delete':
        isAuthorized = this.canDelete(user, doc);
        break;
    }

    if (!isAuthorized) {
      throw new DocumentAccessError('Access denied: You do not have permission for this document', 403);
    }

    return doc;
  }
}

export const documentAccessService = new DocumentAccessService();
