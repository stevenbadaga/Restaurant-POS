import { Router, Request, Response } from 'express';
import { validateQrToken } from '../services/qr.service';

const router = Router();

// ─── GET /api/public/qr/validate/:tokenPrefix ───────────

router.get('/qr/validate/:tokenPrefix', async (req: Request, res: Response) => {
  try {
    const result = await validateQrToken(req.params.tokenPrefix);
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error validating QR token:', error);
    return res.status(500).json({ error: 'Failed to validate QR code.' });
  }
});

export default router;
