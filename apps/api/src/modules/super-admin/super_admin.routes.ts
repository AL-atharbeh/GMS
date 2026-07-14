import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticateSuperAdmin } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { authService } from '../auth/auth.service';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticateSuperAdmin);

// ─── Super Admin Dashboard Stats ─────────────────────────────────────────────
router.get('/stats', async (req: any, res: Response) => {
  const [totalTenants, activeTenants, trialTenants, suspendedTenants, cancelledTenants, activePlans] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    prisma.tenant.count({ where: { status: 'TRIAL' } }),
    prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    prisma.tenant.count({ where: { status: 'CANCELLED' } }),
    prisma.tenantSubscription.count({ where: { cancelledAt: null } }),
  ]);

  // MRR from paid subscription invoices
  const mrrSum = await prisma.subscriptionInvoice.aggregate({
    where: { status: 'PAID' },
    _sum: { amount: true },
  });
  const mrr = Number(mrrSum._sum.amount || 0);
  const arr = mrr * 12;

  // Churn: cancelled in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentCancellations = await prisma.tenant.count({
    where: { status: 'CANCELLED', updatedAt: { gte: thirtyDaysAgo } },
  });
  const churnRate = totalTenants > 0 ? ((recentCancellations / totalTenants) * 100).toFixed(1) : '0.0';

  // Trial expiring in 7 days
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const trialExpiringSoon = await prisma.tenant.count({
    where: {
      status: 'TRIAL',
      trialEndsAt: { lte: sevenDaysFromNow, gte: new Date() },
    },
  });

  res.json({
    success: true,
    data: {
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      cancelledTenants,
      activeSubscriptions: activePlans,
      mrr,
      arr,
      churnRate: Number(churnRate),
      trialExpiringSoon,
    },
  });
});

// ─── Usage Stats (Active tenants this week, inactive tenants) ─────────────────
router.get('/usage-stats', async (req: any, res: Response) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Tenants with at least one work order in the last 7 days
  const activeThisWeek = await prisma.workOrder.groupBy({
    by: ['tenantId'],
    where: { createdAt: { gte: sevenDaysAgo } },
  });

  // Trial expiring soon (next 7 days) with details
  const trialExpiring = await prisma.tenant.findMany({
    where: {
      status: 'TRIAL',
      trialEndsAt: { lte: sevenDaysFromNow, gte: new Date() },
    },
    select: { id: true, name: true, nameAr: true, email: true, phone: true, trialEndsAt: true },
    orderBy: { trialEndsAt: 'asc' },
    take: 10,
  });

  // Tenants inactive for 14+ days (no work orders)
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const activeLastTwoWeeks = await prisma.workOrder.groupBy({
    by: ['tenantId'],
    where: { createdAt: { gte: fourteenDaysAgo } },
  });
  const activeTenantIds = new Set(activeLastTwoWeeks.map(w => w.tenantId));
  const allActiveTenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, nameAr: true, email: true, createdAt: true },
  });
  const inactiveTenants = allActiveTenants
    .filter(t => !activeTenantIds.has(t.id))
    .slice(0, 10);

  res.json({
    success: true,
    data: {
      activeThisWeekCount: activeThisWeek.length,
      trialExpiring,
      inactiveTenants,
    },
  });
});

// ─── Get Tenant Subscription Invoices ───────────────────────────────────────
router.get('/tenants/:tenantId/invoices', async (req: any, res: Response) => {
  const invoices = await prisma.subscriptionInvoice.findMany({
    where: { tenantId: req.params.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json({ success: true, data: invoices });
});

// ─── Get All Tenants ─────────────────────────────────────────────────────────
router.get('/tenants', async (req: any, res: Response) => {
  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: {
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              nameAr: true,
              monthlyPrice: true,
              annualPrice: true,
            },
          },
        },
      },
      _count: {
        select: {
          users: true,
          workOrders: true,
          branches: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: tenants });
});

// ─── Get Subscription Plan Configs ───────────────────────────────────────────
router.get('/plans', async (req: any, res: Response) => {
  const plans = await prisma.subscriptionPlanConfig.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ success: true, data: plans });
});

