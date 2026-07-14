import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { invoicingService } from './invoicing.service';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();
router.use(authenticate);
router.use(authorize('GARAGE_OWNER', 'ACCOUNTANT'));

// ─── Get All Tenant Invoices ────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: req.user!.tenantId },
    include: {
      customer: { select: { name: true, phone: true } },
      workOrder: { select: { orderNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: invoices });
});

// ─── Get All Tenant Payments ────────────────────────────────────────────────
router.get('/payments/all', async (req: AuthRequest, res: Response) => {
  const payments = await prisma.payment.findMany({
    where: {
      invoice: { tenantId: req.user!.tenantId },
    },
    include: {
      invoice: {
        include: {
          customer: { select: { name: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: payments });
});

// ─── Create Invoice for Work Order ──────────────────────────────────────────
const createInvoiceSchema = z.object({
  body: z.object({
    discountAmount: z.number().min(0).default(0),
    notes: z.string().optional(),
  }),
});

router.post('/work-order/:id', validate(createInvoiceSchema), async (req: AuthRequest, res: Response) => {
  const invoice = await invoicingService.createInvoiceForWorkOrder(
    req.user!.tenantId,
    req.params.id,
    req.body
  );
  res.status(201).json({ success: true, data: invoice });
});

// ─── Create Manual Direct Invoice ───────────────────────────────────────────
const createManualInvoiceSchema = z.object({
  body: z.object({
    customerId: z.string().uuid().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    branchId: z.string().uuid().optional(),
    discountAmount: z.number().min(0).default(0),
    notes: z.string().optional(),
    dueAt: z.string().optional(),
    items: z.array(
      z.object({
        type: z.enum(['LABOR', 'PART']),
        partId: z.string().uuid().optional(),
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
      })
    ).min(1),
  }),
});

router.post('/manual', validate(createManualInvoiceSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, id: userId, branchId: userBranchId } = req.user!;
  const {
    customerId,
    customerName,
    customerPhone,
    branchId,
    discountAmount,
    notes,
    dueAt,
    items,
  } = req.body;

  const { AppError } = await import('../../middleware/errorHandler');

  let targetBranchId = branchId || userBranchId;
  if (!targetBranchId) {
    const firstBranch = await prisma.branch.findFirst({ where: { tenantId } });
    if (!firstBranch) throw new AppError('No branches found', 400);
    targetBranchId = firstBranch.id;
  }

  // 1. Resolve customer
  let finalCustomerId = customerId;
  if (!finalCustomerId && customerPhone) {
    let customer = await prisma.customer.findFirst({ where: { phone: customerPhone, tenantId } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          tenantId,
          name: customerName || 'عميل عام',
          phone: customerPhone,
          type: 'INDIVIDUAL',
        },
      });
    }
    finalCustomerId = customer.id;
  }

  if (!finalCustomerId) {
    let generalCustomer = await prisma.customer.findFirst({ where: { tenantId, phone: '00000000' } });
    if (!generalCustomer) {
      generalCustomer = await prisma.customer.create({
        data: {
          tenantId,
          name: 'عميل عام',
          phone: '00000000',
          type: 'INDIVIDUAL',
        },
      });
    }
    finalCustomerId = generalCustomer.id;
  }

  // 2. Resolve dummy vehicle
  let dummyVehicle = await prisma.vehicle.findFirst({ where: { tenantId, plateNumber: 'DIRECT_SALE' } });
  if (!dummyVehicle) {
    dummyVehicle = await prisma.vehicle.create({
      data: {
        tenantId,
        plateNumber: 'DIRECT_SALE',
        make: 'Direct Sale',
        model: 'مبيعات مباشرة',
        year: new Date().getFullYear(),
        customerVehicle: {
          create: {
            customerId: finalCustomerId,
          },
        },
      },
    });
  }

  // 3. Create Work Order + Items + Invoice inside a transaction
  const resultInvoice = await prisma.$transaction(async (tx) => {
    const woCount = await tx.workOrder.count({ where: { tenantId } });
    const orderNumber = `WO-DIRECT-${new Date().getFullYear()}-${String(woCount + 1).padStart(4, '0')}`;

    const wo = await tx.workOrder.create({
      data: {
        tenantId,
        branchId: targetBranchId,
        customerId: finalCustomerId,
        vehicleId: dummyVehicle.id,
        createdById: userId,
        orderNumber,
        status: 'READY_FOR_DELIVERY',
        internalNotes: notes || 'فاتورة بيع مباشرة يدوية',
      },
    });

    for (const item of items) {
      const totalPrice = item.quantity * item.unitPrice;
      await tx.workOrderItem.create({
        data: {
          workOrderId: wo.id,
          type: item.type,
          partId: item.partId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice,
          isApproved: true,
        },
      });

      // Update stock for parts
      if (item.type === 'PART' && item.partId) {
        const inventory = await tx.inventory.findFirst({
          where: { partId: item.partId, branchId: targetBranchId },
        });

        if (inventory) {
          const newQty = Math.max(0, Number(inventory.quantity) - item.quantity);
          const updatedInv = await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: newQty,
              availableQty: newQty,
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryId: updatedInv.id,
              type: 'OUT',
              quantity: item.quantity,
              referenceType: 'WORK_ORDER',
              referenceId: wo.id,
              notes: `سحب مبيعات مباشرة - فاتورة يدوية`,
              userId,
            },
          });
        }
      }
    }

    const laborCost = items.filter((i: any) => i.type === 'LABOR').reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);
    const partsCost = items.filter((i: any) => i.type === 'PART').reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);
    const subtotal = laborCost + partsCost;
    const taxableAmount = Math.max(0, subtotal - discountAmount);

    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    const taxRate = Number(tenant?.vatRate || 0);
    const taxAmount = taxableAmount * (taxRate / 100);
    const total = taxableAmount + taxAmount;

    const invCount = await tx.invoice.count({ where: { tenantId } });
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        workOrderId: wo.id,
        customerId: finalCustomerId,
        invoiceNumber,
        status: 'PENDING',
        subtotal,
        discountAmount,
        taxableAmount,
        taxRate,
        taxAmount,
        total,
        paidAmount: 0,
        remainingAmount: total,
        currency: tenant?.currency || 'KWD',
        notes: notes || '',
        dueAt: dueAt ? new Date(dueAt) : null,
      },
    });

    return invoice;
  });

  res.status(201).json({ success: true, data: resultInvoice });
});

