import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';
import asyncHandler from '../middleware/async-handler.js';

// POST /api/v1/auth/register
export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, result, 201);
});

// POST /api/v1/auth/login
export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, result, 200);
});

// POST /api/v1/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  sendSuccess(res, result, 200);
});

// POST /api/v1/auth/logout
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  sendSuccess(res, { message: 'Logged out successfully' }, 200);
});

// GET /api/v1/auth/me
export const getProfile = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.userId);
  sendSuccess(res, user, 200);
});
