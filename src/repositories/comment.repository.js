import prisma from '../config/prisma.js';

// Get all comments for a task
export const findByTaskId = async (taskId) => {
  return prisma.taskComment.findMany({
    where: { taskId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
};

// Find a comment by ID
export const findById = async (id) => {
  return prisma.taskComment.findFirst({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
};

// Create a comment
export const create = async (data) => {
  return prisma.taskComment.create({
    data,
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
};

// Update a comment
export const update = async (id, content) => {
  return prisma.taskComment.update({
    where: { id },
    data: { content },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
};

// Soft delete a comment
export const softDelete = async (id) => {
  return prisma.taskComment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
