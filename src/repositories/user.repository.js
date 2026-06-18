import prisma from '../config/prisma.js';

// Find a user by their email address
export const findByEmail = async (email) => {
  return prisma.user.findUnique({ where: { email } });
};

// Find a user by their ID
export const findById = async (id) => {
  return prisma.user.findUnique({ where: { id } });
};

// Create a new user
export const create = async (data) => {
  return prisma.user.create({ data });
};

// Find a user by ID and exclude password hash
export const findByIdSafe = async (id) => {
  return prisma.user.findUnique({
    where: { id },
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