// ─── Get Invoice by Work Order ID ───────────────────────────────────────────
router.get('/work-order/:id', async (req: AuthRequest, res: Response) => {
  const invoice = await invoicingService.getInvoiceByWorkOrder(
    req.user!.tenantId,
    req.params.id
  );
  if (!invoice) {
    return res.status(404).json({ success: false, message: 'Invoice not found for this work order' });
  }
  res.json({ success: true, data: invoice });
});

// ─── Record Payment for Invoice ─────────────────────────────────────────────
const recordPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive(),
    paymentMethod: z.enum(['CASH', 'CARD', 'KNET', 'BANK_TRANSFER', 'LINK']),
    transactionReference: z.string().optional(),
  }),
});

router.post('/:id/payments', validate(recordPaymentSchema), async (req: AuthRequest, res: Response) => {
  const result = await invoicingService.recordPayment(
    req.user!.tenantId,
    req.params.id,
    req.body
  );
  res.json({ success: true, message: 'Payment recorded successfully', data: result });
});

// ─── Record Deposit / Advance Payment (Independent Receipt) ───────────────────
const recordDepositSchema = z.object({
  body: z.object({
    customerId: z.string().uuid().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    amount: z.number().positive(),
    paymentMethod: z.enum(['CASH', 'CARD', 'KNET', 'BANK_TRANSFER', 'LINK']),
    transactionReference: z.string().optional(),
    notes: z.string().optional(),
  }),
});

