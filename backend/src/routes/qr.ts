import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import {
  generateQrToken,
  listQrTokens,
  getTokenById,
  rotateQrToken,
  revokeQrToken,
  validateQrToken,
} from '../services/qr.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

// ─── GET /api/tables/qr-codes ───────────────────────────

router.get('/qr-codes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tokens = await listQrTokens(req.user!.restaurantId);
    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/tables/qr-codes/:id ───────────────────────

router.get('/qr-codes/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getTokenById(req.params.id, req.user!.restaurantId);
    if ('error' in result) throw new NotFoundError(result.error);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/tables/:tableId/qr-token ─────────────────

router.post('/:tableId/qr-token', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const clientUrl = process.env.CLIENT_URL || baseUrl;

    const result = await generateQrToken(req.user!.restaurantId, req.params.tableId, clientUrl);
    if ('error' in result) throw new BadRequestError(result.error);

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'QR_TOKEN_GENERATED',
      entityType: 'TABLE_QR_TOKEN',
      description: `Generated QR token for table ${req.params.tableId}`,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/tables/qr-tokens/:id/rotate ──────────────

router.post('/qr-tokens/:id/rotate', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const clientUrl = process.env.CLIENT_URL || baseUrl;

    const result = await rotateQrToken(req.params.id, req.user!.restaurantId, clientUrl);
    if ('error' in result) throw new BadRequestError(result.error);

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'QR_TOKEN_ROTATED',
      entityType: 'TABLE_QR_TOKEN',
      description: `Rotated QR token ${req.params.id}`,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/tables/qr-tokens/:id/revoke ──────────────

router.post('/qr-tokens/:id/revoke', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await revokeQrToken(req.params.id, req.user!.restaurantId);
    if ('error' in result) throw new BadRequestError(result.error);

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'QR_TOKEN_REVOKED',
      entityType: 'TABLE_QR_TOKEN',
      description: `Revoked QR token ${req.params.id}`,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
