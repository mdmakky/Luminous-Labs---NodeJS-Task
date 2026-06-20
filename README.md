# Task Assignment API with Audit Trail

> A production-ready Node.js REST API for internal task tracking — featuring JWT auth with refresh token rotation, granular role-based access control, automatic audit logging on every status change, and full Swagger documentation.

**Stack:** Node.js 20 · Express 5 · PostgreSQL 15 · Prisma ORM · Zod · JWT · Jest · Docker

---

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Seeded Test Accounts](#seeded-test-accounts)
3. [Project Structure](#project-structure)
4. [Architecture](#architecture)
5. [Authentication & Authorization](#authentication--authorization)
6. [Validation & Error Handling](#validation--error-handling)
7. [Audit Trail](#audit-trail)
8. [Filtering, Sorting & Pagination](#filtering-sorting--pagination)
9. [API Reference](#api-reference)
10. [Testing Strategy & Coverage](#production-readiness--resilience-testing-strategy)
11. [Postman Setup & Integration](#postman-setup--integration)
12. [Production Architecture & Hardening Features](#production-architecture--hardening-features)

---

## Quick Setup

### Prerequisites
- Node.js ≥ 20
- PostgreSQL 15 running locally **or** use Docker (see below)

### Local Setup

> [!IMPORTANT]
> You **must** run the database migrations (`npm run migrate` or `npx prisma migrate dev`) to create the necessary tables in your database **before** running the seed command (`npm run seed`). Otherwise, the seeding process will fail.

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Run database migrations (MUST run before seeding to create tables)
npm run migrate

# 4. Seed default users and sample data (fails if migrations aren't applied first)
npm run seed

# 5. Start development server
npm run dev
```

Server → **http://localhost:3000**  
Swagger UI → **http://localhost:3000/api-docs**

### Docker Setup (no local PostgreSQL needed)

```bash
docker-compose up --build
docker exec task_api_app npx prisma migrate deploy
docker exec task_api_app node prisma/seed.js
```

### Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/task_api?schema=public
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_SALT_ROUNDS=10
```

---

## Seeded Test Accounts

After running `npm run seed`, the following accounts are available:

| Role    | Email                    | Password       |
|---------|--------------------------|----------------|
| Admin   | `admin@example.com`      | `Admin@123`    |
| Manager | `manager@example.com`    | `Manager@123`  |
| Member  | `member@example.com`     | `Member@123`   |

---

## Project Structure

```
src/
├── app.js                  # Express app setup (middleware, routing, swagger)
├── server.js               # Server bootstrap + graceful shutdown
├── config/
│   ├── env.js              # Validated env loader
│   ├── prisma.js           # Prisma client + pg connection pool
│   └── swagger.js          # OpenAPI 3.0 specification
├── controllers/            # HTTP layer — reads req, calls services, sends response
│   ├── auth.controller.js
│   ├── task.controller.js
│   ├── project.controller.js
│   ├── comment.controller.js
│   └── audit-log.controller.js
├── services/               # Business logic + RBAC enforcement
│   ├── auth.service.js
│   ├── task.service.js
│   ├── project.service.js
│   ├── comment.service.js
│   └── audit-log.service.js
├── repositories/           # Database access via Prisma (pure data layer)
│   ├── user.repository.js
│   ├── task.repository.js
│   ├── project.repository.js
│   ├── comment.repository.js
│   ├── audit-log.repository.js
│   └── refresh-token.repository.js
├── middleware/
│   ├── auth.middleware.js       # JWT verification
│   ├── rbac.middleware.js       # Role enforcement
│   ├── validation.middleware.js # Zod schema validation
│   ├── rate-limit.middleware.js # Auth route rate limiting
│   ├── error-handler.js         # Centralized error handler
│   └── async-handler.js         # Async error wrapper
├── routes/                 # Route definitions + middleware chains
├── validations/            # Zod schemas per resource
└── utils/
    ├── errors.js           # Custom error classes
    ├── response.js         # Standardized response helpers
    └── token-cleanup.js    # Startup utility: prune expired tokens

prisma/
├── schema.prisma           # Database models and relationships
├── seed.js                 # Seed script for test accounts + sample data
└── migrations/             # Versioned SQL migration history

tests/
├── critical-path.test.js       # End-to-end lifecycle flow tests
├── auth.security.test.js       # Auth security, JWT forgery, rate-limit tests
├── authorization.test.js       # RBAC / IDOR / multi-tenancy boundary tests
├── validation.test.js          # Zod schema, UUID, enum boundary tests
├── database-consistency.test.js # Cascade, soft-delete, completedAt sync tests
├── edge-cases.test.js          # Refresh token replay, expired session, pagination tests
├── setup.js                    # Global Prisma/pool teardown
└── helpers/
    ├── auth.helper.js          # createTestUser + getAuthHeader utilities
    └── db.helper.js            # clearDatabase helper
```

---

## Architecture

The application follows a strict **Layered Architecture** — each layer has a single, well-defined responsibility.

```mermaid
graph TD
    Client -->|HTTP Request| Routes
    Routes -->|Validate Schema| Validation[Zod Validation]
    Validation -->|Parsed Payload| Controller
    Controller --> Services
    Services -->|Business Logic / RBAC| Repositories
    Repositories -->|Prisma Queries| PostgreSQL
    Controller -->|AppError| ErrorHandler[Centralized Error Handler]
```

| Layer | Responsibility |
|---|---|
| **Routes** | URI definitions, middleware chaining (auth → validate → controller) |
| **Controllers** | Read `req`, call service, send standardized `res` |
| **Services** | All business rules, ownership checks, RBAC enforcement |
| **Repositories** | All Prisma queries — no business logic |
| **Middleware** | Auth, RBAC guards, Zod validation, error handler |
| **Utils** | Error classes, response helpers, token cleanup |

### Database Schema

```mermaid
erDiagram
    User ||--o{ RefreshToken : issues
    User ||--o{ Project : owns
    User ||--o{ Task : creates
    User ||--o{ Task : "assigned to"
    User ||--o{ TaskComment : writes
    User ||--o{ AuditLog : performs
    Project ||--o{ Task : contains
    Task ||--o{ TaskComment : has
    Task ||--o{ AuditLog : generates
```

**Key schema decisions:**
- `Task` has `completedAt DateTime?` — auto-set when status reaches `DONE`, cleared otherwise.
- `Project`, `Task`, `TaskComment` have `deletedAt` + `deletedBy` for auditable soft deletes.
- `AuditLog` is **immutable** — no update or delete operations are permitted.
- `RefreshToken` stores only the SHA-256 hash, never the raw token.

---

## Authentication & Authorization

### JWT with Refresh Token Rotation (RTR)

| Token | TTL | Storage | Purpose |
|---|---|---|---|
| Access Token | 15 minutes | Client memory | Authenticates every request via `Authorization: Bearer` |
| Refresh Token | 7 days | PostgreSQL (hashed) | Issues new access tokens without re-login |

**Security properties:**
- Refresh tokens are stored as **SHA-256 hashes** — raw tokens are never persisted.
- On every `/auth/refresh` call, the old token is **immediately deleted** and a new pair is issued (rotation). Replay of an old token returns `401`.
- On `/auth/logout`, the refresh token is deleted from the database, preventing future reuse.
- On server startup, a non-blocking cleanup removes all expired tokens from the database.

### RBAC Matrix

Enforced at two layers: route-level middleware (guards) **and** service-level ownership checks.

| Action | Admin | Manager | Member |
|---|---|---|---|
| Create / Delete Project | ✅ All | ✅ Own projects only | ❌ |
| Update Project | ✅ All | ✅ Own projects only | ❌ |
| List Projects | ✅ All | ✅ Own projects | ✅ Projects with assigned tasks |
| Create / Delete Task | ✅ All | ✅ Own projects only | ❌ |
| Update Task (full) | ✅ All | ✅ Own projects only | ❌ |
| Update Task (status only) | ✅ All | ✅ Own projects only | ✅ Assigned tasks only |
| Reassign Task | ✅ All | ✅ Own projects only | ❌ |
| List Tasks | ✅ All | ✅ Own projects only | ✅ Assigned tasks only |
| View Audit Trail | ✅ All | ✅ Own projects only | ✅ Assigned tasks only |
| Post Comment | ✅ All | ✅ Own projects only | ✅ Assigned tasks only |
| Edit Comment | ✅ All | ✅ Own projects only | ✅ Own comments only |
| Delete Comment | ✅ All | ✅ Own projects only | ✅ Own comments only |

### Auth Rate Limiting

`/auth/register` and `/auth/login` are protected by a **5 requests per 15 minutes** rate limiter to prevent brute-force and credential-stuffing attacks.

---

## Validation & Error Handling

### Request Validation

All request bodies, query strings, and route parameters are validated with **Zod schemas** before reaching the controller. Invalid payloads are rejected immediately with field-level error details:

```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Validation failed",
    "errors": [
      { "field": "body.email", "message": "Invalid email address" },
      { "field": "body.password", "message": "Password must be at least 6 characters" }
    ]
  }
}
```

### Standardized Response Envelope

Every response — success or failure — uses the same predictable shape:

```json
// Success
{ "success": true, "data": { ... }, "error": null }

// Success (paginated list)
{
  "success": true,
  "data": [ ... ],
  "error": null,
  "meta": { "totalCount": 42, "page": 1, "limit": 10, "totalPages": 5 }
}

// Error
{ "success": false, "data": null, "error": { "message": "..." } }
```

### HTTP Status Codes

| Scenario | Status |
|---|---|
| Success | `200` / `201` |
| Validation error | `400` |
| Unauthenticated | `401` |
| Forbidden (RBAC) | `403` |
| Not found | `404` |
| Duplicate / Conflict | `409` |
| Rate limited | `429` |
| Unexpected error | `500` |

### Centralized Error Handler

All thrown errors are caught by `src/middleware/error-handler.js`. In production, unexpected error details are hidden from the client — only `"Internal server error"` is shown. Error details are logged server-side.

---

## Audit Trail

**Every task status change is automatically and immutably logged.** No manual API call is required from the client.

### How It Works

```
PATCH /api/v1/tasks/:id  (e.g., status: "TODO" → "IN_PROGRESS")
        ↓
  task.controller.js  detects oldStatus ≠ newStatus
        ↓
  audit-log.service.js  writes to audit_logs table
        ↓
  GET /api/v1/tasks/:id/audit  returns full history
```

### AuditLog Record

Each log entry captures:
- `taskId` — which task changed
- `changedBy` — which user made the change (UUID)
- `oldStatus` — previous status
- `newStatus` — new status
- `createdAt` — exact timestamp

### Viewing the Audit Trail

```bash
curl "http://localhost:3000/api/v1/tasks/<TASK_UUID>/audit?page=1&limit=10&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Example response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "3f2e...",
      "taskId": "abc1...",
      "oldStatus": "TODO",
      "newStatus": "IN_PROGRESS",
      "createdAt": "2025-06-18T14:30:00.000Z",
      "user": { "name": "Jane Member", "email": "member@example.com" }
    },
    {
      "id": "4d5f...",
      "taskId": "abc1...",
      "oldStatus": "IN_PROGRESS",
      "newStatus": "DONE",
      "createdAt": "2025-06-19T09:10:00.000Z",
      "user": { "name": "Jane Member", "email": "member@example.com" }
    }
  ],
  "meta": { "totalCount": 2, "page": 1, "limit": 10, "totalPages": 1 }
}
```

> **Design choice:** `AuditLog` records are **write-once** — no update or delete endpoints exist for them, ensuring an unalterable history.

---

## Filtering, Sorting & Pagination

All list endpoints support filtering, sorting, and cursor-free pagination via query parameters.

### Tasks — `GET /api/v1/tasks`

| Parameter | Type | Description |
|---|---|---|
| `status` | enum | `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED` |
| `priority` | enum | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `assigneeId` | uuid | Filter by assignee |
| `projectId` | uuid | Filter by project |
| `sortBy` | string | `createdAt`, `dueDate`, `priority`, `status`, `title` |
| `sortOrder` | enum | `asc`, `desc` |
| `page` | int | Default `1` |
| `limit` | int | Default `10`, max `100` |

### Projects — `GET /api/v1/projects`

| Parameter | Type | Description |
|---|---|---|
| `name` | string | Partial name search |
| `sortBy` | string | `name`, `createdAt`, `updatedAt` |
| `sortOrder` | enum | `asc`, `desc` |
| `page` / `limit` | int | Pagination |

### Comments — `GET /api/v1/tasks/:taskId/comments`

Supports `page`, `limit`, `sortBy` (`createdAt`, `updatedAt`), `sortOrder`.

### Audit Trail — `GET /api/v1/tasks/:id/audit`

Supports `page`, `limit`, `sortBy` (`createdAt`, `oldStatus`, `newStatus`), `sortOrder`.

---

## API Reference

Swagger UI with full interactive docs: **http://localhost:3000/api-docs**

![Swagger UI](./swagger-ui.png)

All responses use the envelope: `{ "success": true/false, "data": ..., "error": ... }`

### Auth Endpoints

```bash
# Register (always creates MEMBER — role cannot be self-assigned)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "name": "John Doe", "email": "john@example.com", "password": "Pass@123" }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "manager@example.com", "password": "Manager@123" }'

# Get own profile
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# Refresh tokens — old refresh token is invalidated after this call
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<REFRESH_TOKEN>" }'

# Logout — invalidates the refresh token server-side
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<REFRESH_TOKEN>" }'
```

### Projects

```bash
# Create (Admin / Manager only)
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "name": "Sprint Alpha", "description": "Q3 release sprint" }'

# List with filtering and pagination
curl "http://localhost:3000/api/v1/projects?name=Sprint&sortBy=createdAt&sortOrder=desc&page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"

# Get single project
curl http://localhost:3000/api/v1/projects/<ID> \
  -H "Authorization: Bearer <TOKEN>"

# Update (owner or Admin)
curl -X PATCH http://localhost:3000/api/v1/projects/<ID> \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "name": "Sprint Alpha v2", "description": "Updated scope" }'

# Delete — soft delete, records deletedBy
curl -X DELETE http://localhost:3000/api/v1/projects/<ID> \
  -H "Authorization: Bearer <TOKEN>"
```

### Tasks

```bash
# Create (Admin / Manager only)
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "title": "Setup CI pipeline",
    "description": "Configure GitHub Actions for automated testing",
    "priority": "HIGH",
    "status": "TODO",
    "projectId": "<PROJECT_UUID>",
    "assigneeId": "<MEMBER_UUID>",
    "dueDate": "2025-12-31T00:00:00Z"
  }'

# List with filters + sorting + pagination
curl "http://localhost:3000/api/v1/tasks?status=IN_PROGRESS&priority=HIGH&sortBy=dueDate&sortOrder=asc&page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"

# Get single task
curl http://localhost:3000/api/v1/tasks/<ID> \
  -H "Authorization: Bearer <TOKEN>"

# Update task — triggers audit log if status changes
curl -X PATCH http://localhost:3000/api/v1/tasks/<ID> \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "status": "IN_PROGRESS" }'

# Delete (soft delete — Admin / Manager only)
curl -X DELETE http://localhost:3000/api/v1/tasks/<ID> \
  -H "Authorization: Bearer <TOKEN>"

# Valid statuses: TODO · IN_PROGRESS · IN_REVIEW · DONE · CANCELLED
# Valid priorities: LOW · MEDIUM · HIGH · URGENT
```

### Audit Trail

```bash
# View full audit history for a task (paginated, sortable)
curl "http://localhost:3000/api/v1/tasks/<TASK_UUID>/audit?page=1&limit=10&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer <TOKEN>"
```

### Comments

```bash
# List comments on a task (paginated)
curl "http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments?page=1&limit=20&sortBy=createdAt&sortOrder=asc" \
  -H "Authorization: Bearer <TOKEN>"

# Post a comment
curl -X POST http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "content": "Implementation complete and ready for review." }'

# Edit (author only)
curl -X PATCH http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments/<COMMENT_UUID> \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "content": "Updated comment text." }'

# Delete (author, Admin, or project Manager)
curl -X DELETE http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments/<COMMENT_UUID> \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Production Readiness & Resilience Testing Strategy

The application is validated by a robust suite of **6 modular test suites** (73 tests total) built using Jest and Supertest. The suite is designed to ensure strict alignment with production guidelines and maps test scenarios to specific business and security risks.

### Running the Test Suite

```bash
# 1. Run the entire test suite
npm test

# 2. Run the tests in verbose mode (shows all individual test cases)
npm run test:verbose

# 3. Check test coverage metrics
node --experimental-vm-modules node_modules/.bin/jest --coverage --forceExit --detectOpenHandles

# 4. Run a single specific test file (e.g. auth security)
npx jest tests/auth.security.test.js
```

### Test Coverage Results

Our test coverage exceeds the strict project guidelines, verifying that code branches, statements, and edge conditions are securely tested:

| Metric | Required Threshold | Current Coverage | Status |
|---|---|---|---|
| **Lines** | ≥ 85% | **100.00%** | **PASSED** ✅ |
| **Branches** | ≥ 80% | **92.21%** | **PASSED** ✅ |
| **Functions** | ≥ 85% | **100.00%** | **PASSED** ✅ |
| **Statements** | — | **100.00%** | **PASSED** ✅ |

---

### Test Suite Map & Risk Matrix

| Test Suite / File | Category | Mitigated Risk | Priority | Expected Outcome |
|---|---|---|---|---|
| [`critical-path.test.js`](tests/critical-path.test.js) | Critical-Path | Key task creation, assignment, done status transitions, and soft-delete lifecycle regression. | **Critical** | End-to-end task flows succeed, auto-setting `completedAt` timestamps and correctly hiding deleted tasks while preserving them in database. |
| [`auth.security.test.js`](tests/auth.security.test.js) | Security & Rate-Limiting | Token signature forgery, endpoint health leaks, role mass-assignment escalation, brute force login attacks. | **Critical** | Forged tokens are rejected (401), registration role overrides are ignored (forces `MEMBER`), health checks return 200, and excessive attempts get blocked with `429`. |
| [`authorization.test.js`](tests/authorization.test.js) | Access Control (IDOR) | Manager-to-manager cross-project modifications, member task boundaries cross-tenant view/comment/edit/delete. | **Critical** | Resource reads and mutations across unauthorized manager or member scopes return `403 Forbidden`. Admins bypass boundaries safely. |
| [`validation.test.js`](tests/validation.test.js) | Input Validation | Invalid UUID parameters crashing DB drivers, short input strings, enum boundary violations. | **High** | Malformed parameters or payloads are intercepted by Zod schemas and reject with standard `400 Bad Request` instead of DB 500s. |
| [`database-consistency.test.js`](tests/database-consistency.test.js) | Consistency & Cascades | Accumulating orphaned logs/comments on task delete, mismatched project relations, incorrect `completedAt` sync. | **High** | Database hard-deletes cascade cleanups to prevent orphaned rows; invalid relations fail with 404; `completedAt` synchronizes correctly. Unexpected errors return structured JSON envelopes. |
| [`edge-cases.test.js`](tests/edge-cases.test.js) | Edge Cases & Sessions | Replaying rotated refresh tokens, expired refresh sessions, large limit pagination Denial of Service (DoS). | **Critical** | Replayed refresh tokens yield 401; expired sessions are pruned; page query inputs out of bounds trigger `400 Bad Request` validation. |

### Test Design Notes
- **Isolation**: Each test suite runs `clearDatabase()` before every test run.
- **E2E Fidelity**: Tests run against a live PostgreSQL database instance through the Express app (using `supertest`), using real schema migrations without mocks.
- **Centralized Errors**: Centralized error mapping logic is validated under dynamic `process.env.NODE_ENV` switches (handling development diagnostics and production privacy masks).

---

## Postman Setup & Integration

A production-ready Postman collection and environment schema are provided in the root directory to simplify integration testing and dynamic API exploration.

### Purpose of the Files
1. **[`postman_collection.json`](postman_collection.json)**:
   * Contains pre-configured requests for all **22 endpoints** organized into folders (System, Auth, Projects, Tasks, Comments).
   * Includes **dynamic Javascript tests** that validate status codes and automatically capture `accessToken` / `refreshToken` / resource IDs from responses, saving them directly into environment variables.
2. **[`postman_environment.json`](postman_environment.json)**:
   * Holds configuration keys (`base_url`, `access_token`, `refresh_token`) and placeholders (`project_id`, `task_id`, `comment_id`) to share variables dynamically across API calls.

### How to Use the Postman Suite
1. **Start the API server locally**:
   ```bash
   npm run dev
   ```
2. **Import files into Postman**:
   * Click **Import** in Postman and select both `postman_collection.json` and `postman_environment.json`.
3. **Select the Environment**:
   * In the top-right corner of Postman, switch the active environment from *No Environment* to **"Task API - Local Environment"**. This activates the `{{base_url}}` variable.
4. **Execute requests sequentially**:
   * Run **Register User** or **Login User**. Postman will automatically set the `{{access_token}}` and `{{refresh_token}}` variables behind the scenes.
   * Run **Create Project** then **Create Task**. Postman will capture their IDs automatically, letting you query, update, or delete them instantly without manual copying.

---

## Production Architecture & Hardening Features

The application incorporates key resilience and security features out of the box to guarantee production stability:

| Feature / Control | Description |
|---|---|
| **Refresh Token Rotation** | Expired refresh tokens are rotated and deleted on `/auth/refresh` with SHA-256 validation; replay attempts reject with `401`. |
| **API Auto-Documentation** | Comprehensive OpenAPI 3.0 schemas compiled dynamically and exposed interactively via Swagger UI at `/api-docs`. |
| **Containerization** | Production-ready multi-stage `Dockerfile` and `docker-compose.yml` with built-in PostgreSQL healthcheck parameters. |
| **Data Soft-Delete** | Task, project, and comment entries respect logical `deletedAt` and `deletedBy` records to prevent state pollution. |
| **Task Timestamping & Auditing** | `completedAt` values dynamically transition with task statuses; status logs generate immutable audit logs. |
| **Auth Rate Limiting** | Authentication endpoints are protected against brute-force attacks via sliding-window limiters (5 requests per 15 minutes). |
| **DB Pool Tuning & Cleanup** | Connection limits managed dynamically (`max: 10`); scheduler prunes expired database sessions non-blockingly at startup. |
| **Express Security Hardening** | GZIP body compression via `compression`, unified request headers masking via `helmet`, and client-side error stack trace suppression. |
