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
