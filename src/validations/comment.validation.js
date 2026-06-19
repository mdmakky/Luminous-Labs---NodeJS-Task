import { z } from 'zod';

// POST /api/v1/tasks/:taskId/comments
export const createCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment cannot be empty'),
  }),
  params: z.object({
    taskId: z.string().uuid('Invalid task ID'),
  }),
});

// PATCH /api/v1/tasks/:taskId/comments/:id
export const updateCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment cannot be empty'),
  }),
  params: z.object({
    taskId: z.string().uuid('Invalid task ID'),
    id: z.string().uuid('Invalid comment ID'),
  }),
});

// GET /api/v1/tasks/:taskId/comments
export const listCommentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    sortBy: z.enum(['createdAt', 'updatedAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  }),
  params: z.object({
    taskId: z.string().uuid('Invalid task ID'),
  }),
});

// DELETE /api/v1/tasks/:taskId/comments/:id
export const deleteCommentSchema = z.object({
  params: z.object({
    taskId: z.string().uuid('Invalid task ID'),
    id: z.string().uuid('Invalid comment ID'),
  }),
});
