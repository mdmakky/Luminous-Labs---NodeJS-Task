import { z } from 'zod';

const TaskStatus = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']);
const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const SortOrder = z.enum(['asc', 'desc']).optional().default('asc');

// POST /api/v1/tasks
export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    description: z.string().optional(),
    priority: Priority.optional(),
    status: TaskStatus.optional(),
    dueDate: z.string().datetime({ offset: true }).optional().nullable(),
    projectId: z.string().uuid('Invalid project ID'),
    assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  }),
});

// PATCH /api/v1/tasks/:id
export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(2, 'Title must be at least 2 characters').optional(),
    description: z.string().optional(),
    priority: Priority.optional(),
    status: TaskStatus.optional(),
    dueDate: z.string().datetime({ offset: true }).optional().nullable(),
    assigneeId: z.string().uuid('Invalid assignee ID').optional().nullable(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
});

// GET /api/v1/tasks (with filters, sorting, pagination)
export const listTasksSchema = z.object({
  query: z.object({
    // Filters
    status: TaskStatus.optional(),
    priority: Priority.optional(),
    assigneeId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    // Sorting
    sortBy: z
      .enum(['createdAt', 'dueDate', 'priority', 'status', 'title'])
      .optional()
      .default('createdAt'),
    sortOrder: SortOrder,
    // Pagination
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  }),
});

// GET /api/v1/tasks/:id/audit (with pagination and sorting)
export const listAuditLogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    sortBy: z
      .enum(['createdAt', 'oldStatus', 'newStatus', 'timestamp'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  }),
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
});
