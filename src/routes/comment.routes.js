import { Router } from 'express';
import * as commentController from '../controllers/comment.controller.js';
import authenticate from '../middleware/auth.middleware.js';
import validate from '../middleware/validation.middleware.js';
import { createCommentSchema, updateCommentSchema } from '../validations/comment.validation.js';

// Must use mergeParams to access :taskId from parent route
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', commentController.listComments);
router.post('/', validate(createCommentSchema), commentController.createComment);
router.patch('/:id', validate(updateCommentSchema), commentController.updateComment);
router.delete('/:id', commentController.deleteComment);

export default router;
