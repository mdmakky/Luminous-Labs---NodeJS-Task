import { z } from 'zod';

// POST /api/v1/projects
export const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
  }),
});

// PATCH /api/v1/projects/:id
export const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    description: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid project ID'),
  }),
});

// GET /api/v1/projects (list query)
export const listProjectsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    name: z.string().optional(),
    sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});
