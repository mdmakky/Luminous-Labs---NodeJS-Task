import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

// Middleware to verify JWT and attach user info to req.user
const authenticate = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('No token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { userId, email, role }
    next();
  } catch (_error) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export default authenticate;
