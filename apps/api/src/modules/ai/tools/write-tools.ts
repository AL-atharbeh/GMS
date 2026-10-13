/**
 * Write tools.
 *
 * These are never executed straight from a model call. The agent loop turns a
 * write tool call into an AiPendingAction row and stops; the user confirms in
 * the UI, and only then does executeWriteTool run. Every execution is recorded
 * in the existing AuditLog with the agent marked as the actor.
 */
import { Prisma, TechnicianSpecialty, WorkOrderStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ToolContext } from './context';
import { ToolImpl } from './read-tools';
import { logger } from '../../../utils/logger';

function str(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(input: Record<string, unknown>, key: string): number | undefined {
  const v = input[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) {
    return Number(v);
  }
  return undefined;
}

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

// ─── create_work_order ───────────────────────────────────────────────────────

const createWorkOrder: ToolImpl = {
  def: {
    name: 'create_work_order',
    description:
      'Open a new work order for a vehicle already registered in this garage. Requires user confirmation before it takes effect.',
    parameters: {
      type: 'object',
      properties: {
        plateNumber: {
          type: 'string',
          description: 'Plate number of an existing vehicle',
        },
        customerComplaints: {
          type: 'string',
          description: 'What the customer reported',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
        },
        mileageAtReception: { type: 'number' },
        diagnosisNotes: {
          type: 'string',
          description: 'Initial diagnosis, if known',
        },
      },
      required: ['plateNumber', 'customerComplaints'],
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const plateNumber = str(input, 'plateNumber');
    const complaints = str(input, 'customerComplaints');
    if (!plateNumber || !complaints) {
      throw new ToolValidationError(
        'plateNumber and customerComplaints are required.'
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        tenantId: ctx.tenantId,
        plateNumber: { equals: plateNumber, mode: 'insensitive' },
      },
      select: { id: true, customerVehicle: { select: { customerId: true } } },
    });
    if (!vehicle) {
      throw new ToolValidationError(
        `No vehicle with plate ${plateNumber} in this garage.`
      );
    }

    const branchId = ctx.branchId ?? (
      await prisma.branch.findFirst({
        where: { tenantId: ctx.tenantId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
    )?.id;
    if (!branchId) throw new ToolValidationError('No branch found for this garage.');

    // Order numbers are per-tenant and sequential within the year.
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    const last = await prisma.workOrder.findFirst({
      where: { tenantId: ctx.tenantId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const nextSeq = last
      ? Number(last.orderNumber.slice(prefix.length)) + 1
      : 1;
    const orderNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    const created = await prisma.workOrder.create({
      data: {
        tenantId: ctx.tenantId,
        branchId,
        vehicleId: vehicle.id,
        customerId: vehicle.customerVehicle?.customerId ?? null,
        createdById: ctx.userId,
        orderNumber,
        status: WorkOrderStatus.RECEIVED,
        priority: str(input, 'priority') ?? 'NORMAL',
        customerComplaints: complaints,
        mileageAtReception: num(input, 'mileageAtReception') ?? null,
        diagnosisNotes: str(input, 'diagnosisNotes') ?? null,
      },
      select: { id: true, orderNumber: true, status: true },
    });

    return created;
  },
};

// ─── update_work_order_status ────────────────────────────────────────────────

const updateWorkOrderStatus: ToolImpl = {
  def: {
    name: 'update_work_order_status',
    description:
      'Move a work order to a new status and record the transition in its history. Requires user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string' },
        newStatus: {
          type: 'string',
          enum: [
            'RECEIVED',
            'DIAGNOSING',
            'QUOTED',
            'AWAITING_APPROVAL',
            'APPROVED',
            'IN_PROGRESS',
            'QUALITY_CHECK',
            'READY_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED',
            'ON_HOLD',
          ],
        },
        note: { type: 'string', description: 'Reason for the change' },
      },
      required: ['orderNumber', 'newStatus'],
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const orderNumber = str(input, 'orderNumber');
    const newStatus = str(input, 'newStatus');
    if (!orderNumber || !newStatus) {
      throw new ToolValidationError('orderNumber and newStatus are required.');
    }

    const wo = await prisma.workOrder.findFirst({
      where: { tenantId: ctx.tenantId, orderNumber },
      select: { id: true, status: true },
    });
    if (!wo) throw new ToolValidationError(`Work order ${orderNumber} not found.`);

    const [updated] = await prisma.$transaction([
      prisma.workOrder.update({
        where: { id: wo.id },
        data: { status: newStatus as WorkOrderStatus },
        select: { orderNumber: true, status: true },
      }),
      prisma.workOrderStatusHistory.create({
        data: {
          workOrderId: wo.id,
          fromStatus: wo.status,
          toStatus: newStatus as WorkOrderStatus,
          changedById: ctx.userId,
          notes: str(input, 'note') ?? 'Changed via AI assistant',
        },
      }),
    ]);

    return { ...updated, previousStatus: wo.status };
  },
};

// ─── assign_task ─────────────────────────────────────────────────────────────

const assignTask: ToolImpl = {
  def: {
    name: 'assign_task',
    description:
      'Assign a work order to a technician. Identify the technician by their name or email. Requires user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string' },
        technician: {
          type: 'string',
          description: 'Technician name or email',
        },
        specialty: {
          type: 'string',
          enum: [
            'MECHANICAL',
            'ELECTRICAL',
            'BODYWORK',
            'PAINTING',
            'AC_SYSTEM',
            'TIRES',
            'GENERAL',
          ],
        },
        estimatedHours: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['orderNumber', 'technician'],
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const orderNumber = str(input, 'orderNumber');
    const who = str(input, 'technician');
    if (!orderNumber || !who) {
      throw new ToolValidationError('orderNumber and technician are required.');
    }

    const wo = await prisma.workOrder.findFirst({
      where: { tenantId: ctx.tenantId, orderNumber },
      select: { id: true },
    });
    if (!wo) throw new ToolValidationError(`Work order ${orderNumber} not found.`);

    const tech = await prisma.technician.findFirst({
      where: {
        tenantId: ctx.tenantId,
        user: {
          OR: [
            { name: { contains: who, mode: 'insensitive' } },
            { nameAr: { contains: who, mode: 'insensitive' } },
            { email: { equals: who, mode: 'insensitive' } },
          ],
        },
      },
      select: { id: true, user: { select: { name: true } } },
    });
    if (!tech) {
      throw new ToolValidationError(`No technician matching "${who}".`);
    }

    // Only accept a specialty the enum actually defines; anything else falls
    // back to GENERAL rather than failing the assignment.
    const rawSpecialty = str(input, 'specialty')?.toUpperCase();
    const specialty =
      rawSpecialty && rawSpecialty in TechnicianSpecialty
        ? (rawSpecialty as TechnicianSpecialty)
        : TechnicianSpecialty.GENERAL;

    const assignment = await prisma.taskAssignment.create({
      data: {
        workOrderId: wo.id,
        technicianId: tech.id,
        assignedById: ctx.userId,
        specialty,
        estimatedHours: num(input, 'estimatedHours') ?? null,
        notes: str(input, 'notes') ?? null,
      },
      select: { id: true, status: true },
    });

    return {
      assignmentId: assignment.id,
      status: assignment.status,
      technician: tech.user?.name,
      orderNumber,
    };
  },
};

// ─── create_part_request ─────────────────────────────────────────────────────

const createPartRequest: ToolImpl = {
  def: {
    name: 'create_part_request',
    description:
      'Raise a request for a part needed on a work order. Requires user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string' },
        partNumber: {
          type: 'string',
          description: 'Part number from the catalogue',
        },
        quantity: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['orderNumber', 'partNumber', 'quantity'],
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const orderNumber = str(input, 'orderNumber');
    const partNumber = str(input, 'partNumber');
    const quantity = num(input, 'quantity');
    if (!orderNumber || !partNumber || !quantity || quantity <= 0) {
      throw new ToolValidationError(
        'orderNumber, partNumber and a positive quantity are required.'
      );
    }

    const [wo, part] = await Promise.all([
      prisma.workOrder.findFirst({
        where: { tenantId: ctx.tenantId, orderNumber },
        select: { id: true },
      }),
      prisma.part.findFirst({
        where: { tenantId: ctx.tenantId, partNumber },
        select: { id: true, name: true },
      }),
    ]);
    if (!wo) throw new ToolValidationError(`Work order ${orderNumber} not found.`);
    if (!part) throw new ToolValidationError(`Part ${partNumber} not found.`);

    const request = await prisma.partRequest.create({
      data: {
        workOrderId: wo.id,
        partId: part.id,
        quantity: new Prisma.Decimal(quantity),
        requestedById: ctx.userId,
        notes: str(input, 'notes') ?? null,
      },
      select: { id: true, status: true, quantity: true },
    });

    return { requestId: request.id, status: request.status, part: part.name };
  },
};

// ─── add_work_order_item ─────────────────────────────────────────────────────

const addWorkOrderItem: ToolImpl = {
  def: {
    name: 'add_work_order_item',
    description:
      'Add a labour or part line to a work order, then recompute its totals. Requires user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string' },
        type: { type: 'string', enum: ['LABOR', 'PART'] },
        description: { type: 'string' },
        quantity: { type: 'number' },
        unitPrice: { type: 'number' },
        partNumber: {
          type: 'string',
          description: 'Required when type is PART',
        },
      },
      required: ['orderNumber', 'type', 'description', 'quantity', 'unitPrice'],
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const orderNumber = str(input, 'orderNumber');
    const type = str(input, 'type');
    const description = str(input, 'description');
    const quantity = num(input, 'quantity');
    const unitPrice = num(input, 'unitPrice');

    if (!orderNumber || !type || !description || quantity == null || unitPrice == null) {
      throw new ToolValidationError('All of orderNumber, type, description, quantity and unitPrice are required.');
    }
    if (quantity <= 0 || unitPrice < 0) {
      throw new ToolValidationError('quantity must be positive and unitPrice non-negative.');
    }
    if (type !== 'LABOR' && type !== 'PART') {
      throw new ToolValidationError('type must be LABOR or PART.');
    }

    const wo = await prisma.workOrder.findFirst({
      where: { tenantId: ctx.tenantId, orderNumber },
      select: { id: true },
    });
    if (!wo) throw new ToolValidationError(`Work order ${orderNumber} not found.`);

    let partId: string | null = null;
    if (type === 'PART') {
      const partNumber = str(input, 'partNumber');
      if (!partNumber) {
        throw new ToolValidationError('partNumber is required when type is PART.');
      }
      const part = await prisma.part.findFirst({
        where: { tenantId: ctx.tenantId, partNumber },
        select: { id: true },
      });
      if (!part) throw new ToolValidationError(`Part ${partNumber} not found.`);
      partId = part.id;
    }

    const totalPrice = new Prisma.Decimal(quantity).mul(unitPrice);

    const item = await prisma.workOrderItem.create({
      data: {
        workOrderId: wo.id,
        type,
        partId,
        description,
        quantity: new Prisma.Decimal(quantity),
        unitPrice: new Prisma.Decimal(unitPrice),
        totalPrice,
      },
      select: { id: true, description: true, totalPrice: true },
    });

    // Recompute order totals from its lines so the figures stay consistent.
    const sums = await prisma.workOrderItem.groupBy({
      by: ['type'],
      where: { workOrderId: wo.id },
      _sum: { totalPrice: true },
    });
    const laborCost =
      sums.find((s) => s.type === 'LABOR')?._sum.totalPrice ?? new Prisma.Decimal(0);
    const partsCost =
      sums.find((s) => s.type === 'PART')?._sum.totalPrice ?? new Prisma.Decimal(0);

    const updated = await prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        laborCost,
        partsCost,
        totalAmount: laborCost.add(partsCost),
      },
      select: { orderNumber: true, laborCost: true, partsCost: true, totalAmount: true },
    });

    return { item, orderTotals: updated };
  },
};

