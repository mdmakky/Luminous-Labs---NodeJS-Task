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

The app follows a clean **layered architecture** — each layer has one job:

```
Request
  └─► Routes         (URL mapping, auth/validation middleware)
        └─► Controllers  (parse request, call service, send response)
              └─► Services     (business logic, RBAC ownership checks)
                    └─► Repositories  (Prisma DB queries)
                          └─► PostgreSQL
```

**Key design decisions:**
- **Centralized error handler** — one middleware catches all errors, returns `{ success, data, error }` envelope
- **Async handler wrapper** — eliminates try/catch boilerplate in every controller
- **Zod validation middleware** — validates `body`, `params`, and `query` before hitting the controller
- **Refresh Token Rotation** — each refresh invalidates the old token (SHA-256 hashed in DB) and issues a new pair

**Database models:** `User` · `RefreshToken` · `Project` · `Task` · `TaskComment` · `AuditLog`  
**Soft delete** on: `Project`, `Task`, `TaskComment` (using `deletedAt` timestamp field)

---

## Role-Based Access Control

| Action | Admin | Manager | Member |
|---|---|---|---|
| Projects: create / update / delete | ✅ Any | ✅ Own only | ❌ |
| Tasks: create / delete | ✅ Any | ✅ Own projects only | ❌ |
| Tasks: update | ✅ Any | ✅ Own projects only | ✅ Assigned tasks, **status only** |
| Tasks: list / view | ✅ All | ✅ Own projects | ✅ Assigned only |
| Audit trail: view | ✅ All | ✅ Own projects | ✅ Assigned only |
| Comments: create / edit / delete | ✅ Any | ✅ Own projects | ✅ Assignee / own comments |

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
  -d '{ "name": "John", "email": "john@example.com", "password": "Pass@123", "role": "MEMBER" }'

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
      "timestamp": "2025-06-18T14:30:00.000Z",
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
Tests:       24 passed, 24 total

auth.test.js  (9 tests)  — register, login, duplicate email, profile, wrong password,
                           token refresh rotation, logout invalidation
task.test.js  (11 tests) — admin/manager/member create permissions, list scoping,
                           member status update, reassign block, delete RBAC
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
