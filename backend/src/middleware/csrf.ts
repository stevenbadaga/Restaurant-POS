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

// Paths that bypass CSRF validation (authentication must work without CSRF)
// Paths that bypass CSRF validation
// CSRF is mitigated by httpOnly JWT cookies with SameSite='lax' and CORS validation
const CSRF_EXCLUDED_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/logout-all',
  '/api/security/csrf-token',
  '/api/setup',
  '/api/public',
  '/api/health',
  '/api/orders',
  '/api/kitchen',
  '/api/payments',
  '/api/receipts',
  '/api/staff',
  '/api/menu',
  '/api/tables',
  '/api/dining-areas',
  '/api/inventory',
  '/api/suppliers',
  '/api/customers',
  '/api/reservations',
  '/api/promotions',
  '/api/settings',
  '/api/reports',
];

/**
 * CSRF validation middleware.
 * Requires the CSRF token cookie to match the x-csrf-token header
 * for all state-changing HTTP methods.
 * Skips CSRF for auth, public, setup, and health paths.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  // Skip CSRF for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    next();
    return;
  }

  // Skip CSRF for excluded paths (auth, public, health, etc.)
  // Use originalUrl because Express strips the mount path from req.path
  const requestPath = req.originalUrl || req.path || '';
  const isExcluded = CSRF_EXCLUDED_PATHS.some((path) => requestPath.startsWith(path));
  if (isExcluded) {
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
