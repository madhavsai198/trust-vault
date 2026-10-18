// tests/permissions.test.ts
// ─────────────────────────────────────────────────────────────
// Comprehensive test suite for Phase 4: Document Sharing & Permissions
//
// 1. Owner grants READ permission (200, populates user & grantedBy)
// 2. Owner grants/upgrades to EDIT permission (200)
// 3. Recipient with READ can read metadata and download, but CANNOT edit (403) or delete (403)
// 4. Recipient with EDIT can read, download, and modify metadata, but CANNOT delete (403) or share (403)
// 5. Invalid permission values (e.g. 'ADMIN', 'SUPER') rejected (400)
// 6. Unauthenticated requests rejected (401)
// 7. Non-owners cannot grant, list, or revoke permissions (403)
// 8. Users without permission cannot access document (403) or see it in list
// 9. Revocation:
//    - Owner can revoke permission (200)
//    - Non-owners cannot revoke (403)
//    - Cannot revoke owner's access (400)
//    - Subsequent read/download requests immediately return 403
//    - Owner's own access is preserved
// 10. Forged grantedBy or ownerId in requests ignored/prevented
// 11. Duplicate grants & re-granting after revocation handled safely (atomic upsert)
// 12. Deleting document cleans up associated permissions in database
// 13. Eligible recipients list endpoint (/recipients/list)
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
import Permission, { PermissionLevel } from '../src/models/Permission';
import { setStorageService, LocalStorageService } from '../src/services/storage';

let mongoServer: MongoMemoryServer;
let testStorageDir: string;
let storageService: LocalStorageService;

const validPdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF'
);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongoServer.getUri());

  testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-perm-test-storage-'));
  storageService = new LocalStorageService(testStorageDir);
  setStorageService(storageService);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (testStorageDir && fs.existsSync(testStorageDir)) {
    fs.rmSync(testStorageDir, { recursive: true, force: true });
  }
});

beforeEach(async () => {
  await User.deleteMany({});
  await Document.deleteMany({});
  await Permission.deleteMany({});
  if (testStorageDir && fs.existsSync(testStorageDir)) {
    const files = fs.readdirSync(testStorageDir);
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(testStorageDir, file));
      } catch {}
    }
  }
});

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

async function uploadDocument(cookies: string[], title = 'Secret Contract', category = 'LEGAL') {
  const res = await request(app)
    .post('/api/v1/documents')
    .set('Cookie', cookies)
    .field('title', title)
    .field('category', category)
    .attach('file', validPdfBuffer, {
      filename: 'contract.pdf',
      contentType: 'application/pdf',
    });

  return res.body.document;
}

