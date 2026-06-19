import prisma from '../config/prisma.js';

// Get all tasks with filters, sorting, and pagination
export const findAll = async ({
  page = 1,
  limit = 10,
  status,
  priority,
  assigneeId,
  projectId,
  projectOwnerId,
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
    ...(projectOwnerId && {
      project: {
        ownerId: projectOwnerId,
      },
    }),
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

// Create a new task — sets completedAt if created as DONE
export const create = async (data) => {
  const createData = { ...data };
  if (data.status === 'DONE') {
    createData.completedAt = new Date();
  }
  return prisma.task.create({
    data: createData,
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });
};

// Update a task — auto-sets completedAt if status changes to DONE, clears it otherwise
export const update = async (id, data) => {
  const updateData = { ...data };

  if (data.status === 'DONE') {
    updateData.completedAt = new Date();
  } else if (data.status !== undefined) {
    // Status changed to something other than DONE — clear completedAt
    updateData.completedAt = null;
  }

  return prisma.task.update({
    where: { id },
    data: updateData,
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

// Soft delete a task — records who deleted it
export const softDelete = async (id, deletedBy) => {
  return prisma.task.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy },
  });
};
