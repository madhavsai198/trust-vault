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

> **Note to reviewers:** Every AI-assisted design decision and line of code was reviewed and verified by the developer. The developer can defend all architectural and security implementations during technical interviews.
