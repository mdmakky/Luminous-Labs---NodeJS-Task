import request from 'supertest';
import app from '../src/app.js';
import { clearDatabase } from './helpers/db.helper.js';

beforeEach(async () => {
  await clearDatabase();
});

describe('Authentication API', () => {
  const testUser = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'password123',
    role: 'MEMBER',
  };

  describe('POST /api/v1/auth/register', () => {
    it('should successfully register a new user', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.role).toBe(testUser.role);
      expect(res.body.data.user.passwordHash).toBeUndefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should fail registration with invalid input', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: '',
        email: 'not-an-email',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toContain('Validation failed');
    });

    it('should fail registration with duplicate email', async () => {
      // Register first user
      await request(app).post('/api/v1/auth/register').send(testUser);

      // Register second user with same email
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Jane Smith',
        email: testUser.email,
        password: 'password123',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Email already registered');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
    });

    it('should successfully login user with correct credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should fail login with incorrect password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testUser.email,
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);
      accessToken = res.body.data.accessToken;
    });

    it('should return profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.name).toBe(testUser.name);
    });

    it('should fail profile retrieval without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh & POST /api/v1/auth/logout', () => {
    let refreshToken;

    beforeEach(async () => {
      const res = await request(app).post('/api/v1/auth/register').send(testUser);
      refreshToken = res.body.data.refreshToken;
    });

    it('should successfully refresh token and rotate', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Old token should be invalidated/rotated and not work anymore
      const resInvalid = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

      expect(resInvalid.status).toBe(401);
      expect(resInvalid.body.success).toBe(false);
    });

    it('should successfully logout and delete refresh token', async () => {
      const resLogout = await request(app).post('/api/v1/auth/logout').send({ refreshToken });

      expect(resLogout.status).toBe(200);
      expect(resLogout.body.success).toBe(true);

      // Refresh token should not work after logout
      const resRefresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

      expect(resRefresh.status).toBe(401);
    });
  });
});
