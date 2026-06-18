import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Clearing existing data...');
  // Delete in reverse order of relationships
  await prisma.auditLog.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding database...');

  // Create users
  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('Admin@123', saltRounds);
  const managerPasswordHash = await bcrypt.hash('Manager@123', saltRounds);
  const memberPasswordHash = await bcrypt.hash('Member@123', saltRounds);

  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Project Manager',
      email: 'manager@example.com',
      passwordHash: managerPasswordHash,
      role: 'MANAGER',
    },
  });

  const member = await prisma.user.create({
    data: {
      name: 'Team Member',
      email: 'member@example.com',
      passwordHash: memberPasswordHash,
      role: 'MEMBER',
    },
  });

  console.log('Users seeded:', {
    admin: admin.email,
    manager: manager.email,
    member: member.email,
  });

  // Create project owned by manager
  const project = await prisma.project.create({
    data: {
      name: 'Luminous Core App',
      description: 'The core task assignment application development project.',
      ownerId: manager.id,
    },
  });

  console.log('Project seeded:', project.name);

  // Create tasks
  const task1 = await prisma.task.create({
    data: {
      title: 'Design database schema',
      description: 'Define models for Users, Projects, Tasks, and Audit Logs.',
      priority: 'HIGH',
      status: 'DONE',
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: member.id,
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: 'Implement JWT authentication',
      description: 'Setup JWT access and refresh tokens with automatic rotation.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: member.id,
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: 'Write automated unit tests',
      description: 'Add tests for auth, task status changes, and RBAC.',
      priority: 'MEDIUM',
      status: 'TODO',
      projectId: project.id,
      creatorId: manager.id,
    },
  });

  console.log('Tasks seeded:', [task1.title, task2.title, task3.title]);

  // Add initial audit logs for the task status
  await prisma.auditLog.createMany({
    data: [
      {
        taskId: task1.id,
        changedBy: manager.id,
        oldStatus: 'TODO',
        newStatus: 'DONE',
        timestamp: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      },
      {
        taskId: task2.id,
        changedBy: manager.id,
        oldStatus: 'TODO',
        newStatus: 'IN_PROGRESS',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      },
    ],
  });

  console.log('Audit logs seeded.');

  // Add a sample comment
  await prisma.taskComment.create({
    data: {
      taskId: task2.id,
      content: 'I have started implementing the token database schema.',
      authorId: member.id,
    },
  });

  console.log('Comments seeded.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
