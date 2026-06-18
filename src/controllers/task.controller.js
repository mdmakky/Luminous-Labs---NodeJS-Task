import * as taskService from '../services/task.service.js';
import * as auditLogService from '../services/audit-log.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import asyncHandler from '../middleware/async-handler.js';

// GET /api/v1/tasks
export const listTasks = asyncHandler(async (req, res) => {
  const { page, limit, status, priority, assigneeId, projectId, sortBy, sortOrder } = req.query;

  const { tasks, totalCount } = await taskService.listTasks(
    {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status,
      priority,
      assigneeId,
      projectId,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'desc',
    },
    req.user,
  );

  sendPaginated(res, tasks, {
    totalCount,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
  });
});

// GET /api/v1/tasks/:id
export const getTask = asyncHandler(async (req, res) => {
  const task = await taskService.getTask(req.params.id, req.user);
  sendSuccess(res, task);
});

// POST /api/v1/tasks
export const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createTask(req.body, req.user);
  sendSuccess(res, task, 201);
});

// PATCH /api/v1/tasks/:id
export const updateTask = asyncHandler(async (req, res) => {
  const { updatedTask, oldStatus } = await taskService.updateTask(
    req.params.id,
    req.body,
    req.user,
  );

  // If status changed, record it in the audit log
  if (req.body.status && req.body.status !== oldStatus) {
    await auditLogService.logStatusChange({
      taskId: req.params.id,
      changedBy: req.user.userId,
      oldStatus,
      newStatus: req.body.status,
    });
  }

  sendSuccess(res, updatedTask);
});

// DELETE /api/v1/tasks/:id
export const deleteTask = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.params.id, req.user);
  sendSuccess(res, { message: 'Task deleted successfully' });
});
