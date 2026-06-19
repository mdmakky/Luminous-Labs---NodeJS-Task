import * as auditLogService from '../services/audit-log.service.js';
import * as taskService from '../services/task.service.js';
import { sendPaginated } from '../utils/response.js';
import asyncHandler from '../middleware/async-handler.js';

// GET /api/v1/tasks/:id/audit
export const getAuditLog = asyncHandler(async (req, res) => {
  const { page, limit, sortBy, sortOrder } = req.query;

  // First check user has access to this task
  await taskService.getTask(req.params.id, req.user);

  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 10;

  const { logs, totalCount } = await auditLogService.getAuditLog(req.params.id, {
    page: parsedPage,
    limit: parsedLimit,
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder || 'asc',
  });

  sendPaginated(res, logs, {
    totalCount,
    page: parsedPage,
    limit: parsedLimit,
  });
});