// ─── Update Subscription Plan Config ─────────────────────────────────────────
const updatePlanSchema = z.object({
  body: z.object({
    nameAr: z.string().min(2).optional(),
    monthlyPrice: z.number().min(0).optional(),
    annualPrice: z.number().min(0).optional(),
    maxBranches: z.number().int().min(1).optional(),
    maxTechnicians: z.number().int().min(1).optional(),
    maxVehiclesPerMonth: z.number().int().min(1).optional(),
    hasWhatsApp: z.boolean().optional(),
    hasAdvancedReports: z.boolean().optional(),
    hasFleetManagement: z.boolean().optional(),
    hasApiAccess: z.boolean().optional(),
    trialDays: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

router.patch('/plans/:planId', validate(updatePlanSchema), async (req: any, res: Response) => {
  const plan = await prisma.subscriptionPlanConfig.findUnique({
    where: { id: req.params.planId },
  });
  if (!plan) return res.status(404).json({ success: false, message: 'الخطة غير موجودة' });

  const updated = await prisma.subscriptionPlanConfig.update({
    where: { id: req.params.planId },
    data: req.body,
  });

  await prisma.platformAuditLog.create({
    data: {
      superAdminId: req.superAdmin.id,
      action: `تعديل خطة الاشتراك: ${plan.nameAr} (${plan.name})`,
      targetType: 'plan',
      targetId: plan.id,
      details: { before: plan, after: req.body },
      ipAddress: req.ip || req.socket.remoteAddress || null,
    },
  });

  res.json({ success: true, data: updated });
});

// ─── Update Tenant Status ────────────────────────────────────────────────────
const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']),
    trialEndsAt: z.string().datetime().optional().nullable(),
  }),
});

router.patch('/tenants/:tenantId/status', validate(updateStatusSchema), async (req: any, res: Response) => {
  const { status, trialEndsAt } = req.body;

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.params.tenantId },
  });
  if (!tenant) return res.status(404).json({ success: false, message: 'الكراج غير موجود' });

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      status,
      ...(trialEndsAt !== undefined && { trialEndsAt }),
    },
  });

  await prisma.platformAuditLog.create({
    data: {
      superAdminId: req.superAdmin.id,
      action: `تعديل حالة كراج: ${tenant.name} → ${status}`,
      targetType: 'tenant',
      targetId: tenant.id,
      details: { previousStatus: tenant.status, newStatus: status },
      ipAddress: req.ip || req.socket.remoteAddress || null,
    },
  });

  res.json({ success: true, data: updated });
});

// ─── Update Tenant Subscription Plan ─────────────────────────────────────────
const updateSubscriptionSchema = z.object({
  body: z.object({
    planId: z.string().uuid(),
    billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
    currentPeriodEnd: z.string().datetime(),
  }),
});

router.patch('/tenants/:tenantId/subscription', validate(updateSubscriptionSchema), async (req: any, res: Response) => {
  const { planId, billingCycle, currentPeriodEnd } = req.body;

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.params.tenantId },
    include: { subscription: true },
  });
  if (!tenant) return res.status(404).json({ success: false, message: 'الكراج غير موجود' });

  const plan = await prisma.subscriptionPlanConfig.findUnique({ where: { id: planId } });
  if (!plan) return res.status(400).json({ success: false, message: 'خطة الاشتراك غير صالحة' });

  const now = new Date();
  let updatedSubscription;

  if (tenant.subscription) {
    updatedSubscription = await prisma.tenantSubscription.update({
      where: { tenantId: tenant.id },
      data: { planId, billingCycle, currentPeriodStart: now, currentPeriodEnd: new Date(currentPeriodEnd), cancelledAt: null },
    });
  } else {
    updatedSubscription = await prisma.tenantSubscription.create({
      data: { tenantId: tenant.id, planId, billingCycle, currentPeriodStart: now, currentPeriodEnd: new Date(currentPeriodEnd) },
    });
  }

  await prisma.platformAuditLog.create({
    data: {
      superAdminId: req.superAdmin.id,
      action: `تحديث باقة اشتراك: ${tenant.name} → ${plan.nameAr} (${billingCycle})`,
      targetType: 'subscription',
      targetId: tenant.id,
      details: { planName: plan.name, billingCycle, currentPeriodEnd },
      ipAddress: req.ip || req.socket.remoteAddress || null,
    },
  });

  res.json({ success: true, data: updatedSubscription });
});

