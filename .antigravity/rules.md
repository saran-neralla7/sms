# Project Engineering Rules & Security Standards

## 1. Absolute Zero Data Loss
- NEVER run destructive database migrations, truncate statements, or table drops.
- Always inspect existing database records before modifying or deleting any row.
- For data transformations or cleanups, run inside atomic Prisma transactions (`prisma.$transaction`) with dry-run verification first.

## 2. Security-First Architecture for Every New Feature
For every new endpoint, feature, page, or authentication component added:
- **Transport & Origin Security**:
  - All endpoints and authentication flows must enforce official HTTPS origin (`https://login.gvpcdpgc.edu.in`).
  - Never expose internal or raw IP addresses (`123.108.201.170`) in client-facing payloads, cookies, or redirect links.
- **Cookies & Session Tokens**:
  - All session, auth, and sensitive state cookies must include `HttpOnly`, `Secure`, and `SameSite=Lax` or `SameSite=Strict`.
- **Authorization & Access Control**:
  - Validate role permissions on the server for every API route (`ADMIN`, `FACULTY`, `STUDENT`, `OFFICE`, etc.). Never rely on client-side role guards alone.
- **Input Sanitization & Injection Prevention**:
  - Use parameterized Prisma queries (no raw untyped SQL concatenation).
  - Validate payloads against max lengths and types before writing to the database.
  - Avoid rendering unsanitized HTML/user input to prevent XSS.
- **Information Disclosure Prevention**:
  - Suppress stack traces, verbose server banners, and internal error details in API responses.
  - Never leave sensitive links, admin edit URLs, or internal resource paths in client HTML comments or public bundles.
- **CSRF & Mutating Action Protection**:
  - Protect mutating API actions with CSRF validation and proper origin checks.
