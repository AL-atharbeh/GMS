/**
 * Read tools. These run without confirmation but are always tenant-scoped by
 * the ToolContext, never by model-supplied arguments.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { ToolContext } from './context';
import { AgentToolDef } from '../providers/types';

/** A tool the agent can call: schema for the model, handler for the server. */
export interface ToolImpl {
  def: AgentToolDef;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
}

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

// ─── get_work_order ──────────────────────────────────────────────────────────

const getWorkOrder: ToolImpl = {
  def: {
    name: 'get_work_order',
    description:
      'Get full details of one work order: vehicle, customer, status, complaints, diagnosis, parts used, assigned technicians and costs. Accepts the order number (e.g. WO-2026-0007) or the work order id.',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: {
          type: 'string',
          description: 'Order number such as WO-2026-0007',
        },
        workOrderId: { type: 'string', description: 'Work order UUID' },
      },
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const orderNumber = str(input, 'orderNumber');
    const workOrderId = str(input, 'workOrderId');

    if (!orderNumber && !workOrderId) {
      return { error: 'Provide either orderNumber or workOrderId.' };
    }

    const wo = await prisma.workOrder.findFirst({
      where: {
        tenantId: ctx.tenantId,
        ...(workOrderId ? { id: workOrderId } : {}),
        ...(orderNumber ? { orderNumber } : {}),
      },
      include: {
        vehicle: {
          select: {
            plateNumber: true,
            make: true,
            model: true,
            year: true,
            vin: true,
            engineSize: true,
            fuelType: true,
            transmissionType: true,
          },
        },
        customer: { select: { name: true, nameAr: true, phone: true } },
        branch: { select: { name: true } },
        workOrderItems: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            type: true,
          },
        },
        taskAssignments: {
          select: {
            status: true,
            specialty: true,
            estimatedHours: true,
            actualHours: true,
            technician: {
              select: { user: { select: { name: true, nameAr: true } } },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: { fromStatus: true, toStatus: true, createdAt: true },
        },
      },
    });

    if (!wo) return { error: 'No work order found for this garage.' };

    return {
      orderNumber: wo.orderNumber,
      status: wo.status,
      priority: wo.priority,
      branch: wo.branch?.name,
      vehicle: wo.vehicle,
      customer: wo.customer,
      mileageAtReception: wo.mileageAtReception,
      customerComplaints: wo.customerComplaints,
      customerComplaintsAr: wo.customerComplaintsAr,
      diagnosisNotes: wo.diagnosisNotes,
      internalNotes: wo.internalNotes,
      receivedAt: wo.receivedAt,
      estimatedReadyAt: wo.estimatedReadyAt,
      deliveredAt: wo.deliveredAt,
      costs: {
        labor: wo.laborCost,
        parts: wo.partsCost,
        discount: wo.discountAmount,
        tax: wo.taxAmount,
        total: wo.totalAmount,
      },
      items: wo.workOrderItems,
      assignments: wo.taskAssignments,
      statusHistory: wo.statusHistory,
    };
  },
};

// ─── search_work_orders ──────────────────────────────────────────────────────

const searchWorkOrders: ToolImpl = {
  def: {
    name: 'search_work_orders',
    description:
      'List work orders in this garage, optionally filtered by status, priority, plate number or date range. Use this for questions like "what is open right now" or "which cars are waiting for approval".',
    parameters: {
      type: 'object',
      properties: {
        status: {
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
        priority: {
          type: 'string',
          enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
        },
        plateNumber: { type: 'string' },
        sinceDays: {
          type: 'number',
          description: 'Only orders received in the last N days',
        },
        limit: { type: 'number', description: 'Max rows, default 20, max 50' },
      },
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const limit = Math.min(Math.max(num(input, 'limit') ?? 20, 1), 50);
    const sinceDays = num(input, 'sinceDays');
    const plateNumber = str(input, 'plateNumber');
    const status = str(input, 'status');
    const priority = str(input, 'priority');

    const rows = await prisma.workOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(status ? { status: status as never } : {}),
        ...(priority ? { priority } : {}),
        ...(plateNumber
          ? { vehicle: { plateNumber: { contains: plateNumber, mode: 'insensitive' } } }
          : {}),
        ...(sinceDays
          ? {
              receivedAt: {
                gte: new Date(Date.now() - sinceDays * 86_400_000),
              },
            }
          : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: {
        orderNumber: true,
        status: true,
        priority: true,
        receivedAt: true,
        estimatedReadyAt: true,
        totalAmount: true,
        customerComplaints: true,
        vehicle: {
          select: { plateNumber: true, make: true, model: true, year: true },
        },
        customer: { select: { name: true } },
      },
    });

    return { count: rows.length, workOrders: rows };
  },
};

// ─── get_vehicle_history ─────────────────────────────────────────────────────

const getVehicleHistory: ToolImpl = {
  def: {
    name: 'get_vehicle_history',
    description:
      'Full service history for one vehicle by plate number or VIN: every past work order with its complaint, diagnosis, parts replaced and cost. Use this before diagnosing a returning car.',
    parameters: {
      type: 'object',
      properties: {
        plateNumber: { type: 'string' },
        vin: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const plateNumber = str(input, 'plateNumber');
    const vin = str(input, 'vin');

    if (!plateNumber && !vin) {
      return { error: 'Provide either plateNumber or vin.' };
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        tenantId: ctx.tenantId,
        ...(vin ? { vin } : {}),
        ...(plateNumber
          ? { plateNumber: { equals: plateNumber, mode: 'insensitive' } }
          : {}),
      },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
        year: true,
        vin: true,
        engineSize: true,
        fuelType: true,
        transmissionType: true,
        notes: true,
      },
    });

    if (!vehicle) return { error: 'Vehicle not found in this garage.' };

    const history = await prisma.workOrder.findMany({
      where: { tenantId: ctx.tenantId, vehicleId: vehicle.id },
      orderBy: { receivedAt: 'desc' },
      take: 30,
      select: {
        orderNumber: true,
        status: true,
        receivedAt: true,
        deliveredAt: true,
        mileageAtReception: true,
        customerComplaints: true,
        customerComplaintsAr: true,
        diagnosisNotes: true,
        totalAmount: true,
        workOrderItems: {
          select: { description: true, quantity: true, type: true },
        },
      },
    });

    return { vehicle, visitCount: history.length, history };
  },
};