// ─── Platform Audit Logs ──────────────────────────────────────────────────────
router.get('/audit-logs', async (req: any, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const [logs, total] = await Promise.all([
    prisma.platformAuditLog.findMany({
      include: {
        superAdmin: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.platformAuditLog.count(),
  ]);

  res.json({ success: true, data: { logs, total, page, limit } });
});

// ─── Support Tickets ──────────────────────────────────────────────────────────
router.get('/support-tickets', async (req: any, res: Response) => {
  const status = req.query.status as string;
  const tickets = await prisma.supportTicket.findMany({
    where: status && status !== 'ALL' ? { status: status as any } : undefined,
    include: {
      tenant: { select: { name: true, nameAr: true, email: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 100,
  });
  res.json({ success: true, data: tickets });
});

const updateTicketSchema = z.object({
  body: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    adminReply: z.string().optional(),
  }),
});

router.patch('/support-tickets/:ticketId', validate(updateTicketSchema), async (req: any, res: Response) => {
  const { status, adminReply } = req.body;
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.ticketId } });
  if (!ticket) return res.status(404).json({ success: false, message: 'التذكرة غير موجودة' });

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status,
      resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
    },
  });

  // Add reply as a SupportMessage if provided
  if (adminReply) {
    await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderType: 'SUPER_ADMIN',
        senderId: req.superAdmin.id,
        message: adminReply,
        attachments: [],
      },
    });
  }

  await prisma.platformAuditLog.create({
    data: {
      superAdminId: req.superAdmin.id,
      action: `تحديث تذكرة دعم → ${status}`,
      targetType: 'support_ticket',
      targetId: ticket.id,
      ipAddress: req.ip || req.socket.remoteAddress || null,
    },
  });

  res.json({ success: true, data: updated });
});

// ─── Announcements ────────────────────────────────────────────────────────────
router.get('/announcements', async (req: any, res: Response) => {
  const announcements = await prisma.announcement.findMany({
    include: { superAdmin: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ success: true, data: announcements });
});

const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(2),
    titleAr: z.string().min(2),
    content: z.string().min(2),
    contentAr: z.string().min(2),
    targetType: z.enum(['ALL', 'PLAN', 'SPECIFIC']).default('ALL'),
    targetPlan: z.enum(['BASIC', 'PROFESSIONAL', 'ENTERPRISE']).optional().nullable(),
    broadcastType: z.enum(['ANNOUNCEMENT', 'NOTIFICATION']).default('ANNOUNCEMENT'),
  }),
});

router.post('/announcements', validate(createAnnouncementSchema), async (req: any, res: Response) => {
  const { title, titleAr, content, contentAr, targetType, targetPlan, broadcastType } = req.body;

  let announcement = null;

  if (broadcastType === 'ANNOUNCEMENT') {
    announcement = await prisma.announcement.create({
      data: {
        superAdminId: req.superAdmin.id,
        title,
        titleAr,
        content,
        contentAr,
        targetType,
        targetPlan: targetPlan || null,
        sentAt: new Date(),
      },
    });
  }

  // Fetch targeted tenants
  let targetTenants: { id: string }[] = [];
  
  if (targetType === 'ALL') {
    targetTenants = await prisma.tenant.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'SUSPENDED'] },
      },
      select: { id: true },
    });
  } else if (targetType === 'PLAN' && targetPlan) {
    targetTenants = await prisma.tenant.findMany({
      where: {
        status: { notIn: ['CANCELLED', 'SUSPENDED'] },
        subscription: {
          plan: {
            name: targetPlan as any,
          },
        },
      },
      select: { id: true },
    });
  }

  // Create in-app notifications for all target tenants
  if (targetTenants.length > 0) {
    const notifications = targetTenants.map(tenant => ({
      tenantId: tenant.id,
      title: titleAr || title,
      body: contentAr || content,
      type: broadcastType,
      sourceType: broadcastType,
      isRead: false,
    }));

    await prisma.inAppNotification.createMany({
      data: notifications,
    });
  }

  await prisma.platformAuditLog.create({
    data: {
      superAdminId: req.superAdmin.id,
      action: `إرسال ${broadcastType === 'ANNOUNCEMENT' ? 'إعلان' : 'إشعار'}: "${titleAr}" — الاستهداف: ${targetType}`,
      targetType: broadcastType === 'ANNOUNCEMENT' ? 'announcement' : 'in_app_notification',
      targetId: announcement?.id || null,
      ipAddress: req.ip || req.socket.remoteAddress || null,
    },
  });

  res.json({ success: true, data: { announcement, broadcastType } });
});

// ─── Impersonate Tenant ───────────────────────────────────────────────────────
router.post('/tenants/:tenantId/impersonate', async (req: any, res: Response) => {
  const { tenantId } = req.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'الكراج غير موجود' });
  }

  const result = await authService.impersonate(tenantId);

  // Log in PlatformAuditLog
  await prisma.platformAuditLog.create({
    data: {
      superAdminId: req.superAdmin.id,
      action: `الدخول كمشاهد لحساب الكراج: ${tenant.nameAr || tenant.name}`,
      targetType: 'tenant',
      targetId: tenant.id,
      details: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        impersonatedUserId: result.user.id,
        impersonatedUserEmail: result.user.email,
      },
      ipAddress: req.ip || req.socket.remoteAddress || null,
    },
  });

  res.json({
    success: true,
    data: result,
  });
});

