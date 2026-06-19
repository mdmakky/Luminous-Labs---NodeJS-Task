import * as commentService from '../services/comment.service.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import asyncHandler from '../middleware/async-handler.js';

// GET /api/v1/tasks/:taskId/comments
export const listComments = asyncHandler(async (req, res) => {
  const { page, limit, sortBy, sortOrder } = req.query;
  const parsedPage = parseInt(page) || 1;
  const parsedLimit = parseInt(limit) || 10;

  const { comments, totalCount } = await commentService.listComments(
    req.params.taskId,
    {
      page: parsedPage,
      limit: parsedLimit,
      sortBy: sortBy || 'createdAt',
      sortOrder: sortOrder || 'asc',
    },
    req.user,
  );

  sendPaginated(res, comments, {
    totalCount,
    page: parsedPage,
    limit: parsedLimit,
  });
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
