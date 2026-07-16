import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import * as authService from '../services/auth.service';
import { BadRequestError } from '../types';

const router = Router();

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many setup attempts' },
});

const initializeSchema = z.object({
  restaurantName: z.string().min(2, 'Restaurant name must be at least 2 characters'),
  restaurantEmail: z.string().email().optional().or(z.literal('')),
  restaurantPhone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  currency: z.string().default('RWF'),
  timezone: z.string().default('Africa/Kigali'),
  firstName: z.string().min(1, 'First name required'),
  lastName: z.string().min(1, 'Last name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'At least one uppercase letter')
    .regex(/[a-z]/, 'At least one lowercase letter')
    .regex(/[0-9]/, 'At least one number')
    .regex(/[^A-Za-z0-9]/, 'At least one special character'),
  passwordConfirmation: z.string(),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: 'Passwords do not match',
  path: ['passwordConfirmation'],
});

// GET /api/setup/status
router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await authService.checkSetupStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

// POST /api/setup/initialize
router.post('/initialize', setupLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = initializeSchema.parse(req.body);

    const result = await authService.setupRestaurant({
      restaurantName: parsed.restaurantName,
      restaurantEmail: parsed.restaurantEmail,
      restaurantPhone: parsed.restaurantPhone,
      address: parsed.address,
      currency: parsed.currency,
      timezone: parsed.timezone,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      phone: parsed.phone,
      password: parsed.password,
    });

    authService.setAuthCookies(res, result.tokens);

    res.status(201).json({
      success: true,
      message: 'Restaurant and administrator created successfully',
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

export default router;
