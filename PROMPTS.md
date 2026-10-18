# PROMPTS.md — AI Assistance Log

> This file records every significant AI prompt used during the development of TrustVault.
> Keeping this log demonstrates transparency in AI-assisted development.

---

## Format

Each entry includes:
- **Date** — when the prompt was used
- **Phase** — project phase it belongs to
- **Tool** — AI tool used (e.g., Antigravity / Gemini / ChatGPT)
- **Prompt** — the exact or summarised prompt
- **Purpose** — why it was used
- **Output Used** — yes / partial / no

---

## Log

### Entry 001
- **Date:** 2026-10-18
- **Phase:** Phase 1 — Project Foundation
- **Tool:** Antigravity (Google DeepMind)
- **Prompt:**
  ```
  Build TrustVault Phase 1: Project Foundation.
  Stack: React + Vite + TypeScript (frontend), Node.js + Express + TypeScript (backend),
  MongoDB Atlas + Mongoose, Tailwind CSS, Vitest + Supertest.
  Implement: folder structure, health endpoint, landing page placeholder,
  .gitignore, .env.example files, README.md, THREATS.md, PROMPTS.md,
  and an automated test for the health endpoint.
  ```
- **Purpose:** Bootstrap the entire project foundation from scratch.
- **Output Used:** Yes — reviewed and understood before committing.

### Entry 002
- **Date:** 2026-10-18
- **Phase:** Phase 2 — Database and Authentication
- **Tool:** Antigravity (Google DeepMind)
- **Prompt:**
  ```
  Connect MongoDB Atlas using MONGODB_URI. Create User model with ADMIN, OWNER, VIEWER roles.
  Hash passwords using Argon2id. Implement login, logout, /auth/me with HttpOnly cookies,
  SameSite=Strict, Zod validation, rate limiting, anti-enumeration timing defense,
  seed script, and automated tests.
  ```
- **Real Challenges & Corrections:**
  1. *Dummy Hash format in Argon2*: Initially used `$dummy$dummy` which threw `Output is too short` from Argon2 C++ bindings. Replaced with a pre-computed valid Argon2id hash constant.
  2. *Express 4 Async Handlers*: Express 4 does not automatically catch unhandled rejections from async route handlers. Replaced `throw err` with `next(err)`.
  3. *TypeScript rootDir*: `rootDir: "./src"` conflicted with `include: ["src/**/*", "tests/**/*"]`. Adjusted `tsconfig.json` include to `["src/**/*"]`.
- **Output Used:** Yes — reviewed, verified with 25 passing tests, and seeded into Atlas.

---

### Entry 003
- **Date:** 2026-10-18
- **Phase:** Phase 3 — Secure Document Management
- **Tool:** Antigravity (Google DeepMind)
- **Prompt:**
  ```
  Implement secure document management with private file storage and server-side authorisation:
  - Document model (ownerId, title, category, storageKey, originalFilename, detectedMimeType, sizeBytes).
  - Private storage adapter with path traversal guards. Server-generated storage keys (UUID).
  - POST /api/v1/documents with magic-byte signature validation, allowlist, and DB rollback file cleanup.
  - Reusable DocumentAccessService for authorization (IDOR prevention).
  - GET, PATCH, DELETE, and GET /download streaming with hardened security headers.
  - Automated tests (22 tests) with isolated storage and DB.
  - Frontend documents view with upload, list, search, filters, download, edit, and delete.
  ```
- **Real Challenges & Corrections:**
  1. *Test Storage Pollution*: The rollback cleanup test initially found 14 files left from preceding upload tests. Added explicit directory cleaning in `beforeEach` to guarantee 100% test isolation.
  2. *Vite verbatimModuleSyntax*: TypeScript threw `TS1484` on interface imports. Corrected to `import type { ... }` in all React components.
  3. *Zod nativeEnum errorMap*: Modern Zod rejected `errorMap` inside `z.nativeEnum`. Replaced with `{ message: 'Invalid category' }`.
- **Output Used:** Yes — 47/47 tests passing across the entire test suite.

---

### Entry 004
- **Date:** 2026-10-18
- **Phase:** Phase 4 — Document Sharing and Permissions
- **Tool:** Antigravity (Google DeepMind)
- **Prompt:**
  ```
  Implement secure per-document sharing, READ/EDIT permissions, and revocation:
  - Mongoose Permission model with documentId, userId, permission (READ/EDIT), grantedBy, revokedAt, timestamps, compound unique index.
  - API endpoints: PUT /api/v1/documents/:id/permissions/:userId, GET /api/v1/documents/:id/permissions, DELETE /api/v1/documents/:id/permissions/:userId, GET /api/v1/documents/recipients/list.
  - Integrate permissions into DocumentAccessService (enforce read, modify, delete, share).
  - Immediate revocation effect; unshared/revoked users denied with 403 Forbidden.
  - Comprehensive automated security test suite (24 tests) covering access levels, IDOR, forged headers, duplicate grants, and deletion cascades.
  - Frontend sharing interface in DocumentsView with recipient picker, permission selector, active grant list, revocation, and loading/error states.
  ```
- **Real Challenges & Corrections:**
  1. *MongoDB Atlas Residential IP Lockout*: During development, dynamic ISP IP rotation blocked incoming Atlas connections. Enhanced `lib/db.ts` to attempt connection with retry, and cleanly fall back to `mongodb-memory-server` with automated user seeding for local dev resilience.
  2. *Mongoose findOneAndUpdate Deprecation*: In Mongoose 9+, passing `{ new: true }` in `findOneAndUpdate` triggers a deprecation warning recommending `{ returnDocument: 'after' }`. Modernized options to maintain deprecation-free execution.
  3. *Vitest Parallel Test Collisions on Windows*: Running 4 in-memory Mongo instances concurrently in Vitest caused sporadic port/process contention on Windows. Added `--fileParallelism=false` in `package.json` to guarantee sequential, 100% deterministic test execution.
  4. *Recipient vs Owner Boundaries*: Explicitly prevented document owners from sharing documents with themselves (400) and preventing non-owners or recipients from altering permissions (403).
- **Output Used:** Yes — 71/71 tests passing across 4 test suites; frontend verified with clean production build.

---

> **Note to reviewers:** Every AI-assisted design decision and line of code was reviewed and verified by the developer. The developer can defend all architectural and security implementations during technical interviews.

