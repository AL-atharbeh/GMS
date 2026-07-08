import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticate);

// ─── Get All Technicians ────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const technicians = await prisma.technician.findMany({
    where: { tenantId },
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
  }),
});

router.post('/', validate(createTechnicianSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { name, email, password, phone, branchId, specialties, skillLevel } = req.body;

  // Check email
  const existingUser = await prisma.user.findFirst({ where: { email } });
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
        email,
        passwordHash,
        phone,
        role: 'TECHNICIAN',
        isActive: true,
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
router.get('/my-tasks', async (req: AuthRequest, res: Response) => {
  const tech = await prisma.technician.findFirst({
    where: { userId: req.user!.id }
  });
  if (!tech) return res.status(404).json({ success: false, message: 'Technician profile not found' });

  const tasks = await prisma.taskAssignment.findMany({
    where: { technicianId: tech.id },
    include: {
      workOrder: {
        include: {
          vehicle: { select: { make: true, model: true, plateNumber: true, color: true } },
          customer: { select: { name: true, phone: true } },
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ success: true, data: tasks });
});

// ─── Update Task Assignment Status ───────────────────────────────────────────
router.patch('/tasks/:taskId/status', async (req: AuthRequest, res: Response) => {
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

export default router;
