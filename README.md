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
10. [Tests](#tests)
11. [Bonus Features](#bonus-features)

---

## Quick Setup

### Prerequisites
- Node.js ≥ 20
- PostgreSQL 15 running locally **or** use Docker (see below)

### Local Setup

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Run database migrations
npm run migrate

# 4. Seed default users and sample data
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
├── auth.test.js            # 9 auth endpoint integration tests
├── task.test.js            # 19 task/project/comment integration tests
├── audit.test.js           # 4 audit trail integration tests
├── setup.js
└── helpers/db.helper.js    # Test DB teardown helper
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

## Tests

```bash
npm test
```

**Results:**

```
Test Suites: 3 passed, 3 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        ~10s
```

### Test Coverage by Suite

| Suite | Tests | What's covered |
|---|---|---|
| `auth.test.js` | 9 | Register, login, duplicate email rejection, profile retrieval, wrong password, token refresh rotation (old token invalidated), logout token invalidation |
| `task.test.js` | 19 | Admin/Manager can create tasks, Member cannot; list scoping per role; Member can update status on assigned tasks only; Member cannot reassign; Admin can delete, Member cannot; project filtering/sorting/search; comment pagination with ACL; Manager can delete task comments within own project |
| `audit.test.js` | 4 | Status change creates audit log entry; non-status update skips log; authorized user can read audit trail; unauthorized user gets `403` |

### Test Design Notes
- Each test suite runs `clearDatabase()` before every test to ensure full isolation.
- Tests use `supertest` to make real HTTP calls against the Express app.
- No mocking — tests hit a live PostgreSQL test database for end-to-end fidelity.
- Rate limiting is automatically bypassed in `NODE_ENV=test` to prevent flakiness.

---

## Bonus Features

All optional bonus items from the task requirements are implemented:

| Feature | Implementation |
|---|---|
| **Refresh Token Rotation** | Token hashed with SHA-256; old token deleted on every `/auth/refresh`; replay of old token returns `401` |
| **Swagger / OpenAPI 3.0** | Full spec in `src/config/swagger.js`; live interactive UI at `/api-docs` with JWT Bearer auth |
| **Docker** | `Dockerfile` (Node 20 Alpine) + `docker-compose.yml` with PostgreSQL healthcheck |
| **Soft Delete** | `deletedAt` + `deletedBy` on `Project`, `Task`, `TaskComment`; deleted records excluded from all queries |
| **Activity Logging for Comments** | `deletedBy` field records who deleted each comment; `completedAt` auto-set on `Task` when status reaches `DONE` |

### Production Hardening (beyond task requirements)
- **DB connection pool** tuned: `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`
- **Auth rate limiting**: 5 req / 15 min per IP on login and register endpoints
- **Startup token cleanup**: expired refresh tokens pruned from DB on every server start
- **Helmet** security headers enabled
- **GZIP compression** via `compression` middleware
- **Consistent error exposure**: production mode hides internal error details from clients
