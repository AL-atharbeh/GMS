import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// ─── Get All Technicians ────────────────────────────────────────────────────
router.get('/', authorize('GARAGE_OWNER', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  const { tenantId, role, branchId } = req.user!;
  const technicians = await prisma.technician.findMany({
    where: { tenantId, ...(role === 'BRANCH_MANAGER' && branchId ? { branchId } : {}) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          nameAr: true,
          email: true,
          phone: true,
          avatar: true,
          isActive: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          nameAr: true,
        },
      },
      taskAssignments: {
        include: {
          workOrder: {
            include: {
              vehicle: { select: { make: true, model: true, plateNumber: true } },
              customer: { select: { name: true } },
            }
          }
        }
      },
      performance: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: technicians });
});

// ─── Create Technician (Create User + Technician Record) ─────────────────────
const createTechnicianSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional(),
    branchId: z.string().uuid(),
    specialties: z.array(z.string()).default([]),
    skillLevel: z.enum(['JUNIOR', 'MID_LEVEL', 'SENIOR', 'MASTER']).default('MID_LEVEL'),
    commissionPercent: z.number().min(0).max(100).optional(),
    hourlyRate: z.number().min(0).optional(),
    employeeId: z.string().optional(),
    certifications: z.array(z.string()).optional(),
    avatar: z.string().optional(),
  }),
});

router.post('/', authorize('GARAGE_OWNER', 'BRANCH_MANAGER'), validate(createTechnicianSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const {
    name,
    email,
    password,
    phone,
    branchId,
    specialties,
    skillLevel,
    commissionPercent = 0,
    hourlyRate = 0,
    employeeId,
    certifications = [],
    avatar,
  } = req.body;

  const normalizedEmail = email.toLowerCase().trim();

  // Check email
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const technician = await prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        tenantId,
        branchId,
        name,
        email: normalizedEmail,
        passwordHash,
        phone,
        role: 'TECHNICIAN',
        isActive: true,
        avatar: avatar || null,
      },
    });

    // 2. Create Technician Profile
    const tech = await tx.technician.create({
      data: {
        tenantId,
        branchId,
        userId: user.id,
        specialties,
        skillLevel,
        isAvailable: true,
        commissionPercent,
        hourlyRate,
        employeeId: employeeId || null,
        certifications,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return tech;
  });

  res.status(201).json({ success: true, data: technician });
});

