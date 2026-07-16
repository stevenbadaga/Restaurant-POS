import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config';
import { ForbiddenError } from '../types/app-error';

/**
 * CSRF protection using double-submit cookie pattern.
 * The server issues a CSRF token via a dedicated endpoint,
 * and the client sends it back in a custom header for
 * state-changing requests.
 */

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

// Safe methods that don't require CSRF validation
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Generate a CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF token endpoint — issues a fresh token cookie.
 */
export function csrfTokenHandler(_req: Request, res: Response): void {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,   // Must be readable by client JS
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
  });
  res.json({ success: true, token });
}

/**
 * CSRF validation middleware.
 * Requires the CSRF token cookie to match the x-csrf-token header
 * for all state-changing HTTP methods.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Skip CSRF for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    next(new ForbiddenError('Invalid or missing CSRF token'));
    return;
  }

  next();
}

/**
 * Validate Origin header to prevent cross-origin attacks.
 * In production, all requests should come from allowed origins.
 */
export function originValidation(req: Request, _res: Response, next: NextFunction): void {
  if (env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  // For same-origin requests without Origin header
  if (!origin && !referer) {
    next();
    return;
  }

  const allowedOrigins = env.CLIENT_URL.split(',').map((s: string) => s.trim());

  const requestOrigin = origin || referer;
  if (requestOrigin) {
    const isAllowed = allowedOrigins.some((allowed: string) => requestOrigin.startsWith(allowed));
    if (!isAllowed) {
      next(new ForbiddenError('Request from unauthorized origin'));
      return;
    }
  }

  next();
}
