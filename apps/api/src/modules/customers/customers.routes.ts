import { Router, Response } from 'express';

// ─── No-Show Thresholds (configurable — move to settings table later) ─────────
// WARN_THRESHOLD:  shows an orange badge ("⚠️ كثير الغياب")
// CRITICAL_THRESHOLD: shows a red badge ("🔴 غياب متكرر")
const NO_SHOW_WARN_THRESHOLD = 3;
const NO_SHOW_CRITICAL_THRESHOLD = 5;
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();
router.use(authenticate);
router.use(authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'));

// ─── Get All Customers ──────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    include: {
      vehicles: {
        include: {
          vehicle: true
        }
      },
      workOrders: {
        select: {
          id: true,
          totalAmount: true
        }
      },
      _count: {
        select: {
          // Count invoices for quick stats
          invoices: true,
        }
      }
    },
    orderBy: { name: 'asc' },
  });

  // Attach noShowCount per customer (single batch query — efficient)
  const customerIds = customers.map(c => c.id);
  const noShowCounts = await prisma.appointment.groupBy({
    by: ['customerId'],
    where: {
      tenantId,
      customerId: { in: customerIds },
      status: 'NO_SHOW',
    },
    _count: { id: true },
  });

  const noShowMap = new Map(noShowCounts.map(r => [r.customerId, r._count.id]));

  const enriched = customers.map(c => ({
    ...c,
    noShowCount: noShowMap.get(c.id) ?? 0,
    noShowLevel:
      (noShowMap.get(c.id) ?? 0) >= NO_SHOW_CRITICAL_THRESHOLD ? 'CRITICAL' :
      (noShowMap.get(c.id) ?? 0) >= NO_SHOW_WARN_THRESHOLD     ? 'WARN'     :
      'OK',
  }));

  res.json({ success: true, data: enriched });
});

// ─── Get Single Customer Command Center Details ──────────────────────────────
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, tenantId },
    include: {
      vehicles: {
        include: {
          vehicle: {
            include: {
              workOrders: {
                select: {
                  id: true,
                  status: true,
                  receivedAt: true,
                }
              }
            }
          }
        }
      },
      workOrders: {
        include: {
          vehicle: true,
        },
        orderBy: { receivedAt: 'desc' }
      },
      invoices: {
        select: {
          id: true,
          total: true,
          paidAmount: true,
          remainingAmount: true,
          status: true,
        }
      }
    }
  });

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  // Calculate financial parameters
  const totalInvoiced = customer.invoices.reduce((acc, inv) => acc + Number(inv.total), 0);
  const totalPaid = customer.invoices.reduce((acc, inv) => acc + Number(inv.paidAmount), 0);
  const totalRemaining = customer.invoices.reduce((acc, inv) => acc + Number(inv.remainingAmount), 0);
  const avgInvoiceValue = customer.invoices.length > 0 ? (totalInvoiced / customer.invoices.length) : 0;

  // ── No-Show count (live COUNT — always accurate) ───────────────────────────
  const noShowCount = await prisma.appointment.count({
    where: {
      tenantId,
      customerId: customer.id,
      status: 'NO_SHOW',
    },
  });

  const noShowLevel =
    noShowCount >= NO_SHOW_CRITICAL_THRESHOLD ? 'CRITICAL' :
    noShowCount >= NO_SHOW_WARN_THRESHOLD     ? 'WARN'     :
    'OK';

  res.json({
    success: true,
    data: {
      ...customer,
      financials: {
        totalInvoiced,
        totalPaid,
        totalRemaining,
        avgInvoiceValue
      },
      noShowCount,
      noShowLevel,
      noShowWarnThreshold: NO_SHOW_WARN_THRESHOLD,
      noShowCriticalThreshold: NO_SHOW_CRITICAL_THRESHOLD,
    }
  });
});

// ─── Create Customer ────────────────────────────────────────────────────────
const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    phone: z.string().min(6).max(20),
    email: z.string().email().optional().or(z.literal('')),
    type: z.enum(['INDIVIDUAL', 'FLEET']).optional(),
  }),
});

