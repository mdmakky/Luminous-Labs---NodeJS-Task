import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireCanManageProject } from '../middleware/rbac.middleware.js';
import validate from '../middleware/validation.middleware.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  getOrDeleteProjectSchema,
} from '../validations/project.validation.js';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// Anyone authenticated can list and view projects
router.get('/', validate(listProjectsSchema), projectController.listProjects);
router.get('/:id', validate(getOrDeleteProjectSchema), projectController.getProject);

// Only ADMIN and MANAGER can create, update, delete projects
router.post(
  '/',
  requireCanManageProject,
  validate(createProjectSchema),
  projectController.createProject,
);
router.patch(
  '/:id',
  requireCanManageProject,
  validate(updateProjectSchema),
  projectController.updateProject,
);
router.delete(
  '/:id',
  requireCanManageProject,
  validate(getOrDeleteProjectSchema),
  projectController.deleteProject,
);

export default router;
