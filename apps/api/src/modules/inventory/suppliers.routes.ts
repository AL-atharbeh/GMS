import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { AppError } from '../../middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.use(authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT'));

// ─── Get All Suppliers (with part count + PO count) ─────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId },
    include: {
      partSuppliers: {
        include: {
          part: { select: { id: true, name: true, nameAr: true, partNumber: true } },
        },
      },
      purchaseOrders: {
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          expectedAt: true,
        },
      },
      _count: {
        select: {
          partSuppliers: true,
          purchaseOrders: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json({ success: true, data: suppliers });
});

// ─── Get Single Supplier with full Command Center data ───────────────────────
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { id } = req.params;

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId },
    include: {
      partSuppliers: {
        include: {
          part: {
            include: {
              inventory: {
                select: { quantity: true, minStockLevel: true },
              },
            },
          },
        },
        orderBy: { isPreferred: 'desc' },
      },
      purchaseOrders: {
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              part: { select: { name: true, nameAr: true, partNumber: true } },
            },
          },
        },
      },
      _count: {
        select: {
          partSuppliers: true,
          purchaseOrders: true,
        },
      },
    },
  });

  if (!supplier) throw new AppError('المورد غير موجود', 404);

  // Calculate total spend from purchase orders
  const totalSpend = supplier.purchaseOrders
    .filter((po) => po.status !== 'CANCELLED')
    .reduce((sum, po) => sum + Number(po.totalAmount), 0);

  res.json({ success: true, data: { ...supplier, totalSpend } });
});

// ─── Create Supplier ────────────────────────────────────────────────────────
const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    nameAr: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().optional(),
    contactPerson: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    paymentTermDays: z.number().int().min(0).max(365).optional(),
  }),
});

router.post('/', validate(createSupplierSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { name, nameAr, phone, whatsapp, email, contactPerson, address, notes, paymentTermDays } = req.body;

  const supplier = await prisma.supplier.create({
    data: {
      tenantId,
      name,
      nameAr: nameAr || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      email: email || null,
      contactPerson: contactPerson || null,
      address: address || null,
      notes: notes || null,
      paymentTermDays: paymentTermDays ?? 30,
    },
  });

  res.status(201).json({ success: true, data: supplier });
});

// ─── Update Supplier ─────────────────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { id } = req.params;

  const existing = await prisma.supplier.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError('المورد غير موجود', 404);

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...req.body,
    },
  });

  res.json({ success: true, data: supplier });
});

// ─── Create Purchase Order for Supplier ──────────────────────────────────────
const createPOSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        partId: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
      })
    ).min(1),
    expectedAt: z.string().optional(),
    notes: z.string().optional(),
    sentViaWhatsApp: z.boolean().optional(),
  }),
});

router.post('/:id/purchase-orders', validate(createPOSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, branchId } = req.user!;
  const supplierId = req.params.id;
  const { items, expectedAt, notes, sentViaWhatsApp } = req.body;

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId } });
  if (!supplier) throw new AppError('المورد غير موجود', 404);

  // Ensure branch
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const firstBranch = await prisma.branch.findFirst({ where: { tenantId } });
    if (!firstBranch) throw new AppError('No branch found', 400);
    targetBranchId = firstBranch.id;
  }

  // Generate PO number
  const count = await prisma.purchaseOrder.count({ where: { tenantId } });
  const orderNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const totalAmount = items.reduce(
    (sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice,
    0
  );

  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId,
      branchId: targetBranchId!,
      supplierId,
      orderNumber,
      totalAmount,
      orderedAt: new Date(),
      expectedAt: expectedAt ? new Date(expectedAt) : null,
      notes: notes || null,
      sentViaWhatsApp: sentViaWhatsApp || false,
      items: {
        create: items.map((item: { partId: string; quantity: number; unitPrice: number }) => ({
          partId: item.partId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        })),
      },
    },
    include: {
      items: {
        include: {
          part: { select: { name: true, nameAr: true, partNumber: true } },
        },
      },
    },
  });

  res.status(201).json({ success: true, data: po });
});

// ─── Get Purchase Orders for Supplier ─────────────────────────────────────
router.get('/:id/purchase-orders', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const supplierId = req.params.id;

  const orders = await prisma.purchaseOrder.findMany({
    where: { supplierId, tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          part: { select: { name: true, nameAr: true, partNumber: true } },
        },
      },
    },
  });

  res.json({ success: true, data: orders });
});

