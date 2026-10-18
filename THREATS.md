# THREATS.md — TrustVault Threat Model

> This document records known security threats and the mitigations planned or implemented.
> It grows with the project. Phase 1 establishes the baseline.

---

## Scope

TrustVault allows authenticated users to upload, store, and share sensitive documents with
trusted contacts. The threat model covers the web application, its API, and data at rest.

---

## Threat Categories (STRIDE)

| ID  | Category          | Threat                                        | Status      | Mitigation Planned                          |
|-----|-------------------|-----------------------------------------------|-------------|---------------------------------------------|
| T01 | Spoofing          | Attacker impersonates a legitimate user        | ⬜ Open     | JWT auth + bcrypt password hashing          |
| T02 | Tampering         | Document contents modified in transit          | ⬜ Open     | HTTPS (TLS) + file integrity checks         |
| T03 | Repudiation       | User denies uploading/sharing a document       | ⬜ Open     | Audit log with timestamps and user IDs      |
| T04 | Info Disclosure   | Unauthorised user accesses another's documents | ⬜ Open     | Route guards + ownership checks in API      |
| T05 | Info Disclosure   | `.env` secrets committed to Git                | ✅ Mitigated | `.gitignore` blocks all `.env` files        |
| T06 | Info Disclosure   | API leaks stack traces in production           | ⬜ Open     | Custom error handler; `NODE_ENV` check      |
| T07 | Denial of Service | Large file uploads exhaust server memory       | ⬜ Open     | `multer` file size limits                   |
| T08 | Elevation         | Non-owner gains delete/share permission        | ⬜ Open     | Permission middleware per route             |
| T09 | Tampering         | MongoDB injection via crafted input            | ⬜ Open     | Mongoose schema validation + sanitisation   |
| T10 | Info Disclosure   | CORS misconfiguration exposes API publicly     | ⬜ Open     | Restrict CORS origin to frontend URL        |

---

## Phase 1 Security Posture

- Secrets are kept out of version control via `.gitignore` and `.env.example` placeholders.
- No credentials are hardcoded anywhere in the source.
- No authentication is implemented yet — the API is **not production-ready**.
- No documents are stored or served in Phase 1.

---

## Notes for Reviewer

- Threats marked ⬜ Open will be addressed in subsequent phases.
- This document must be updated each time a new feature is added.
