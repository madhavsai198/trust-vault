// tests/documents.test.ts
// ─────────────────────────────────────────────────────────────
// Comprehensive test suite for Phase 3 Document Management:
//
// 1. Unauthenticated upload and download rejected (401)
// 2. Owner uploading and retrieving their document (201, 200)
// 3. Unauthorized access by another user rejected (403)
// 4. Forged ownerId in upload payload ignored / overridden
// 5. Invalid file type & signature mismatch rejected (400)
// 6. Oversized file (>10MB) rejected (400)
// 7. Path traversal in filenames sanitized safely
// 8. Unauthorized edits (PATCH) & deletions (DELETE) rejected (403)
// 9. Disallowed metadata fields (ownerId, storageKey) in PATCH rejected (400)
// 10. Storage cleanup on DB persistence failure (zero orphaned files)
// 11. Download headers (Content-Disposition, nosniff, no-cache) & content integrity
// 12. Correct 404 handling on missing / invalid IDs
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import os from 'os';
import path from 'path';
import fs from 'fs';
import app from '../src/server';
import User, { Role } from '../src/models/User';
import Document, { DocumentCategory } from '../src/models/Document';
import { setStorageService, LocalStorageService, getStorageService } from '../src/services/storage';

let mongoServer: MongoMemoryServer;
let testStorageDir: string;
let storageService: LocalStorageService;

// Valid dummy files
const validPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF'
);
const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);
const validTxtBuffer = Buffer.from('TrustVault confidential test content.');

beforeAll(async () => {
  // 1. Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongoServer.getUri());

  // 2. Create isolated test storage directory
  testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-storage-'));
  storageService = new LocalStorageService(testStorageDir);
  setStorageService(storageService);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  // Clean up test storage directory
  if (testStorageDir && fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Document.deleteMany({});
  if (testStorageDir && fs.existsSync(testStorageDir)) {
    const files = fs.readdirSync(testStorageDir);
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(testStorageDir, file));
      } catch {}
    }
  }
});

// ── Helper to register a user and return cookie + user data ──
async function createAuthenticatedUser(
  name: string,
  email: string,
  password = 'ValidPassword@123'
) {
  const regRes = await request(app)
    .post('/auth/register')
    .send({ name, email, password });

  const cookies = regRes.headers['set-cookie'] as unknown as string[];
  return {
    user: regRes.body.user,
    cookies,
  };
}

