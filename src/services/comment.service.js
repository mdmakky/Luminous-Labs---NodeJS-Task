import * as commentRepo from '../repositories/comment.repository.js';
import * as taskService from './task.service.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

// List all comments on a task
export const listComments = async (taskId, user) => {
  // Verify task exists and user has access to it
  await taskService.getTask(taskId, user);
  return commentRepo.findByTaskId(taskId);
};

// Create a comment
export const createComment = async (taskId, content, user) => {
  // Verify task exists and user has access to it
  await taskService.getTask(taskId, user);
  return commentRepo.create({ taskId, content, authorId: user.userId });
};

// Update a comment — only the author can edit
export const updateComment = async (id, content, user) => {
  const comment = await commentRepo.findById(id);
  if (!comment) throw new NotFoundError('Comment not found');

  // Verify task access
  await taskService.getTask(comment.taskId, user);

  if (user.role !== 'ADMIN' && comment.authorId !== user.userId) {
    throw new ForbiddenError('You can only edit your own comments');
  }

  return commentRepo.update(id, content);
};

// Delete a comment — author or admin
export const deleteComment = async (id, user) => {
  const comment = await commentRepo.findById(id);
  if (!comment) throw new NotFoundError('Comment not found');

  // Verify task access
  await taskService.getTask(comment.taskId, user);

  if (user.role !== 'ADMIN' && comment.authorId !== user.userId) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  return commentRepo.softDelete(id);
};
