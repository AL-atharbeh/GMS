import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);
router.use(authorize('GARAGE_OWNER'));

// ─── Get Audit Logs for Users Management ─────────────────────────────────────
router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId,
      resource: { in: ['user', 'user_role', 'user_status'] },
    },
    include: {
      user: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ success: true, data: logs });
});

// ─── Get All Users ───────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      nameAr: true,
      email: true,
      phone: true,
      avatar: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
      branch: {
        select: {
          id: true,
          name: true,
          nameAr: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: users });
});

// ─── Create User ─────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
    role: z.enum(['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT']),
    branchId: z.string().uuid().optional(),
    avatar: z.string().optional(),
  }),
});

router.post('/', validate(createUserSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { name, email, password, phone, role, branchId, avatar } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  // Check email globally since it's unique on system level
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً في النظام' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      tenantId,
      branchId: branchId || null,
      name,
      email: normalizedEmail,
      passwordHash,
      phone: phone || null,
      role,
      isActive: true,
      avatar: avatar || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  // Log to Audit Logs
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: req.user!.id,
      action: 'CREATE',
      resource: 'user',
      resourceId: newUser.id,
      newData: { name: newUser.name, email: newUser.email, role: newUser.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.status(201).json({ success: true, data: newUser });
});

// ─── Update User Role ────────────────────────────────────────────────────────
const updateRoleSchema = z.object({
  body: z.object({
    role: z.enum(['GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT']),
  }),
});

router.patch('/:userId/role', validate(updateRoleSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { role } = req.body;

  const user = await prisma.user.findFirst({
    where: { id: req.params.userId, tenantId },
  });
  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  // Log to Audit Logs
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'user_role',
      resourceId: user.id,
      oldData: { role: user.role },
      newData: { role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.json({ success: true, data: updated });
});

// ─── Update User Status ──────────────────────────────────────────────────────
const updateStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean(),
  }),
});

router.patch('/:userId/status', validate(updateStatusSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { isActive } = req.body;

  const user = await prisma.user.findFirst({
    where: { id: req.params.userId, tenantId },
  });
  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive },
  });

  // Log to Audit Logs
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'user_status',
      resourceId: user.id,
      oldData: { isActive: user.isActive },
      newData: { isActive },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.json({ success: true, data: updated });
});

// ─── Delete User ─────────────────────────────────────────────────────────────
router.delete('/:userId', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;

  const user = await prisma.user.findFirst({
    where: { id: req.params.userId, tenantId },
  });
  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  // Prevent self deletion
  if (user.id === req.user!.id) {
    return res.status(400).json({ success: false, message: 'لا يمكنك حذف حسابك الحالي' });
  }

  await prisma.user.delete({
    where: { id: user.id },
  });

  // Log to Audit Logs
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: req.user!.id,
      action: 'DELETE',
      resource: 'user',
      resourceId: user.id,
      oldData: { name: user.name, email: user.email, role: user.role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    },
  });

  res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
});

export default router;
