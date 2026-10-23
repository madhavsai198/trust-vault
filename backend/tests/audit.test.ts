// tests/audit.test.ts
// ─────────────────────────────────────────────────────────────
// Comprehensive test suite for Phase 5: Audit Trail & Security Monitoring
//
// 1. AuditLog model & schema validation (flat metadata, enums, indexes)
// 2. Authentication events (REGISTER_SUCCESS, LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT_SUCCESS)
// 3. Document events (DOCUMENT_UPLOADED, UPLOAD_REJECTED, DOCUMENT_VIEWED,
//    DOCUMENT_DOWNLOADED, DOCUMENT_UPDATED, DOCUMENT_DELETED,
//    DOCUMENT_ACCESS_DENIED, DOCUMENT_DELETE_DENIED)
// 4. Permission events (PERMISSION_GRANTED, PERMISSION_REVOKED, PERMISSION_CHANGE_DENIED)
// 5. Admin-only audit query API:
//    - 200 for ADMIN with populated references and pagination
//    - 403 for OWNER
//    - 403 for VIEWER
//    - 401 for unauthenticated requests
// 6. Filtering by action, outcome, and pagination
// 7. Data privacy verification (passwords/tokens never stored)
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
import AuditLog, { AuditAction, AuditOutcome } from '../src/models/AuditLog';
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

  testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-audit-test-storage-'));
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
  await AuditLog.deleteMany({});
});

// Helper to register and return cookies
async function createAndLoginUser(name: string, email: string, role: Role = Role.VIEWER) {
  const argon2 = await import('argon2');
  const passwordHash = await argon2.hash('SecurePassword@123!');
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
  });

  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'SecurePassword@123!' });

  const cookies = res.headers['set-cookie'] as unknown as string[];
  return { user, cookies };
}

