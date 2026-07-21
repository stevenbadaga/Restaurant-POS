import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { allowedOrigins, env } from '../config';
import { ForbiddenError } from '../types/app-error';

/**
 * CSRF protection using double-submit cookie pattern.
 * The server issues a CSRF token via a dedicated endpoint,
 * and the client sends it back in a custom header for
 * state-changing requests.
 */

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_MAX_AGE_MS = 60 * 60 * 1000;

// Safe methods that don't require CSRF validation
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Generate a CSRF token.
 */
export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now().toString();
  const payload = `${timestamp}.${nonce}`;
  const signature = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function verifyCsrfToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestamp, nonce, signature] = parts;
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > CSRF_MAX_AGE_MS || issuedAt > Date.now() + 60_000) {
    return false;
  }

  const expected = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${timestamp}.${nonce}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
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
    maxAge: CSRF_MAX_AGE_MS,
    domain: env.COOKIE_DOMAIN || undefined,
  });
  res.json({ success: true, token });
}

const CSRF_EXCLUDED_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/security/csrf-token',
  '/api/setup',
  '/api/health',
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

  if (!cookieToken || !headerToken || cookieToken !== headerToken || !verifyCsrfToken(headerToken)) {
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
