import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import * as authService from '../services/auth.service';
import { BadRequestError } from '../types';

const router = Router();

const REFRESH_COOKIE = 'restaurant_pos_refresh';

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[A-Z]/, 'At least one uppercase letter')
    .regex(/[a-z]/, 'At least one lowercase letter')
    .regex(/[0-9]/, 'At least one number')
    .regex(/[^A-Za-z0-9]/, 'At least one special character'),
  newPasswordConfirmation: z.string(),
}).refine((data) => data.newPassword === data.newPasswordConfirmation, {
  message: 'Passwords do not match',
  path: ['newPasswordConfirmation'],
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(parsed.email, parsed.password, ipAddress, userAgent);
    authService.setAuthCookies(res, result.tokens);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        restaurant: result.restaurant,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new BadRequestError(error.errors[0].message));
    } else {
      next(error);
    }
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.refreshToken(rawRefreshToken, ipAddress, userAgent);
    authService.setAuthCookies(res, result.tokens);

    res.json({
      success: true,
      message: 'Token refreshed',
      data: {
        user: result.user,
        restaurant: result.restaurant,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE];
    const userId = req.user?.id;
    const restaurantId = req.user?.restaurantId;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    if (userId && restaurantId) {
      await authService.logout(rawRefreshToken, userId, restaurantId, userAgent, ipAddress);
    }

    authService.clearAuthCookies(res);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout-all
router.post('/logout-all', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const restaurantId = req.user!.restaurantId;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    await authService.logoutAll(userId, restaurantId, userAgent, ipAddress);
    authService.clearAuthCookies(res);

    res.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = await authService.getCurrentUser(req.user!.id);
    res.json({ success: true, data: userData });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SESSION MANAGEMENT
// ==========================================

function getCurrentTokenHash(req: Request): string {
  const rawRefreshToken = req.cookies?.['restaurant_pos_refresh'];
  if (!rawRefreshToken) return '';
  return crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
}

// GET /api/auth/sessions
router.get('/sessions', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await authService.listSessions(req.user!.id, getCurrentTokenHash(req));
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/sessions/revoke-others — MUST be before /sessions/:id to avoid :id matching 'revoke-others'
router.post('/sessions/revoke-others', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    await authService.revokeOtherSessions(
      req.user!.id,
      req.user!.restaurantId,
      getCurrentTokenHash(req),
      userAgent,
      ipAddress
    );
    res.json({ success: true, message: 'Other sessions revoked' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/sessions/:id
router.delete('/sessions/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    await authService.revokeSession(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId,
      userAgent,
      ipAddress
    );
    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = changePasswordSchema.parse(req.body);
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    await authService.changePassword(
      req.user!.id,
      req.user!.restaurantId,
      parsed.currentPassword,
      parsed.newPassword,
      ipAddress,
      userAgent
    );

    authService.clearAuthCookies(res);

    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new BadRequestError(error.errors[0].message));
    } else {
      next(error);
    }
  }
});

export default router;
