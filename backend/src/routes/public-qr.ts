import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validateQrToken } from '../services/qr.service';

const router = Router();

const qrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many QR validation requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const qrParamsSchema = z.object({
  tokenPrefix: z.string().regex(/^[a-z0-9_-]{4,32}$/i, 'Invalid QR code.'),
});

// ─── GET /api/public/qr/validate/:tokenPrefix ───────────

router.get('/qr/validate/:tokenPrefix', qrLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = qrParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const result = await validateQrToken(parsed.data.tokenPrefix);
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ success: true, data: result });
  } catch {
    return res.status(500).json({ error: 'Failed to validate QR code.' });
  }
});

export default router;
