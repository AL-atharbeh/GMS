import { Router, Response } from 'express';

// ─── No-Show Thresholds (configurable — move to settings table later) ─────────
// WARN_THRESHOLD:  shows an orange badge ("⚠️ كثير الغياب")
// CRITICAL_THRESHOLD: shows a red badge ("🔴 غياب متكرر")
const NO_SHOW_WARN_THRESHOLD = 3;
const NO_SHOW_CRITICAL_THRESHOLD = 5;
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();
router.use(authenticate);

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

export default router;
