import * as commentService from '../services/comment.service.js';
import { sendSuccess } from '../utils/response.js';
import asyncHandler from '../middleware/async-handler.js';

// GET /api/v1/tasks/:taskId/comments
export const listComments = asyncHandler(async (req, res) => {
  const comments = await commentService.listComments(req.params.taskId, req.user);
  sendSuccess(res, comments);
});

// POST /api/v1/tasks/:taskId/comments
export const createComment = asyncHandler(async (req, res) => {
  const comment = await commentService.createComment(req.params.taskId, req.body.content, req.user);
  sendSuccess(res, comment, 201);
});

// PATCH /api/v1/tasks/:taskId/comments/:id
export const updateComment = asyncHandler(async (req, res) => {
  const comment = await commentService.updateComment(req.params.id, req.body.content, req.user);
  sendSuccess(res, comment);
});

// DELETE /api/v1/tasks/:taskId/comments/:id
export const deleteComment = asyncHandler(async (req, res) => {
  await commentService.deleteComment(req.params.id, req.user);
  sendSuccess(res, { message: 'Comment deleted successfully' });
});
