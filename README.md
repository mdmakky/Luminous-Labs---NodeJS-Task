# Task Assignment API with Audit Trail

A production-ready REST API for internal task tracking with **JWT authentication**, **role-based access control**, **status-change audit logs**, and **Swagger documentation**.

**Stack:** Node.js · Express.js · PostgreSQL · Prisma ORM · JWT · Zod · Jest

---

## Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env

# 3. Run database migrations
npm run migrate

# 4. Seed default users and sample data
npm run seed

# 5. Start development server
npm run dev
```

Server runs at **http://localhost:3000**  
API docs (Swagger) at **http://localhost:3000/api-docs**

### Environment Variables (`.env.example`)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/task_api?schema=public
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_SALT_ROUNDS=10
```

### Run with Docker (no local PostgreSQL needed)
```bash
docker-compose up --build
docker exec task_api_app npx prisma migrate deploy
docker exec task_api_app node prisma/seed.js
```

---

## Seeded Test Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin@123` |
| Manager | `manager@example.com` | `Manager@123` |
| Member | `member@example.com` | `Member@123` |

---

## Architecture

This section describes the design patterns, layer roles, database relationships, and security controls used in the Task Assignment API.

### 1. Architectural Overview

The application follows a clean, traditional **Layered Architecture**. By segregating responsibilities into distinct layers, we ensure that business rules, request routing, validation, and data persistence remain decoupled and testable.

```mermaid
graph TD
    Client -->|HTTP Request| Routes
    Routes -->|Request Payload| Validation[Zod Validation]
    Validation -->|Parsed Object| Controller
    Controller -->|AppError Handling| Middleware[Error Handler Middleware]
    Controller --> Services
    Services -->|Business logic / RBAC| Repositories
    Repositories -->|Queries| Prisma[Prisma ORM]
    Prisma -->|Query Execution| PostgreSQL
```

#### Layer Roles
1. **Routes (`src/routes/*`)**: Defines the endpoint URIs and chains the appropriate authentication, validation, and authorization middlewares before delegating to the controller.
2. **Controllers (`src/controllers/*`)**: Reads route parameters, query strings, and payloads. Delegates execution to the services and constructs standard API envelopes for response.
3. **Services (`src/services/*`)**: House all core business logic and state transitions. Enforces security checks (e.g. user authorization boundaries).
4. **Repositories (`src/repositories/*`)**: Contains data-access logic and interacts directly with PostgreSQL via the Prisma Client.
5. **Utils & Configs (`src/utils/*` & `src/config/*`)**: Houses centralized configuration loaders, error classes, and JSON response helpers.

---

### 2. Core Patterns & Practices

#### Centralized Error Handling
An Express middleware (`src/middleware/error-handler.js`) intercepts all errors thrown in the controller and service layers. Operational errors (e.g., validation failures, unauthorized access) receive correct semantic HTTP status codes.

#### Response Standardization
All JSON responses conform to a predictable envelope:
- **Success**: `{ success: true, data: [...], error: null }`
- **Error**: `{ success: false, data: null, error: { message: "Error msg", errors: [...] } }`

---

### 3. Security Hardening & RBAC

#### JWT Authentication with Refresh Token Rotation (RTR)
- **Access Tokens**: Short-lived (15 minutes), containing the user ID, email, and role.
- **Refresh Tokens**: Long-lived (7 days), stored securely in PostgreSQL as a SHA-256 hash.
- **Rotation**: On every token refresh, the old refresh token is immediately deleted/invalidated, and a new refresh token is issued to the client. This mitigates the risk of replay attacks.

#### Role-Based Access Control (RBAC) Matrix
Permissions are enforced at the route level via middleware (`rbac.middleware.js`) and further validated inside services when data ownership is required (e.g., project owner checks).

| Action | Admin | Manager | Member |
|---|---|---|---|
| Projects CRUD | ✅ | Owner only | ❌ |
| Tasks Create/Delete | ✅ | Project Owner only | ❌ |
| Tasks Update | ✅ | Project Owner only | Assignee only (Status update only) |
| Task List | ✅ | All tasks | Assigned tasks only |
| Audit Trail View | ✅ | Project Owner only | Assignee only |
| Comments CRUD | ✅ | Project Owner only | Assignee/Author only |

---

### 4. Database Schema Relationships

```mermaid
erDiagram
    User ||--o{ RefreshToken : issues
    User ||--o{ Project : owns
    User ||--o{ Task : creates
    User ||--o{ Task : assigned
    User ||--o{ TaskComment : writes
    User ||--o{ AuditLog : performs
    Project ||--o{ Task : contains
    Task ||--o{ TaskComment : has
    Task ||--o{ AuditLog : generates
```
- **Soft Delete**: Both `Project`, `Task`, and `TaskComment` models feature a `deletedAt` timestamp. Records where `deletedAt != null` are automatically excluded from lists and lookups.
- **Audit Trails**: The `AuditLog` table logs every task status transition (`oldStatus` -> `newStatus`), capturing who changed it and when.

