import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { invoicingService } from './invoicing.service';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();
router.use(authenticate);

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

export default router;
