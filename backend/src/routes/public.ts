import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getPublicRestaurantInfo,
  getPublicOpeningHours,
  getPublicMenu,
  getPublicMenuCategories,
  getPublicMenuItem,
  getPublicPromotions,
  getPublicOrderOptions,
  getPublicReservationOptions,
  getDeliveryZones,
} from '../services/public.service';

const router = Router();

// Public rate limiter — generous but protective
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: { error: 'Too many requests. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(publicLimiter);

// ─── GET /api/public/restaurant ──────────────────────────

router.get('/restaurant', async (_req: Request, res: Response) => {
  try {
    const info = await getPublicRestaurantInfo();
    if (!info) {
      return res.status(404).json({ error: 'Restaurant not found or not publicly available.' });
    }
    return res.json({ data: info });
  } catch (error) {
    console.error('Error fetching public restaurant info:', error);
    return res.status(500).json({ error: 'Failed to fetch restaurant information.' });
  }
});

// ─── GET /api/public/opening-hours ───────────────────────

router.get('/opening-hours', async (_req: Request, res: Response) => {
  try {
    const hours = await getPublicOpeningHours();
    if (!hours) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }
    return res.json({ data: hours });
  } catch (error) {
    console.error('Error fetching opening hours:', error);
    return res.status(500).json({ error: 'Failed to fetch opening hours.' });
  }
});

// ─── GET /api/public/menu ────────────────────────────────

router.get('/menu', async (_req: Request, res: Response) => {
  try {
    const menu = await getPublicMenu();
    if (!menu) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }
    return res.json({ data: menu });
  } catch (error) {
    console.error('Error fetching public menu:', error);
    return res.status(500).json({ error: 'Failed to fetch menu.' });
  }
});

// ─── GET /api/public/menu/categories ─────────────────────

router.get('/menu/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await getPublicMenuCategories();
    if (!categories) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }
    return res.json({ data: categories });
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    return res.status(500).json({ error: 'Failed to fetch menu categories.' });
  }
});

// ─── GET /api/public/menu/items/:publicSlug ──────────────

router.get('/menu/items/:publicSlug', async (req: Request, res: Response) => {
  try {
    const item = await getPublicMenuItem(req.params.publicSlug);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }
    return res.json({ data: item });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    return res.status(500).json({ error: 'Failed to fetch menu item.' });
  }
});

// ─── GET /api/public/promotions ──────────────────────────

router.get('/promotions', async (_req: Request, res: Response) => {
  try {
    const promotions = await getPublicPromotions();
    if (!promotions) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }
    return res.json({ data: promotions });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return res.status(500).json({ error: 'Failed to fetch promotions.' });
  }
});

// ─── GET /api/public/order-options ───────────────────────

router.get('/order-options', async (_req: Request, res: Response) => {
  try {
    const options = await getPublicOrderOptions();
    if (!options) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }
    return res.json({ data: options });
  } catch (error) {
    console.error('Error fetching order options:', error);
    return res.status(500).json({ error: 'Failed to fetch order options.' });
  }
});

// ─── GET /api/public/reservation-options ─────────────────

router.get('/reservation-options', async (_req: Request, res: Response) => {
  try {
    const options = await getPublicReservationOptions();
    if (!options) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }
    return res.json({ data: options });
  } catch (error) {
    console.error('Error fetching reservation options:', error);
    return res.status(500).json({ error: 'Failed to fetch reservation options.' });
  }
});

// ─── GET /api/public/delivery-zones ──────────────────────

router.get('/delivery-zones', async (_req: Request, res: Response) => {
  try {
    const zones = await getDeliveryZones();
    if (!zones) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }
    return res.json({ data: zones });
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    return res.status(500).json({ error: 'Failed to fetch delivery zones.' });
  }
});

export default router;
