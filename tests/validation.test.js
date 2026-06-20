import request from 'supertest';
import app from '../src/app.js';
import { jest } from '@jest/globals';
import { clearDatabase } from './helpers/db.helper.js';
import { createTestUser, getAuthHeader } from './helpers/auth.helper.js';

describe('Validation & Boundary Tests', () => {
  let user, userHeader;

  beforeEach(async () => {
    await clearDatabase();

    user = await createTestUser({
      name: 'Validation User',
      email: 'val@test.com',
      password: 'Password@123',
      role: 'ADMIN',
    });
    userHeader = getAuthHeader(user);
  });

  /**
   * Risk: Invalid UUID paths crash the server (500) rather than failing cleanly (400).
   * Priority: High
   * Expected Outcome: Return 400 validation failure response.
   */
  describe('Malformed UUID Path Parameters', () => {
    it('should reject requests with invalid UUID path params with a 400 instead of a 500', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/not-a-valid-uuid')
        .set('Authorization', userHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Validation failed');
    });

    it('should reject requests with invalid UUID in comments delete path params with a 400', async () => {
      const res = await request(app)
        .delete('/api/v1/tasks/not-a-valid-uuid/comments/also-not-a-uuid')
        .set('Authorization', userHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  /**
   * Risk: Empty values or short length strings pollute business models.
   * Priority: High
   * Expected Outcome: Return 400 Bad Request.
   */
  describe('Zod Schema Boundary Validations', () => {
    it('should block project creation when title length is less than 2 characters', async () => {
      const res = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', userHeader)
        .send({ name: 'A' }); // minimum is 2

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Validation failed');
    });

    it('should block task creation when title is missing', async () => {
      const res = await request(app).post('/api/v1/tasks').set('Authorization', userHeader).send({
        description: 'No title task',
        projectId: 'd9e2b17f-0b44-42b7-84ad-e343bf8ff4e2',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  /**
   * Risk: Arbitrary text bypasses backend status / priority checks.
   * Priority: High
   * Expected Outcome: Return 400 Bad Request.
   */
  describe('Strict Enum Boundaries Checks', () => {
    it('should reject invalid task status changes during creation', async () => {
      const res = await request(app).post('/api/v1/tasks').set('Authorization', userHeader).send({
        title: 'Invalid Status Task',
        projectId: 'd9e2b17f-0b44-42b7-84ad-e343bf8ff4e2',
        status: 'FINISHED', // FINISHED is not in TaskStatus enum
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid task priority changes during updates', async () => {
      const res = await request(app)
        .patch('/api/v1/tasks/d9e2b17f-0b44-42b7-84ad-e343bf8ff4e2')
        .set('Authorization', userHeader)
        .send({
          priority: 'EXTREME', // EXTREME is not in Priority enum
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Internal Code Base Utility Unit Tests (Defaults & Helpers)', () => {
    it('should correctly cover error class default values', async () => {
      const {
        AppError,
        ValidationError,
        UnauthorizedError,
        ForbiddenError,
        NotFoundError,
        ConflictError,
      } = await import('../src/utils/errors.js');

      const appErr = new AppError('Error message');
      expect(appErr.statusCode).toBe(500);

      const valErr = new ValidationError();
      expect(valErr.message).toBe('Validation failed');
      expect(valErr.errors).toEqual([]);

      const unauthErr = new UnauthorizedError();
      expect(unauthErr.message).toBe('Unauthorized');

      const forbiddenErr = new ForbiddenError();
      expect(forbiddenErr.message).toBe('Forbidden');

      const notFoundErr = new NotFoundError();
      expect(notFoundErr.message).toBe('Resource not found');

      const conflictErr = new ConflictError();
      expect(conflictErr.message).toBe('Resource already exists');
    });

    it('should correctly cover response sendError utility functions default values and structure', async () => {
      const { sendError } = await import('../src/utils/response.js');
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      const mockRes = { status: mockStatus };

      // Cover defaults: message, status 500, no errors
      sendError(mockRes, 'Internal server crash');
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        data: null,
        error: { message: 'Internal server crash' },
      });

      // Cover with custom errors
      const fieldErrors = [{ field: 'email', message: 'invalid email' }];
      sendError(mockRes, 'Validation failed', 400, fieldErrors);
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenLastCalledWith({
        success: false,
        data: null,
        error: { message: 'Validation failed', errors: fieldErrors },
      });
    });

    it('should hit validate middleware generic error catcher branch', async () => {
      const validate = (await import('../src/middleware/validation.middleware.js')).default;
      const fakeSchema = {
        parse: () => {
          throw new Error('Fake Generic Parsing Error');
        },
      };
      const req = { body: {}, query: {}, params: {} };
      const next = jest.fn();

      validate(fakeSchema)(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Fake Generic Parsing Error');
    });

    it('should map ZodError to ValidationError with structured field errors', async () => {
      const { z } = await import('zod');
      const { ValidationError } = await import('../src/utils/errors.js');
      const validate = (await import('../src/middleware/validation.middleware.js')).default;

      // Schema that requires a body.name field of at least 2 chars
      const schema = z.object({
        body: z.object({
          name: z.string().min(2, 'Name must be at least 2 characters'),
        }),
        query: z.object({}).optional(),
        params: z.object({}).optional(),
      });

      const req = { body: { name: 'A' }, query: {}, params: {} };
      const next = jest.fn();

      validate(schema)(req, {}, next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Validation failed');
      expect(err.errors.length).toBeGreaterThan(0);
      expect(err.errors[0].message).toContain('at least 2 characters');
    });
  });
});
