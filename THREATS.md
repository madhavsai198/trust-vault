# THREATS.md — TrustVault Threat Model

> This document records known security threats, attack vectors, and their mitigations across TrustVault development phases.

---

## Scope

TrustVault allows authenticated users to upload, store, and share sensitive documents with
trusted contacts under strict role-based and per-document permission models. The threat model covers
the web application, REST API, storage abstraction, and database persistence.

---

## Threat Matrix (STRIDE)

| ID  | Category          | Threat                                             | Status       | Implemented Mitigation |
|-----|-------------------|----------------------------------------------------|--------------|------------------------|
| T01 | Spoofing          | Attacker impersonates a legitimate user             | ✅ Mitigated | Argon2id hashing + HttpOnly SameSite=Strict JWT authentication cookies. Constant-time dummy verification prevents timing attacks. |
| T02 | Tampering         | Document contents modified in transit               | ⬜ In Progress | HTTPS / TLS headers configured (`X-Content-Type-Options: nosniff`, HSTS, secure cookies in production). |
| T03 | Repudiation       | User denies uploading/sharing/revoking a document   | ⬜ Next Phase| GrantedBy/timestamps tracked in Mongoose models. Immutable audit log scheduled for Phase 5. |
| T04 | Info Disclosure   | Unauthorised user accesses another's documents      | ✅ Mitigated | Centralized `DocumentAccessService` enforces server-side ownership and active permission checks on every route. |
| T05 | Info Disclosure   | `.env` secrets committed to Git                     | ✅ Mitigated | Root `.gitignore` and `backend/.dockerignore` block all `.env` files. |
| T06 | Info Disclosure   | API leaks stack traces in production                | ✅ Mitigated | Centralized error-handling middleware hides stack traces outside development. |
| T07 | Denial of Service | Large file uploads exhaust server memory            | ✅ Mitigated | Multer memory limits capped at 10MB; rate-limiting middleware on auth endpoints. |
| T08 | Elevation         | Non-owner gains delete or grant sharing permission  | ✅ Mitigated | `canDelete` and `canManagePermissions` strictly restrict delete/sharing management to Document Owner and System Admin. Recipients cannot delete or share. |
| T09 | Tampering         | MongoDB injection via crafted query payload         | ✅ Mitigated | Mongoose schemas with strict field allowlists, regex escaping, and Zod input validation. |
| T10 | Info Disclosure   | CORS misconfiguration exposes API publicly          | ✅ Mitigated | Strict CORS configuration restricting origins to trusted frontend domains (`credentials: true`). |
| T11 | Info Disclosure   | IDOR attack on document sharing endpoints           | ✅ Mitigated | All sharing routes (`/permissions/:userId`) resolve the document via `DocumentAccessService` with `'share'` action verification before any mutation. |
| T12 | Elevation         | Forged `grantedBy` or `ownerId` in request body     | ✅ Mitigated | `grantedBy` is derived strictly from verified JWT session (`req.user.userId`). Schema ignores client-submitted `ownerId` or `grantedBy`. |
| T13 | Info Disclosure   | Revoked user retains access via lingering session   | ✅ Mitigated | Revocation sets `revokedAt = new Date()`. Every single download, metadata read, and edit queries active permissions (`revokedAt: null`) directly in the database. Subsequent requests receive immediate `403 Forbidden`. |
| T14 | Tampering         | Race condition / duplicate active grants            | ✅ Mitigated | Compound unique index `{ documentId: 1, userId: 1 }` in MongoDB prevents duplicate records. Atomic `findOneAndUpdate` with `upsert` ensures idempotent grants. |
| T15 | Elevation         | EDIT recipient attempts to delete document or share | ✅ Mitigated | Role separation in `DocumentAccessService`: `EDIT` permission only grants metadata modification (`title`, `category`) and streaming downloads. Delete and sharing management remain restricted to Owner/Admin. |
| T16 | Data Leakage      | Orphaned permissions remain after document deletion | ✅ Mitigated | When an owner deletes a document, `Permission.deleteMany({ documentId: doc._id })` cleans up all related permission records. |

---

## Phase 4 Security Posture & Verification

- **Centralized Authorization**: Document ownership, permissions, and revocation are checked on the backend for every request. The frontend UI does not enforce security alone.
- **Immediate Revocation**: No token caching or long-lived permission leases. Revoking an active grant invalidates read/download capability instantaneously.
- **Zero-Trust Input**: Neither document `ownerId`, `storageKey`, nor permission `grantedBy` are accepted from request bodies.
- **Automated Security Verification**: 24 dedicated security tests in `tests/permissions.test.ts` test all attack vectors, edge cases, privilege escalations, and IDOR vulnerabilities.
