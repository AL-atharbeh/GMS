import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { WorkOrderStatus, Prisma } from '@prisma/client';
import { generateOrderNumber } from '../../utils/generators';
import { NotificationService } from '../notifications/notification.service';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { env } from '../../config/env';

interface CreateWorkOrderDto {
  vehicleId: string;
  branchId: string;
  customerId?: string;
  priority?: string;
  mileageAtReception?: number;
  customerComplaints?: string;
  customerComplaintsAr?: string;
  estimatedReadyAt?: Date;
  internalNotes?: string;
}

interface UpdateWorkOrderStatusDto {
  status: WorkOrderStatus;
  notes?: string;
  diagnosisNotes?: string;
  diagnosisDiagram?: any;
}

interface CreateWorkOrderItemDto {
  type: 'LABOR' | 'PART';
  laborRateId?: string;
  partId?: string;
  description: string;
  descriptionAr?: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  discountPercent?: number;
  notes?: string;
}

export class WorkOrderService {
  private notificationService = new NotificationService();

  // ─── Create Work Order ──────────────────────────────────────────────────────
  async createWorkOrder(tenantId: string, userId: string, data: CreateWorkOrderDto) {
    // Verify vehicle belongs to tenant
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: data.vehicleId, tenantId },
      include: { customerVehicle: { include: { customer: true } } },
    });

    if (!vehicle) throw new AppError('Vehicle not found', 404);

    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, tenantId },
    });
    if (!branch) throw new AppError('Branch not found', 404);

    const orderNumber = await generateOrderNumber(tenantId, 'WO');
    const trackingToken = uuidv4();
    const approvalToken = uuidv4();

    const workOrder = await prisma.workOrder.create({
      data: {
        tenantId,
        branchId: data.branchId,
        vehicleId: data.vehicleId,
        customerId: data.customerId || vehicle.customerVehicle?.customerId,
        createdById: userId,
        orderNumber,
        status: 'RECEIVED',
        priority: data.priority || 'NORMAL',
        mileageAtReception: data.mileageAtReception,
        customerComplaints: data.customerComplaints,
        customerComplaintsAr: data.customerComplaintsAr,
        estimatedReadyAt: data.estimatedReadyAt,
        internalNotes: data.internalNotes,
        trackingToken,
        approvalToken,
      },
      include: {
        vehicle: true,
        customer: true,
        branch: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Update vehicle mileage history
    if (data.mileageAtReception) {
      await prisma.vehicleHistoryEntry.create({
        data: {
          vehicleId: vehicle.id,
          mileage: data.mileageAtReception,
          workOrderId: workOrder.id,
          type: 'WORK_ORDER',
          description: `Work order ${orderNumber} created`,
        },
      });
    }

    // Status history
    await prisma.workOrderStatusHistory.create({
      data: {
        workOrderId: workOrder.id,
        toStatus: 'RECEIVED',
        changedById: userId,
        notes: 'Work order created',
      },
    });

    // Send notification to customer
    if (workOrder.customer?.phone) {
      await this.notificationService.sendWorkOrderNotification(
        workOrder,
        'WORK_ORDER_RECEIVED'
      );
    }

    return workOrder;
  }

  // ─── Get Work Orders (with filters) ────────────────────────────────────────
  async getWorkOrders(
    tenantId: string,
    filters: {
      branchId?: string;
      status?: WorkOrderStatus;
      page?: number;
      limit?: number;
      search?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    const { page = 1, limit = 20, search, branchId, status, dateFrom, dateTo } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkOrderWhereInput = {
      tenantId,
      ...(branchId && { branchId }),
      ...(status && { status }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: dateFrom }),
              ...(dateTo && { lte: dateTo }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { vehicle: { plateNumber: { contains: search, mode: 'insensitive' } } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [workOrders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          priority: true,
          receivedAt: true,
          totalAmount: true,
          trackingToken: true,
          vehicle: { select: { id: true, plateNumber: true, make: true, model: true, year: true } },
          customer: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          taskAssignments: {
            include: { technician: { include: { user: { select: { name: true } } } } },
          },
          _count: { select: { workOrderItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.workOrder.count({ where }),
    ]);

    return {
      data: workOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Single Work Order ──────────────────────────────────────────────────
  async getWorkOrder(tenantId: string, workOrderId: string) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        vehicle: true,
        customer: { include: { loyaltyTransactions: { take: 5, orderBy: { createdAt: 'desc' } } } },
        branch: true,
        createdBy: { select: { id: true, name: true, email: true } },
        workOrderItems: {
          include: { laborRate: true, part: true },
          orderBy: { sortOrder: 'asc' },
        },
        taskAssignments: {
          include: {
            technician: { include: { user: { select: { id: true, name: true, avatar: true } } } },
            assignedBy: { select: { id: true, name: true } },
          },
        },
        photos: { orderBy: { sortOrder: 'asc' } },
        qualityChecks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { items: { include: { templateItem: true } } },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        invoice: true,
        warrantyRecords: { where: { isVoided: false } },
        partRequests: { include: { part: true } },
      },
    });

    if (!workOrder) throw new AppError('Work order not found', 404);
    return workOrder;
  }

  // ─── Generate Intake QR Code (internal, authenticated staff link) ───────────
  async generateQrCode(tenantId: string, workOrderId: string) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: {
        id: true,
        orderNumber: true,
        vehicle: { select: { make: true, model: true, plateNumber: true } },
      },
    });
    if (!workOrder) throw new AppError('Work order not found', 404);

    const internalUrl = `${env.FRONTEND_URL}/work-orders/${workOrder.id}`;
    const qrDataUrl = await QRCode.toDataURL(internalUrl, { margin: 1, width: 300 });

    return {
      orderNumber: workOrder.orderNumber,
      vehicle: workOrder.vehicle,
      url: internalUrl,
      qrDataUrl,
    };
  }

  // ─── Update Work Order Status ───────────────────────────────────────────────
  async updateStatus(
    tenantId: string,
    workOrderId: string,
    userId: string,
    data: UpdateWorkOrderStatusDto
  ) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: { customer: true },
    });

    if (!workOrder) throw new AppError('Work order not found', 404);

    await this.validateStatusTransition(workOrder.status, data.status, workOrderId);

    const updateData: Prisma.WorkOrderUpdateInput = {
      status: data.status,
      ...(data.diagnosisNotes && { diagnosisNotes: data.diagnosisNotes }),
      ...(data.diagnosisDiagram && { diagnosisDiagram: data.diagnosisDiagram }),
    };

    // Set timestamps based on status
    const now = new Date();
    switch (data.status) {
      case 'DIAGNOSING': updateData.diagnosedAt = now; break;
      case 'QUOTED': updateData.quotedAt = now; break;
      case 'APPROVED': updateData.approvedAt = now; break;
      case 'IN_PROGRESS': updateData.workStartedAt = now; break;
      case 'QUALITY_CHECK': updateData.qualityCheckedAt = now; break;
      case 'READY_FOR_DELIVERY': updateData.readyAt = now; break;
      case 'DELIVERED': updateData.deliveredAt = now; break;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.update({
        where: { id: workOrderId },
        data: updateData,
        include: { vehicle: true, customer: true, branch: true },
      });

      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId,
          fromStatus: workOrder.status,
          toStatus: data.status,
          changedById: userId,
          notes: data.notes,
        },
      });

      return wo;
    });

    // Send notifications
    const notificationTypes: Partial<Record<WorkOrderStatus, string>> = {
      DIAGNOSING: 'DIAGNOSIS_STARTED',
      QUOTED: 'QUOTE_READY',
      IN_PROGRESS: 'WORK_STARTED',
      READY_FOR_DELIVERY: 'VEHICLE_READY',
      DELIVERED: 'VEHICLE_DELIVERED',
    };

    const notifType = notificationTypes[data.status];
    if (notifType && updated.customer?.phone) {
      await this.notificationService.sendWorkOrderNotification(updated as any, notifType);
    }

    return updated;
  }

  // ─── Add Work Order Items ───────────────────────────────────────────────────
  async addItems(tenantId: string, workOrderId: string, items: CreateWorkOrderItemDto[]) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
    });
    if (!workOrder) throw new AppError('Work order not found', 404);

    const createdItems = await prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        items.map((item, index) => {
          const discountMultiplier = 1 - (item.discountPercent || 0) / 100;
          const totalPrice = item.quantity * item.unitPrice * discountMultiplier;

          return tx.workOrderItem.create({
            data: {
              workOrderId,
              type: item.type,
              laborRateId: item.laborRateId,
              partId: item.partId,
              description: item.description,
              descriptionAr: item.descriptionAr,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              costPrice: item.costPrice || 0,
              discountPercent: item.discountPercent || 0,
              totalPrice,
              notes: item.notes,
              sortOrder: index,
            },
          });
        })
      );

      // Recalculate totals
      await this.recalculateTotals(tx, workOrderId, tenantId);
      return created;
    });

    return createdItems;
  }

  // ─── Customer Approval via Link ─────────────────────────────────────────────
  async approveViaToken(approvalToken: string, approved: boolean, rejectionReason?: string) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { approvalToken },
      include: { customer: true, vehicle: true },
    });

    if (!workOrder) throw new AppError('Invalid approval link', 404);
    if (workOrder.status !== 'AWAITING_APPROVAL') {
      throw new AppError('This quote is no longer pending approval', 400);
    }

    const newStatus: WorkOrderStatus = approved ? 'APPROVED' : 'CANCELLED';

    await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: newStatus,
        approvedAt: approved ? new Date() : undefined,
        rejectionReason: !approved ? rejectionReason : undefined,
        approvalMethod: 'LINK',
      },
    });

    return { approved, workOrderId: workOrder.id };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────
  private async recalculateTotals(tx: any, workOrderId: string, tenantId: string) {
    const items = await tx.workOrderItem.findMany({ where: { workOrderId } });
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });

    const laborCost = items
      .filter((i: any) => i.type === 'LABOR')
      .reduce((sum: number, i: any) => sum + Number(i.totalPrice), 0);

    const partsCost = items
      .filter((i: any) => i.type === 'PART')
      .reduce((sum: number, i: any) => sum + Number(i.totalPrice), 0);

    const subtotal = laborCost + partsCost;
    const taxRate = Number(tenant?.vatRate || 0);
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    await tx.workOrder.update({
      where: { id: workOrderId },
      data: { laborCost, partsCost, taxAmount, totalAmount },
    });
  }

  async assignTask(
    tenantId: string,
    workOrderId: string,
    assignedById: string,
    data: {
      technicianId: string;
      specialty: any;
      notes?: string;
      estimatedHours?: number;
    }
  ) {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
    });
    if (!workOrder) throw new AppError('Work order not found', 404);

    const technician = await prisma.technician.findFirst({
      where: { id: data.technicianId, tenantId },
    });
    if (!technician) throw new AppError('Technician not found', 404);

    // 3. Check for previous completed work order in the last 14 days for same vehicle and same specialty
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const previousAssignment = await prisma.taskAssignment.findFirst({
      where: {
        specialty: data.specialty,
        workOrder: {
          vehicleId: workOrder.vehicleId,
          tenantId,
          status: 'DELIVERED',
          createdAt: { gte: fourteenDaysAgo },
        },
      },
      include: {
        workOrder: true,
        technician: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let reworkStatus = 'NONE';
    let reworkReason = null;

    if (previousAssignment) {
      reworkStatus = 'PENDING';
      reworkReason = `نفس السيارة ونفس التخصص خلال 14 يوم. تاريخ الصيانة السابقة: ${new Date(previousAssignment.createdAt).toLocaleDateString('ar-KW')} بواسطة الفني ${previousAssignment.technician.user.name}. رقم كرت العمل السابق: ${previousAssignment.workOrder.orderNumber}`;
    }

    const assignment = await prisma.taskAssignment.create({
      data: {
        workOrderId,
        technicianId: data.technicianId,
        assignedById,
        specialty: data.specialty,
        estimatedHours: data.estimatedHours || 1,
        notes: data.notes,
        status: 'PENDING',
        reworkStatus,
        reworkReason,
      },
      include: {
        technician: { include: { user: { select: { name: true } } } },
      },
    });

    return assignment;
  }

  private async validateStatusTransition(current: WorkOrderStatus, next: WorkOrderStatus, workOrderId: string) {
    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      RECEIVED: ['DIAGNOSING', 'CANCELLED'],
      DIAGNOSING: ['QUOTED', 'CANCELLED'],
      QUOTED: ['AWAITING_APPROVAL', 'APPROVED', 'CANCELLED'],
      AWAITING_APPROVAL: ['APPROVED', 'CANCELLED'],
      APPROVED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['QUALITY_CHECK', 'CANCELLED'],
      QUALITY_CHECK: ['READY_FOR_DELIVERY', 'IN_PROGRESS'],
      READY_FOR_DELIVERY: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!validTransitions[current].includes(next)) {
      throw new AppError(
        `Cannot transition from ${current} to ${next}`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    if (next === 'DELIVERED') {
      const completionPhoto = await prisma.workOrderPhoto.findFirst({
        where: { workOrderId, type: 'COMPLETION' },
      });
      if (!completionPhoto) {
        throw new AppError(
          'لا يمكن التسليم: يجب رفع صورة بعد الإنجاز',
          400,
          'MISSING_COMPLETION_PHOTO'
        );
      }

      const qualityCheck = await prisma.qualityCheck.findFirst({
        where: { workOrderId },
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { templateItem: true } } },
      });

      if (!qualityCheck) {
        throw new AppError(
          'لا يمكن التسليم: يجب إكمال فحص الجودة أولاً',
          400,
          'MISSING_QUALITY_CHECK'
        );
      }

      if (qualityCheck.items.length > 0) {
        const requiredCount = await prisma.qualityCheckTemplateItem.count({
          where: { templateId: qualityCheck.items[0].templateItem.templateId, isRequired: true },
        });
        const answeredRequiredCount = qualityCheck.items.filter((i) => i.templateItem.isRequired).length;
        if (answeredRequiredCount < requiredCount) {
          throw new AppError(
            'لا يمكن التسليم: يجب إكمال فحص الجودة أولاً',
            400,
            'MISSING_QUALITY_CHECK'
          );
        }
      } else if (qualityCheck.isPassed === null) {
        throw new AppError(
          'لا يمكن التسليم: يجب إكمال فحص الجودة أولاً',
          400,
          'MISSING_QUALITY_CHECK'
        );
      }

      const pendingTask = await prisma.taskAssignment.findFirst({
        where: { workOrderId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        include: { technician: { include: { user: { select: { name: true } } } } },
      });
      if (pendingTask) {
        throw new AppError(
          `لا يمكن التسليم: مهمة الفني ${pendingTask.technician.user.name} لسه غير مكتملة`,
          400,
          'PENDING_TASK_ASSIGNMENT'
        );
      }
    }
  }
}

export const workOrderService = new WorkOrderService();