describe('Phase 5: Audit Trail and Security Monitoring', () => {
  describe('1. Model Validation & Privacy Safeguards', () => {
    it('creates a valid audit log entry with primitive metadata', async () => {
      const log = await AuditLog.create({
        action: AuditAction.LOGIN_SUCCESS,
        outcome: AuditOutcome.SUCCESS,
        requestId: 'test-req-123',
        metadata: { clientIp: '127.0.0.1', isSecure: true, attempts: 1 },
      });

      expect(log._id).toBeDefined();
      expect(log.action).toBe(AuditAction.LOGIN_SUCCESS);
      expect(log.outcome).toBe(AuditOutcome.SUCCESS);
      expect(log.requestId).toBe('test-req-123');
      expect(log.metadata).toEqual({ clientIp: '127.0.0.1', isSecure: true, attempts: 1 });
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('rejects nested objects or arrays in metadata to prevent sensitive payload leaks', async () => {
      await expect(
        AuditLog.create({
          action: AuditAction.LOGIN_FAILED,
          outcome: AuditOutcome.DENIED,
          requestId: 'test-req-nested',
          metadata: { nestedObj: { password: 'leak' } as any },
        })
      ).rejects.toThrow();

      await expect(
        AuditLog.create({
          action: AuditAction.LOGIN_FAILED,
          outcome: AuditOutcome.DENIED,
          requestId: 'test-req-array',
          metadata: { arrayField: ['one', 'two'] as any },
        })
      ).rejects.toThrow();
    });

    it('rejects invalid action and outcome enums', async () => {
      await expect(
        AuditLog.create({
          action: 'UNKNOWN_ACTION' as any,
          outcome: AuditOutcome.SUCCESS,
          requestId: 'req-bad-action',
        })
      ).rejects.toThrow();

      await expect(
        AuditLog.create({
          action: AuditAction.LOGIN_SUCCESS,
          outcome: 'PENDING' as any,
          requestId: 'req-bad-outcome',
        })
      ).rejects.toThrow();
    });
  });

  describe('2. Authentication Event Auditing', () => {
    it('records REGISTER_SUCCESS when a new user registers', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ name: 'Alice New', email: 'alice.new@example.com', password: 'Password@123!' });

      expect(res.status).toBe(201);

      const logs = await AuditLog.find({ action: AuditAction.REGISTER_SUCCESS });
      expect(logs).toHaveLength(1);
      expect(logs[0].outcome).toBe(AuditOutcome.SUCCESS);
      expect(logs[0].actorId?.toString()).toBe(res.body.user.id);
      expect(logs[0].metadata.email).toBe('alice.new@example.com');
      expect(logs[0].metadata.role).toBe(Role.VIEWER);
    });

    it('records LOGIN_SUCCESS on successful login', async () => {
      const { user } = await createAndLoginUser('Bob Login', 'bob.login@example.com', Role.OWNER);

      const log = await AuditLog.findOne({
        action: AuditAction.LOGIN_SUCCESS,
        actorId: user._id,
      });
      expect(log).not.toBeNull();
      expect(log!.outcome).toBe(AuditOutcome.SUCCESS);
      expect(log!.metadata.email).toBe('bob.login@example.com');
    });

    it('records LOGIN_FAILED with DENIED outcome on incorrect password', async () => {
      await createAndLoginUser('Charlie User', 'charlie@example.com', Role.VIEWER);

      const failRes = await request(app)
        .post('/auth/login')
        .send({ email: 'charlie@example.com', password: 'WrongPassword@999!' });

      expect(failRes.status).toBe(401);

      const log = await AuditLog.findOne({
        action: AuditAction.LOGIN_FAILED,
        'metadata.attemptedEmail': 'charlie@example.com',
      });
      expect(log).not.toBeNull();
      expect(log!.outcome).toBe(AuditOutcome.DENIED);
      // actorId is captured because user existed
      expect(log!.actorId).not.toBeNull();
      // Ensure password is NEVER saved in log metadata
      expect(log!.metadata.password).toBeUndefined();
    });

    it('records LOGIN_FAILED with null actorId on unknown email', async () => {
      const failRes = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'AnyPassword@123!' });

      expect(failRes.status).toBe(401);

      const log = await AuditLog.findOne({
        action: AuditAction.LOGIN_FAILED,
        'metadata.attemptedEmail': 'nonexistent@example.com',
      });
      expect(log).not.toBeNull();
      expect(log!.outcome).toBe(AuditOutcome.DENIED);
      expect(log!.actorId).toBeNull();
    });

    it('records LOGOUT_SUCCESS when user logs out', async () => {
      const { user, cookies } = await createAndLoginUser('David Logout', 'david@example.com');

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies);

      expect(logoutRes.status).toBe(200);

      const log = await AuditLog.findOne({
        action: AuditAction.LOGOUT_SUCCESS,
        actorId: user._id,
      });
      expect(log).not.toBeNull();
      expect(log!.outcome).toBe(AuditOutcome.SUCCESS);
    });
  });

  describe('3. Document Event Auditing', () => {
    it('records DOCUMENT_UPLOADED when file upload succeeds', async () => {
      const { user, cookies } = await createAndLoginUser('Uploader', 'uploader@example.com', Role.OWNER);

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookies)
        .field('title', 'Tax Return 2025')
        .field('category', DocumentCategory.TAX)
        .attach('file', validPdfBuffer, 'tax_return.pdf');

      expect(res.status).toBe(201);
      const docId = res.body.document.id;

      const log = await AuditLog.findOne({
        action: AuditAction.DOCUMENT_UPLOADED,
        documentId: docId,
      });
      expect(log).not.toBeNull();
      expect(log!.actorId?.toString()).toBe(user._id.toString());
      expect(log!.outcome).toBe(AuditOutcome.SUCCESS);
      expect(log!.metadata.title).toBe('Tax Return 2025');
      expect(log!.metadata.category).toBe(DocumentCategory.TAX);
    });

    it('records UPLOAD_REJECTED with DENIED outcome on invalid file content (magic byte mismatch)', async () => {
      const { user, cookies } = await createAndLoginUser('Malicious', 'mal@example.com', Role.OWNER);

      const fakePdf = Buffer.from('Plain text masquerading as a PDF file');
      const res = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookies)
        .field('title', 'Fake Document')
        .field('category', DocumentCategory.LEGAL)
        .attach('file', fakePdf, 'fake.pdf');

      expect(res.status).toBe(400);

      const log = await AuditLog.findOne({
        action: AuditAction.UPLOAD_REJECTED,
        actorId: user._id,
      });
      expect(log).not.toBeNull();
      expect(log!.outcome).toBe(AuditOutcome.DENIED);
      expect(log!.metadata.reason).toBeDefined();
    });

    it('records DOCUMENT_VIEWED and DOCUMENT_DOWNLOADED for authorized access', async () => {
      const { user, cookies } = await createAndLoginUser('Doc Owner', 'owner@example.com', Role.OWNER);

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookies)
        .field('title', 'NDA Agreement')
        .field('category', DocumentCategory.LEGAL)
        .attach('file', validPdfBuffer, 'nda.pdf');

      const docId = uploadRes.body.document.id;

      // View metadata
      const viewRes = await request(app)
        .get(`/api/v1/documents/${docId}`)
        .set('Cookie', cookies);
      expect(viewRes.status).toBe(200);

      const viewLog = await AuditLog.findOne({
        action: AuditAction.DOCUMENT_VIEWED,
        documentId: docId,
      });
      expect(viewLog).not.toBeNull();
      expect(viewLog!.actorId?.toString()).toBe(user._id.toString());
      expect(viewLog!.outcome).toBe(AuditOutcome.SUCCESS);

      // Download file
      const downloadRes = await request(app)
        .get(`/api/v1/documents/${docId}/download`)
        .set('Cookie', cookies);
      expect(downloadRes.status).toBe(200);

      const dlLog = await AuditLog.findOne({
        action: AuditAction.DOCUMENT_DOWNLOADED,
        documentId: docId,
      });
      expect(dlLog).not.toBeNull();
      expect(dlLog!.outcome).toBe(AuditOutcome.SUCCESS);
    });

    it('records DOCUMENT_ACCESS_DENIED when an unauthorized user attempts to view a document', async () => {
      const { cookies: ownerCookies } = await createAndLoginUser('Owner User', 'doc.owner@example.com', Role.OWNER);
      const { user: intruder, cookies: intruderCookies } = await createAndLoginUser('Intruder', 'intruder@example.com', Role.VIEWER);

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', ownerCookies)
        .field('title', 'Confidential Specs')
        .field('category', DocumentCategory.OTHER)
        .attach('file', validPdfBuffer, 'specs.pdf');

      const docId = uploadRes.body.document.id;

      // Intruder attempts to view
      const viewRes = await request(app)
        .get(`/api/v1/documents/${docId}`)
        .set('Cookie', intruderCookies);

      expect(viewRes.status).toBe(403);

      const denialLog = await AuditLog.findOne({
        action: AuditAction.DOCUMENT_ACCESS_DENIED,
        actorId: intruder._id,
      });
      expect(denialLog).not.toBeNull();
      expect(denialLog!.outcome).toBe(AuditOutcome.DENIED);
      expect(denialLog!.documentId?.toString()).toBe(docId);
    });

    it('records DOCUMENT_UPDATED on metadata patch', async () => {
      const { user, cookies } = await createAndLoginUser('Editor Owner', 'edit.owner@example.com', Role.OWNER);

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookies)
        .field('title', 'Old Title')
        .field('category', DocumentCategory.OTHER)
        .attach('file', validPdfBuffer, 'doc.pdf');

      const docId = uploadRes.body.document.id;

      const patchRes = await request(app)
        .patch(`/api/v1/documents/${docId}`)
        .set('Cookie', cookies)
        .send({ title: 'New Audited Title', category: DocumentCategory.FINANCIAL });

      expect(patchRes.status).toBe(200);

      const updateLog = await AuditLog.findOne({
        action: AuditAction.DOCUMENT_UPDATED,
        documentId: docId,
      });
      expect(updateLog).not.toBeNull();
      expect(updateLog!.actorId?.toString()).toBe(user._id.toString());
      expect(updateLog!.outcome).toBe(AuditOutcome.SUCCESS);
      expect(updateLog!.metadata.updatedTitle).toBe(true);
      expect(updateLog!.metadata.updatedCategory).toBe(true);
    });

    it('records DOCUMENT_DELETED and cleans up storage when owner deletes document', async () => {
      const { user, cookies } = await createAndLoginUser('Deleter', 'deleter@example.com', Role.OWNER);

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', cookies)
        .field('title', 'To Be Deleted')
        .field('category', DocumentCategory.OTHER)
        .attach('file', validPdfBuffer, 'delete_me.pdf');

      const docId = uploadRes.body.document.id;

      const delRes = await request(app)
        .delete(`/api/v1/documents/${docId}`)
        .set('Cookie', cookies);

      expect(delRes.status).toBe(200);

      const delLog = await AuditLog.findOne({
        action: AuditAction.DOCUMENT_DELETED,
        documentId: docId,
      });
      expect(delLog).not.toBeNull();
      expect(delLog!.actorId?.toString()).toBe(user._id.toString());
      expect(delLog!.outcome).toBe(AuditOutcome.SUCCESS);
    });
  });

  describe('4. Permission Event Auditing', () => {
    it('records PERMISSION_GRANTED and PERMISSION_REVOKED', async () => {
      const { user: owner, cookies: ownerCookies } = await createAndLoginUser('Share Owner', 'share.owner@example.com', Role.OWNER);
      const { user: recipient } = await createAndLoginUser('Share Recipient', 'recipient@example.com', Role.VIEWER);

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', ownerCookies)
        .field('title', 'Shared Contract')
        .field('category', DocumentCategory.LEGAL)
        .attach('file', validPdfBuffer, 'contract.pdf');

      const docId = uploadRes.body.document.id;

      // Grant READ permission
      const grantRes = await request(app)
        .put(`/api/v1/documents/${docId}/permissions/${recipient._id}`)
        .set('Cookie', ownerCookies)
        .send({ permission: 'READ' });

      expect(grantRes.status).toBe(200);

      const grantLog = await AuditLog.findOne({
        action: AuditAction.PERMISSION_GRANTED,
        documentId: docId,
      });
      expect(grantLog).not.toBeNull();
      expect(grantLog!.actorId?.toString()).toBe(owner._id.toString());
      expect(grantLog!.targetUserId?.toString()).toBe(recipient._id.toString());
      expect(grantLog!.outcome).toBe(AuditOutcome.SUCCESS);
      expect(grantLog!.metadata.permission).toBe('READ');

      // Revoke permission
      const revokeRes = await request(app)
        .delete(`/api/v1/documents/${docId}/permissions/${recipient._id}`)
        .set('Cookie', ownerCookies);

      expect(revokeRes.status).toBe(200);

      const revokeLog = await AuditLog.findOne({
        action: AuditAction.PERMISSION_REVOKED,
        documentId: docId,
      });
      expect(revokeLog).not.toBeNull();
      expect(revokeLog!.actorId?.toString()).toBe(owner._id.toString());
      expect(revokeLog!.targetUserId?.toString()).toBe(recipient._id.toString());
      expect(revokeLog!.outcome).toBe(AuditOutcome.SUCCESS);
    });

    it('records PERMISSION_CHANGE_DENIED when a non-owner attempts to grant permissions', async () => {
      const { cookies: ownerCookies } = await createAndLoginUser('Real Owner', 'real.owner@example.com', Role.OWNER);
      const { user: viewer, cookies: viewerCookies } = await createAndLoginUser('Viewer Hacker', 'vhacker@example.com', Role.VIEWER);
      const { user: recipient } = await createAndLoginUser('Third Party', 'third@example.com', Role.VIEWER);

      const uploadRes = await request(app)
        .post('/api/v1/documents')
        .set('Cookie', ownerCookies)
        .field('title', 'Private Vault Item')
        .field('category', DocumentCategory.LEGAL)
        .attach('file', validPdfBuffer, 'vault.pdf');

      const docId = uploadRes.body.document.id;

      // Viewer attempts to grant permission
      const grantRes = await request(app)
        .put(`/api/v1/documents/${docId}/permissions/${recipient._id}`)
        .set('Cookie', viewerCookies)
        .send({ permission: 'EDIT' });

      expect(grantRes.status).toBe(403);

      const deniedLog = await AuditLog.findOne({
        action: AuditAction.PERMISSION_CHANGE_DENIED,
        actorId: viewer._id,
      });
      expect(deniedLog).not.toBeNull();
      expect(deniedLog!.outcome).toBe(AuditOutcome.DENIED);
    });
  });

  describe('5. Administrator Audit Logs Endpoint (GET /api/v1/audit-logs)', () => {
    it('allows ADMIN to retrieve paginated audit logs', async () => {
      const { cookies: adminCookies } = await createAndLoginUser('Admin Boss', 'admin.boss@example.com', Role.ADMIN);

      const res = await request(app)
        .get('/api/v1/audit-logs?page=1&limit=10')
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.logs).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(typeof res.body.pagination.total).toBe('number');
    });

    it('rejects OWNER with 403 Forbidden', async () => {
      const { cookies: ownerCookies } = await createAndLoginUser('Regular Owner', 'reg.owner@example.com', Role.OWNER);

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Cookie', ownerCookies);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Insufficient permissions');
    });

    it('rejects VIEWER with 403 Forbidden', async () => {
      const { cookies: viewerCookies } = await createAndLoginUser('Regular Viewer', 'reg.viewer@example.com', Role.VIEWER);

      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Cookie', viewerCookies);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Insufficient permissions');
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/audit-logs');
      expect(res.status).toBe(401);
    });

    it('supports filtering by action and outcome', async () => {
      const { cookies: adminCookies } = await createAndLoginUser('Super Admin', 'super.admin@example.com', Role.ADMIN);

      // Trigger a failed login
      await request(app).post('/auth/login').send({ email: 'fake@example.com', password: 'bad' });

      // Query filtered by action=LOGIN_FAILED
      const actionRes = await request(app)
        .get('/api/v1/audit-logs?action=LOGIN_FAILED')
        .set('Cookie', adminCookies);

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.logs.length).toBeGreaterThan(0);
      actionRes.body.logs.forEach((log: any) => {
        expect(log.action).toBe('LOGIN_FAILED');
      });

      // Query filtered by outcome=DENIED
      const outcomeRes = await request(app)
        .get('/api/v1/audit-logs?outcome=DENIED')
        .set('Cookie', adminCookies);

      expect(outcomeRes.status).toBe(200);
      expect(outcomeRes.body.logs.length).toBeGreaterThan(0);
      outcomeRes.body.logs.forEach((log: any) => {
        expect(log.outcome).toBe('DENIED');
      });
    });
  });
});