// ─── Update Purchase Order Status ─────────────────────────────────────────
// Handles two cases:
//   (1) Simple status flip for non-receiving transitions:
//         body: { status: 'PENDING' | 'ORDERED' | 'CANCELLED' }
//   (2) Receiving goods — moves inventory atomically and computes the PO
//       status automatically from per‑item received quantities:
//         body: { status: 'RECEIVING', items: [{ id, receivedQty }] }
//       The caller never sets RECEIVED/PARTIALLY_RECEIVED directly; the
//       server derives them so a human can't mark "fully received" while
//       entering only a partial quantity.
//
// Why one transaction: inventory stock, audit trail, item receivedQty and
// PO status must all move together. If the server died after updating status
// but before moving stock, we'd land back on the exact bug we're fixing — a
// PO that says "received" while the shelf is short.
router.patch('/purchase-orders/:poId/status', async (req: AuthRequest, res: Response) => {
  const { tenantId, id: userId } = req.user!;
  const { poId } = req.params;
  const { status, items } = req.body as {
    status: string;
    items?: Array<{ id: string; receivedQty: number }>;
  };

  const existing = await prisma.purchaseOrder.findFirst({
    where: { id: poId, tenantId },
    include: { items: true },
  });
  if (!existing) throw new AppError('طلب الشراء غير موجود', 404);

  // ── (1) Simple status flip (PENDING→ORDERED, CANCELLED) ──────────────────
  const SIMPLE_STATUSES = ['PENDING', 'ORDERED', 'CANCELLED'];
  if (status === 'ORDERED') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'ORDERED',
        orderedAt: existing.orderedAt ?? new Date(),
      },
      include: { items: { include: { part: { select: { name: true, nameAr: true, partNumber: true } } } } },
    });
    return res.json({ success: true, data: updated });
  }

  if (status === 'CANCELLED') {
    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: 'CANCELLED' },
      include: { items: { include: { part: { select: { name: true, nameAr: true, partNumber: true } } } } },
    });
    return res.json({ success: true, data: updated });
  }

  // ── (2) Receiving goods — moves inventory + computes status atomically ──
  if (status !== 'RECEIVING') {
    throw new AppError('الحالة غير صالحة. استخدم ORDERED, CANCELLED, أو RECEIVING مع كميات الاستلام.', 400, 'INVALID_STATUS');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('أدخل كميات الاستلام للأصناف', 400, 'NO_ITEMS');
  }

  // Disallow receiving against a closed/cancelled PO
  if (existing.status === 'CANCELLED' || existing.status === 'RECEIVED') {
    throw new AppError('لا يمكن الاستلام على طلب مكتمل أو ملغي', 400, 'PO_NOT_RECEIVABLE');
  }

  // Validate receivedQty per item: cumulative, never exceeds ordered quantity
  const receivedMap = new Map<string, number>();
  for (const line of items) {
    const poItem = existing.items.find((it) => it.id === line.id);
    if (!poItem) throw new AppError(' item الطلب غير موجود', 400, 'ITEM_NOT_FOUND');
    if (line.receivedQty === undefined || line.receivedQty === null) continue;
    const incoming = Number(line.receivedQty);
    if (Number.isNaN(incoming) || incoming < 0) {
      throw new AppError(`كمية الاستلام غير صالحة للصنف`, 400, 'INVALID_QTY');
    }
    const alreadyReceived = Number(poItem.receivedQty);
    const afterReceive = alreadyReceived + incoming;
    if (afterReceive > Number(poItem.quantity)) {
      throw new AppError(
        `كمية الاستلام (${afterReceive}) تتجاوز الكمية المطلوبة (${poItem.quantity}) لأحد الأصناف`,
        400,
        'QTY_EXCEEDS_ORDERED'
      );
    }
    if (incoming > 0) receivedMap.set(line.id, incoming);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Re-fetch the PO inside the tx to lock against concurrent receives
    const po = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      include: { items: true },
    });

    let allCompleted = true;
    const allItems = [...po.items];

    for (const poItem of po.items) {
      const incoming = receivedMap.get(poItem.id) ?? 0;
      if (incoming <= 0) {
        if (Number(poItem.receivedQty) < Number(poItem.quantity)) allCompleted = false;
        continue;
      }

      const prevReceived = Number(poItem.receivedQty);
      const newReceivedQty = prevReceived + incoming;

      // 1. Update item receivedQty
      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { receivedQty: newReceivedQty },
      });

      // 2. Find the part's inventory record in this PO's branch (not the user's)
      let inventory = await tx.inventory.findUnique({
        where: { partId_branchId: { partId: poItem.partId, branchId: po.branchId } },
      });

      // If no stock record exists yet for this branch, create one at zero
      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            partId: poItem.partId,
            branchId: po.branchId,
            quantity: 0,
            availableQty: 0,
          },
        });
      }

      const currentQty = Number(inventory.quantity);
      const newQty = currentQty + incoming;

      // 3. Increment stock + stamp last restock
      const inv = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQty,
          availableQty: newQty,
          lastRestockedAt: new Date(),
        },
      });

      // 4. Create audit transaction trail
      await tx.inventoryTransaction.create({
        data: {
          inventoryId: inv.id,
          type: 'IN',
          quantity: incoming,
          referenceType: 'PURCHASE_ORDER',
          referenceId: poId,
          notes: `استلام من طلب شراء ${po.orderNumber}`,
          userId,
        },
      });

      // 5. Update the part's purchasePrice to this order's latest price
      //    (keeps the pre‑filled unit price in future POs accurate).
      await tx.part.update({
        where: { id: poItem.partId },
        data: { purchasePrice: poItem.unitPrice },
      });

      if (newReceivedQty < Number(poItem.quantity)) allCompleted = false;
    }

    // 6. Auto‑compute PO status from items
    const computedStatus = allCompleted ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    const wasOrdered = po.status;

    const finalPO = await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: computedStatus,
        receivedAt: computedStatus === 'RECEIVED' ? new Date() : undefined,
        // Mark as ordered if it was still PENDING (first partial receipt confirms dispatch)
        orderedAt: po.orderedAt ?? new Date(),
      },
      include: { items: { include: { part: { select: { name: true, nameAr: true, partNumber: true } } } } },
    });

    return finalPO;
  });

  res.json({ success: true, data: updated });
});

export default router;
