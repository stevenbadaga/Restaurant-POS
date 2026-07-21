import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import * as auditService from '../services/audit.service';

const router = Router();
router.use(requireAuth);

// ==========================================
// GET /api/audit - Search audit logs
// ==========================================
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await auditService.searchAuditLogs(req.user!.restaurantId, {
      action: req.query.action as string,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      userId: req.query.userId as string,
      severity: req.query.severity as string,
      search: req.query.search as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    });

    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// ==========================================
// GET /api/audit/actions - Get distinct action types
// ==========================================
router.get('/actions', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actions = await auditService.getAuditActions(req.user!.restaurantId);
    res.json({ success: true, data: actions });
  } catch (error) { next(error); }
});

// ==========================================
// GET /api/audit/entity-types - Get distinct entity types
// ==========================================
router.get('/entity-types', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await auditService.getAuditEntityTypes(req.user!.restaurantId);
    res.json({ success: true, data: types });
  } catch (error) { next(error); }
});

// ==========================================
// GET /api/audit/verify - Verify audit trail integrity
// ==========================================
router.get('/verify', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
    const result = await auditService.verifyAuditTrailIntegrity(req.user!.restaurantId, fromDate);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

export default router;
