import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: result.error.errors.map((e) => ({
          field: e.path.slice(1).join('.'),
          message: e.message,
        })),
      });
    }

    // Merge validated data back
    if (result.data.body) req.body = result.data.body;
    if (result.data.params) req.params = result.data.params as any;
    if (result.data.query) req.query = result.data.query as any;

    next();
  };
};
