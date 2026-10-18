# TrustVault

> Enterprise-grade secure document storage and sharing platform with zero-knowledge architecture, end-to-end encryption, role-based access control (RBAC), and comprehensive audit trails.

Built for the **Snovasys Fresher Hiring Challenge 2026**.

[![TrustVault CI](https://github.com/madhavsai198/trust-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/madhavsai198/trust-vault/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/Node-v20+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript | Strict TypeScript, Tailwind CSS v3, Accessible HTML5 Landmarks |
| **Backend** | Node.js + Express + TypeScript | Modular architecture, Zod schema validation, Argon2id hashing |
| **Database** | MongoDB Atlas + Mongoose | Schema constraints, indexes, excluded hash by default (`select: false`) |
| **Auth** | JWT in `HttpOnly` Cookies | `SameSite=Strict`, CSRF defense, anti-enumeration constant-time verification |
| **Testing** | Vitest + Supertest | 25 automated tests with `mongodb-memory-server` isolated test DB |
| **DevOps** | Docker, GitHub Actions, Render/Vercel | Automated CI workflow, multi-stage Docker containerization |

---

## Project Structure

```
trust-vault/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI (typecheck, test, build)
├── backend/
│   ├── src/
│   │   ├── lib/                 # Database connection & lifecycle
│   │   ├── middleware/          # requireAuth, requireRole (RBAC)
│   │   ├── models/              # User model (ADMIN, OWNER, VIEWER)
│   │   ├── routes/              # /health, /auth (register, login, logout, me)
│   │   ├── scripts/             # Seed script (idempotent user provisioning)
│   │   └── server.ts            # Express server configuration & graceful shutdown
│   ├── tests/                   # Automated Vitest + Supertest suites
│   ├── Dockerfile               # Production multi-stage Dockerfile
│   └── tsconfig.json
├── frontend/
│   ├── public/                  # Favicon, robots.txt, sitemap.xml, site.webmanifest
│   ├── src/
│   │   ├── components/          # LandingPage, Navigation, Landmarks
│   │   └── index.css            # Tailwind design system tokens
│   ├── Dockerfile               # Production Nginx container
│   ├── nginx.conf               # Gzip, SPA fallback & security headers
│   ├── vercel.json              # Vercel SPA rewrites & security headers
│   └── vite.config.ts
├── docker-compose.yml           # Unified multi-container orchestration
├── render.yaml                  # Render Infrastructure-as-Code blueprint
├── THREATS.md                   # Threat model & security mitigation matrix
└── PROMPTS.md                   # AI pair programming trajectory log
```

---

## Security Architecture & Technical Interview Defense

1. **Password Hashing with Argon2id**:
   - Uses Argon2id (winner of the Password Hashing Competition), configured with memory-hard parameters to resist GPU/ASIC brute-force attacks.
2. **HttpOnly & SameSite=Strict Cookie Auth**:
   - JWT tokens are stored in `HttpOnly` cookies, preventing token theft via Cross-Site Scripting (XSS).
   - `SameSite=Strict` defends against Cross-Site Request Forgery (CSRF).
3. **Data Leakage Prevention**:
   - `passwordHash` is excluded by default at schema level (`select: false`) and never included in queries unless explicitly requested during login.
4. **Anti-Enumeration & Constant-Time Defense**:
   - Identical error message returned for unknown users and wrong passwords (`Invalid email or password`).
   - If an email does not exist, Argon2 verification executes against a constant dummy hash so response latency is indistinguishable.
5. **Least Privilege & Role Escalation Prevention**:
   - Registration assigns `Role.VIEWER` strictly on the server. Client-submitted `role` claims in the request body are ignored.

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+
- npm 9+
- MongoDB Atlas cluster URI

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB Atlas URI and JWT_SECRET
npm run seed     # Idempotently seeds default admin, owner, viewer users
npm run dev      # Starts dev server on http://localhost:4000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
npm run dev      # Starts Vite dev server on http://localhost:5173
```

### 4. Running Automated Tests
```bash
cd backend
npm test         # Runs full Vitest suite (47 passing tests in-memory)
```

---

## Phase 3: Secure Document Management Architecture

### Main Request Flow
```
Client (Browser)
   │  multipart/form-data (Title, Category, File)
   ▼
[requireAuth Middleware] ── Cookie Verified (JWT) ──> Attaches req.user
   │
   ▼
[Multer In-Memory Buffer] (Max 10MB)
   │
   ▼
[fileValidation.ts]
   ├── Magic Byte Signature Check (PDF %PDF-, PNG \x89PNG, JPEG \xFF\xD8\xFF, DOCX/XLSX PK..)
   ├── File Extension & MIME Allowlist Verification
   └── Filename Sanitization (strips traversal sequences, prevents shell injection)
   │
   ▼
[LocalStorageService] ── Generates Random Server Key (UUIDv4) ──> Writes to isolated private storage
   │
   ▼
[Mongoose Document Model] ── Persists metadata (ownerId from session, title, category, size)
   │ (Rollback guard: if DB fails, physical storage file is automatically unlinked)
   ▼
Response 201 Created (Safe metadata without internal storage key)
```

### Document Management Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/documents` | Required | Uploads file with magic-byte verification and private storage isolation. |
| `GET` | `/api/v1/documents` | Required | Lists documents accessible to the user with category/search filters. |
| `GET` | `/api/v1/documents/:id` | Required | Retrieves document metadata (enforces ownership via `DocumentAccessService`). |
| `PATCH` | `/api/v1/documents/:id` | Required | Updates metadata (`title`, `category`). Strictly rejects attempts to modify `ownerId` or `storageKey`. |
| `DELETE` | `/api/v1/documents/:id` | Required | Deletes metadata record and unlinks file from physical storage. |
| `GET` | `/api/v1/documents/:id/download` | Required | Streams file directly with `nosniff`, `no-cache`, and safe `Content-Disposition`. |

---

## Automated Test Evidence

The automated Vitest test suite runs in-memory with zero network or production dependencies:

```text
✓ tests/health.test.ts     (6 tests)
✓ tests/auth.test.ts       (19 tests)
✓ tests/documents.test.ts  (22 tests)

Test Files:  3 passed (3)
Tests:       47 passed (47)
Duration:    ~5 seconds
```

### Document Test Matrix (`tests/documents.test.ts`):
1. **Unauthenticated access**: Rejection of upload, listing, and download (401).
2. **Owner lifecycle**: Uploading, listing, retrieving, and metadata isolation.
3. **Cross-user IDOR defense**: User B forbidden from reading, modifying, downloading, or deleting User A's documents (403).
4. **Forged owner ID prevention**: Client-submitted `ownerId` in request bodies is strictly ignored.
5. **Magic byte inspection**: Extension mismatches and disguised executables rejected (400).
6. **Conservative upload limits**: Files >10MB rejected with clear feedback (400).
7. **Path traversal defense**: Path separators and `..` sequences stripped cleanly.
8. **Forbidden fields protection**: Disallows modifying `ownerId` or `storageKey` via PATCH (400).
9. **Atomic cleanup**: Automatic rollback and unlinking of storage files if DB persistence fails.
10. **Hardened streaming**: Validates `nosniff`, `no-cache`, `Content-Disposition`, and binary byte integrity.
11. **Missing document handling**: Clean 404 responses for non-existent or malformed IDs.

---

## Roadmap & Unfinished Work

- [x] **Phase 1 — Project Foundation & Tooling** (Vite + React, Express + TS, Healthcheck)
- [x] **Phase 2 — Database & Authentication** (MongoDB Atlas, Argon2id, HttpOnly JWT, RBAC)
- [x] **Phase 3 — Private Document Management** (Private storage, magic bytes, streaming, RBAC access service, 47 tests)
- [ ] **Phase 4 — Granular Sharing & Access Delegation** (Time-bound secure links, recipient revocation, view limits) — *Next Phase*
- [ ] **Phase 5 — Security Hardening & Immutable Audit Log** (Tamper detection, audit trail of all access events) — *Future Phase*

---

## Anytime Deployment Options

### Option A: Docker Compose (Any Cloud or VPS)
```bash
MONGODB_URI="your-atlas-uri" JWT_SECRET="your-secret" docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

### Option B: Render Blueprint (1-Click Cloud)
Render detects [`render.yaml`](./render.yaml), deploying the Express backend web service and static frontend automatically.

### Option C: Vercel (Frontend) + Render/Fly.io (Backend)
Frontend is configured with [`vercel.json`](./frontend/vercel.json) for instant deployment with SPA routing and security headers.
