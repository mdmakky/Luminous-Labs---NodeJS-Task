import { ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

// Validates request body/query/params against a zod schema
// Usage: router.post('/users', validate(createUserSchema), controller)
const validate = (schema) => {
  return (req, _res, next) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
};

export default validate;
