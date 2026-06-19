import { Router } from 'express';
import * as taskController from '../controllers/task.controller.js';
import * as auditLogController from '../controllers/audit-log.controller.js';
import commentRoutes from './comment.routes.js';
import authenticate from '../middleware/auth.middleware.js';
import { requireCanCreateTask, requireCanDeleteTask } from '../middleware/rbac.middleware.js';
import validate from '../middleware/validation.middleware.js';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksSchema,
  listAuditLogsSchema,
  getOrDeleteTaskSchema,
} from '../validations/task.validation.js';

const router = Router();

// Mount comment routes under /tasks/:taskId/comments
router.use('/:taskId/comments', commentRoutes);

// All task routes require authentication
router.use(authenticate);

// All roles can list and view tasks (service layer filters by role)
router.get('/', validate(listTasksSchema), taskController.listTasks);
router.get('/:id', validate(getOrDeleteTaskSchema), taskController.getTask);

// Only ADMIN and MANAGER can create tasks
router.post('/', requireCanCreateTask, validate(createTaskSchema), taskController.createTask);

// All roles can update (service layer enforces field restrictions for members)
router.patch('/:id', validate(updateTaskSchema), taskController.updateTask);

// Only ADMIN and MANAGER can delete tasks
router.delete('/:id', requireCanDeleteTask, validate(getOrDeleteTaskSchema), taskController.deleteTask);

// Audit trail — accessible to anyone who has access to the task
router.get('/:id/audit', validate(listAuditLogsSchema), auditLogController.getAuditLog);

export default router;