---

## API Documentation (Swagger)

![Swagger UI](./swagger-ui.png)

Full interactive docs at **http://localhost:3000/api-docs** — click **Authorize** and paste your JWT access token.

---

## API Reference

All responses use the envelope: `{ "success": true/false, "data": ..., "error": ... }`

### Auth

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "name": "John", "email": "john@example.com", "password": "Pass@123" }'
# Note: all registered users default to MEMBER role (role cannot be self-assigned)

# Login → copy accessToken + refreshToken from response
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "manager@example.com", "password": "Manager@123" }'

# Get profile
curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer <ACCESS_TOKEN>"

# Refresh tokens (old token is invalidated)
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<REFRESH_TOKEN>" }'

# Logout
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<REFRESH_TOKEN>" }'
```

### Projects

```bash
# Create (Admin/Manager)
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "name": "Sprint Alpha", "description": "Q3 release sprint" }'

# List (paginated)
curl "http://localhost:3000/api/v1/projects?page=1&limit=10" -H "Authorization: Bearer <TOKEN>"

# Get / Update / Delete
curl http://localhost:3000/api/v1/projects/<ID> -H "Authorization: Bearer <TOKEN>"
curl -X PATCH http://localhost:3000/api/v1/projects/<ID> -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{ "name": "Updated Name" }'
curl -X DELETE http://localhost:3000/api/v1/projects/<ID> -H "Authorization: Bearer <TOKEN>"
```

### Tasks

```bash
# Create (Admin/Manager only)
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{
    "title": "Setup CI pipeline",
    "priority": "HIGH",
    "projectId": "<PROJECT_UUID>",
    "assigneeId": "<MEMBER_UUID>",
    "dueDate": "2025-12-31T00:00:00Z"
  }'

# List with filters + sorting + pagination
curl "http://localhost:3000/api/v1/tasks?status=IN_PROGRESS&priority=HIGH&sortBy=dueDate&sortOrder=desc&page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>"

# Update status (Members can only update status on assigned tasks)
curl -X PATCH http://localhost:3000/api/v1/tasks/<ID> \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "status": "DONE" }'

# Valid statuses: TODO · IN_PROGRESS · IN_REVIEW · DONE · CANCELLED
# Valid priorities: LOW · MEDIUM · HIGH · URGENT

# Delete (soft delete — Admin/Manager only)
curl -X DELETE http://localhost:3000/api/v1/tasks/<ID> -H "Authorization: Bearer <TOKEN>"
```

### Audit Trail

Every task status change is **automatically logged**. No manual trigger needed.

```bash
# View audit history for a task
curl http://localhost:3000/api/v1/tasks/<TASK_UUID>/audit -H "Authorization: Bearer <TOKEN>"
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "oldStatus": "TODO",
      "newStatus": "IN_PROGRESS",
      "createdAt": "2025-06-18T14:30:00.000Z",
      "user": { "name": "Team Member", "email": "member@example.com" }
    }
  ]
}
```

### Comments

```bash
# List / Add
curl http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments -H "Authorization: Bearer <TOKEN>"
curl -X POST http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "content": "Completed and ready for review." }'

# Edit (author only) / Delete (author or admin)
curl -X PATCH http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments/<COMMENT_UUID> \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{ "content": "Updated text." }'
curl -X DELETE http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments/<COMMENT_UUID> \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Tests

```bash
npm test
```

```
Test Suites: 3 passed, 3 total
Tests:       32 passed, 32 total

auth.test.js  (9 tests)  — register, login, duplicate email, profile, wrong password,
                           token refresh rotation, logout invalidation
task.test.js  (19 tests) — admin/manager/member create permissions, list scoping,
                           member status update, reassign block, delete RBAC,
                           project filtering/sorting/search, comment pagination,
                           manager comment delete ACL
audit.test.js (4 tests)  — status change creates log, non-status update skips log,
                           authorized access, unauthorized blocked (403)
```

---

## Bonus Features

| Feature | Details |
|---|---|
| Refresh Token Rotation | Old token deleted on each refresh; stored as SHA-256 hash |
| Swagger / OpenAPI | Live at `/api-docs` with JWT auth support |
| Docker | `Dockerfile` + `docker-compose.yml` included |
| Soft Delete | `deletedAt` field on Project, Task, Comment |
