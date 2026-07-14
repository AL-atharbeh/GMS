import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import { AppError } from '../../middleware/errorHandler';
import { WorkOrderService } from '../work-orders/workOrder.service';

const router = Router();
router.use(authenticate);
router.use(authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'));

const workOrderService = new WorkOrderService();

// ─── Get All Appointments ───────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;

  const appointments = await prisma.appointment.findMany({
    where: { tenantId },
    include: {
      branch: { select: { name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  res.json({ success: true, data: appointments });
});

// ─── Create Appointment ──────────────────────────────────────────────────────
const createAppointmentSchema = z.object({
  body: z.object({
    customerName: z.string().min(2),
    customerPhone: z.string().min(6),
    vehiclePlate: z.string().min(2),
    vehicleMake: z.string().optional(),
    vehicleModel: z.string().optional(),
    serviceType: z.string().min(2),
    scheduledAt: z.string(), // ISO String
    notes: z.string().optional(),
    customerId: z.string().optional(),
    vehicleId: z.string().optional(),
    technicianId: z.string().optional(),
    estimatedDuration: z.number().optional(),
  }),
});

router.post('/', validate(createAppointmentSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, branchId } = req.user!;
  const {
    customerName, customerPhone, vehiclePlate, vehicleMake, vehicleModel,
    serviceType, scheduledAt, notes, customerId, vehicleId, technicianId, estimatedDuration,
  } = req.body;

  // Fallback branch
  let targetBranchId = branchId;
  if (!targetBranchId) {
    const firstBranch = await prisma.branch.findFirst({ where: { tenantId } });
    if (!firstBranch) throw new AppError('No branches found for this tenant', 400);
    targetBranchId = firstBranch.id;
  }

  // Conflict check: check if there's an appointment within ±60 min of scheduledAt
  const scheduledDate = new Date(scheduledAt);
  const windowStart = new Date(scheduledDate.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(scheduledDate.getTime() + 60 * 60 * 1000);

  const conflicting = await prisma.appointment.findFirst({
    where: {
      tenantId,
      branchId: targetBranchId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledAt: { gte: windowStart, lte: windowEnd },
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      branchId: targetBranchId,
      customerName,
      customerPhone,
      vehiclePlate,
      vehicleMake: vehicleMake || undefined,
      vehicleModel: vehicleModel || undefined,
      serviceType,
      scheduledAt: scheduledDate,
      notes: notes || '',
      status: 'SCHEDULED',
      customerId: customerId || undefined,
      estimatedDuration: estimatedDuration || 60,
    },
  });

  res.status(201).json({
    success: true,
    data: appointment,
    warning: conflicting
      ? `⚠️ يوجد موعد آخر في نفس الوقت تقريباً: ${conflicting.customerName} (${new Date(conflicting.scheduledAt).toLocaleTimeString('ar')})`
      : null,
  });
});

// ─── Update Appointment Status ──────────────────────────────────────────────
const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  }),
});

router.patch('/:id/status', validate(updateStatusSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { status } = req.body;

  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.id, tenantId },
  });

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  const updated = await prisma.appointment.update({
    where: { id: req.params.id },
    data: { status },
  });

  res.json({ success: true, data: updated });
});

// ─── Convert Appointment → Work Order ──────────────────────────────────────
router.post('/:id/convert-to-work-order', async (req: AuthRequest, res: Response) => {
  const { tenantId, id: userId, branchId } = req.user!;

  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.id, tenantId },
  });

  if (!appointment) throw new AppError('Appointment not found', 404);

  // Already converted → return existing
  if (appointment.workOrderId) {
    res.json({ success: true, workOrderId: appointment.workOrderId, alreadyConverted: true });
    return;
  }

  // Resolve branch
  let targetBranchId = branchId || appointment.branchId;
  if (!targetBranchId) {
    const firstBranch = await prisma.branch.findFirst({ where: { tenantId } });
    if (!firstBranch) throw new AppError('No branches found', 400);
    targetBranchId = firstBranch.id;
  }

  // Must have a vehicle registered in the system
  let vehicleId: string | null = null;
  if (appointment.vehiclePlate) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { tenantId, plateNumber: appointment.vehiclePlate },
    });
    vehicleId = vehicle?.id || null;
  }

  if (!vehicleId) {
    throw new AppError(
      'لم يتم العثور على السيارة في النظام. يرجى إضافة السيارة أولاً من صفحة السيارات.',
      400
    );
  }

  // Resolve customer
  let resolvedCustomerId = appointment.customerId;
  if (!resolvedCustomerId && appointment.customerPhone) {
    const customer = await prisma.customer.findFirst({
      where: { tenantId, phone: appointment.customerPhone },
    });
    resolvedCustomerId = customer?.id || null;
  }

  if (!resolvedCustomerId) {
    throw new AppError(
      'لم يتم ربط العميل بالموعد. يرجى تحديد العميل أولاً من صفحة العملاء.',
      400
    );
  }

  // Use WorkOrderService to properly create with orderNumber, tokens, etc.
  const workOrder = await workOrderService.createWorkOrder(tenantId, userId, {
    vehicleId,
    branchId: targetBranchId,
    customerId: resolvedCustomerId,
    customerComplaints: appointment.serviceType
      ? `${appointment.serviceType}${appointment.notes ? ' — ' + appointment.notes : ''}`
      : appointment.notes || '',
    priority: 'NORMAL',
  });

  // Link work order to appointment + mark as completed
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { workOrderId: workOrder.id, status: 'COMPLETED' },
  });

  res.status(201).json({ success: true, workOrderId: workOrder.id, data: workOrder });
});

export default router;
