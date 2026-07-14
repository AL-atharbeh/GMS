import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { prisma } from '../../config/database';

const router = Router();
router.use(authenticate);

// ─── Get Tenant In-App Notifications ─────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;

  const notifications = await prisma.inAppNotification.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: notifications });
});

// ─── Mark Single Notification as Read ────────────────────────────────────────
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { id } = req.params;

  const notification = await prisma.inAppNotification.findFirst({
    where: { id, tenantId },
  });

  if (!notification) {
    return res.status(404).json({ success: false, message: 'الإشعار غير موجود أو لا تملك صلاحية الوصول إليه' });
  }

  const updated = await prisma.inAppNotification.update({
    where: { id },
    data: { isRead: true },
  });

  res.json({ success: true, data: updated });
});

// ─── Mark All Notifications as Read ──────────────────────────────────────────
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;

  await prisma.inAppNotification.updateMany({
    where: { tenantId, isRead: false },
    data: { isRead: true },
  });

  res.json({ success: true, message: 'تم تحديد جميع الإشعارات كمقروءة بنجاح' });
});

export default router;
