import prisma from '../config/prisma.js';

// Record a task status change in the audit log
export const logStatusChange = async ({ taskId, changedBy, oldStatus, newStatus }) => {
  return prisma.auditLog.create({
    data: { taskId, changedBy, oldStatus, newStatus },
  });
};

// Get the audit trail for a task with pagination and sorting
export const getAuditLog = async (taskId, { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'asc' } = {}) => {
  const skip = (page - 1) * limit;

  const where = {
    taskId,
    deletedAt: null,
  };

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, totalCount };
};

// Soft delete an audit log entry
export const softDelete = async (id) => {
  return prisma.auditLog.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
