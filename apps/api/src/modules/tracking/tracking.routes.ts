import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();

// Public tracking endpoint - no auth needed
router.get('/:token', async (req: any, res: Response) => {
  const { token } = req.params;

  const workOrder = await prisma.workOrder.findFirst({
    where: { trackingToken: token },
    include: {
      vehicle: {
        select: { make: true, model: true, year: true, plateNumber: true, color: true },
      },
      branch: {
        select: { name: true, nameAr: true, phone: true, address: true },
      },
      workOrderItems: {
        select: {
          type: true,
          description: true,
          descriptionAr: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          isApproved: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
      statusHistory: {
        select: { toStatus: true, createdAt: true, notes: true },
        orderBy: { createdAt: 'asc' },
      },
      photos: {
        select: { url: true, thumbnailUrl: true, type: true, caption: true },
        orderBy: { sortOrder: 'asc' },
      },
      taskAssignments: {
        select: {
          specialty: true,
          status: true,
          technician: {
            select: { user: { select: { name: true } } },
          },
        },
      },
      invoice: {
        select: { id: true, invoiceNumber: true, status: true, total: true, paidAmount: true, remainingAmount: true },
      },
    },
  });

  if (!workOrder) {
    throw new AppError('Tracking link not found', 404);
  }

  // Return public-safe data only
  const publicData = {
    id: workOrder.id,
    orderNumber: workOrder.orderNumber,
    status: workOrder.status,
    vehicle: workOrder.vehicle,
    branch: workOrder.branch,
    receivedAt: workOrder.receivedAt,
    estimatedReadyAt: workOrder.estimatedReadyAt,
    deliveredAt: workOrder.deliveredAt,
    items: workOrder.workOrderItems,
    timeline: workOrder.statusHistory.map((h) => ({
      status: h.toStatus,
      date: h.createdAt,
      note: h.notes,
    })),
    photos: workOrder.photos,
    technicians: workOrder.taskAssignments.map((t) => ({
      specialty: t.specialty,
      name: t.technician.user.name,
    })),
    totalAmount: workOrder.totalAmount,
    approvalToken: workOrder.status === 'AWAITING_APPROVAL' ? workOrder.approvalToken : undefined,
    invoice: workOrder.invoice,
  };

  res.json({ success: true, data: publicData });
});

export default router;
