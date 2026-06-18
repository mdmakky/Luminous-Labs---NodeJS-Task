import prisma from '../config/prisma.js';

// Get all tasks with filters, sorting, and pagination
export const findAll = async ({
  page = 1,
  limit = 10,
  status,
  priority,
  assigneeId,
  projectId,
  sortBy = 'createdAt',
  sortOrder = 'asc',
} = {}) => {
  const skip = (page - 1) * limit;

  // Build filter conditions — only include if provided
  const where = {
    deletedAt: null,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(assigneeId && { assigneeId }),
    ...(projectId && { projectId }),
  };

  const [tasks, totalCount] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, totalCount };
};

// Get a single task by ID
export const findById = async (id) => {
  return prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });
};

// Create a new task
export const create = async (data) => {
  return prisma.task.create({
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });
};

// Update a task — returns old and new task
export const update = async (id, data) => {
  return prisma.task.update({
    where: { id },
    data,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });
};

// Get the current status of a task (used before update to detect status changes)
export const getStatus = async (id) => {
  const task = await prisma.task.findUnique({ where: { id }, select: { status: true } });
  return task?.status || null;
};

// Soft delete a task
export const softDelete = async (id) => {
  return prisma.task.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
