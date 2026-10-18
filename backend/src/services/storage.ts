// src/services/storage.ts
// ─────────────────────────────────────────────────────────────
// Private storage service interface and local filesystem adapter.
//
// Security decisions:
//
// 1. Files are stored strictly outside the frontend and public web root.
//    No web server can directly map a URL to these files.
//
// 2. Storage keys are validated against path traversal (no `..`, no
//    slashes, no null bytes). The resolved path is verified to remain
//    within the designated storage directory boundary.
//
// 3. Storage is modular: an S3/GCS adapter can implement `IStorageService`
//    without modifying controller or business logic.
// ─────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export interface IStorageService {
  saveFile(key: string, data: Buffer | Readable): Promise<void>;
  getFileStream(key: string): Promise<Readable>;
  deleteFile(key: string): Promise<void>;
  fileExists(key: string): Promise<boolean>;
  getStoragePath(): string;
}

export class LocalStorageService implements IStorageService {
  private readonly baseDir: string;

  constructor(customPath?: string) {
    // Default to a private directory in backend/storage/vault
    this.baseDir = path.resolve(
      customPath || process.env.STORAGE_PATH || path.join(process.cwd(), 'vault-storage')
    );

    // Ensure the private storage directory exists with restricted permissions
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o700 });
    }
  }

  getStoragePath(): string {
    return this.baseDir;
  }

  /**
   * Resolves a key to an absolute filesystem path and enforces path traversal guards.
   */
  private resolveSafePath(key: string): string {
    // Disallow path separators and parent directory traversal
    if (key.includes('..') || key.includes('/') || key.includes('\\') || key.includes('\0')) {
      throw new Error('Invalid storage key: path traversal detected');
    }

    const resolved = path.resolve(this.baseDir, key);

    // Double check that the resolved path is strictly within baseDir
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error('Security violation: path traversal attempt prevented');
    }

    return resolved;
  }

  async saveFile(key: string, data: Buffer | Readable): Promise<void> {
    const filePath = this.resolveSafePath(key);

    if (Buffer.isBuffer(data)) {
      await fs.promises.writeFile(filePath, data, { mode: 0o600 });
    } else {
      const writeStream = fs.createWriteStream(filePath, { mode: 0o600 });
      await pipeline(data, writeStream);
    }
  }

  async getFileStream(key: string): Promise<Readable> {
    const filePath = this.resolveSafePath(key);

    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      throw new Error('File not found in storage');
    }

    return fs.createReadStream(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = this.resolveSafePath(key);
      await fs.promises.unlink(filePath);
    } catch (err: unknown) {
      // Ignore if file was already deleted or doesn't exist (ENOENT)
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

// Global default instance
let defaultStorageService: IStorageService = new LocalStorageService();

export function getStorageService(): IStorageService {
  return defaultStorageService;
}

export function setStorageService(service: IStorageService): void {
  defaultStorageService = service;
}
