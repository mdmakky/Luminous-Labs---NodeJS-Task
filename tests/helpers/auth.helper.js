import bcrypt from 'bcrypt';
import prisma from '../../src/config/prisma.js';
import jwt from 'jsonwebtoken';
import env from '../../src/config/env.js';

export const createTestUser = async ({ name, email, password, role }) => {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
    },
  });
};

export const getAuthHeader = (user) => {
  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: '15m',
  });
  return `Bearer ${token}`;
};
