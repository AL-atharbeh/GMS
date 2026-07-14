import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.use(authorize('GARAGE_OWNER'));

// ─── Get Current Tenant Settings ─────────────────────────────────────────────
router.get('/current', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      branches: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!tenant) {
    throw new AppError('Tenant not found', 404);
  }

  res.json({ success: true, data: tenant });
});

// ─── Update Tenant Settings ──────────────────────────────────────────────────
const updateSettingsSchema = z.object({
  body: z.object({
    nameAr: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    logo: z.string().optional().nullable(),
    settings: z.any().optional(),
    vatNumber: z.string().optional().nullable(),
    vatRate: z.number().min(0).max(100).optional(),
    timezone: z.string().optional(),
    country: z.string().optional(),
    currency: z.string().optional(),
  }),
});

router.put('/settings', validate(updateSettingsSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { nameAr, phone, logo, settings, vatNumber, vatRate, timezone, country, currency } = req.body;

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(nameAr !== undefined && { nameAr }),
      ...(phone !== undefined && { phone }),
      ...(logo !== undefined && { logo }),
      ...(settings !== undefined && { settings }),
      ...(vatNumber !== undefined && { vatNumber }),
      ...(vatRate !== undefined && { vatRate }),
      ...(timezone !== undefined && { timezone }),
      ...(country !== undefined && { country }),
      ...(currency !== undefined && { currency }),
    },
  });

  res.json({ success: true, data: updated });
});

// ─── Create Branch ───────────────────────────────────────────────────────────
const createBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    nameAr: z.string().min(2).optional(),
    address: z.string().optional().nullable(),
    addressAr: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    dailyCapacity: z.number().min(1).optional(),
    workingHours: z.any().optional(),
  }),
});

router.post('/branches', validate(createBranchSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { name, nameAr, address, addressAr, phone, email, dailyCapacity, workingHours } = req.body;

  const branch = await prisma.branch.create({
    data: {
      tenantId,
      name,
      nameAr: nameAr || null,
      address: address || null,
      addressAr: addressAr || null,
      phone: phone || null,
      email: email || null,
      dailyCapacity: dailyCapacity !== undefined ? dailyCapacity : 10,
      workingHours: workingHours || {},
    },
  });

  res.status(201).json({ success: true, data: branch });
});

// ─── Update Branch ───────────────────────────────────────────────────────────
const updateBranchSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    nameAr: z.string().min(2).optional(),
    address: z.string().optional().nullable(),
    addressAr: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    isActive: z.boolean().optional(),
    dailyCapacity: z.number().min(1).optional(),
    workingHours: z.any().optional(),
  }),
});

router.put('/branches/:branchId', validate(updateBranchSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { branchId } = req.params;
  const { name, nameAr, address, addressAr, phone, email, isActive, dailyCapacity, workingHours } = req.body;

  // Verify branch ownership
  const existingBranch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
  });
  if (!existingBranch) {
    throw new AppError('Branch not found', 404);
  }

  const updated = await prisma.branch.update({
    where: { id: branchId },
    data: {
      ...(name !== undefined && { name }),
      ...(nameAr !== undefined && { nameAr }),
      ...(address !== undefined && { address }),
      ...(addressAr !== undefined && { addressAr }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(isActive !== undefined && { isActive }),
      ...(dailyCapacity !== undefined && { dailyCapacity }),
      ...(workingHours !== undefined && { workingHours }),
    },
  });

  res.json({ success: true, data: updated });
});

export default router;
