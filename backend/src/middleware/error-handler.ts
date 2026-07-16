import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';
import logger from '../logging/logger';

/**
 * Sanitize Prisma errors to avoid exposing internal details.
 * Uses err.name for robustness (preserved during minification).
 */
function sanitizeError(err: unknown): { message: string; statusCode: number } {
  if (!(err instanceof Error)) {
    return { message: 'Internal server error', statusCode: 500 };
  }

  const errorName = err.name || '';
  const message = err.message || '';

  // Prisma known request errors
  if (errorName.startsWith('Prisma')) {
    if (message.includes('Unique constraint')) {
      return { message: 'A record with this value already exists.', statusCode: 409 };
    }
    if (message.includes('Foreign key constraint')) {
      return { message: 'Referenced record not found.', statusCode: 400 };
    }
    if (message.includes('Record to update not found') || message.includes('Record to delete not found')) {
      return { message: 'Record not found.', statusCode: 404 };
    }
    return { message: 'Database error.', statusCode: 500 };
  }

  // JSON parse errors (invalid request body)
  if (err instanceof SyntaxError && 'body' in err) {
    return { message: 'Invalid request body.', statusCode: 400 };
  }

  return { message: 'Internal server error', statusCode: 500 };
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const correlationId = req.correlationId || 'unknown';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      requestId: correlationId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  const sanitized = sanitizeError(err);

  logger.error({ err, requestId: correlationId }, `Unhandled error: ${sanitized.message}`);

  res.status(sanitized.statusCode).json({
    success: false,
    message: sanitized.message,
    requestId: correlationId,
    ...(process.env.NODE_ENV === 'development' && { stack: err instanceof Error ? err.stack : undefined }),
  });
};
