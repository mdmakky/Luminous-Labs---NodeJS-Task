import * as projectService from '../services/project.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import asyncHandler from '../middleware/async-handler.js';

// GET /api/v1/projects
export const listProjects = asyncHandler(async (req, res) => {
  const { page, limit, name, sortBy, sortOrder } = req.query;
  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 10;

  const { projects, totalCount } = await projectService.listProjects({
    userId: req.user.userId,
    role: req.user.role,
    page: parsedPage,
    limit: parsedLimit,
    name,
    sortBy,
    sortOrder,
  });

  sendPaginated(res, projects, {
    totalCount,
    page: parsedPage,
    limit: parsedLimit,
  });
});

// GET /api/v1/projects/:id
export const getProject = asyncHandler(async (req, res) => {
  const project = await projectService.getProject(req.params.id, req.user);
  sendSuccess(res, project);
});

// POST /api/v1/projects
export const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.body, req.user.userId);
  sendSuccess(res, project, 201);
});

// PATCH /api/v1/projects/:id
export const updateProject = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(req.params.id, req.body, req.user);
  sendSuccess(res, project);
});

// DELETE /api/v1/projects/:id
export const deleteProject = asyncHandler(async (req, res) => {
  await projectService.deleteProject(req.params.id, req.user);
  sendSuccess(res, { message: 'Project deleted successfully' });
});
