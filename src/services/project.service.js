import * as projectRepo from '../repositories/project.repository.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

// List all projects with filtering, sorting, and pagination (admin sees all, manager sees own, member sees projects they have tasks in)
export const listProjects = async ({ userId, role, page, limit, name, sortBy, sortOrder }) => {
  let ownerId = null;
  let memberId = null;

  if (role === 'MANAGER') {
    ownerId = userId;
  } else if (role === 'MEMBER') {
    memberId = userId;
  }

  return projectRepo.findAll({
    page,
    limit,
    ownerId,
    memberId,
    name,
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder || 'desc',
  });
};

// Get a single project
export const getProject = async (id, { userId, role }) => {
  const project = await projectRepo.findById(id);
  if (!project) throw new NotFoundError('Project not found');

  // Managers can only see their own projects
  if (role === 'MANAGER' && project.ownerId !== userId) {
    throw new ForbiddenError('You do not have access to this project');
  }

  return project;
};

// Create a new project — only admin and manager
export const createProject = async (data, userId) => {
  return projectRepo.create({ ...data, ownerId: userId });
};

// Update a project
export const updateProject = async (id, data, { userId, role }) => {
  const project = await projectRepo.findById(id);
  if (!project) throw new NotFoundError('Project not found');

  // Only admin or the project owner can update
  if (role !== 'ADMIN' && project.ownerId !== userId) {
    throw new ForbiddenError('You can only update your own projects');
  }

  return projectRepo.update(id, data);
};

// Delete a project (soft delete)
export const deleteProject = async (id, { userId, role }) => {
  const project = await projectRepo.findById(id);
  if (!project) throw new NotFoundError('Project not found');

  if (role !== 'ADMIN' && project.ownerId !== userId) {
    throw new ForbiddenError('You can only delete your own projects');
  }

  return projectRepo.softDelete(id);
};
