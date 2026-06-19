import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { clearDatabase } from './helpers/db.helper.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Authorization & Multi-Tenancy Boundary Tests', () => {
  let managerA, managerB, memberA, memberB, admin;
  let managerAHeader, managerBHeader, memberAHeader, memberBHeader, adminHeader;
  let projectA, projectB;
  let taskA, taskB;

  beforeEach(async () => {
    await clearDatabase();

    // Create users
    managerA = await createTestUser({
      name: 'Manager A',
      email: 'man_a@test.com',
      password: 'Password@123',
      role: 'MANAGER',
    });
    managerB = await createTestUser({
      name: 'Manager B',
      email: 'man_b@test.com',
      password: 'Password@123',
      role: 'MANAGER',
    });
    memberA = await createTestUser({
      name: 'Member A',
      email: 'mem_a@test.com',
      password: 'Password@123',
      role: 'MEMBER',
    });
    memberB = await createTestUser({
      name: 'Member B',
      email: 'mem_b@test.com',
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
    managerAHeader = getAuthHeader(managerA);
    managerBHeader = getAuthHeader(managerB);
    memberAHeader = getAuthHeader(memberA);
    memberBHeader = getAuthHeader(memberB);
    adminHeader = getAuthHeader(admin);

    // Create projects
    projectA = await prisma.project.create({
      data: { name: 'Project A', ownerId: managerA.id },
    });
    projectB = await prisma.project.create({
      data: { name: 'Project B', ownerId: managerB.id },
    });

    // Create tasks
    taskA = await prisma.task.create({
      data: {
        title: 'Task A',
        projectId: projectA.id,
        creatorId: managerA.id,
        assigneeId: memberA.id,
      },
    });
    taskB = await prisma.task.create({
      data: {
        title: 'Task B',
        projectId: projectB.id,
        creatorId: managerB.id,
        assigneeId: memberB.id,
      },
    });
  });

  /**
   * Risk: IDOR - Manager A reads/updates/deletes projects or tasks belonging to Manager B.
   * Priority: Critical
   * Expected Outcome: Returns 403 Forbidden.
   */
  describe('Insecure Direct Object Reference (IDOR) - Manager Boundary', () => {
    it('should block Manager A from retrieving details of Project B', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', managerAHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('access to this project');
    });

    it('should block Manager A from updating Project B', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', managerAHeader)
        .send({ name: 'Hacked Title' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('only update your own projects');
    });

    it('should block Manager A from deleting Project B', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', managerAHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('only delete your own projects');
    });

    it('should block Manager A from viewing Task B', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskB.id}`)
        .set('Authorization', managerAHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should block Manager A from updating Task B status or details', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskB.id}`)
        .set('Authorization', managerAHeader)
        .send({ status: 'DONE' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should block Manager A from deleting Task B', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskB.id}`)
        .set('Authorization', managerAHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  /**
   * Risk: Member A accesses or creates task details/comments of Member B without permission.
   * Priority: Critical
   * Expected Outcome: Returns 403 Forbidden.
   */
  describe('Broken Authorization - Member Scope Boundary', () => {
    it('should block Member A from viewing Task B', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskB.id}`)
        .set('Authorization', memberAHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should block Member A from creating a comment on Task B', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskB.id}/comments`)
        .set('Authorization', memberAHeader)
        .send({ content: 'Unauthorised comment' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow Member A to create and edit comments on their own Task A', async () => {
      // Create comment
      const createRes = await request(app)
        .post(`/api/v1/tasks/${taskA.id}/comments`)
        .set('Authorization', memberAHeader)
        .send({ content: 'Member A comment' });

      expect(createRes.status).toBe(201);
      const commentId = createRes.body.data.id;

      // Edit comment
      const updateRes = await request(app)
        .patch(`/api/v1/tasks/${taskA.id}/comments/${commentId}`)
        .set('Authorization', memberAHeader)
        .send({ content: 'Member A updated comment' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.content).toBe('Member A updated comment');

      // Block Member B from editing Member A's comment
      const intruderEditRes = await request(app)
        .patch(`/api/v1/tasks/${taskA.id}/comments/${commentId}`)
        .set('Authorization', memberBHeader)
        .send({ content: 'Stolen edit' });

      expect(intruderEditRes.status).toBe(403);
    });

    it('should block Member B from deleting Member A comment', async () => {
      const comment = await prisma.taskComment.create({
        data: { content: 'Original comment', authorId: memberA.id, taskId: taskA.id },
      });

      const res = await request(app)
        .delete(`/api/v1/tasks/${taskA.id}/comments/${comment.id}`)
        .set('Authorization', memberBHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should block Member A from editing comment authored by Manager A on Task A', async () => {
      const comment = await prisma.taskComment.create({
        data: { content: 'Manager A comment', authorId: managerA.id, taskId: taskA.id },
      });

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskA.id}/comments/${comment.id}`)
        .set('Authorization', memberAHeader)
        .send({ content: 'Member updated manager comment' });

      expect(res.status).toBe(403);
    });

    it('should block Member A from deleting comment authored by Manager A on Task A', async () => {
      const comment = await prisma.taskComment.create({
        data: { content: 'Manager A comment', authorId: managerA.id, taskId: taskA.id },
      });

      const res = await request(app)
        .delete(`/api/v1/tasks/${taskA.id}/comments/${comment.id}`)
        .set('Authorization', memberAHeader);

      expect(res.status).toBe(403);
    });
  });

  /**
   * Risk: Administrative controls failing to overwrite tenant objects or execute universal audits.
   * Priority: High
   * Expected Outcome: Admin succeeds on all tasks/projects regardless of owner.
   */
  describe('Administrative Overrides Control Checks', () => {
    it('should allow ADMIN to retrieve Project B details', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(projectB.id);
    });

    it('should allow ADMIN to update Project B details', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', adminHeader)
        .send({ name: 'Admin Changed Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Admin Changed Title');
    });

    it('should allow ADMIN to soft-delete Project B', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await prisma.project.findFirst({
        where: { id: projectB.id },
      });
      expect(check.deletedAt).not.toBeNull();
      expect(check.deletedBy).toBe(admin.id);
    });

    it('should allow ADMIN to edit comments of other users', async () => {
      const comment = await prisma.taskComment.create({
        data: { content: 'User comment', authorId: memberA.id, taskId: taskA.id },
      });

      const res = await request(app)
        .patch(`/api/v1/tasks/${taskA.id}/comments/${comment.id}`)
        .set('Authorization', adminHeader)
        .send({ content: 'Edited by admin' });

      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('Edited by admin');
    });
  });
});