// ─── find_similar_faults ─────────────────────────────────────────────────────
// Stage 1 of grounded diagnosis: trigram search over this garage's own past
// work orders. The agent layer reranks these with the fast model before the
// main model writes the diagnosis.

interface SimilarFaultRow {
  orderNumber: string;
  status: string;
  receivedAt: Date;
  customerComplaints: string | null;
  customerComplaintsAr: string | null;
  diagnosisNotes: string | null;
  totalAmount: Prisma.Decimal;
  make: string;
  model: string;
  year: number;
  plateNumber: string;
  similarity: number;
}

const findSimilarFaults: ToolImpl = {
  def: {
    name: 'find_similar_faults',
    description:
      "Search this garage's own past work orders for similar symptoms, optionally narrowed to a vehicle make/model. Returns what the fault turned out to be and what fixed it. This is the most valuable tool for diagnosis — always try it before answering from general knowledge.",
    parameters: {
      type: 'object',
      properties: {
        symptoms: {
          type: 'string',
          description:
            'The symptoms as described, in Arabic or English, e.g. "اهتزاز عند السرعات العالية" or "knocking noise when cold".',
        },
        make: { type: 'string', description: 'Vehicle make, e.g. Toyota' },
        model: { type: 'string', description: 'Vehicle model, e.g. Camry' },
        limit: { type: 'number', description: 'Max matches, default 8, max 20' },
      },
      required: ['symptoms'],
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const symptoms = str(input, 'symptoms');
    if (!symptoms) return { error: 'symptoms is required.' };

    const make = str(input, 'make');
    const model = str(input, 'model');
    const limit = Math.min(Math.max(num(input, 'limit') ?? 8, 1), 20);

    // Parameterised throughout: symptoms text is model-generated and may
    // itself have come from attacker-controlled complaint text.
    const rows = await prisma.$queryRaw<SimilarFaultRow[]>`
      SELECT
        wo."orderNumber",
        wo."status"::text               AS status,
        wo."receivedAt",
        wo."customerComplaints",
        wo."customerComplaintsAr",
        wo."diagnosisNotes",
        wo."totalAmount",
        v."make",
        v."model",
        v."year",
        v."plateNumber",
        GREATEST(
          similarity(COALESCE(wo."customerComplaints", ''),   ${symptoms}),
          similarity(COALESCE(wo."customerComplaintsAr", ''), ${symptoms}),
          similarity(COALESCE(wo."diagnosisNotes", ''),       ${symptoms})
        ) AS similarity
      FROM "work_orders" wo
      JOIN "vehicles" v ON v."id" = wo."vehicleId"
      WHERE wo."tenantId" = ${ctx.tenantId}
        AND wo."diagnosisNotes" IS NOT NULL
        AND (${make}::text  IS NULL OR v."make"  ILIKE ${make})
        AND (${model}::text IS NULL OR v."model" ILIKE ${model})
        AND GREATEST(
              similarity(COALESCE(wo."customerComplaints", ''),   ${symptoms}),
              similarity(COALESCE(wo."customerComplaintsAr", ''), ${symptoms}),
              similarity(COALESCE(wo."diagnosisNotes", ''),       ${symptoms})
            ) > 0.08
      ORDER BY similarity DESC, wo."receivedAt" DESC
      LIMIT ${limit}
    `;

    if (!rows.length) {
      return {
        matches: [],
        note: 'No similar past faults recorded in this garage. Answer from general knowledge and say so explicitly.',
      };
    }

    // Which parts were actually used on those jobs — the "what fixed it" half.
    const orderNumbers = rows.map((r) => r.orderNumber);
    const items = await prisma.workOrder.findMany({
      where: { tenantId: ctx.tenantId, orderNumber: { in: orderNumbers } },
      select: {
        orderNumber: true,
        workOrderItems: {
          select: { description: true, quantity: true, type: true },
        },
      },
    });
    const itemsByOrder = new Map(
      items.map((i) => [i.orderNumber, i.workOrderItems])
    );

    return {
      matches: rows.map((r) => ({
        orderNumber: r.orderNumber,
        similarity: Number(r.similarity.toFixed(3)),
        vehicle: `${r.year} ${r.make} ${r.model} (${r.plateNumber})`,
        receivedAt: r.receivedAt,
        status: r.status,
        complaint: r.customerComplaints || r.customerComplaintsAr,
        diagnosis: r.diagnosisNotes,
        totalAmount: r.totalAmount,
        partsUsed: itemsByOrder.get(r.orderNumber) ?? [],
      })),
    };
  },
};

// ─── check_part_availability ─────────────────────────────────────────────────

const checkPartAvailability: ToolImpl = {
  def: {
    name: 'check_part_availability',
    description:
      'Check stock for a part by name or part number, with supplier options: purchase price, lead time in days and which supplier is preferred. Use this when recommending a repair so the answer includes whether the part is on hand.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Part name or part number, Arabic or English',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const query = str(input, 'query');
    if (!query) return { error: 'query is required.' };

    const parts = await prisma.part.findMany({
      where: {
        tenantId: ctx.tenantId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { nameAr: { contains: query, mode: 'insensitive' } },
          { partNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        name: true,
        nameAr: true,
        partNumber: true,
        sellingPrice: true,
        inventory: {
          select: {
            quantity: true,
            reservedQty: true,
            availableQty: true,
            minStockLevel: true,
            reorderPoint: true,
            location: true,
            branch: { select: { name: true } },
          },
        },
        suppliers: {
          select: {
            purchasePrice: true,
            leadTimeDays: true,
            isPreferred: true,
            supplierPartNumber: true,
            supplier: {
              select: { name: true, nameAr: true, phone: true, paymentTermDays: true },
            },
          },
        },
      },
    });

    if (!parts.length) {
      return { parts: [], note: 'No matching part in this garage catalogue.' };
    }

    return {
      parts: parts.map((p) => ({
        name: p.name,
        nameAr: p.nameAr,
        partNumber: p.partNumber,
        sellingPrice: p.sellingPrice,
        stock: p.inventory.map((i) => ({
          branch: i.branch?.name,
          location: i.location,
          onHand: i.quantity,
          reserved: i.reservedQty,
          available: i.availableQty,
          minStockLevel: i.minStockLevel,
          reorderPoint: i.reorderPoint,
        })),
        suppliers: p.suppliers,
      })),
    };
  },
};

// ─── get_financial_summary ───────────────────────────────────────────────────

const getFinancialSummary: ToolImpl = {
  def: {
    name: 'get_financial_summary',
    description:
      'Revenue, costs, profit and invoice status totals for this garage over a recent period. Restricted to owner and accountant roles.',
    parameters: {
      type: 'object',
      properties: {
        periodDays: {
          type: 'number',
          description: 'Look-back window in days, default 30, max 365',
        },
      },
      additionalProperties: false,
    },
  },
  async run(input, ctx) {
    const periodDays = Math.min(Math.max(num(input, 'periodDays') ?? 30, 1), 365);
    const since = new Date(Date.now() - periodDays * 86_400_000);

    const [orders, invoices] = await Promise.all([
      prisma.workOrder.aggregate({
        where: { tenantId: ctx.tenantId, receivedAt: { gte: since } },
        _sum: { totalAmount: true, laborCost: true, partsCost: true },
        _count: true,
      }),
      prisma.invoice.groupBy({
        by: ['status'],
        where: { tenantId: ctx.tenantId, createdAt: { gte: since } },
        _sum: { total: true, paidAmount: true },
        _count: true,
      }),
    ]);

    return {
      periodDays,
      workOrders: {
        count: orders._count,
        billed: orders._sum.totalAmount ?? 0,
        laborCost: orders._sum.laborCost ?? 0,
        partsCost: orders._sum.partsCost ?? 0,
      },
      invoicesByStatus: invoices.map((i) => ({
        status: i.status,
        count: i._count,
        total: i._sum.total ?? 0,
        paid: i._sum.paidAmount ?? 0,
      })),
    };
  },
};

export const READ_TOOLS: Record<string, ToolImpl> = {
  get_work_order: getWorkOrder,
  search_work_orders: searchWorkOrders,
  get_vehicle_history: getVehicleHistory,
  find_similar_faults: findSimilarFaults,
  check_part_availability: checkPartAvailability,
  get_financial_summary: getFinancialSummary,
};
