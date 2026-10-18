// src/models/Document.ts
// ─────────────────────────────────────────────────────────────
// Mongoose schema for TrustVault private documents.
//
// Security decisions documented for technical interview:
//
// 1. `storageKey` is a server-generated random identifier (UUIDv4).
//    The client's original filename is never used on the filesystem,
//    eliminating all path traversal, overwrite, or shell injection risks.
//
// 2. `ownerId` references the User who created the document.
//    Ownership is derived strictly from the verified JWT session,
//    never from request body parameters (prevents IDOR / spoofing).
//
// 3. File content is stored in private isolated storage outside
//    the web server root. Only metadata and the storage key live here.
//
// 4. Compound index on { ownerId: 1, createdAt: -1 } ensures fast,
//    efficient querying when listing a user's private documents.
// ─────────────────────────────────────────────────────────────

import { Schema, model, Document as MongooseDoc, Types } from 'mongoose';

export enum DocumentCategory {
  FINANCIAL = 'FINANCIAL',
  LEGAL     = 'LEGAL',
  MEDICAL   = 'MEDICAL',
  PERSONAL  = 'PERSONAL',
  TAX       = 'TAX',
  OTHER     = 'OTHER',
}

export interface IDocument extends MongooseDoc {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  category: DocumentCategory;
  storageKey: string;
  originalFilename: string;
  detectedMimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Document owner ID is required'],
      index: true,
    },

    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    category: {
      type: String,
      enum: {
        values: Object.values(DocumentCategory),
        message: 'Invalid document category',
      },
      default: DocumentCategory.OTHER,
      index: true,
    },

    storageKey: {
      type: String,
      required: [true, 'Storage key is required'],
      unique: true,
      index: true,
    },

    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
      maxlength: [255, 'Filename cannot exceed 255 characters'],
    },

    detectedMimeType: {
      type: String,
      required: [true, 'Detected MIME type is required'],
    },

    sizeBytes: {
      type: Number,
      required: [true, 'File size in bytes is required'],
      min: [1, 'File cannot be empty'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user document listing sorted by newest first
documentSchema.index({ ownerId: 1, createdAt: -1 });

const Document = model<IDocument>('Document', documentSchema);
export default Document;
