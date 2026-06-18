import * as auditLogService from '../services/audit-log.service.js';
import * as taskService from '../services/task.service.js';
import { sendSuccess } from '../utils/response.js';
import asyncHandler from '../middleware/async-handler.js';

// GET /api/v1/tasks/:id/audit
export const getAuditLog = asyncHandler(async (req, res) => {
  // First check user has access to this task
  await taskService.getTask(req.params.id, req.user);

  const logs = await auditLogService.getAuditLog(req.params.id);
  sendSuccess(res, logs);
});
