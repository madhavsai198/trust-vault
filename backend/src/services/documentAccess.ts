// src/services/documentAccess.ts
// ─────────────────────────────────────────────────────────────
// Centralized document authorization and access control service.
//
// Security principles:
// 1. Single Responsibility: All authorization checks (owner, ADMIN,
//    shared READ/EDIT permissions) live here.
// 2. Least Privilege:
//    - Owner & Admin: full access (read, modify, delete, share).
//    - READ recipient: can read metadata and stream download.
//    - EDIT recipient: can read, download, and modify metadata (title/category).
//      (Recipients CANNOT delete documents or manage sharing permissions).
//    - Revoked or unshared: denied immediately with 403 Forbidden.
// 3. User IDs are NEVER trusted from client inputs (headers/body/params).
//    They are strictly obtained from the verified JWT token payload.
// ─────────────────────────────────────────────────────────────

import { isValidObjectId } from 'mongoose';
import Document, { IDocument } from '../models/Document';
import Permission, { PermissionLevel } from '../models/Permission';
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

export type AccessLevel = 'OWNER' | 'ADMIN' | 'EDIT' | 'READ' | 'NONE';

export class DocumentAccessService {
  /**
   * Determines the user's specific access level on a given document.
   */
  async getUserAccessLevel(user: AuthPayload, doc: IDocument): Promise<AccessLevel> {
    if (user.role === Role.ADMIN) return 'ADMIN';
    if (doc.ownerId.toString() === user.userId) return 'OWNER';

    const activePerm = await Permission.findOne({
      documentId: doc._id,
      userId: user.userId,
      revokedAt: null,
    });

    if (!activePerm) return 'NONE';
    return activePerm.permission === PermissionLevel.EDIT ? 'EDIT' : 'READ';
  }

  /**
   * Checks whether the given user is authorized to read/download the document.
   */
  async canAccess(user: AuthPayload, doc: IDocument): Promise<boolean> {
    if (user.role === Role.ADMIN) return true;
    if (doc.ownerId.toString() === user.userId) return true;

    const perm = await Permission.findOne({
      documentId: doc._id,
      userId: user.userId,
      revokedAt: null,
    });

    return perm !== null;
  }

  /**
   * Checks whether the given user is authorized to update metadata.
   */
  async canModify(user: AuthPayload, doc: IDocument): Promise<boolean> {
    if (user.role === Role.ADMIN) return true;
    if (doc.ownerId.toString() === user.userId) return true;

    const perm = await Permission.findOne({
      documentId: doc._id,
      userId: user.userId,
      revokedAt: null,
      permission: PermissionLevel.EDIT,
    });

    return perm !== null;
  }

  /**
   * Checks whether the given user is authorized to delete the document.
   * Only the document OWNER (or system ADMIN) can permanently delete.
   */
  canDelete(user: AuthPayload, doc: IDocument): boolean {
    if (user.role === Role.ADMIN) return true;
    return doc.ownerId.toString() === user.userId;
  }

  /**
   * Checks whether the user can manage permissions (grant/revoke/list).
   * Only the document OWNER (or system ADMIN) can manage sharing.
   */
  canManagePermissions(user: AuthPayload, doc: IDocument): boolean {
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
    action: 'read' | 'modify' | 'delete' | 'share'
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
        isAuthorized = await this.canAccess(user, doc);
        break;
      case 'modify':
        isAuthorized = await this.canModify(user, doc);
        break;
      case 'delete':
        isAuthorized = this.canDelete(user, doc);
        break;
      case 'share':
        isAuthorized = this.canManagePermissions(user, doc);
        break;
    }

    if (!isAuthorized) {
      throw new DocumentAccessError(
        'Access denied: You do not have permission for this document',
        403
      );
    }

    return doc;
  }
}

export const documentAccessService = new DocumentAccessService();
