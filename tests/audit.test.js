import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { clearDatabase } from './helpers/db.helper.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Audit Trail API', () => {
  let admin, manager, member1, member2;
  let adminHeader, managerHeader, member1Header, member2Header;
  let project, task;

  beforeEach(async () => {
    await clearDatabase();

    // Create users
    admin = await createTestUser({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Password@123',
      role: 'ADMIN',
    });
    manager = await createTestUser({
      name: 'Manager User',
      email: 'manager@test.com',
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

    // Headers
    adminHeader = getAuthHeader(admin);
    managerHeader = getAuthHeader(manager);
    member1Header = getAuthHeader(member1);
    member2Header = getAuthHeader(member2);

    // Create project
    project = await prisma.project.create({
      data: { name: 'Audit Project', ownerId: manager.id },
    });

    // Create task
    task = await prisma.task.create({
      data: {
        title: 'Audit Task',
        status: 'TODO',
        projectId: project.id,
        creatorId: manager.id,
        assigneeId: member1.id,
      },
    });
  });

  it('should create an audit log when task status changes', async () => {
    // Verify starting state has no logs
    const initialLogs = await prisma.auditLog.findMany({ where: { taskId: task.id } });
    expect(initialLogs.length).toBe(0);

    // Update status to IN_PROGRESS as member1
    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set('Authorization', member1Header)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);

    // Verify audit log exists
    const logs = await prisma.auditLog.findMany({
      where: { taskId: task.id },
      include: { user: true },
    });

    expect(logs.length).toBe(1);
    expect(logs[0].oldStatus).toBe('TODO');
    expect(logs[0].newStatus).toBe('IN_PROGRESS');
    expect(logs[0].changedBy).toBe(member1.id);
  });

  it('should NOT create an audit log when other task fields change without status change', async () => {
    // Update description only
    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set('Authorization', managerHeader)
      .send({ description: 'Updated description' });

    expect(res.status).toBe(200);

    // Verify no audit log is created
    const logs = await prisma.auditLog.findMany({ where: { taskId: task.id } });
    expect(logs.length).toBe(0);
  });

  it('should allow user with task access to retrieve audit logs', async () => {
    // Add status changes
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set('Authorization', member1Header)
      .send({ status: 'IN_PROGRESS' });

    // Retrieve audit logs as manager
    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/audit`)
      .set('Authorization', managerHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].oldStatus).toBe('TODO');
    expect(res.body.data[0].newStatus).toBe('IN_PROGRESS');
  });

  it('should forbid user without task access from retrieving audit logs', async () => {
    // Member2 has no access to task because it is not assigned to them and they are not admin/manager
    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/audit`)
      .set('Authorization', member2Header);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should support pagination query parameters for audit logs', async () => {
    // Add multiple status changes
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set('Authorization', member1Header)
      .send({ status: 'IN_PROGRESS' });

    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set('Authorization', member1Header)
      .send({ status: 'IN_REVIEW' });

    // Retrieve audit logs with page=1, limit=1
    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/audit`)
      .set('Authorization', managerHeader)
      .query({ page: 1, limit: 1, sortBy: 'createdAt', sortOrder: 'asc' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].oldStatus).toBe('TODO');
    expect(res.body.data[0].newStatus).toBe('IN_PROGRESS');
    expect(res.body.pagination.totalCount).toBe(2);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.totalPages).toBe(2);
  });
});
