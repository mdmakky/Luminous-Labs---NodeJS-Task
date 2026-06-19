import prisma from '../config/prisma.js';

// Find a user by their email address - excludes soft-deleted
export const findByEmail = async (email) => {
  return prisma.user.findFirst({ where: { email, deletedAt: null } });
};

// Find a user by their ID - excludes soft-deleted
export const findById = async (id) => {
  return prisma.user.findFirst({ where: { id, deletedAt: null } });
};

// Create a new user
export const create = async (data) => {
  return prisma.user.create({ data });
};

// Find a user by ID and exclude password hash - excludes soft-deleted
export const findByIdSafe = async (id) => {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

// Soft delete a user
export const softDelete = async (id) => {
  return prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
