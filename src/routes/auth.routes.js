import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validation.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from '../validations/auth.validation.js';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', validate(logoutSchema), authController.logout);

// Protected route
router.get('/me', authenticate, authController.getProfile);

export default router;