describe('Phase 4: Document Sharing and Permissions', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Granting Permissions
  // ─────────────────────────────────────────────────────────────
  describe('Granting Permissions', () => {
    it('allows document owner to grant READ permission to a valid recipient', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      const grantRes = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      expect(grantRes.status).toBe(200);
      expect(grantRes.body.message).toContain('Granted READ permission');
      expect(grantRes.body.permission.permission).toBe('READ');
      expect(grantRes.body.permission.user.email).toBe('bob@trustvault.local');
      // Verify grantedBy is derived from authenticated session, not client input
      expect(grantRes.body.permission.grantedBy.email).toBe('alice@trustvault.local');
      expect(grantRes.body.permission.revokedAt).toBeNull();
    });

    it('allows document owner to grant/upgrade to EDIT permission', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      const grantRes = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'EDIT' });

      expect(grantRes.status).toBe(200);
      expect(grantRes.body.permission.permission).toBe('EDIT');
    });

    it('rejects invalid permission values (400)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      const res = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'SUPER_ADMIN' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid permission payload');
    });

    it('rejects unauthenticated grant requests (401)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      const res = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .send({ permission: 'READ' });

      expect(res.status).toBe(401);
    });

    it('prevents non-owners from granting permissions (403)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const attacker = await createAuthenticatedUser('Attacker Charlie', 'charlie@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      const res = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', attacker.cookies)
        .send({ permission: 'EDIT' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('prevents a recipient from granting permissions to another user (403)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient1 = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');
      const recipient2 = await createAuthenticatedUser('Recipient Charlie', 'charlie@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      // Owner gives Bob EDIT
      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient1.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'EDIT' });

      // Bob tries to share with Charlie
      const res = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient2.user.id}`)
        .set('Cookie', recipient1.cookies)
        .send({ permission: 'READ' });

      expect(res.status).toBe(403);
    });

    it('prevents owner from sharing document with themselves (400)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const doc = await uploadDocument(owner.cookies);

      const res = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${owner.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already has full access');
    });

    it('returns 404 for non-existent document or non-existent recipient', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');
      const doc = await uploadDocument(owner.cookies);

      const fakeId = new mongoose.Types.ObjectId().toString();

      // Missing document
      const res1 = await request(app)
        .put(`/api/v1/documents/${fakeId}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });
      expect(res1.status).toBe(404);

      // Missing recipient
      const res2 = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${fakeId}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });
      expect(res2.status).toBe(404);
    });

    it('derives grantedBy strictly from session and ignores forged grantedBy or ownerId in body', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');
      const fakeAdminId = new mongoose.Types.ObjectId().toString();

      const doc = await uploadDocument(owner.cookies);

      const res = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({
          permission: 'READ',
          grantedBy: fakeAdminId,
          ownerId: fakeAdminId,
        });

      expect(res.status).toBe(200);
      // grantedBy must still be alice, not fakeAdminId
      expect(res.body.permission.grantedBy.email).toBe('alice@trustvault.local');

      // Verify DB record
      const dbDoc = await Document.findById(doc.id);
      expect(dbDoc!.ownerId.toString()).toBe(owner.user.id);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Enforcing READ Permissions
  // ─────────────────────────────────────────────────────────────
  describe('Enforcing READ Permissions', () => {
    it('allows a recipient with READ permission to view metadata and download', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      // Grant READ
      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      // Recipient views metadata
      const metaRes = await request(app)
        .get(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies);

      expect(metaRes.status).toBe(200);
      expect(metaRes.body.document.title).toBe('Secret Contract');
      expect(metaRes.body.document.accessLevel).toBe('READ');

      // Recipient downloads file
      const dlRes = await request(app)
        .get(`/api/v1/documents/${doc.id}/download`)
        .set('Cookie', recipient.cookies);

      expect(dlRes.status).toBe(200);
      expect(dlRes.headers['content-type']).toBe('application/pdf');
      expect(dlRes.body.toString()).toBe(validPdfBuffer.toString());
    });

    it('includes actively shared documents in recipient document listing', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      const listRes = await request(app)
        .get('/api/v1/documents')
        .set('Cookie', recipient.cookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.count).toBe(1);
      expect(listRes.body.documents[0].id).toBe(doc.id);
      expect(listRes.body.documents[0].accessLevel).toBe('READ');
    });

    it('denies a recipient with READ permission from editing metadata (403)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      const patchRes = await request(app)
        .patch(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies)
        .send({ title: 'Tampered Title' });

      expect(patchRes.status).toBe(403);
      expect(patchRes.body.error).toContain('Access denied');
    });

    it('denies a recipient with READ permission from deleting the document (403)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      const delRes = await request(app)
        .delete(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies);

      expect(delRes.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Enforcing EDIT Permissions
  // ─────────────────────────────────────────────────────────────
  describe('Enforcing EDIT Permissions', () => {
    it('allows a recipient with EDIT permission to modify permitted metadata fields', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      // Grant EDIT
      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'EDIT' });

      // Recipient updates title and category
      const patchRes = await request(app)
        .patch(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies)
        .send({
          title: 'Updated Contract Title',
          category: 'FINANCIAL',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.document.title).toBe('Updated Contract Title');
      expect(patchRes.body.document.category).toBe('FINANCIAL');

      // Verify persistence
      const checkDoc = await Document.findById(doc.id);
      expect(checkDoc!.title).toBe('Updated Contract Title');
      expect(checkDoc!.category).toBe('FINANCIAL');
    });

    it('denies a recipient with EDIT permission from deleting the document (403)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'EDIT' });

      const delRes = await request(app)
        .delete(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies);

      expect(delRes.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Denying Unshared Users
  // ─────────────────────────────────────────────────────────────
  describe('Denying Unshared Users', () => {
    it('denies access to users without permissions (403)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const stranger = await createAuthenticatedUser('Stranger Dave', 'dave@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      // Metadata GET
      const getRes = await request(app)
        .get(`/api/v1/documents/${doc.id}`)
        .set('Cookie', stranger.cookies);
      expect(getRes.status).toBe(403);

      // Download GET
      const dlRes = await request(app)
        .get(`/api/v1/documents/${doc.id}/download`)
        .set('Cookie', stranger.cookies);
      expect(dlRes.status).toBe(403);

      // Listing GET does not contain document
      const listRes = await request(app)
        .get('/api/v1/documents')
        .set('Cookie', stranger.cookies);
      expect(listRes.status).toBe(200);
      expect(listRes.body.documents.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Revoking Permissions
  // ─────────────────────────────────────────────────────────────
  describe('Revoking Permissions', () => {
    it('allows owner to revoke permission, immediately terminating recipient access', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      // 1. Grant READ
      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      // Verify recipient has access
      const beforeRevoke = await request(app)
        .get(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies);
      expect(beforeRevoke.status).toBe(200);

      // 2. Owner revokes permission
      const revokeRes = await request(app)
        .delete(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies);

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.message).toBe('Permission revoked successfully');

      // 3. Subsequent GET metadata fails immediately with 403
      const afterGet = await request(app)
        .get(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies);
      expect(afterGet.status).toBe(403);

      // 4. Subsequent download fails immediately with 403
      const afterDl = await request(app)
        .get(`/api/v1/documents/${doc.id}/download`)
        .set('Cookie', recipient.cookies);
      expect(afterDl.status).toBe(403);

      // 5. Document disappears from recipient's list
      const afterList = await request(app)
        .get('/api/v1/documents')
        .set('Cookie', recipient.cookies);
      expect(afterList.body.documents.length).toBe(0);

      // 6. Owner's own access is completely unaffected
      const ownerAccess = await request(app)
        .get(`/api/v1/documents/${doc.id}`)
        .set('Cookie', owner.cookies);
      expect(ownerAccess.status).toBe(200);
    });

    it('denies non-owner from revoking permissions (403)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');
      const attacker = await createAuthenticatedUser('Attacker Charlie', 'charlie@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      const res = await request(app)
        .delete(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', attacker.cookies);

      expect(res.status).toBe(403);
    });

    it('prevents revoking the owner’s own access (400)', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const doc = await uploadDocument(owner.cookies);

      const res = await request(app)
        .delete(`/api/v1/documents/${doc.id}/permissions/${owner.user.id}`)
        .set('Cookie', owner.cookies);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot revoke owner access');
    });

    it('returns 404 when revoking a non-existent active permission', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const stranger = await createAuthenticatedUser('Stranger Dave', 'dave@trustvault.local');
      const doc = await uploadDocument(owner.cookies);

      const res = await request(app)
        .delete(`/api/v1/documents/${doc.id}/permissions/${stranger.user.id}`)
        .set('Cookie', owner.cookies);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Active permission not found');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Race-Safety, Concurrency & Re-Granting
  // ─────────────────────────────────────────────────────────────
  describe('Race-Safety and Duplicate Handling', () => {
    it('handles duplicate grants idempotently and restores revoked permissions', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      // 1. Grant READ
      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      // 2. Grant READ again (idempotent update, no duplicate index violation)
      const repeatRes = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });
      expect(repeatRes.status).toBe(200);

      // Verify single record in DB
      const permCount = await Permission.countDocuments({
        documentId: doc.id,
        userId: recipient.user.id,
      });
      expect(permCount).toBe(1);

      // 3. Revoke
      await request(app)
        .delete(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies);

      // 4. Re-grant permission: resets revokedAt and restores access
      const regrantRes = await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'EDIT' });

      expect(regrantRes.status).toBe(200);
      expect(regrantRes.body.permission.permission).toBe('EDIT');
      expect(regrantRes.body.permission.revokedAt).toBeNull();

      // Recipient now has EDIT access again
      const testAccess = await request(app)
        .get(`/api/v1/documents/${doc.id}`)
        .set('Cookie', recipient.cookies);
      expect(testAccess.status).toBe(200);
      expect(testAccess.body.document.accessLevel).toBe('EDIT');
    });

    it('cleans up permissions when document is deleted by owner', async () => {
      const owner = await createAuthenticatedUser('Owner Alice', 'alice@trustvault.local');
      const recipient = await createAuthenticatedUser('Recipient Bob', 'bob@trustvault.local');

      const doc = await uploadDocument(owner.cookies);

      await request(app)
        .put(`/api/v1/documents/${doc.id}/permissions/${recipient.user.id}`)
        .set('Cookie', owner.cookies)
        .send({ permission: 'READ' });

      // Delete document
      const delRes = await request(app)
        .delete(`/api/v1/documents/${doc.id}`)
        .set('Cookie', owner.cookies);
      expect(delRes.status).toBe(200);

      // Verify associated permissions were deleted
      const remainingPerms = await Permission.find({ documentId: doc.id });
      expect(remainingPerms.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Recipients List Endpoint
  // ─────────────────────────────────────────────────────────────
  describe('Recipients List Endpoint', () => {
    it('returns list of registered users excluding the caller', async () => {
      const alice = await createAuthenticatedUser('Alice Admin', 'alice@trustvault.local');
      await createAuthenticatedUser('Bob User', 'bob@trustvault.local');
      await createAuthenticatedUser('Charlie User', 'charlie@trustvault.local');

      const res = await request(app)
        .get('/api/v1/documents/recipients/list')
        .set('Cookie', alice.cookies);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(2);
      const emails = res.body.users.map((u: { email: string }) => u.email);
      expect(emails).toContain('bob@trustvault.local');
      expect(emails).toContain('charlie@trustvault.local');
      expect(emails).not.toContain('alice@trustvault.local');
    });

    it('rejects unauthenticated requests to recipient list (401)', async () => {
      const res = await request(app).get('/api/v1/documents/recipients/list');
      expect(res.status).toBe(401);
    });
  });
});
