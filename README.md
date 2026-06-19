# Task Assignment API with Audit Trail

A production-ready, security-hardened REST API for internal task tracking with **role-based access control (RBAC)**, **automatic refresh token rotation**, **status-change audit logs**, and **interactive Swagger documentation**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v18+ (ES Modules) |
| Framework | Express.js v5 |
| Database | PostgreSQL 15 |
| ORM | Prisma 7 (with `@prisma/adapter-pg`) |
| Authentication | JWT (`jsonwebtoken`) + Refresh Token Rotation |
| Validation | Zod |
| Password Hashing | bcrypt |
| Testing | Jest + Supertest |
| Documentation | Swagger UI (`swagger-ui-express`) |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
├── prisma/
│   ├── schema.prisma       # DB models & enums
│   ├── migrations/         # Auto-generated SQL migrations
│   └── seed.js             # Dev seed script
├── src/
│   ├── config/             # env loader, prisma client, swagger spec
│   ├── controllers/        # Request handlers (thin layer)
│   ├── middleware/         # auth, rbac, validation, error handler
│   ├── repositories/       # Prisma data access (one per model)
│   ├── routes/             # Express routers mounted under /api/v1
│   ├── services/           # Business logic + RBAC enforcement
│   ├── utils/              # Error classes, response helpers
│   ├── validations/        # Zod schemas (body, params, query)
│   ├── app.js              # Express app setup
│   └── server.js           # Server entry point
├── tests/
│   ├── helpers/            # DB cleanup + auth helpers
│   ├── auth.test.js        # Auth integration tests (9 cases)
│   ├── task.test.js        # Task CRUD + RBAC tests (11 cases)
│   ├── audit.test.js       # Audit trail tests (4 cases)
│   └── setup.js            # Global Jest teardown
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── ARCHITECTURE.md
└── README.md
```

---

## Getting Started (Local)

### Prerequisites
- Node.js v18+
- PostgreSQL running locally on port `5432`

### Installation

```bash
# 1. Clone repo and install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env and set your DATABASE_URL, JWT_SECRET, etc.

# 3. Create DB tables (run migration)
npm run migrate

# 4. Seed default users, project, and tasks
npm run seed

# 5. Start development server (auto-reload)
npm run dev
```

The server starts at: **http://localhost:3000**

---

## Getting Started (Docker)

If you prefer containers — no local PostgreSQL needed:

```bash
# Start PostgreSQL + app containers
docker-compose up --build

# In a separate terminal, run migrations inside the container
docker exec task_api_app npx prisma migrate deploy

# Run seed
docker exec task_api_app node prisma/seed.js
```

---

## Environment Variables (`.env.example`)

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

## Seeded Test Users

After running `npm run seed`, these accounts are available:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin@123` |
| Manager | `manager@example.com` | `Manager@123` |
| Member | `member@example.com` | `Member@123` |

---

## API Documentation (Swagger UI)

Interactive Swagger documentation is served at:

👉 **http://localhost:3000/api-docs**

Use the **Authorize** button in Swagger to enter your JWT access token.

---

## Role-Based Access Control (RBAC)

| Action | Admin | Manager | Member |
|---|---|---|---|
| Projects CRUD | ✅ All | ✅ Own projects only | ❌ |
| Tasks Create/Delete | ✅ All | ✅ Own projects only | ❌ |
| Tasks Update | ✅ All | ✅ Own projects only | ✅ Assigned tasks (status only) |
| Tasks List/View | ✅ All | ✅ Own projects | ✅ Assigned tasks only |
| Audit Trail View | ✅ All | ✅ Own projects | ✅ Assigned tasks only |
| Comments CRUD | ✅ All | ✅ Own projects | ✅ Assignee / own comments |

---

## API Reference

### Authentication

#### Register
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Developer",
    "email": "dev@example.com",
    "password": "Password@123",
    "role": "MEMBER"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "password": "Manager@123"
  }'
```
> Copy the `accessToken` and `refreshToken` from the response.

#### Get Profile
```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Refresh Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<REFRESH_TOKEN>" }'
```

#### Logout
```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<REFRESH_TOKEN>" }'
```

---

### Projects

#### Create Project
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Beta Sprint", "description": "Beta release project." }'
```

