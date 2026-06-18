import prisma from '../config/prisma.js';

// Record a task status change in the audit log
export const logStatusChange = async ({ taskId, changedBy, oldStatus, newStatus }) => {
  return prisma.auditLog.create({
    data: { taskId, changedBy, oldStatus, newStatus },
  });
};

// Get the full audit trail for a task
export const getAuditLog = async (taskId) => {
  return prisma.auditLog.findMany({
    where: { taskId },
    orderBy: { timestamp: 'asc' },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
};
