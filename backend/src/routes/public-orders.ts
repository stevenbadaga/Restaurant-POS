import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createPublicOrder,
  trackOrder,
  requestCancellation,
  createPublicReservation,
} from '../services/public-order.service';

const router = Router();

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
    const result = await createPublicOrder(req.body);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json({ data: result });
  } catch (error) {
    console.error('Error creating public order:', error);
    return res.status(500).json({ error: 'Failed to create order.' });
  }
});

// ─── GET /api/public/orders/track ───────────────────────

router.get('/orders/track', async (req: Request, res: Response) => {
  try {
    const { reference, token } = req.query;
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ error: 'Order reference is required.' });
    }

    const result = await trackOrder(reference, typeof token === 'string' ? token : undefined);
    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }
    return res.json({ data: result });
  } catch (error) {
    console.error('Error tracking order:', error);
    return res.status(500).json({ error: 'Failed to track order.' });
  }
});

// ─── POST /api/public/orders/:publicReference/cancel-request ──

router.post('/orders/:publicReference/cancel-request', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const { publicReference } = req.params;
    const token = req.query.token as string | undefined;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'Cancellation reason is required.' });
    }

    const result = await requestCancellation(publicReference, reason.trim(), token);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ data: result });
  } catch (error) {
    console.error('Error requesting cancellation:', error);
    return res.status(500).json({ error: 'Failed to request cancellation.' });
  }
});

// ─── POST /api/public/reservations ───────────────────────

router.post('/reservations', reservationLimiter, async (req: Request, res: Response) => {
  try {
    const result = await createPublicReservation(req.body);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json({ data: result });
  } catch (error) {
    console.error('Error creating reservation:', error);
    return res.status(500).json({ error: 'Failed to create reservation.' });
  }
});

export default router;
