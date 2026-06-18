import prisma, { pool } from '../src/config/prisma.js';

afterAll(async () => {
  // Disconnect prisma and close pg pool
  await prisma.$disconnect();
  await pool.end();
});
