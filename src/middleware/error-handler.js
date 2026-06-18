import { AppError, ValidationError } from '../utils/errors.js';

// Centralized error handler — catches all errors passed via next(error)
const errorHandler = (err, _req, res, _next) => {
  // Log unexpected errors in development
  if (process.env.NODE_ENV === 'development' && !(err instanceof AppError)) {
    console.error('Unexpected Error:', err);
  }

  // Handle known application errors
  if (err instanceof AppError) {
    const response = {
      success: false,
      data: null,
      error: {
        message: err.message,
      },
    };

    // Add field-level errors for validation failures
    if (err instanceof ValidationError && err.errors.length > 0) {
      response.error.errors = err.errors;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle unknown/unexpected errors
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  return res.status(500).json({
    success: false,
    data: null,
    error: { message },
  });
};

export default errorHandler;
