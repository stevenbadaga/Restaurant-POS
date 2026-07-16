/* eslint-disable @typescript-eslint/no-namespace */
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Attach a unique correlation ID to every request.
 * This ID is returned in the response header and logged with every log entry,
 * enabling tracing of a single request across the system.
 *
 * Uses Node.js built-in crypto.randomUUID() (available since Node.js 19).
 */

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
}
