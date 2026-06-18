# Task Assignment API with Audit Trail

A production-ready, security-hardened REST API for internal task tracking with role-based access control (RBAC), automatic token rotation, and audit logs.

## Tech Stack
- **Runtime & Framework**: Node.js, Express.js (ES Modules)
- **Database & ORM**: PostgreSQL, Prisma ORM
- **Authentication**: JWT Access tokens (short-lived) + Refresh tokens (rotated on use, SHA-256 hashed)
- **Validation**: Zod
- **Testing**: Jest + Supertest

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL running locally on port `5432`

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables by copying `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Run migrations to create the database tables:
   ```bash
   npm run migrate
   ```

4. Seed the database with default users, a project, and tasks:
   ```bash
   npm run seed
   ```

### Seeded Users
The seed script creates three default accounts with password `Password@123` (or details in `prisma/seed.js`):
- **Admin**: `admin@example.com` (Has full access across all projects and tasks)
- **Manager**: `manager@example.com` (Can CRUD projects they own, create/assign tasks, delete tasks in their projects)
- **Member**: `member@example.com` (Can view and update status of assigned tasks, comment on tasks)

---

## Running the Application

### Development mode (with nodemon reload)
```bash
npm run dev
```

### Running Tests
To run all automated integration tests:
```bash
npm test
```

---

## API Endpoints & Usage

Below are example `curl` commands to test the core features of the API.

### 1. Authentication

#### Register a user
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
> Note the `accessToken` and `refreshToken` in the response.

#### Get Profile (requires Authorization header)
```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

### 2. Projects (Admin and Manager only)

#### Create a project
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Beta Release Sprint",
    "description": "Project for managing tasks of Beta Release."
  }'
```

#### List Projects
```bash
curl http://localhost:3000/api/v1/projects?page=1&limit=10 \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

### 3. Tasks

#### Create a Task (Manager/Admin only)
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Set up environment variables",
    "description": "Configure dev/prod env variables.",
    "priority": "HIGH",
    "projectId": "<PROJECT_UUID>",
    "assigneeId": "<MEMBER_UUID>"
  }'
```

#### List Tasks (with filters, sorting, and pagination)
```bash
curl "http://localhost:3000/api/v1/tasks?priority=HIGH&status=IN_PROGRESS&sortBy=createdAt&sortOrder=desc" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Update Task Status (Member can only update status of assigned tasks)
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/<TASK_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE"
  }'
```

---

### 4. Audit Trail

#### View Task Audit Trail (accessible to anyone with task access)
```bash
curl http://localhost:3000/api/v1/tasks/<TASK_UUID>/audit \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

### 5. Comments

#### Create a comment
```bash
curl -X POST http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Work completed. Submitting for code review."
  }'
```

#### List comments
```bash
curl http://localhost:3000/api/v1/tasks/<TASK_UUID>/comments \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```
