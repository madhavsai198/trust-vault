// src/lib/fileValidation.ts
// ─────────────────────────────────────────────────────────────
// File validation, MIME detection, and magic byte signature verification.
//
// Security principles:
// 1. NEVER trust client-supplied Content-Type or filename.
// 2. An explicit allowlist of extensions and MIME types is enforced.
// 3. Magic bytes (file signatures) are inspected from file buffer headers
//    to ensure the actual file contents match the claimed format.
// 4. Filenames are aggressively sanitized to prevent path traversal,
//    command injection, and header injection.
// ─────────────────────────────────────────────────────────────

import path from 'path';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB conservative limit

export interface AllowedFileType {
  extension: string;
  mimeType: string;
  verifyMagicBytes: (buffer: Buffer) => boolean;
}

export const ALLOWED_FILE_TYPES: Record<string, AllowedFileType> = {
  '.pdf': {
    extension: '.pdf',
    mimeType: 'application/pdf',
    verifyMagicBytes: (buf: Buffer) => {
      // PDF starts with %PDF- (hex: 25 50 44 46 2d)
      if (buf.length < 5) return false;
      return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
    },
  },
  '.png': {
    extension: '.png',
    mimeType: 'image/png',
    verifyMagicBytes: (buf: Buffer) => {
      // PNG starts with 89 50 4E 47 0D 0A 1A 0A
      if (buf.length < 8) return false;
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      return signature.every((byte, idx) => buf[idx] === byte);
    },
  },
  '.jpg': {
    extension: '.jpg',
    mimeType: 'image/jpeg',
    verifyMagicBytes: (buf: Buffer) => {
      // JPEG starts with FF D8 FF
      if (buf.length < 3) return false;
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    },
  },
  '.jpeg': {
    extension: '.jpeg',
    mimeType: 'image/jpeg',
    verifyMagicBytes: (buf: Buffer) => {
      if (buf.length < 3) return false;
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    },
  },
  '.docx': {
    extension: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    verifyMagicBytes: (buf: Buffer) => {
      // OpenXML (ZIP) starts with PK\x03\x04 (50 4B 03 04)
      if (buf.length < 4) return false;
      return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    },
  },
  '.xlsx': {
    extension: '.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    verifyMagicBytes: (buf: Buffer) => {
      // OpenXML (ZIP) starts with PK\x03\x04 (50 4B 03 04)
      if (buf.length < 4) return false;
      return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    },
  },
  '.txt': {
    extension: '.txt',
    mimeType: 'text/plain',
    verifyMagicBytes: (buf: Buffer) => {
      // Plain text should contain valid printable or whitespace characters, no null bytes
      const sample = buf.subarray(0, Math.min(buf.length, 1024));
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0x00) return false; // Null byte indicates binary content
      }
      return true;
    },
  },
};

/**
 * Sanitizes an untrusted filename received from the client.
 * Strips path traversal sequences, replaces non-alphanumeric chars,
 * and preserves only a single safe extension.
 */
export function sanitizeFilename(untrustedName: string): string {
  if (!untrustedName || typeof untrustedName !== 'string') {
    return 'document.bin';
  }

  // 1. Strip all directory components
  const baseName = path.basename(untrustedName);

  // 2. Extract extension in lowercase
  const rawExt = path.extname(baseName).toLowerCase();
  const nameWithoutExt = path.basename(baseName, rawExt);

  // 3. Clean the name: allow alphanumeric, hyphens, underscores, spaces
  const cleanName = nameWithoutExt
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 100);

  // 4. Validate or fallback extension
  const safeExt = rawExt.replace(/[^a-z0-9.]/g, '');

  const finalName = `${cleanName || 'document'}${safeExt}`;
  return finalName;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
  sanitizedFilename?: string;
}

/**
 * Performs full server-side validation on an uploaded file.
 */
export function validateUploadedFile(
  fileBuffer: Buffer,
  originalFilename: string,
  declaredMimeType?: string
): ValidationResult {
  if (!fileBuffer || fileBuffer.length === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the conservative limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
    };
  }

  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized).toLowerCase();

  const fileTypeConfig = ALLOWED_FILE_TYPES[ext];
  if (!fileTypeConfig) {
    return {
      valid: false,
      error: `File extension '${ext}' is not supported. Allowed formats: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}`,
    };
  }

  // Verify magic bytes signature
  const signatureMatches = fileTypeConfig.verifyMagicBytes(fileBuffer);
  if (!signatureMatches) {
    return {
      valid: false,
      error: `File content signature (magic bytes) does not match the claimed file type '${ext}'`,
    };
  }

  return {
    valid: true,
    detectedMimeType: fileTypeConfig.mimeType,
    sanitizedFilename: sanitized,
  };
}
