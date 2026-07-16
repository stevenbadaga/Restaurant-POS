import { Router, Request, Response} from 'express';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.use(requireAuth);
router.get('/', (_req: Request, res: Response) => { res.json({ success: true, data: [] }); });
router.get('/tickets', (_req: Request, res: Response) => { res.json({ success: true, data: [] }); });
export default router;
