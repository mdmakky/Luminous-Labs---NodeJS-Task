import request from 'supertest';
import app from '../src/app.js';
import { jest } from '@jest/globals';
import prisma from '../src/config/prisma.js';
import { clearDatabase } from './helpers/db.helper.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Database Consistency & Integrity Tests', () => {
  let admin, adminHeader;
  let project, member;

  beforeEach(async () => {
    await clearDatabase();

    admin = await createTestUser({
      name: 'DB Admin',
      email: 'db_admin@test.com',
      password: 'Password@123',
      role: 'ADMIN',
    });
    adminHeader = getAuthHeader(admin);

    member = await createTestUser({
      name: 'DB Member',
      email: 'db_member@test.com',
      password: 'Password@123',
      role: 'MEMBER',
    });

    project = await prisma.project.create({
      data: { name: 'Integrity Project', ownerId: admin.id },
    });
  });

  /**
   * Risk: Storing orphaned comments or audit logs in DB when tasks are hard-deleted.
   * Priority: High
   * Expected Outcome: Related records are automatically deleted by CASCADE constraints.
   */
  describe('Cascade Delete Constraints', () => {
    it('should automatically cascade delete comments and audit logs when task is hard deleted', async () => {
      // 1. Create a task
      const task = await prisma.task.create({
        data: { title: 'Cascade Task', projectId: project.id, creatorId: admin.id },
      });

      // 2. Create comment
      await prisma.taskComment.create({
        data: { content: 'Cascade Comment', authorId: admin.id, taskId: task.id },
      });

      // 3. Trigger audit log by changing status
      await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set('Authorization', adminHeader)
        .send({ status: 'IN_PROGRESS' });

      // Check DB directly: they should exist
      const initialComments = await prisma.taskComment.findMany({ where: { taskId: task.id } });
      const initialLogs = await prisma.auditLog.findMany({ where: { taskId: task.id } });
      expect(initialComments.length).toBe(1);
      expect(initialLogs.length).toBe(1);

      // 4. Hard delete the task
      await prisma.task.delete({ where: { id: task.id } });

      // Verify cascading
      const finalComments = await prisma.taskComment.findMany({ where: { taskId: task.id } });
      const finalLogs = await prisma.auditLog.findMany({ where: { taskId: task.id } });
      expect(finalComments.length).toBe(0);
      expect(finalLogs.length).toBe(0);
    });
  });

  /**
   * Risk: Bypassing relationship validation leads to orphaned database records (e.g. task without a valid project).
   * Priority: High
   * Expected Outcome: Blocked by foreign key constraints or relation validations (throws NotFound / DB constraint error).
   */
  describe('Foreign Key Relation Constraints', () => {
    it('should block task creation if the referenced projectId does not exist in DB', async () => {
      const nonExistentProjectId = 'd9e2b17f-0b44-42b7-84ad-000000000000';

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', adminHeader)
        .send({
          title: 'Orphaned Task',
          projectId: nonExistentProjectId,
        });

      // Returns 404 (Project not found / NotFoundError) or a database relation error
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  /**
   * Risk: Stale data leakage of logically deleted projects or tasks back to standard listings.
   * Priority: High
   * Expected Outcome: Excluded from query listings.
   */
  describe('Soft-Delete Visibility Isolation', () => {
    it('should exclude soft-deleted projects from findAll and findById queries', async () => {
      const projectToDelete = await prisma.project.create({
        data: { name: 'To Soft Delete', ownerId: admin.id },
      });

      // Soft delete it
      await request(app)
        .delete(`/api/v1/projects/${projectToDelete.id}`)
        .set('Authorization', adminHeader);

      // List projects
      const listRes = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', adminHeader);
      
      const found = listRes.body.data.find(p => p.id === projectToDelete.id);
      expect(found).toBeUndefined();

      // Retrieve by ID directly
      const getRes = await request(app)
        .get(`/api/v1/projects/${projectToDelete.id}`)
        .set('Authorization', adminHeader);
      
      expect(getRes.status).toBe(404);
    });
  });

  /**
   * Risk: Misaligned completedAt timestamps pollute SLA metrics and dashboards.
   * Priority: High
   * Expected Outcome: completedAt timestamp is updated or cleared in lockstep with status changes.
   */
  describe('completedAt Timestamp Synchronization Checks', () => {
    it('should sync completedAt automatically on creation and transition', async () => {
      // 1. Create as TODO - completedAt should be null
      const task = await prisma.task.create({
        data: { title: 'Sync Task', projectId: project.id, creatorId: admin.id, status: 'TODO' },
      });
      expect(task.completedAt).toBeNull();

      // 2. Update to DONE
      const doneRes = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set('Authorization', adminHeader)
        .send({ status: 'DONE' });
      
      expect(doneRes.body.data.status).toBe('DONE');
      expect(doneRes.body.data.completedAt).not.toBeNull();

      // 3. Transition back to IN_REVIEW - completedAt should clear
      const reviewRes = await request(app)
        .patch(`/api/v1/tasks/${task.id}`)
        .set('Authorization', adminHeader)
        .send({ status: 'IN_REVIEW' });
      
      expect(reviewRes.body.data.status).toBe('IN_REVIEW');
      expect(reviewRes.body.data.completedAt).toBeNull();
    });
  });

  /**
   * Risk: API errors expose detailed database stack traces or format inconsistently.
   * Priority: High
   * Expected Outcome: Standard format: { success: false, error: { message } }.
   */
  describe('Error Response Format Uniformity', () => {
    it('should return standardized JSON response for non-existent resources', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/d9e2b17f-0b44-42b7-84ad-999999999999')
        .set('Authorization', adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBeDefined();
    });
  });

  describe('Repository & Centralized Error Handler Branch Coverage', () => {
    it('should cover task repository create as DONE and getStatus for non-existent task', async () => {
      const taskRepo = await import('../src/repositories/task.repository.js');

      // Create task directly as DONE
      const doneTask = await taskRepo.create({
        title: 'Instant Done Task',
        status: 'DONE',
        projectId: project.id,
        creatorId: admin.id,
      });
      expect(doneTask.completedAt).not.toBeNull();

      // getStatus for non-existent task
      const status = await taskRepo.getStatus('d9e2b17f-0b44-42b7-84ad-000000000000');
      expect(status).toBeNull();
    });

    it('should cover task search and project search with all optional branches', async () => {
      const taskRepo = await import('../src/repositories/task.repository.js');
      const projectRepo = await import('../src/repositories/project.repository.js');

      // Run task findAll with all combinations
      await taskRepo.findAll({
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeId: member.id,
        projectId: project.id,
        projectOwnerId: admin.id,
      });

      // Run project findAll with options
      await projectRepo.findAll({
        ownerId: admin.id,
        memberId: member.id,
        name: 'Integrity',
      });
    });

    it('should format unexpected errors correctly depending on NODE_ENV', async () => {
      const spy = jest.spyOn(prisma.project, 'findMany').mockRejectedValue(new Error('Simulated Database Crash'));

      const originalEnv = process.env.NODE_ENV;

      // 1. Test in 'development' mode (should call console.error)
      process.env.NODE_ENV = 'development';
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const devRes = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', adminHeader);
      
      expect(devRes.status).toBe(500);
      expect(devRes.body.error.message).toBe('Simulated Database Crash');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();

      // 2. Test in 'production' mode (should map message to 'Internal server error')
      process.env.NODE_ENV = 'production';
      const prodRes = await request(app)
        .get('/api/v1/projects')
        .set('Authorization', adminHeader);

      expect(prodRes.status).toBe(500);
      expect(prodRes.body.error.message).toBe('Internal server error');

      // Restore environment and mocks
      process.env.NODE_ENV = originalEnv;
      spy.mockRestore();
    });
  });
});
