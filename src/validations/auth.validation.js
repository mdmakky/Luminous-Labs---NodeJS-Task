import { z } from 'zod';

// POST /api/v1/auth/register
// NOTE: 'role' is intentionally excluded — all self-registered users are MEMBER by default.
// Role can only be changed by an ADMIN via the users management API.
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

// POST /api/v1/auth/login
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

// POST /api/v1/auth/refresh
export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

// POST /api/v1/auth/logout
export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});
