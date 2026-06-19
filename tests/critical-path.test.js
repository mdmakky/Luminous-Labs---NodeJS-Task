import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { clearDatabase } from './helpers/db.helper.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Critical-Path Tests', () => {
  let manager, member, admin;
  let managerHeader, memberHeader, adminHeader;

  beforeEach(async () => {
    await clearDatabase();

    // Create users
    manager = await createTestUser({
      name: 'Project Manager',
      email: 'pm@test.com',
      password: 'Password@123',
      role: 'MANAGER',
    });
    member = await createTestUser({
      name: 'Team Member',
      email: 'member@test.com',
      password: 'Password@123',
      role: 'MEMBER',
    });
    admin = await createTestUser({
      name: 'System Admin',
      email: 'admin@test.com',
      password: 'Password@123',
      role: 'ADMIN',
    });

    // Headers
    managerHeader = getAuthHeader(manager);
    memberHeader = getAuthHeader(member);
    adminHeader = getAuthHeader(admin);
  });

  /**
   * Risk: Key workflow regression or failure in task lifecycle transitions.
   * Priority: Critical
   * Expected Outcome: Complete lifecycle flow runs smoothly with status, soft deletion, and timestamps recorded accurately.
   */
  it('should successfully execute the end-to-end task lifecycle (Project Creation -> Task Creation -> Assignment -> Member In Progress -> Member Done -> Soft Delete)', async () => {
    // 1. MANAGER creates a project
    const projectRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', managerHeader)
      .send({
        name: 'Critical Project',
        description: 'Testing core flow',
      });
    expect(projectRes.status).toBe(201);
    expect(projectRes.body.success).toBe(true);
    const projectId = projectRes.body.data.id;
    expect(projectId).toBeDefined();

    // 2. MANAGER creates a task inside the project and assigns it to MEMBER
    const taskRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', managerHeader)
      .send({
        title: 'Core Task',
        description: 'Verify flow',
        projectId,
        assigneeId: member.id,
        priority: 'HIGH',
      });
    expect(taskRes.status).toBe(201);
    expect(taskRes.body.success).toBe(true);
    const taskId = taskRes.body.data.id;
    expect(taskId).toBeDefined();

    // 3. MEMBER lists tasks (should see only the assigned task)
    const listRes = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', memberHeader);
    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(taskId);

    // 4. MEMBER starts working on task (IN_PROGRESS)
    const startRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', memberHeader)
      .send({ status: 'IN_PROGRESS' });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('IN_PROGRESS');
    expect(startRes.body.data.completedAt).toBeNull();

    // 5. MEMBER completes the task (DONE)
    const completeRes = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', memberHeader)
      .send({ status: 'DONE' });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('DONE');
    expect(completeRes.body.data.completedAt).not.toBeNull();
    const completedAtStr = completeRes.body.data.completedAt;

    // 6. MANAGER verifies status is DONE and completedAt exists
    const getRes = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', managerHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('DONE');
    expect(getRes.body.data.completedAt).toBe(completedAtStr);

    // 7. MANAGER soft-deletes the task
    const deleteRes = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Authorization', managerHeader);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 8. Verify the task is no longer returned in general listings for manager
    const pmListRes = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', managerHeader);
    expect(pmListRes.status).toBe(200);
    const visibleTasks = pmListRes.body.data.filter(t => t.id === taskId);
    expect(visibleTasks.length).toBe(0);

    // 9. Verify the task still exists in the DB with soft-deleted audit fields
    const dbTask = await prisma.task.findUnique({
      where: { id: taskId },
    });
    expect(dbTask).not.toBeNull();
    expect(dbTask.deletedAt).not.toBeNull();
    expect(dbTask.deletedBy).toBe(manager.id);
  });
});
