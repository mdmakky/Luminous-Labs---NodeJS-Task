import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { clearDatabase } from './helpers/db.helper.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Tasks API & RBAC', () => {
  let admin, manager1, manager2, member1, member2;
  let adminHeader, manager1Header, manager2Header, member1Header, member2Header;
  let project1, project2;

  beforeEach(async () => {
    await clearDatabase();

    // Create test users
    admin = await createTestUser({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Password@123',
      role: 'ADMIN',
    });
    manager1 = await createTestUser({
      name: 'Manager One',
      email: 'manager1@test.com',
      password: 'Password@123',
      role: 'MANAGER',
    });
    manager2 = await createTestUser({
      name: 'Manager Two',
      email: 'manager2@test.com',
      password: 'Password@123',
      role: 'MANAGER',
    });
    member1 = await createTestUser({
      name: 'Member One',
      email: 'member1@test.com',
      password: 'Password@123',
      role: 'MEMBER',
    });
    member2 = await createTestUser({
      name: 'Member Two',
      email: 'member2@test.com',
      password: 'Password@123',
      role: 'MEMBER',
    });

    // Generate auth headers
    adminHeader = getAuthHeader(admin);
    manager1Header = getAuthHeader(manager1);
    manager2Header = getAuthHeader(manager2);
    member1Header = getAuthHeader(member1);
    member2Header = getAuthHeader(member2);

    // Create projects
    project1 = await prisma.project.create({
      data: { name: 'Project One', ownerId: manager1.id },
    });
    project2 = await prisma.project.create({
      data: { name: 'Project Two', ownerId: manager2.id },
    });
  });

  describe('POST /api/v1/tasks (Create Task)', () => {
    it('should allow ADMIN to create task on any project', async () => {
      const res = await request(app).post('/api/v1/tasks').set('Authorization', adminHeader).send({
        title: 'Admin Task',
        projectId: project1.id,
        assigneeId: member1.id,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Admin Task');
    });

    it('should allow MANAGER to create task on own project', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', manager1Header)
        .send({
          title: 'Manager Task',
          projectId: project1.id,
          assigneeId: member1.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.projectId).toBe(project1.id);
    });

    it('should block MANAGER from creating task on other manager project', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', manager1Header)
        .send({
          title: 'Intruder Task',
          projectId: project2.id,
          assigneeId: member1.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('own projects');
    });

    it('should block MEMBER from creating tasks', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', member1Header)
        .send({
          title: 'Member Task',
          projectId: project1.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not allowed to create tasks');
    });
  });

  describe('GET /api/v1/tasks (List Tasks)', () => {
    let task1, task2;

    beforeEach(async () => {
      task1 = await prisma.task.create({
        data: {
          title: 'Task 1',
          projectId: project1.id,
          assigneeId: member1.id,
          creatorId: manager1.id,
        },
      });
      task2 = await prisma.task.create({
        data: {
          title: 'Task 2',
          projectId: project2.id,
          assigneeId: member2.id,
          creatorId: manager2.id,
        },
      });
    });

    it('should allow ADMIN to list all tasks', async () => {
      const res = await request(app).get('/api/v1/tasks').set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should filter tasks for MEMBER to only their assigned tasks', async () => {
      const res = await request(app).get('/api/v1/tasks').set('Authorization', member1Header);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(task1.id);
    });
  });

  describe('PATCH /api/v1/tasks/:id (Update Task)', () => {
    let task1, task2;

    beforeEach(async () => {
      task1 = await prisma.task.create({
        data: {
          title: 'Task 1',
          projectId: project1.id,
          assigneeId: member1.id,
          creatorId: manager1.id,
          status: 'TODO',
        },
      });
      task2 = await prisma.task.create({
        data: {
          title: 'Task 2',
          projectId: project2.id,
          assigneeId: member2.id,
          creatorId: manager2.id,
          status: 'TODO',
        },
      });
    });

    it('should allow MEMBER to update status of their assigned task', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${task1.id}`)
        .set('Authorization', member1Header)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('should block MEMBER from reassigning their assigned task', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${task1.id}`)
        .set('Authorization', member1Header)
        .send({ assigneeId: member2.id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not allowed to reassign tasks');
    });

    it('should block MEMBER from updating tasks not assigned to them', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${task2.id}`)
        .set('Authorization', member1Header)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('only update tasks assigned to you');
    });
  });

  describe('DELETE /api/v1/tasks/:id (Delete Task)', () => {
    let task;

    beforeEach(async () => {
      task = await prisma.task.create({
        data: {
          title: 'To Delete',
          projectId: project1.id,
          assigneeId: member1.id,
          creatorId: manager1.id,
        },
      });
    });

    it('should block MEMBER from deleting task', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${task.id}`)
        .set('Authorization', member1Header);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow MANAGER of the project to delete task', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${task.id}`)
        .set('Authorization', manager1Header);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it was soft deleted
      const check = await prisma.task.findUnique({ where: { id: task.id } });
      expect(check.deletedAt).not.toBeNull();
    });
  });
});
