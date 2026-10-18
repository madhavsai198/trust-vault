// src/types/document.ts

export type DocumentCategory =
  | 'FINANCIAL'
  | 'LEGAL'
  | 'MEDICAL'
  | 'PERSONAL'
  | 'TAX'
  | 'OTHER';

export type AccessLevel = 'OWNER' | 'ADMIN' | 'EDIT' | 'READ' | 'NONE';

export interface VaultDocument {
  id: string;
  ownerId: string;
  title: string;
  category: DocumentCategory;
  originalFilename: string;
  detectedMimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  accessLevel?: AccessLevel;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OWNER' | 'VIEWER';
  createdAt?: string;
}

export interface DocumentPermission {
  id: string;
  documentId: string;
  permission: 'READ' | 'EDIT';
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  grantedBy: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipientUser {
  id: string;
  name: string;
  email: string;
  role: string;
}
