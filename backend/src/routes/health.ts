import { Router, Request, Response} from 'express';
import { prisma } from '../database/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import pkg from '../../package.json';

const router = Router();

/**
 * GET /api/health/live
 * Simple liveness check — process is running.
 * Must not perform expensive database queries.
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'restaurant-pos-api',
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/ready
 * Readiness check — database is connected and service is ready to accept traffic.
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Lightweight database connectivity check
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      service: 'restaurant-pos-api',
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'restaurant-pos-api',
      status: 'not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/details
 * Detailed health information — ADMIN only.
 * Provides version, environment, uptime and database status.
 */
router.get('/details', requireAuth, requireRole('ADMIN'), async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbStatus = 'connected';

    // Count migration status
    const migrations = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "_prisma_migrations"
      WHERE "rolled_back_at" IS NULL AND "applied_steps_count" > 0
    `.catch(() => [{ count: 0 }]);

    const migrationCount = Array.isArray(migrations) ? (migrations[0] as any)?.count || 0 : 0;

    res.json({
      success: true,
      details: {
        service: 'restaurant-pos-api',
        version: (pkg as any).version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: dbStatus,
        migrationsApplied: migrationCount,
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

export default router;