#### List Projects (paginated)
```bash
curl "http://localhost:3000/api/v1/projects?page=1&limit=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Get Single Project
```bash
curl http://localhost:3000/api/v1/projects/<PROJECT_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Update Project
```bash
curl -X PATCH http://localhost:3000/api/v1/projects/<PROJECT_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Updated Name" }'
```

#### Delete Project (soft delete)
```bash
curl -X DELETE http://localhost:3000/api/v1/projects/<PROJECT_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

### Tasks

#### Create Task
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Setup CI/CD pipeline",
    "description": "Configure GitHub Actions for automated deployment.",
    "priority": "HIGH",
    "projectId": "<PROJECT_UUID>",
    "assigneeId": "<MEMBER_UUID>",
    "dueDate": "2025-12-31T00:00:00Z"
  }'
```

#### List Tasks (filtering + sorting + pagination)
```bash
# Filter by status and priority, sort by dueDate descending
curl "http://localhost:3000/api/v1/tasks?status=IN_PROGRESS&priority=HIGH&sortBy=dueDate&sortOrder=desc&page=1&limit=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Supported filter params: `status`, `priority`, `assigneeId`, `projectId`
Supported sort fields: `createdAt`, `dueDate`, `priority`, `status`, `title`

#### Get Single Task
```bash
curl http://localhost:3000/api/v1/tasks/<TASK_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Update Task Status (Member can only update assigned tasks)
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/<TASK_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "DONE" }'
```

Valid statuses: `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE` / `CANCELLED`

#### Delete Task (soft delete)
```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/<TASK_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

### Audit Trail

Every time a task's **status changes**, a record is automatically added to the audit log.

#### View Task Audit History
```bash
curl http://localhost:3000/api/v1/tasks/<TASK_UUID>/audit \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Example response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "taskId": "...",
      "oldStatus": "TODO",
      "newStatus": "IN_PROGRESS",
      "timestamp": "2025-06-18T14:30:00.000Z",
      "user": { "id": "...", "name": "Team Member", "email": "member@example.com" }
    }
  ],
  "error": null
}
```

---

### Comments

#### List Comments on a Task
```bash
curl http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Add a Comment
```bash
curl -X POST http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "Work completed. Submitting for code review." }'
```

#### Edit a Comment (author only)
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments/<COMMENT_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "Updated comment text." }'
```

#### Delete a Comment (author or admin)
```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments/<COMMENT_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## Running Tests

```bash
npm test
```

**Test Results:**

```
PASS  tests/auth.test.js
PASS  tests/task.test.js
PASS  tests/audit.test.js

Test Suites: 3 passed, 3 total
Tests:       24 passed, 24 total
Snapshots:   0 total
Time:        ~7s
```

### What is tested:
- **Auth** (9 tests): Register, login, duplicate email conflict, profile fetch, wrong password, refresh token rotation, logout invalidating token
- **Task RBAC** (11 tests): Admin creates tasks on any project, Manager creates tasks on own project, Manager blocked from other's project, Member blocked from creating, Admin sees all tasks, Member sees only assigned, Member updates assigned task status, Member blocked from reassigning, Member blocked from other's task, Member blocked from deleting, Manager can delete own project task
- **Audit Trail** (4 tests): Status change creates log, non-status update skips log, authorized user gets audit, unauthorized user gets 403

---

## Response Format

All API responses use a consistent JSON envelope:

**Success:**
```json
{ "success": true, "data": { ... }, "error": null }
```

**Error:**
```json
{ "success": false, "data": null, "error": { "message": "...", "errors": [...] } }
```

**Validation Error (400):**
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Validation failed",
    "errors": [
      { "field": "email", "message": "Invalid email address" },
      { "field": "password", "message": "Password must be at least 6 characters" }
    ]
  }
}
```

---

## Bonus Features Implemented

| Bonus | Status |
|---|---|
| Refresh Token support (with rotation) | ✅ |
| Swagger / OpenAPI documentation | ✅ at `/api-docs` |
| Docker + docker-compose | ✅ |
| Soft delete (projects, tasks, comments) | ✅ |
| Activity logging (status change audit) | ✅ |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details on:
- Layered architecture diagram
- RBAC enforcement strategy
- JWT + Refresh Token Rotation design
- Database schema relationships (ER diagram)
