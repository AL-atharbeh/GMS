import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── Get Branches ───────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const branches = await prisma.branch.findMany({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: branches });
});

export default router;
