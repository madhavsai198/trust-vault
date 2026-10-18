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
| **Testing** | Vitest + Supertest | 71 automated tests across 4 suites with `mongodb-memory-server` isolated test DB |
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
npm test         # Runs full Vitest suite (71 passing tests sequentially in-memory)
```

---

## Phase 3 & 4: Secure Document Management, Sharing & Permissions

### Authorization & Access Control Matrix

| Role / Permission | View Metadata | Download File | Modify Metadata (`PATCH`) | Delete Document | Grant / Revoke Permissions |
|---|:---:|:---:|:---:|:---:|:---:|
| **Document Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **System Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Recipient (EDIT)** | ✅ | ✅ | ✅ | ❌ (403) | ❌ (403) |
| **Recipient (READ)** | ✅ | ✅ | ❌ (403) | ❌ (403) | ❌ (403) |
| **Revoked / Unshared** | ❌ (403) | ❌ (403) | ❌ (403) | ❌ (403) | ❌ (403) |
| **Unauthenticated** | ❌ (401) | ❌ (401) | ❌ (401) | ❌ (401) | ❌ (401) |

---

### API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/documents` | Required | Uploads file with magic-byte verification and private storage isolation. |
| `GET` | `/api/v1/documents` | Required | Lists documents owned by or actively shared with user (includes `accessLevel`). |
| `GET` | `/api/v1/documents/recipients/list` | Required | Returns registered users (excluding current user) for sharing dropdown. |
| `GET` | `/api/v1/documents/:id` | Required | Retrieves document metadata with user's access level (`DocumentAccessService`). |
| `PATCH` | `/api/v1/documents/:id` | Required | Updates metadata (`title`, `category`). Permitted for Owner, Admin, or `EDIT` recipient. |
| `DELETE` | `/api/v1/documents/:id` | Required | Deletes physical file and database document; cleans up associated permissions. |
| `GET` | `/api/v1/documents/:id/download` | Required | Streams file directly with `nosniff`, `no-cache`, and safe `Content-Disposition`. |
| `PUT` | `/api/v1/documents/:id/permissions/:userId` | Owner/Admin | Grants or updates `READ`/`EDIT` permission for recipient user (atomic upsert). |
| `GET` | `/api/v1/documents/:id/permissions` | Owner/Admin | Lists all active and historical permission records for the document. |
| `DELETE` | `/api/v1/documents/:id/permissions/:userId` | Owner/Admin | Revokes recipient permission with immediate termination of access. |

---

## Automated Test Evidence

The automated Vitest test suite runs in-memory with zero network or production dependencies:

```text
✓ tests/health.test.ts       (6 tests)
✓ tests/auth.test.ts         (19 tests)
✓ tests/documents.test.ts    (22 tests)
✓ tests/permissions.test.ts  (24 tests)

Test Files:  4 passed (4)
Tests:       71 passed (71)
Duration:    ~45 seconds
```

### Security Test Matrix Highlights:
1. **Unauthenticated access**: Upload, list, download, grant, and revoke rejected (401).
2. **Owner lifecycle**: Full control over documents, private storage cleanup, and sharing management.
3. **Cross-user IDOR defense**: Third-party users denied metadata, download, modify, and delete access (403).
4. **Granular Permissions (READ vs EDIT)**:
   - Recipient with `READ` can view metadata and download, but cannot edit (403) or delete (403).
   - Recipient with `EDIT` can modify title and category, but cannot delete (403) or share with others (403).
5. **Immediate Revocation**:
   - Owner revokes recipient access; subsequent metadata, download, and edit requests immediately return 403.
   - Owner cannot revoke their own access (400).
   - Owner's own access is completely preserved after revoking recipient.
6. **Race-Condition & Duplicate Safety**:
   - MongoDB compound unique index `{ documentId: 1, userId: 1 }` prevents duplicate records.
   - Atomic `findOneAndUpdate` with `upsert` handles concurrent grants and restores revoked permissions cleanly.
7. **Zero-Trust Field Derivation**:
   - `grantedBy` and `ownerId` are strictly derived from verified session tokens, ignoring client request payloads.
8. **Storage & Permission Cascades**:
   - Deleting a document removes the physical storage file and cascades removal of all associated permissions.

---

## Roadmap & Progress

- [x] **Phase 1 — Project Foundation & Tooling** (Vite + React, Express + TS, Healthcheck, CI)
- [x] **Phase 2 — Database & Authentication** (MongoDB Atlas, Argon2id, HttpOnly JWT, RBAC, 25 tests)
- [x] **Phase 3 — Private Document Management** (Private storage, magic bytes, streaming, rollback cleanup, 47 tests)
- [x] **Phase 4 — Document Sharing & Permissions** (Permission model, READ/EDIT grants, immediate revocation, sharing UI, 71 tests)
- [ ] **Phase 5 — Security Hardening & Immutable Audit Log** (Tamper detection, audit dashboard of access and sharing events) — *Future Phase*

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