// ─── Get Tasks assigned to current Technician ────────────────────────────────
router.get('/my-tasks', authorize('TECHNICIAN'), async (req: AuthRequest, res: Response) => {
  const tech = await prisma.technician.findFirst({
    where: { userId: req.user!.id }
  });
  if (!tech) return res.status(404).json({ success: false, message: 'Technician profile not found' });

  const tasks = await prisma.taskAssignment.findMany({
    where: { technicianId: tech.id },
    include: {
      workOrder: {
        include: {
          vehicle: { select: { make: true, model: true, plateNumber: true, color: true, year: true } },
          customer: { select: { name: true, phone: true } },
          photos: {
            select: { id: true, url: true, type: true, caption: true, capturedAt: true },
            orderBy: { capturedAt: 'desc' },
          },
          workOrderItems: {
            where: { isApproved: true },
            select: {
              id: true,
              type: true,
              description: true,
              descriptionAr: true,
              quantity: true,
              // NO unitPrice or costPrice — hidden from technician
              part: { select: { id: true, name: true, nameAr: true, inventory: { select: { quantity: true } } } },
              laborRate: { select: { id: true, name: true, nameAr: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        }
      }
    },
    orderBy: [
      { status: 'asc' }, // PENDING first, then IN_PROGRESS, then COMPLETED
      { createdAt: 'desc' }
    ]
  });
  res.json({ success: true, data: tasks });
});

// ─── Get Single Task Detail ─────────────────────────────────────────────────
router.get('/tasks/:taskId', authorize('TECHNICIAN'), async (req: AuthRequest, res: Response) => {
  const tech = await prisma.technician.findFirst({ where: { userId: req.user!.id } });
  if (!tech) return res.status(404).json({ success: false, message: 'Technician profile not found' });

  const task = await prisma.taskAssignment.findFirst({
    where: { id: req.params.taskId, technicianId: tech.id },
    include: {
      workOrder: {
        include: {
          vehicle: true,
          customer: { select: { name: true, phone: true, email: true } },
          photos: { orderBy: { capturedAt: 'asc' } },
          workOrderItems: {
            where: { isApproved: true },
            select: {
              id: true, type: true, description: true, descriptionAr: true,
              quantity: true,
              part: { select: { id: true, name: true, nameAr: true, unit: true, inventory: { select: { quantity: true } } } },
              laborRate: { select: { id: true, name: true, nameAr: true, duration: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
          qualityChecks: {
            include: { items: { include: { templateItem: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!task) return res.status(404).json({ success: false, message: 'المهمة غير موجودة أو غير مسندة إليك' });
  res.json({ success: true, data: task });
});

// ─── Get Quality Check Template for a Work Order ────────────────────────────
router.get('/tasks/:taskId/quality-template', authorize('TECHNICIAN'), async (req: AuthRequest, res: Response) => {
  const tech = await prisma.technician.findFirst({ where: { userId: req.user!.id } });
  if (!tech) return res.status(404).json({ success: false, message: 'Technician profile not found' });

  const task = await prisma.taskAssignment.findFirst({
    where: { id: req.params.taskId, technicianId: tech.id },
    select: { workOrder: { select: { tenantId: true } } },
  });
  if (!task) return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });

  // Find the default quality check template for this tenant
  const template = await prisma.qualityCheckTemplate.findFirst({
    where: { tenantId: task.workOrder.tenantId, isActive: true, isDefault: true },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!template) {
    // Return a hardcoded default checklist if no custom template exists
    return res.json({
      success: true,
      data: {
        id: 'default',
        name: 'قائمة الفحص الأساسية',
        nameAr: 'قائمة الفحص الأساسية',
        items: [
          { id: 'c1', nameAr: 'فحص الفرامل الأمامية والخلفية', category: 'السلامة', isRequired: true, sortOrder: 1 },
          { id: 'c2', nameAr: 'فحص الإطارات (ضغط + تآكل)', category: 'السلامة', isRequired: true, sortOrder: 2 },
          { id: 'c3', nameAr: 'فحص مستوى زيت المحرك', category: 'السوائل', isRequired: true, sortOrder: 3 },
          { id: 'c4', nameAr: 'فحص سائل التبريد', category: 'السوائل', isRequired: true, sortOrder: 4 },
          { id: 'c5', nameAr: 'فحص سائل الفرامل', category: 'السوائل', isRequired: true, sortOrder: 5 },
          { id: 'c6', nameAr: 'فحص بطارية السيارة', category: 'الكهرباء', isRequired: true, sortOrder: 6 },
          { id: 'c7', nameAr: 'فحص أضواء الأمامية والخلفية', category: 'الكهرباء', isRequired: false, sortOrder: 7 },
          { id: 'c8', nameAr: 'فحص نظافة السيارة من الداخل والخارج', category: 'الجودة', isRequired: false, sortOrder: 8 },
          { id: 'c9', nameAr: 'فحص المكيف وسلامة عمله', category: 'الراحة', isRequired: false, sortOrder: 9 },
          { id: 'c10', nameAr: 'مطابقة العمل المنجز مع الطلب الأصلي', category: 'الجودة', isRequired: true, sortOrder: 10 },
        ],
      }
    });
  }

  res.json({ success: true, data: template });
});

// ─── Submit Quality Check ────────────────────────────────────────────────────
router.post('/tasks/:taskId/quality-check', authorize('TECHNICIAN'), async (req: AuthRequest, res: Response) => {
  const { items, notes } = req.body; // items: [{templateItemId, isPassed, notes}]

  const tech = await prisma.technician.findFirst({ where: { userId: req.user!.id } });
  if (!tech) return res.status(404).json({ success: false, message: 'Technician profile not found' });

  const task = await prisma.taskAssignment.findFirst({
    where: { id: req.params.taskId, technicianId: tech.id },
    include: { workOrder: true },
  });
  if (!task) return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });

  // Check if all required items passed
  const allPassed = !items.some((item: any) => item.isPassed === false);

  let qualityCheck: any;

  // For default template (no DB template), save simplified record
  if (items[0]?.templateItemId?.startsWith('c')) {
    qualityCheck = await prisma.qualityCheck.create({
      data: {
        workOrderId: task.workOrderId,
        checkedById: req.user!.id,
        isPassed: allPassed,
        notes: notes || null,
      }
    });
  } else {
    qualityCheck = await prisma.qualityCheck.create({
      data: {
        workOrderId: task.workOrderId,
        checkedById: req.user!.id,
        isPassed: allPassed,
        notes: notes || null,
        items: {
          create: items.map((item: any) => ({
            templateItemId: item.templateItemId,
            isPassed: item.isPassed,
            notes: item.notes || null,
          })),
        },
      },
    });
  }

  res.json({ success: true, data: qualityCheck });
});

// ─── Update Task Assignment Status ───────────────────────────────────────────
router.patch('/tasks/:taskId/status', authorize('TECHNICIAN'), async (req: AuthRequest, res: Response) => {
  const { status, notes } = req.body;
  const task = await prisma.taskAssignment.findUnique({
    where: { id: req.params.taskId },
    include: { workOrder: true }
  });
  if (!task) return res.status(404).json({ success: false, message: 'Task assignment not found' });

  // Enforce quote approval before technician starts work
  if (status === 'IN_PROGRESS' && !['APPROVED', 'IN_PROGRESS'].includes(task.workOrder.status)) {
    return res.status(400).json({
      success: false,
      message: 'عذراً، لا يمكن بدء العمل الفعلي قبل اعتماد عرض السعر والموافقة عليه من قبل العميل.'
    });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.taskAssignment.update({
      where: { id: task.id },
      data: {
        status,
        ...(status === 'IN_PROGRESS' && { startedAt: now }),
        ...(status === 'COMPLETED' && { completedAt: now }),
        ...(notes && { notes }),
      }
    });

    if (status === 'IN_PROGRESS' && task.workOrder.status === 'APPROVED') {
      await tx.workOrder.update({
        where: { id: task.workOrderId },
        data: { status: 'IN_PROGRESS', workStartedAt: now }
      });
      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: task.workOrderId,
          fromStatus: 'APPROVED',
          toStatus: 'IN_PROGRESS',
          changedById: req.user!.id,
          notes: 'العمل بدأ بواسطة الفني',
        }
      });
    }

    if (status === 'COMPLETED') {
      const remainingTasks = await tx.taskAssignment.count({
        where: { workOrderId: task.workOrderId, status: { not: 'COMPLETED' } }
      });
      if (remainingTasks === 0 && task.workOrder.status === 'IN_PROGRESS') {
        await tx.workOrder.update({
          where: { id: task.workOrderId },
          data: { status: 'QUALITY_CHECK', qualityCheckedAt: now }
        });
        await tx.workOrderStatusHistory.create({
          data: {
            workOrderId: task.workOrderId,
            fromStatus: 'IN_PROGRESS',
            toStatus: 'QUALITY_CHECK',
            changedById: req.user!.id,
            notes: 'اكتملت جميع المهام بواسطة الفنيين، بانتظار فحص الجودة',
          }
        });
      }
    }

    return u;
  });

  res.json({ success: true, data: updated });
});

// ─── Confirm Task Rework (Confirm Technical Error) ───────────────────────────
router.post('/tasks/:taskId/rework/confirm', authorize('GARAGE_OWNER', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  const task = await prisma.taskAssignment.findUnique({
    where: { id: req.params.taskId }
  });
  if (!task) return res.status(404).json({ success: false, message: 'Task assignment not found' });

  const updated = await prisma.taskAssignment.update({
    where: { id: task.id },
    data: {
      reworkStatus: 'CONFIRMED',
      reworkCount: { increment: 1 },
      reworkReason: task.reworkReason 
        ? `${task.reworkReason} | تأكيد المدير: ${reason || 'خطأ فني'}`
        : `تأكيد المدير: ${reason || 'خطأ فني'}`,
    }
  });

  res.json({ success: true, data: updated });
});

// ─── Dismiss Task Rework (Dismiss Exception) ───────────────────────────────
router.post('/tasks/:taskId/rework/dismiss', authorize('GARAGE_OWNER', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  const { reason } = req.body;
  const task = await prisma.taskAssignment.findUnique({
    where: { id: req.params.taskId }
  });
  if (!task) return res.status(404).json({ success: false, message: 'Task assignment not found' });

  const updated = await prisma.taskAssignment.update({
    where: { id: task.id },
    data: {
      reworkStatus: 'DISMISSED',
      reworkReason: task.reworkReason
        ? `${task.reworkReason} | استثناء المدير: ${reason || 'سبب خارجي'}`
        : `استثناء المدير: ${reason || 'سبب خارجي'}`,
    }
  });

  res.json({ success: true, data: updated });
});

export default router;
