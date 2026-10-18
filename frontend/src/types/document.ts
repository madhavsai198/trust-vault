// src/types/document.ts

export type DocumentCategory =
  | 'FINANCIAL'
  | 'LEGAL'
  | 'MEDICAL'
  | 'PERSONAL'
  | 'TAX'
  | 'OTHER';

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
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OWNER' | 'VIEWER';
  createdAt?: string;
}