export const WRITE_TOOL_IMPLS: Record<string, ToolImpl> = {
  create_work_order: createWorkOrder,
  update_work_order_status: updateWorkOrderStatus,
  assign_task: assignTask,
  create_part_request: createPartRequest,
  add_work_order_item: addWorkOrderItem,
};

/**
 * Human-readable description of what a pending write will do, shown on the
 * confirmation button. Built from the tool input, not from model prose, so the
 * user is approving the actual effect.
 */
export function describeWriteAction(
  toolName: string,
  input: Record<string, unknown>
): { en: string; ar: string } {
  const order = str(input, 'orderNumber') ?? '';
  switch (toolName) {
    case 'create_work_order':
      return {
        en: `Open a new work order for vehicle ${str(input, 'plateNumber') ?? '?'}`,
        ar: `فتح أمر عمل جديد للسيارة ${str(input, 'plateNumber') ?? '؟'}`,
      };
    case 'update_work_order_status':
      return {
        en: `Change ${order} to ${str(input, 'newStatus') ?? '?'}`,
        ar: `تغيير حالة ${order} إلى ${str(input, 'newStatus') ?? '؟'}`,
      };
    case 'assign_task':
      return {
        en: `Assign ${order} to ${str(input, 'technician') ?? '?'}`,
        ar: `إسناد ${order} إلى ${str(input, 'technician') ?? '؟'}`,
      };
    case 'create_part_request':
      return {
        en: `Request ${num(input, 'quantity') ?? '?'} × ${str(input, 'partNumber') ?? '?'} for ${order}`,
        ar: `طلب ${num(input, 'quantity') ?? '؟'} × ${str(input, 'partNumber') ?? '؟'} لأمر ${order}`,
      };
    case 'add_work_order_item':
      return {
        en: `Add ${str(input, 'type') ?? '?'} line "${str(input, 'description') ?? '?'}" to ${order}`,
        ar: `إضافة بند ${str(input, 'type') ?? '؟'} «${str(input, 'description') ?? '؟'}» إلى ${order}`,
      };
    default:
      return { en: `Run ${toolName}`, ar: `تنفيذ ${toolName}` };
  }
}

/** Executes a confirmed write and writes an audit record. */
export async function executeWriteTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const impl = WRITE_TOOL_IMPLS[toolName];
  if (!impl) throw new ToolValidationError(`Unknown write tool: ${toolName}`);

  const result = await impl.run(input, ctx);

  try {
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: `AI_AGENT.${toolName}`,
        resource: 'ai_agent',
        newData: { input, result } as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // An audit write failure must not roll back work the user confirmed.
    logger.error('Failed to audit AI agent action', { toolName, err });
  }

  return result;
}