// Helper to generate unique tenant slug
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '') // Allow arabic chars or alphanumeric
    .trim()
    .replace(/\s+/g, '-');

  let slug = baseSlug || 'garage';
  let count = 0;

  while (true) {
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (!existing) break;
    count++;
    slug = `${baseSlug}-${count}`;
  }

  return slug;
}

// ─── Create Garage Manually ───────────────────────────────────────────────────
const createTenantSchema = z.object({
  body: z.object({
    garageName: z.string().min(2),
    garageNameAr: z.string().optional().nullable(),
    ownerName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    planId: z.string().uuid(),
    status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).default('TRIAL'),
    phone: z.string().optional().nullable(),
  }),
});

router.post('/tenants', validate(createTenantSchema), async (req: any, res: Response) => {
  const { garageName, garageNameAr, ownerName, email, password, planId, status, phone } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر' });
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { email: normalizedEmail } });
  if (existingTenant) {
    return res.status(409).json({ success: false, message: 'البريد الإلكتروني مسجل بالفعل لكراج آخر' });
  }

  // 2. Find plan
  const plan = await prisma.subscriptionPlanConfig.findUnique({ where: { id: planId } });
  if (!plan) {
    return res.status(400).json({ success: false, message: 'خطة الاشتراك المحددة غير موجودة' });
  }

  // 3. Prepare data
  const slug = await generateUniqueSlug(garageName);
  const passwordHash = await bcrypt.hash(password, 12);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + (plan.trialDays || 14));

  // 4. Run Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create tenant
    const tenant = await tx.tenant.create({
      data: {
        name: garageName,
        nameAr: garageNameAr || null,
        slug,
        email: normalizedEmail,
        phone: phone || null,
        status,
        trialEndsAt: status === 'TRIAL' ? trialEndsAt : null,
        country: 'KW',
        currency: 'KWD',
      },
    });

    // Create subscription
    await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: status === 'TRIAL' ? trialEndsAt : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Create main branch
    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: garageName,
        nameAr: garageNameAr || null,
        phone: phone || null,
        isActive: true,
        dailyCapacity: 10,
      },
    });

    // Create owner user
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        email: normalizedEmail,
        passwordHash,
        name: ownerName,
        role: 'GARAGE_OWNER',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    return { tenant, user };
  });

  // 5. Audit Log
  await prisma.platformAuditLog.create({
    data: {
      superAdminId: req.superAdmin.id,
      action: `إنشاء كراج جديد يدوياً: ${garageName}`,
      targetType: 'tenant',
      targetId: result.tenant.id,
      details: {
        tenantId: result.tenant.id,
        tenantName: result.tenant.name,
        tenantEmail: result.tenant.email,
        planName: plan.name,
        status: status,
      },
      ipAddress: req.ip || req.socket.remoteAddress || null,
    },
  });

  res.status(201).json({
    success: true,
    data: result.tenant,
  });
});

// ─── Get Garage Full Details ──────────────────────────────────────────────────
router.get('/tenants/:tenantId/details', async (req: any, res: Response) => {
  const { tenantId } = req.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
      _count: {
        select: {
          users: true,
          workOrders: true,
          branches: true,
        },
      },
    },
  });

  if (!tenant) {
    return res.status(404).json({ success: false, message: 'الكراج غير موجود' });
  }

  // 1. Last Activity (max user login)
  const lastActiveUser = await prisma.user.findFirst({
    where: { tenantId },
    select: { lastLoginAt: true },
    orderBy: { lastLoginAt: 'desc' },
  });

  // 2. Total Registered Vehicles
  const vehiclesCount = await prisma.vehicle.count({
    where: { tenantId },
  });

  // 3. Total Garage Revenue (paid amount of paid/partial invoices)
  const invoiceAggregate = await prisma.invoice.aggregate({
    where: { tenantId, status: { in: ['PAID', 'PARTIAL'] } },
    _sum: { paidAmount: true },
  });
  const revenue = Number(invoiceAggregate._sum.paidAmount || 0);

  // 4. Audit Log history for this tenant
  const auditLogs = await prisma.platformAuditLog.findMany({
    where: { targetType: 'tenant', targetId: tenantId },
    include: {
      superAdmin: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: {
      tenant,
      lastActivity: lastActiveUser?.lastLoginAt || null,
      vehiclesCount,
      revenue,
      auditLogs,
    },
  });
});

export default router;
