import prisma from '../config/prisma.js';

// Store a hashed refresh token in the database
export const create = async (data) => {
  return prisma.refreshToken.create({ data });
};

// Find a refresh token by its hash
export const findByHash = async (tokenHash) => {
  return prisma.refreshToken.findUnique({ where: { tokenHash } });
};

// Delete a specific refresh token by hash
export const deleteByHash = async (tokenHash) => {
  return prisma.refreshToken.delete({ where: { tokenHash } });
};

// Delete all refresh tokens for a user (e.g. logout from all devices)
export const deleteByUserId = async (userId) => {
  return prisma.refreshToken.deleteMany({ where: { userId } });
};
