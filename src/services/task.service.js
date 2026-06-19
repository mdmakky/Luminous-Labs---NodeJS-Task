import * as taskRepo from '../repositories/task.repository.js';
import * as projectRepo from '../repositories/project.repository.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

// List tasks with filters, sorting, pagination — respects RBAC at query level
export const listTasks = async (filters, { userId, role }) => {
  // Members only see their assigned tasks
  if (role === 'MEMBER') {
    filters.assigneeId = userId;
  }

  // Managers only see tasks in their own projects
  if (role === 'MANAGER') {
    filters.projectOwnerId = userId;
  }

  return taskRepo.findAll(filters);
};

// Get a single task
export const getTask = async (id, { userId, role }) => {
  const task = await taskRepo.findById(id);
  if (!task) throw new NotFoundError('Task not found');

  // Member: can only see their assigned tasks
  if (role === 'MEMBER' && task.assigneeId !== userId) {
    throw new ForbiddenError('You can only view tasks assigned to you');
  }

  // Manager: can only see tasks in their own projects
  if (role === 'MANAGER') {
    const project = await projectRepo.findById(task.projectId);
    if (!project || project.ownerId !== userId) {
      throw new ForbiddenError('You can only view tasks in your own projects');
    }
  }

  return task;
};

// Create a task — admin or manager (within their project)
export const createTask = async (data, { userId, role }) => {
  // Managers can only create tasks in their own projects
  if (role === 'MANAGER') {
    const project = await projectRepo.findById(data.projectId);
    if (!project) throw new NotFoundError('Project not found');
    if (project.ownerId !== userId) {
      throw new ForbiddenError('You can only create tasks in your own projects');
    }
  }

  return taskRepo.create({ ...data, creatorId: userId });
};

// Update a task — admin, manager (own project), member (assigned, no reassign)
export const updateTask = async (id, data, { userId, role }) => {
  const task = await taskRepo.findById(id);
  if (!task) throw new NotFoundError('Task not found');

  if (role === 'MEMBER') {
    // Member can only update their own assigned tasks
    if (task.assigneeId !== userId) {
      throw new ForbiddenError('You can only update tasks assigned to you');
    }
    // Member cannot reassign tasks
    if (data.assigneeId !== undefined) {
      throw new ForbiddenError('You are not allowed to reassign tasks');
    }
  }

  if (role === 'MANAGER') {
    const project = await projectRepo.findById(task.projectId);
    if (!project || project.ownerId !== userId) {
      throw new ForbiddenError('You can only update tasks in your own projects');
    }
  }

  // Capture old status for audit trail (done in controller layer)
  const oldStatus = task.status;
  const updatedTask = await taskRepo.update(id, data);

  // Return both for audit logging
  return { updatedTask, oldStatus };
};

// Delete a task — admin or manager (own project only)
export const deleteTask = async (id, { userId, role }) => {
  const task = await taskRepo.findById(id);
  if (!task) throw new NotFoundError('Task not found');

  if (role === 'MANAGER') {
    const project = await projectRepo.findById(task.projectId);
    if (!project || project.ownerId !== userId) {
      throw new ForbiddenError('You can only delete tasks in your own projects');
    }
  }

  return taskRepo.softDelete(id);
};
