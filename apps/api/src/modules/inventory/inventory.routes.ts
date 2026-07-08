import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// ─── Get All Inventory Parts ────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  
  const parts = await prisma.part.findMany({
    where: { tenantId },
    include: {
      inventory: {
        include: {
          branch: { select: { name: true } },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      },
      suppliers: {
        include: {
          supplier: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({ success: true, data: parts });
});

// ─── Create Part and Initialize Inventory Stock ─────────────────────────────
const createPartSchema = z.object({
  body: z.object({
    partNumber: z.string().min(1),
    name: z.string().min(2),
    nameAr: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    purchasePrice: z.number().positive(),
    sellingPrice: z.number().positive(),
    initialQty: z.number().min(0).default(0),
    minStockLevel: z.number().min(0).default(1),
    unit: z.string().optional(),
    location: z.string().optional(),
    barcode: z.string().optional(),
    vehicleCompatibility: z.array(z.string()).optional(),
    supplierId: z.string().optional(),
  }),
});

router.post('/', validate(createPartSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, branchId, id: userId } = req.user!;
  const {
    partNumber,
    name,
    nameAr,
    category,
    brand,
    purchasePrice,
    sellingPrice,
    initialQty,
    minStockLevel,
    unit,
    location,
    barcode,
    vehicleCompatibility,
    supplierId,
  } = req.body;

  // Ensure branch exists or fallback to the first branch of the tenant
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const firstBranch = await prisma.branch.findFirst({ where: { tenantId } });
    if (!firstBranch) throw new AppError('No branches found for this tenant', 400);
    targetBranchId = firstBranch.id;
  }

  // Check if part number already exists for this tenant
  const existingPart = await prisma.part.findUnique({
    where: {
      tenantId_partNumber: {
        tenantId,
        partNumber,
      },
    },
  });
  if (existingPart) {
    throw new AppError('رقم الصنف (Part Number) مسجل بالفعل في المستودع.', 400);
  }

  const part = await prisma.$transaction(async (tx) => {
    // 1. Create the Part
    const p = await tx.part.create({
      data: {
        tenantId,
        partNumber,
        name,
        nameAr: nameAr || null,
        category: category || null,
        brand: brand || null,
        unit: unit || 'PCS',
        barcode: barcode || null,
        vehicleCompatibility: vehicleCompatibility || [],
        purchasePrice,
        sellingPrice,
      },
    });

    // 2. Initialize stock in the branch
    const inv = await tx.inventory.create({
      data: {
        partId: p.id,
        branchId: targetBranchId!,
        quantity: initialQty,
        availableQty: initialQty,
        minStockLevel,
        location: location || null,
      },
    });

    // 3. Log stock movement transaction (Opening Quantity)
    if (initialQty > 0) {
      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inv.id,
          type: 'IN',
          quantity: initialQty,
          referenceType: 'MANUAL',
          notes: 'رصيد مخزون افتتاحي عند إنشاء الصنف',
          userId,
        },
      });
    }

    // 4. Link supplier if provided
    if (supplierId) {
      await tx.partSupplier.create({
        data: {
          partId: p.id,
          supplierId,
          purchasePrice,
          isPreferred: true,
        },
      });
    }

    return p;
  });

  res.status(201).json({ success: true, data: part });
});

// ─── Adjust Stock Level ─────────────────────────────────────────────────────
const adjustStockSchema = z.object({
  body: z.object({
    quantity: z.number(), // positive to add, negative to withdraw
    notes: z.string().optional(),
  }),
});

router.patch('/:id/stock', validate(adjustStockSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, branchId, id: userId } = req.user!;
  const partId = req.params.id;
  const { quantity, notes } = req.body;

  // Get current inventory record
  const inventory = await prisma.inventory.findFirst({
    where: { partId, branchId },
  });

  if (!inventory) {
    throw new AppError('Inventory record not found in your branch', 404);
  }

  const currentQty = Number(inventory.quantity);
  const newQty = Math.max(0, currentQty + quantity);
  const movementType = quantity >= 0 ? 'IN' : 'OUT';

  const updatedInventory = await prisma.$transaction(async (tx) => {
    // 1. Update stock
    const inv = await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: newQty,
        availableQty: newQty,
      },
    });

    // 2. Create Audit Log Transaction
    await tx.inventoryTransaction.create({
      data: {
        inventoryId: inventory.id,
        type: movementType,
        quantity: Math.abs(quantity),
        referenceType: 'MANUAL',
        notes: notes || (quantity >= 0 ? 'تعديل يدوي - إضافة كمية' : 'تعديل يدوي - سحب كمية'),
        userId,
      },
    });

    return inv;
  });

  res.json({ success: true, data: updatedInventory });
});

export default router;
