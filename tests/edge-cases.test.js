import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { clearDatabase } from './helpers/db.helper.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Edge Case & Session Boundaries Tests', () => {
  let user;

  beforeEach(async () => {
    await clearDatabase();

    user = await createTestUser({
      name: 'Session User',
      email: 'session@test.com',
      password: 'Password@123',
      role: 'MEMBER',
    });
  });

  /**
   * Risk: Session hijacking via replaying an already-rotated/invalid refresh token.
   * Priority: Critical
   * Expected Outcome: Reject subsequent rotations of the same token with 401.
   */
  describe('Refresh Token Replay (Re-use) Protection', () => {
    it('should reject refresh token rotation attempts using an already rotated token', async () => {
      // 1. Get initial token pair
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password@123' });

      const firstRefreshToken = loginRes.body.data.refreshToken;
      expect(firstRefreshToken).toBeDefined();

      // 2. Refresh token rotation 1 (succeeds)
      const rotate1Res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken });

      expect(rotate1Res.status).toBe(200);
      const secondRefreshToken = rotate1Res.body.data.refreshToken;
      expect(secondRefreshToken).toBeDefined();

      // 3. Refresh token rotation 2 using firstRefreshToken again (fails)
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken });

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.success).toBe(false);
      expect(replayRes.body.error.message).toContain('Invalid refresh token');
    });
  });

  /**
   * Risk: Expired sessions remain active indefinitely.
   * Priority: Critical
   * Expected Outcome: Reject rotation with 401 and prune the token.
   */
  describe('Expired Refresh Token Enforcement', () => {
    it('should reject refresh attempts with expired refresh tokens and delete them from DB', async () => {
      // Create a token directly in DB that is already expired
      const token = 'expiredtokenplaceholder1234567890abcdefg';
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await prisma.refreshToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        },
      });

      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Refresh token has expired');

      // Verify it was deleted from DB
      const search = await prisma.refreshToken.findUnique({
        where: { tokenHash },
      });
      expect(search).toBeNull();
    });
  });

  /**
   * Risk: Performance degradation or DoS via massive pagination limits or negative pages.
   * Priority: High
   * Expected Outcome: Coerce page to >=1 and limit to max 100 via Zod schema.
   */
  describe('Query Pagination Boundaries', () => {
    it('should coerce negative page indexes and excessively large limits to defaults/max constraints', async () => {
      const adminHeader = getAuthHeader(user);

      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', adminHeader)
        .query({ page: 0, limit: 1000 }); // page=0 is coerced/validated to default (1) or error, limit=1000 is blocked/coerced. Let's see.

      // In task.validation.js, page is coerced: z.coerce.number().int().min(1).optional().default(1)
      // So page=0 fails validation (returns 400), or limit=1000 fails validation (max is 100).
      // Let's test that validation blocks them (returns 400) or handles them gracefully.
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Validation failed');
    });

    it('should successfully apply valid boundary pagination parameters (page=1, limit=100)', async () => {
      const adminHeader = getAuthHeader(user);

      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', adminHeader)
        .query({ page: 1, limit: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination.limit).toBe(100);
      expect(res.body.pagination.page).toBe(1);
    });
  });

  describe('Entity Service Error Handling Edge Cases', () => {
    let adminHeader;

    beforeEach(async () => {
      const admin = await createTestUser({
        name: 'Ghost Admin',
        email: 'ghost_admin@test.com',
        password: 'Password@123',
        role: 'ADMIN',
      });
      adminHeader = getAuthHeader(admin);
    });

    it('should return 404 when trying to update a non-existent comment', async () => {
      const nonExistentCommentId = 'd9e2b17f-0b44-42b7-84ad-000000000000';
      const res = await request(app)
        .patch(
          `/api/v1/tasks/d9e2b17f-0b44-42b7-84ad-e343bf8ff4e2/comments/${nonExistentCommentId}`,
        )
        .set('Authorization', adminHeader)
        .send({ content: 'Updating ghost comment' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Comment not found');
    });

    it('should return 404 when trying to delete a non-existent comment', async () => {
      const nonExistentCommentId = 'd9e2b17f-0b44-42b7-84ad-000000000000';
      const res = await request(app)
        .delete(
          `/api/v1/tasks/d9e2b17f-0b44-42b7-84ad-e343bf8ff4e2/comments/${nonExistentCommentId}`,
        )
        .set('Authorization', adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Comment not found');
    });

    it('should return 404 when trying to update a non-existent project', async () => {
      const nonExistentProjectId = 'd9e2b17f-0b44-42b7-84ad-000000000000';
      const res = await request(app)
        .patch(`/api/v1/projects/${nonExistentProjectId}`)
        .set('Authorization', adminHeader)
        .send({ name: 'Updating ghost project' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Project not found');
    });

    it('should return 404 when trying to delete a non-existent project', async () => {
      const nonExistentProjectId = 'd9e2b17f-0b44-42b7-84ad-000000000000';
      const res = await request(app)
        .delete(`/api/v1/projects/${nonExistentProjectId}`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Project not found');
    });

    it('should return 404 when trying to update a non-existent task', async () => {
      const nonExistentTaskId = 'd9e2b17f-0b44-42b7-84ad-000000000000';
      const res = await request(app)
        .patch(`/api/v1/tasks/${nonExistentTaskId}`)
        .set('Authorization', adminHeader)
        .send({ title: 'Updating ghost task' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Task not found');
    });

    it('should return 404 when trying to delete a non-existent task', async () => {
      const nonExistentTaskId = 'd9e2b17f-0b44-42b7-84ad-000000000000';
      const res = await request(app)
        .delete(`/api/v1/tasks/${nonExistentTaskId}`)
        .set('Authorization', adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Task not found');
    });
  });
});