describe('Phase 3: Secure Document Management', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Unauthenticated Requests
  // ─────────────────────────────────────────────────────────────
  describe('Unauthenticated access controls', () => {
    it('rejects unauthenticated document upload with 401', async () => {
      const res = await request(app)
        .post('/api/v1/documents')
        .field('title', 'Tax Return')
        .attach('file', validPdfBuffer, 'taxes.pdf');

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not authenticated/i);
    });

    it('rejects unauthenticated document listing with 401', async () => {
      const res = await request(app).get('/api/v1/documents');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated document download with 401', async () => {
      const dummyId = new mongoose.Types.ObjectId().toString();
      const res = await request(app).get(`/api/v1/documents/${dummyId}/download`);
      expect(res.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Owner Upload, Retrieval, and Listing
  // ─────────────────────────────────────────────────────────────
  describe('Owner document lifecycle', () => {
    it('allows owner to upload a valid document and returns 201 with metadata', async () => {
      const { cookies, user } = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookies)
        .field('title', 'Financial Statement 2026')
        .field('category', DocumentCategory.FINANCIAL)
        .attach('file', validPdfBuffer, 'statement.pdf');

      expect(res.status).toBe(201);
      expect(res.body.document).toBeDefined();
      expect(res.body.document.title).toBe('Financial Statement 2026');
      expect(res.body.document.category).toBe(DocumentCategory.FINANCIAL);
      expect(res.body.document.ownerId.toString()).toBe(user.id);
      expect(res.body.document.detectedMimeType).toBe('application/pdf');
      expect(res.body.document.sizeBytes).toBe(validPdfBuffer.length);
      // Ensure internal storageKey is NEVER leaked in the API response
      expect(res.body.document.storageKey).toBeUndefined();
    });

    it('lists only documents owned by the calling user', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');
      const bob = await createAuthenticatedUser('Bob', 'bob@vault.dev');

      // Alice uploads 2 documents
      await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Alice Contract')
        .field('category', DocumentCategory.LEGAL)
        .attach('file', validPdfBuffer, 'contract.pdf');

      await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Alice Medical')
        .field('category', DocumentCategory.MEDICAL)
        .attach('file', validPdfBuffer, 'medical.pdf');

      // Bob uploads 1 document
      await request(app)
        .post('/api/v1/documents')
        .set('Cookie', bob.cookies)
        .field('title', 'Bob Personal')
        .field('category', DocumentCategory.PERSONAL)
        .attach('file', validTxtBuffer, 'notes.txt');

      // Alice listing
      const aliceList = await request(app)
        .get('/api/v1/documents')
        .set('Cookie', alice.cookies);

      expect(aliceList.status).toBe(200);
      expect(aliceList.body.documents.length).toBe(2);
      expect(aliceList.body.documents.every((d: any) => d.ownerId === alice.user.id)).toBe(true);

      // Bob listing
      const bobList = await request(app)
        .get('/api/v1/documents')
        .set('Cookie', bob.cookies);

      expect(bobList.status).toBe(200);
      expect(bobList.body.documents.length).toBe(1);
      expect(bobList.body.documents[0].title).toBe('Bob Personal');
    });

    it('supports search and category filtering on document listing', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Quarterly Audit Report')
        .field('category', DocumentCategory.FINANCIAL)
        .attach('file', validPdfBuffer, 'audit.pdf');

      await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Employment Agreement')
        .field('category', DocumentCategory.LEGAL)
        .attach('file', validPdfBuffer, 'agreement.pdf');

      // Filter by category
      const catRes = await request(app)
        .get(`/api/v1/documents?category=${DocumentCategory.LEGAL}`)
        .set('Cookie', alice.cookies);

      expect(catRes.status).toBe(200);
      expect(catRes.body.documents.length).toBe(1);
      expect(catRes.body.documents[0].title).toBe('Employment Agreement');

      // Search by title keyword
      const searchRes = await request(app)
        .get('/api/v1/documents?search=audit')
        .set('Cookie', alice.cookies);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.documents.length).toBe(1);
      expect(searchRes.body.documents[0].title).toBe('Quarterly Audit Report');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Unauthorized Cross-User Access (IDOR Prevention)
  // ─────────────────────────────────────────────────────────────
  describe('Cross-user authorization defense (IDOR prevention)', () => {
    it('returns 403 when User B attempts to get User A document metadata', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');
      const bob = await createAuthenticatedUser('Bob', 'bob@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Confidential Patent')
        .field('category', DocumentCategory.LEGAL)
        .attach('file', validPdfBuffer, 'patent.pdf');

      const docId = uploadRes.body.document.id;

      // Bob attempts to read Alice's document metadata
      const res = await request(app)
        .get(`/api/v1/documents/${docId}`)
        .set('Cookie', bob.cookies);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access denied/i);
    });

    it('returns 403 when User B attempts to download User A document', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');
      const bob = await createAuthenticatedUser('Bob', 'bob@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Secret Financials')
        .field('category', DocumentCategory.FINANCIAL)
        .attach('file', validPdfBuffer, 'secret.pdf');

      const docId = uploadRes.body.document.id;

      // Bob attempts to download Alice's document
      const res = await request(app)
        .get(`/api/v1/documents/${docId}/download`)
        .set('Cookie', bob.cookies);

      expect(res.status).toBe(403);
    });

    it('returns 403 when User B attempts to modify (PATCH) User A document metadata', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');
      const bob = await createAuthenticatedUser('Bob', 'bob@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Original Title')
        .attach('file', validPdfBuffer, 'doc.pdf');

      const docId = uploadRes.body.document.id;

      const res = await request(app)
        .patch(`/api/v1/documents/${docId}`)
        .set('Cookie', bob.cookies)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);

      // Verify in DB that title was untouched
      const freshDoc = await Document.findById(docId);
      expect(freshDoc?.title).toBe('Original Title');
    });

    it('returns 403 when User B attempts to delete User A document', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');
      const bob = await createAuthenticatedUser('Bob', 'bob@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Do Not Delete')
        .attach('file', validPdfBuffer, 'safe.pdf');

      const docId = uploadRes.body.document.id;

      const res = await request(app)
        .delete(`/api/v1/documents/${docId}`)
        .set('Cookie', bob.cookies);

      expect(res.status).toBe(403);

      // Verify doc still exists
      const freshDoc = await Document.findById(docId);
      expect(freshDoc).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Forged ownerId Prevention
  // ─────────────────────────────────────────────────────────────
  describe('Forged ownerId parameter handling', () => {
    it('strictly derives ownerId from session, ignoring any client-sent ownerId', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');
      const bob = await createAuthenticatedUser('Bob', 'bob@vault.dev');

      // Alice sends Bob's user ID in the form data
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Attempted Spoof')
        .field('ownerId', bob.user.id)
        .attach('file', validPdfBuffer, 'spoof.pdf');

      expect(res.status).toBe(201);
      // Must be owned by Alice, NOT Bob
      expect(res.body.document.ownerId.toString()).toBe(alice.user.id);
      expect(res.body.document.ownerId.toString()).not.toBe(bob.user.id);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. File Validation & Magic Byte Signature Verification
  // ─────────────────────────────────────────────────────────────
  describe('File validation & magic bytes verification', () => {
    it('rejects unsupported file extensions (e.g. .exe)', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Malicious File')
        .attach('file', Buffer.from('MZ\x90\x00'), 'malware.exe');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not supported/i);
    });

    it('rejects files where magic bytes contradict claimed extension (signature mismatch)', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      // Renamed fake file: plain text pretending to be a PDF
      const fakePdfBuffer = Buffer.from('I am just plain text, not a real PDF');

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Spoofed PDF')
        .attach('file', fakePdfBuffer, 'fake.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/magic bytes|signature/i);
    });

    it('rejects uploads exceeding the conservative size limit', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      // Create an oversized 11MB buffer (limit is 10MB)
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
      oversizedBuffer.write('%PDF-1.4\n');

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Oversized PDF')
        .attach('file', oversizedBuffer, 'huge.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/exceeds/i);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Path Traversal & Filename Sanitization
  // ─────────────────────────────────────────────────────────────
  describe('Path traversal & filename sanitization', () => {
    it('sanitizes malicious filenames with directory traversal sequences', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Traversal Attempt')
        .attach('file', validPdfBuffer, '../../../../etc/passwd.pdf');

      expect(res.status).toBe(201);
      // Filename should be sanitized, without `..` or `/`
      expect(res.body.document.originalFilename).not.toContain('..');
      expect(res.body.document.originalFilename).not.toContain('/');
      expect(res.body.document.originalFilename).not.toContain('\\');
      expect(res.body.document.originalFilename).toBe('passwd.pdf');

      // The physical storage file on disk must remain inside testStorageDir
      const doc = await Document.findById(res.body.document.id);
      expect(doc).not.toBeNull();
      const onDiskPath = path.join(testStorageDir, doc!.storageKey);
      expect(fs.existsSync(onDiskPath)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Metadata Edits & Forbidden Field Protection
  // ─────────────────────────────────────────────────────────────
  describe('PATCH metadata controls', () => {
    it('allows owner to update title and category', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Initial Title')
        .field('category', DocumentCategory.OTHER)
        .attach('file', validPdfBuffer, 'file.pdf');

      const docId = uploadRes.body.document.id;

      const patchRes = await request(app)
        .patch(`/api/v1/documents/${docId}`)
        .set('Cookie', alice.cookies)
        .send({
          title: 'Revised Financial Audit',
          category: DocumentCategory.FINANCIAL,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.title).toBe('Revised Financial Audit');
      expect(patchRes.body.document.category).toBe(DocumentCategory.FINANCIAL);
    });

    it('rejects attempts to overwrite ownerId or storageKey in PATCH', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Locked Doc')
        .attach('file', validPdfBuffer, 'file.pdf');

      const docId = uploadRes.body.document.id;

      const patchRes = await request(app)
        .patch(`/api/v1/documents/${docId}`)
        .set('Cookie', alice.cookies)
        .send({
          title: 'New Title',
          ownerId: new mongoose.Types.ObjectId().toString(),
          storageKey: 'forged-storage-key.pdf',
        });

      // Strict Zod schema rejects unauthorized keys
      expect(patchRes.status).toBe(400);

      // Verify DB fields remain untampered
      const freshDoc = await Document.findById(docId);
      expect(freshDoc?.ownerId.toString()).toBe(alice.user.id);
      expect(freshDoc?.storageKey).not.toBe('forged-storage-key.pdf');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Storage Deletion & Cleanup on DB Persistence Failure
  // ─────────────────────────────────────────────────────────────
  describe('Storage lifecycle and rollback cleanup', () => {
    it('deletes both DB record and physical storage file when owner deletes document', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'To Be Deleted')
        .attach('file', validPdfBuffer, 'trash.pdf');

      const docId = uploadRes.body.document.id;
      const doc = await Document.findById(docId);
      const filePath = path.join(testStorageDir, doc!.storageKey);
      expect(fs.existsSync(filePath)).toBe(true);

      const delRes = await request(app)
        .delete(`/api/v1/documents/${docId}`)
        .set('Cookie', alice.cookies);

      expect(delRes.status).toBe(200);

      // DB record must be gone
      const deletedDoc = await Document.findById(docId);
      expect(deletedDoc).toBeNull();

      // Physical file must be removed from disk
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('cleans up physical storage file if DB persistence fails during upload', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      // Temporarily mock Document.create to simulate a database failure
      const originalCreate = Document.create;
      // @ts-expect-error Mocking Document.create for test
      Document.create = async () => {
        throw new Error('Simulated MongoDB Write Collision');
      };

      try {
        const res = await request(app)
          .post('/api/v1/documents')
          .set('Cookie', alice.cookies)
          .field('title', 'Will Fail DB')
          .attach('file', validPdfBuffer, 'test.pdf');

        // Should return 500 internal server error
        expect(res.status).toBe(500);

        // Ensure no orphaned files remain in testStorageDir
        const filesInStorage = fs.readdirSync(testStorageDir);
        expect(filesInStorage.length).toBe(0);
      } finally {
        Document.create = originalCreate;
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Download Headers & Binary Content Integrity
  // ─────────────────────────────────────────────────────────────
  describe('Download headers and content streaming', () => {
    it('sets hardened security headers and streams identical binary content', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', alice.cookies)
        .field('title', 'Important Document')
        .attach('file', validPdfBuffer, 'important.pdf');

      const docId = uploadRes.body.document.id;

      const downloadRes = await request(app)
        .get(`/api/v1/documents/${docId}/download`)
        .set('Cookie', alice.cookies)
        .responseType('blob');

      expect(downloadRes.status).toBe(200);

      // Verify headers
      expect(downloadRes.headers['content-type']).toBe('application/pdf');
      expect(downloadRes.headers['content-disposition']).toContain('attachment;');
      expect(downloadRes.headers['content-disposition']).toContain('important.pdf');
      expect(downloadRes.headers['x-content-type-options']).toBe('nosniff');
      expect(downloadRes.headers['cache-control']).toContain('no-cache');
      expect(downloadRes.headers['cache-control']).toContain('no-store');

      // Verify exact binary equality
      expect(Buffer.compare(downloadRes.body, validPdfBuffer)).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10. Missing Document & Invalid ID Handling
  // ─────────────────────────────────────────────────────────────
  describe('Missing document & invalid ID error handling', () => {
    it('returns 404 when document does not exist', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/v1/documents/${nonExistentId}`)
        .set('Cookie', alice.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 404 when ID is not a valid ObjectId', async () => {
      const alice = await createAuthenticatedUser('Alice', 'alice@vault.dev');

      const res = await request(app)
        .get('/api/v1/documents/not-a-valid-id')
        .set('Cookie', alice.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });
});
