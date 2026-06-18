import prisma from '../../src/config/prisma.js';

export const clearDatabase = async () => {
  await prisma.auditLog.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
};
