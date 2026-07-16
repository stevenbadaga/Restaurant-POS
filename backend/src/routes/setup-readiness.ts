import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { getSetupReadiness } from '../services/readiness.service';
import { createAuditLog } from '../services/audit.service';

const router = Router();

router.use(requireAuth);

// GET /api/setup/readiness
router.get(
  '/readiness',
  requireRole('ADMIN', 'MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await getSetupReadiness(req.user!.restaurantId);

      await createAuditLog({
        restaurantId: req.user!.restaurantId,
        userId: req.user!.id,
        action: 'SETUP_READINESS_CHECKED',
        entityType: 'SETUP_READINESS',
        description: `Setup readiness reviewed: ${result.completionPercentage}% complete, ${result.criticalIssues} critical issue(s)`,
        metadata: {
          completionPercentage: result.completionPercentage,
          criticalIssues: result.criticalIssues,
          warnings: result.warnings,
        },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
