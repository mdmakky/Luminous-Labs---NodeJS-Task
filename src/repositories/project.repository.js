import prisma from '../config/prisma.js';

// Get all projects (with pagination) - excludes soft-deleted
export const findAll = async ({ page = 1, limit = 10, ownerId = null } = {}) => {
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(ownerId && { ownerId }),
  };

  const [projects, totalCount] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, totalCount };
};

// Get a single project by ID
export const findById = async (id) => {
  return prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true } },
    },
  });
};

// Create a new project
export const create = async (data) => {
  return prisma.project.create({
    data,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });
};

// Update a project
export const update = async (id, data) => {
  return prisma.project.update({
    where: { id },
    data,
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  });
};

// Soft delete a project
export const softDelete = async (id) => {
  return prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
