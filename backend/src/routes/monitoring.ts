import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as monitoringService from '../services/monitoring.service';

const router = Router();

// ==========================================
// GET /api/monitoring/health - System health overview
// ==========================================
router.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await monitoringService.getSystemHealth();
    res.json({ success: true, data: health });
  } catch (error) { next(error); }
});

// ==========================================
// GET /api/monitoring/database - Database stats (admin only)
// ==========================================
router.get('/database', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await monitoringService.getDatabaseStats();
    res.json({ success: true, data: stats });
  } catch (error) { next(error); }
});

// ==========================================
// GET /api/monitoring/socketio - Socket.IO status (admin only)
// ==========================================
router.get('/socketio', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = monitoringService.getSocketIOStatus();
    res.json({ success: true, data: status });
  } catch (error) { next(error); }
});

// ==========================================
// GET /api/monitoring/metrics - Metrics overview
// ==========================================
router.get('/metrics', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
    const overview = await monitoringService.getMetricsOverview(req.user?.restaurantId, hours);
    res.json({ success: true, data: overview });
  } catch (error) { next(error); }
});

// ==========================================
// GET /api/monitoring/dashboard - Full dashboard overview
// ==========================================
router.get('/dashboard', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [health, dbStats, socketStatus, metrics] = await Promise.all([
      monitoringService.getSystemHealth(),
      monitoringService.getDatabaseStats(),
      monitoringService.getSocketIOStatus(),
      monitoringService.getMetricsOverview(req.user!.restaurantId, 24),
    ]);

    res.json({
      success: true,
      data: { health, database: dbStats, socketio: socketStatus, metrics },
    });
  } catch (error) { next(error); }
});

export default router;