router.post('/payments/deposit', validate(recordDepositSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, id: userId, name: userName } = req.user!;
  const {
    customerId,
    customerName,
    customerPhone,
    amount,
    paymentMethod,
    transactionReference,
    notes,
  } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Resolve customer
    let finalCustomerId = customerId;
    if (!finalCustomerId && customerPhone) {
      let customer = await tx.customer.findFirst({ where: { phone: customerPhone, tenantId } });
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId,
            name: customerName || 'عميل عام',
            phone: customerPhone,
            type: 'INDIVIDUAL',
          },
        });
      }
      finalCustomerId = customer.id;
    }

    if (!finalCustomerId) {
      let generalCustomer = await tx.customer.findFirst({ where: { tenantId, phone: '00000000' } });
      if (!generalCustomer) {
        generalCustomer = await tx.customer.create({
          data: {
            tenantId,
            name: 'عميل عام',
            phone: '00000000',
            type: 'INDIVIDUAL',
          },
        });
      }
      finalCustomerId = generalCustomer.id;
    }

    // 2. Resolve dummy vehicle
    let dummyVehicle = await tx.vehicle.findFirst({ where: { tenantId, plateNumber: 'DIRECT_SALE' } });
    if (!dummyVehicle) {
      dummyVehicle = await tx.vehicle.create({
        data: {
          tenantId,
          plateNumber: 'DIRECT_SALE',
          make: 'Direct Sale',
          model: 'مبيعات مباشرة',
          year: new Date().getFullYear(),
          customerVehicle: {
            create: {
              customerId: finalCustomerId,
            },
          },
        },
      });
    }

    // 3. Create dummy work order for prepayment
    const woCount = await tx.workOrder.count({ where: { tenantId } });
    const orderNumber = `WO-DEP-${new Date().getFullYear()}-${String(woCount + 1).padStart(4, '0')}`;
    const firstBranch = await tx.branch.findFirst({ where: { tenantId } });
    if (!firstBranch) throw new Error('No branch found');

    const wo = await tx.workOrder.create({
      data: {
        tenantId,
        branchId: firstBranch.id,
        customerId: finalCustomerId,
        vehicleId: dummyVehicle.id,
        createdById: userId,
        orderNumber,
        status: 'READY_FOR_DELIVERY',
        internalNotes: 'عربون / دفعة مقدمة مستقلة',
      },
    });

    // Create item
    await tx.workOrderItem.create({
      data: {
        workOrderId: wo.id,
        type: 'LABOR',
        description: 'دفعة مقدمة / عربون مالي للورشة',
        quantity: 1,
        unitPrice: amount,
        totalPrice: amount,
        isApproved: true,
      },
    });

    // 4. Create Prepayment Invoice
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    const invCount = await tx.invoice.count({ where: { tenantId } });
    const invoiceNumber = `INV-DEP-${new Date().getFullYear()}-${String(invCount + 1).padStart(4, '0')}`;

    const invoice = await tx.invoice.create({
      data: {
        tenantId,
        workOrderId: wo.id,
        customerId: finalCustomerId,
        invoiceNumber,
        status: 'PAID',
        subtotal: amount,
        discountAmount: 0,
        taxableAmount: amount,
        taxRate: 0,
        taxAmount: 0,
        total: amount,
        paidAmount: amount,
        remainingAmount: 0,
        currency: tenant?.currency || 'KWD',
        notes: notes || 'عربون / دفعة مقدمة مستقلة',
        paidAt: new Date(),
      },
    });

    // 5. Create Payment record
    let dbMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' = 'CASH';
    if (paymentMethod === 'CARD' || paymentMethod === 'KNET' || paymentMethod === 'LINK') {
      dbMethod = 'CARD';
    } else if (paymentMethod === 'BANK_TRANSFER') {
      dbMethod = 'BANK_TRANSFER';
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method: dbMethod,
        reference: transactionReference || null,
        notes: `تم الاستلام بواسطة الكاشير: ${userName}. ملاحظة: ${notes || ''}`,
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    return { payment, invoice };
  });

  res.status(201).json({ success: true, data: result });
});

export default router;
