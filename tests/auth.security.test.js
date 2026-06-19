import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import app from '../src/app.js';
import { clearDatabase } from './helpers/db.helper.js';
import env from '../src/config/env.js';
import prisma from '../src/config/prisma.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Auth Security Tests', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  /**
   * Risk: Health check and root welcome endpoints are broken or leak sensitive debugging data.
   * Priority: Medium
   * Expected Outcome: Return 200 OK and expected basic structure.
   */
  describe('GET /health & GET / (System Diagnostics & Welcome)', () => {
    it('should return health check state successfully', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.timestamp).toBeDefined();
    });

    it('should return welcome message successfully', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Welcome to the Task Assignment API');
      expect(res.body.data.docs).toBe('/api-docs');
    });
  });

  /**
   * Risk: Spoofed JWT signatures with forged secret bypass authorization checks.
   * Priority: Critical
   * Expected Outcome: Access rejected with 401.
   */
  describe('JWT Forgery & Invalid Secret Detection', () => {
    it('should reject access with forged JWT signed with an invalid secret', async () => {
      const forgedToken = jwt.sign(
        { userId: 'some-user-uuid', email: 'intruder@test.com', role: 'ADMIN' },
        'WRONG_JWT_SECRET',
        { expiresIn: '15m' },
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid or expired token');
    });

    it('should reject access with malformed Authorization header structure', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'BearerNotMatchingPattern');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('No token provided');
    });
  });

  /**
   * Risk: Attackers self-assigning ADMIN or MANAGER roles in request body payloads.
   * Priority: Critical
   * Expected Outcome: Self-registration ignores the payload role field and forces MEMBER role.
   */
  describe('Mass Assignment & Role Escalation Defense', () => {
    it('should register new users with MEMBER role even if payload requests ADMIN', async () => {
      const payload = {
        name: 'Attacker User',
        email: 'attacker@test.com',
        password: 'Password@123',
        role: 'ADMIN', // Attempted mass assignment
      };

      const res = await request(app).post('/api/v1/auth/register').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('MEMBER');

      // Verify profile returns MEMBER role
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${res.body.data.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.role).toBe('MEMBER');
    });
  });

  /**
   * Risk: Brute-force attacks against auth routes (login/register).
   * Priority: High
   * Expected Outcome: Exceeding rate limits blocks with 429.
   */
  describe('Authentication Route Rate Limiting', () => {
    let originalEnv;

    beforeAll(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should block authentication attempts after exceeding max limit in production mode', async () => {
      // Temporarily change environment to trigger rate limiter
      process.env.NODE_ENV = 'production';

      const payload = {
        email: 'rate-limit@test.com',
        password: 'WrongPassword1',
      };

      // Limit is 5. Request 6 times.
      let lastRes;
      for (let i = 0; i < 6; i++) {
        lastRes = await request(app).post('/api/v1/auth/login').send(payload);
      }

      expect(lastRes.status).toBe(429);
      expect(lastRes.body.success).toBe(false);
      expect(lastRes.body.error.message).toContain('Too many attempts');
    });

    it('should cover skip conditions for rate limiters', async () => {
      const { authRateLimiter, generalRateLimiter } =
        await import('../src/middleware/rate-limit.middleware.js');

      const originalEnv = process.env.NODE_ENV;

      const mockReq = (path, ip = '127.0.0.1') => ({
        path,
        headers: {},
        ip,
        app: {
          get: () => false,
        },
      });

      const mockRes = {
        setHeader: () => {},
        setHeaders: () => {},
        status: function () {
          return this;
        },
        send: () => {},
        json: () => {},
      };

      // 1. generalRateLimiter test in test mode (should skip)
      process.env.NODE_ENV = 'test';
      const next1 = jest.fn();
      await generalRateLimiter(mockReq('/'), mockRes, next1);
      expect(next1).toHaveBeenCalled();

      // 2. generalRateLimiter test in production mode (should NOT skip)
      process.env.NODE_ENV = 'production';
      const next2 = jest.fn();
      await generalRateLimiter(mockReq('/', '127.0.0.8'), mockRes, next2);
      expect(next2).toHaveBeenCalled();

      // 3. authRateLimiter test in test mode
      process.env.NODE_ENV = 'test';
      const next3 = jest.fn();
      await authRateLimiter(mockReq('/login'), mockRes, next3);
      expect(next3).toHaveBeenCalled();

      // 4. authRateLimiter test in production mode with /logout path (should skip)
      process.env.NODE_ENV = 'production';
      const next4 = jest.fn();
      await authRateLimiter(mockReq('/logout'), mockRes, next4);
      expect(next4).toHaveBeenCalled();

      // 5. authRateLimiter test in production mode with /login path (should NOT skip)
      process.env.NODE_ENV = 'production';
      const next5 = jest.fn();
      await authRateLimiter(mockReq('/login', '127.0.0.9'), mockRes, next5);
      expect(next5).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it('should cover rbac requireRole middleware edge cases (no user)', async () => {
      const { requireRole } = await import('../src/middleware/rbac.middleware.js');
      const middleware = requireRole('ADMIN');
      const req = {}; // no user
      const next = jest.fn();

      middleware(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it('should cover rbac requireRole middleware when role does not match', async () => {
      const { requireRole } = await import('../src/middleware/rbac.middleware.js');
      const middleware = requireRole('ADMIN', 'MANAGER');
      const req = { user: { role: 'MEMBER' } };
      const next = jest.fn();

      middleware(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it('should cover rbac requireRole middleware when role matches', async () => {
      const { requireRole } = await import('../src/middleware/rbac.middleware.js');
      const middleware = requireRole('ADMIN', 'MANAGER');
      const req = { user: { role: 'MANAGER' } };
      const next = jest.fn();

      middleware(req, {}, next);
      expect(next).toHaveBeenCalled();
      expect(next).not.toHaveBeenLastCalledWith(expect.any(Error));
    });

    it('should cover rbac requireCanCreateTask, requireCanDeleteTask, requireCanManageProject with undefined user', async () => {
      const { requireCanCreateTask, requireCanDeleteTask, requireCanManageProject } =
        await import('../src/middleware/rbac.middleware.js');
      const req = {}; // no req.user
      const next = jest.fn();

      requireCanCreateTask(req, {}, next);
      requireCanDeleteTask(req, {}, next);
      requireCanManageProject(req, {}, next);
      expect(next).toHaveBeenCalledTimes(3);
    });
  });

  describe('Authentication Service Edge Conditions', () => {
    it('should reject registration of duplicate emails (409 Conflict)', async () => {
      const payload = {
        name: 'First User',
        email: 'duplicate@test.com',
        password: 'Password@123',
      };

      // First registration
      await request(app).post('/api/v1/auth/register').send(payload);

      // Second registration with same email
      const res = await request(app).post('/api/v1/auth/register').send(payload);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Email already registered');
    });

    it('should reject login with wrong password for an existing user (401 Unauthorized)', async () => {
      const email = 'existing-user@test.com';
      await request(app).post('/api/v1/auth/register').send({
        name: 'Existing User',
        email,
        password: 'Password@123',
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email,
        password: 'WrongPassword@123',
      });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid email or password');
    });

    it('should reject profile query for a user that does not exist in the database (401 Unauthorized)', async () => {
      const nonExistentUserId = 'd9e2b17f-0b44-42b7-84ad-000000000000';
      const token = jwt.sign(
        { userId: nonExistentUserId, email: 'nonexistent@test.com', role: 'MEMBER' },
        env.JWT_SECRET,
        { expiresIn: '15m' },
      );

      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('User not found');
    });

    it('should reject token refresh if the associated user has been deleted (401)', async () => {
      // 1. Create a user
      const user = await createTestUser({
        name: 'Soon To Be Deleted',
        email: 'deleted-user@test.com',
        password: 'Password@123',
        role: 'MEMBER',
      });

      // 2. Log in to get a refresh token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'deleted-user@test.com', password: 'Password@123' });

      const { refreshToken } = loginRes.body.data;

      // 3. Soft-delete the user
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      // 4. Try to refresh the token
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('User not found');
    });
  });
});
