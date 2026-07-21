import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import {
  createPublicOrder,
  trackOrder,
  requestCancellation,
  createPublicReservation,
} from '../services/public-order.service';

const router = Router();

const publicOrderSchema = z.object({
  orderType: z.enum(['PICKUP', 'DELIVERY', 'DINE_IN']),
  customerName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
    instructions: z.string().trim().max(300).optional().or(z.literal('')),
  })).min(1).max(50),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  promotionCode: z.string().trim().max(50).optional().or(z.literal('')),
  requestedPickupTime: z.string().trim().max(40).optional().or(z.literal('')),
  deliveryZoneId: z.string().uuid().optional().or(z.literal('')),
  deliveryAddress: z.object({
    addressLine1: z.string().trim().min(1).max(200),
    addressLine2: z.string().trim().max(200).optional().or(z.literal('')),
    neighbourhood: z.string().trim().max(100).optional().or(z.literal('')),
    city: z.string().trim().min(1).max(100),
  }).optional(),
  deliveryInstructions: z.string().trim().max(300).optional().or(z.literal('')),
  tableId: z.string().uuid().optional().or(z.literal('')),
});

const publicReservationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().trim().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(100),
  occasion: z.string().trim().max(100).optional().or(z.literal('')),
  specialRequests: z.string().trim().max(500).optional().or(z.literal('')),
});

const trackQuerySchema = z.object({
  reference: z.string().trim().min(1).max(80),
  token: z.string().trim().regex(/^[a-f0-9]{48}$/i).optional(),
});

const cancelParamsSchema = z.object({
  publicReference: z.string().trim().min(1).max(80),
});

const cancelQuerySchema = z.object({
  token: z.string().trim().regex(/^[a-f0-9]{48}$/i).optional(),
});

const cancelBodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

// Stricter rate limiter for order creation
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many orders. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const reservationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many reservation requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/public/orders ─────────────────────────────

router.post('/orders', orderLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = publicOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const result = await createPublicOrder(parsed.data as any);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json({ data: result });
  } catch {
    return res.status(500).json({ error: 'Failed to create order.' });
  }
});

// ─── GET /api/public/orders/track ───────────────────────

router.get('/orders/track', async (req: Request, res: Response) => {
  try {
    const parsed = trackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const result = await trackOrder(parsed.data.reference, parsed.data.token);
    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }
    return res.json({ data: result });
  } catch {
    return res.status(500).json({ error: 'Failed to track order.' });
  }
});

// ─── POST /api/public/orders/:publicReference/cancel-request ──

router.post('/orders/:publicReference/cancel-request', async (req: Request, res: Response) => {
  try {
    const params = cancelParamsSchema.safeParse(req.params);
    const query = cancelQuerySchema.safeParse(req.query);
    const body = cancelBodySchema.safeParse(req.body);
    if (!params.success || !query.success || !body.success) {
      return res.status(400).json({ error: 'Invalid cancellation request.' });
    }

    const result = await requestCancellation(params.data.publicReference, body.data.reason, query.data.token);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ data: result });
  } catch {
    return res.status(500).json({ error: 'Failed to request cancellation.' });
  }
});

// ─── POST /api/public/reservations ───────────────────────

router.post('/reservations', reservationLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = publicReservationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const result = await createPublicReservation(parsed.data);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json({ data: result });
  } catch {
    return res.status(500).json({ error: 'Failed to create reservation.' });
  }
});

export default router;
