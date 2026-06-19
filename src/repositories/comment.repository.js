import prisma from '../config/prisma.js';

// Get comments for a task with pagination and sorting - excludes soft-deleted
export const findByTaskId = async (
  taskId,
  { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'asc' } = {},
) => {
  const skip = (page - 1) * limit;

  const where = {
    taskId,
    deletedAt: null,
  };

  const [comments, totalCount] = await Promise.all([
    prisma.taskComment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.taskComment.count({ where }),
  ]);

  return { comments, totalCount };
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
