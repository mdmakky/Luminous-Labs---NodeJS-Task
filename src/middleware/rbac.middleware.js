import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

// Check that the logged-in user has one of the allowed roles
// Usage: requireRole('ADMIN', 'MANAGER')
export const requireRole = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to perform this action'));
    }
    next();
  };
};

// Block members from creating tasks (only ADMIN and MANAGER can create)
export const requireCanCreateTask = (req, _res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Not authenticated'));
  }
  if (req.user.role === 'MEMBER') {
    return next(new ForbiddenError('Members are not allowed to create tasks'));
  }
  next();
};

// Block members from deleting tasks
export const requireCanDeleteTask = (req, _res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Not authenticated'));
  }
  if (req.user.role === 'MEMBER') {
    return next(new ForbiddenError('Members are not allowed to delete tasks'));
  }
  next();
};

// Block members from managing projects
export const requireCanManageProject = (req, _res, next) => {
  if (!req.user) {
    return next(new UnauthorizedError('Not authenticated'));
  }
  if (req.user.role === 'MEMBER') {
    return next(new ForbiddenError('Members are not allowed to manage projects'));
  }
  next();
};