router.post('/', validate(createCustomerSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { name, phone, email, type } = req.body;

  // Check if a customer with the same phone already exists in this tenant
  const existing = await prisma.customer.findFirst({
    where: { tenantId, phone },
  });

  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'رقم الهاتف هذا مسجل لعميل آخر بالفعل. يرجى استخدام رقم مختلف.',
    });
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      name,
      phone,
      email: email || null,
      type: type || 'INDIVIDUAL',
    },
  });

  res.status(201).json({ success: true, data: customer });
});

// ─── Update Customer Profile, Preferences, Notes ──────────────────────────────
const updateCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(6).max(20).optional(),
    email: z.string().email().optional().or(z.literal('')).optional(),
    type: z.enum(['INDIVIDUAL', 'FLEET']).optional(),
    preferredContactMethod: z.enum(['WHATSAPP', 'SMS', 'CALL']).optional(),
    optInMarketing: z.boolean().optional(),
    notes: z.string().optional(),
  }),
});

router.patch('/:id', validate(updateCustomerSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, tenantId }
  });

  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  if (req.body.phone) {
    const duplicate = await prisma.customer.findFirst({
      where: {
        tenantId,
        phone: req.body.phone,
        id: { not: customer.id },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف هذا مسجل لعميل آخر بالفعل. يرجى استخدام رقم مختلف.',
      });
    }
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: req.body
  });

  res.json({ success: true, data: updated });
});

// ─── Get Customer Statement of Account Ledger ───────────────────────────────
router.get('/:id/statement', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const customerId = req.params.id;
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId },
  });
  if (!customer) {
    return res.status(404).json({ success: false, message: 'العميل غير موجود' });
  }

  // Default date range: current month to now
  const startDate = startDateStr ? new Date(startDateStr) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = endDateStr ? new Date(endDateStr) : new Date();

  // Fetch all invoices of the customer and their successful payments
  const invoices = await prisma.invoice.findMany({
    where: {
      customerId,
      tenantId,
      status: { not: 'CANCELLED' },
    },
    include: {
      payments: {
        where: {
          status: 'PAID',
        },
      },
    },
  });

  let invoicedBefore = 0;
  let paidBefore = 0;
  const ledger: any[] = [];

  for (const inv of invoices) {
    const invDate = new Date(inv.createdAt);
    const invAmount = Number(inv.total);

    if (invDate < startDate) {
      invoicedBefore += invAmount;
    } else if (invDate <= endDate) {
      ledger.push({
        id: inv.id,
        date: inv.createdAt,
        type: 'INVOICE',
        reference: inv.invoiceNumber,
        description: 'فاتورة صيانة وإصلاح',
        amount: invAmount,
      });
    }

    for (const pay of inv.payments) {
      const payDate = new Date(pay.createdAt);
      const payAmount = Number(pay.amount);

      if (payDate < startDate) {
        paidBefore += payAmount;
      } else if (payDate <= endDate) {
        ledger.push({
          id: pay.id,
          date: pay.createdAt,
          type: 'PAYMENT',
          reference: pay.reference || 'سند سداد',
          description: `سند قبض إلكتروني (${pay.method})`,
          amount: -payAmount,
        });
      }
    }
  }

  const beginningBalance = invoicedBefore - paidBefore;

  // Sort chronological
  ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = beginningBalance;
  for (const item of ledger) {
    runningBalance += item.amount;
    item.rollingBalance = runningBalance;
  }

  const totalInvoicedDuring = ledger
    .filter((x) => x.type === 'INVOICE')
    .reduce((acc, x) => acc + x.amount, 0);

  const totalPaidDuring = ledger
    .filter((x) => x.type === 'PAYMENT')
    .reduce((acc, x) => acc + Math.abs(x.amount), 0);

  const endingBalance = beginningBalance + totalInvoicedDuring - totalPaidDuring;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  res.json({
    success: true,
    data: {
      customer,
      tenant,
      startDate,
      endDate,
      beginningBalance,
      endingBalance,
      totalInvoicedDuring,
      totalPaidDuring,
      ledger,
    },
  });
});

export default router;
