import { Router, Response } from 'express';
import { z } from 'zod';
import { workOrderService } from './workOrder.service';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { WorkOrderStatus } from '@prisma/client';

const router = Router();

// ─── Customer Approval (Public — via token) ─────────────────────────────────
router.get('/approve/:token', async (req, res) => {
  // Return work order details for the approval page
  const { prisma } = await import('../../config/database');
  const workOrder = await prisma.workOrder.findUnique({
    where: { approvalToken: req.params.token },
    include: {
      vehicle: true,
      customer: { select: { name: true, phone: true } },
      workOrderItems: true,
      branch: { select: { name: true, phone: true } },
    },
  });
  if (!workOrder) {
    return res.status(404).json({ success: false, message: 'Invalid link' });
  }
  res.json({ success: true, data: workOrder });
});

router.post('/approve/:token', async (req, res) => {
  const { approved, rejectionReason } = req.body;
  const result = await workOrderService.approveViaToken(
    req.params.token,
    approved,
    rejectionReason
  );
  res.json({ success: true, data: result });
});

// All other routes require authentication
router.use(authenticate);

// ─── Create Work Order ──────────────────────────────────────────────────────
const createSchema = z.object({
  body: z.object({
    vehicleId: z.string().uuid(),
    branchId: z.string().uuid(),
    customerId: z.string().uuid().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    mileageAtReception: z.number().positive().optional(),
    customerComplaints: z.string().max(2000).optional(),
    customerComplaintsAr: z.string().max(2000).optional(),
    estimatedReadyAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    internalNotes: z.string().max(2000).optional(),
  }),
});

router.post('/', authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'), validate(createSchema), async (req: AuthRequest, res: Response) => {
  const workOrder = await workOrderService.createWorkOrder(
    req.user!.tenantId,
    req.user!.id,
    req.body
  );
  res.status(201).json({ success: true, data: workOrder });
});

// ─── Get Work Orders (List) ─────────────────────────────────────────────────
router.get('/', authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'), async (req: AuthRequest, res: Response) => {
  const { page, limit, status, branchId, search, dateFrom, dateTo } = req.query;
  const isBranchScoped = ['BRANCH_MANAGER', 'RECEPTIONIST'].includes(req.user!.role);
  const result = await workOrderService.getWorkOrders(req.user!.tenantId, {
    page: page ? parseInt(page as string) : 1,
    limit: limit ? parseInt(limit as string) : 20,
    status: status as WorkOrderStatus,
    branchId: isBranchScoped ? (req.user!.branchId || undefined) : (branchId as string),
    search: search as string,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo: dateTo ? new Date(dateTo as string) : undefined,
  });
  res.json({ success: true, ...result });
});

// ─── Get Single Work Order ──────────────────────────────────────────────────
router.get('/:id', authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'), async (req: AuthRequest, res: Response) => {
  const workOrder = await workOrderService.getWorkOrder(req.user!.tenantId, req.params.id);
  const isBranchScoped = ['BRANCH_MANAGER', 'RECEPTIONIST'].includes(req.user!.role);
  if (isBranchScoped && workOrder.branchId !== req.user!.branchId) {
    return res.status(404).json({ success: false, message: 'Work order not found' });
  }
  res.json({ success: true, data: workOrder });
});

// ─── Get Intake QR Code ──────────────────────────────────────────────────────
router.get('/:id/qrcode', authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'), async (req: AuthRequest, res: Response) => {
  const qr = await workOrderService.generateQrCode(req.user!.tenantId, req.params.id);
  res.json({ success: true, data: qr });
});

// ─── Update Status ──────────────────────────────────────────────────────────
const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'RECEIVED', 'DIAGNOSING', 'QUOTED', 'AWAITING_APPROVAL',
      'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'DELIVERED', 'CANCELLED',
    ]),
    notes: z.string().optional(),
    diagnosisNotes: z.string().optional(),
    diagnosisDiagram: z.any().optional(),
  }),
});

router.patch('/:id/status', authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'), validate(updateStatusSchema), async (req: AuthRequest, res: Response) => {
  const workOrder = await workOrderService.updateStatus(
    req.user!.tenantId,
    req.params.id,
    req.user!.id,
    req.body
  );
  res.json({ success: true, data: workOrder });
});

// ─── Photo Upload ───────────────────────────────────────────────────────────
router.post('/:id/photos', authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST', 'TECHNICIAN'), async (req: AuthRequest, res: Response) => {
  const { photoData, type, caption } = req.body;
  if (!photoData || !photoData.startsWith('data:image/')) {
    return res.status(400).json({ success: false, message: 'Invalid photo format' });
  }

  const base64Content = photoData.split(';base64,').pop();
  const filename = `${require('uuid').v4()}.jpg`;
  
  const fs = require('fs');
  const path = require('path');
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, base64Content, { encoding: 'base64' });

  // Port is 3001
  const url = `http://localhost:3001/uploads/${filename}`;
  const { prisma } = await import('../../config/database');
  const photo = await prisma.workOrderPhoto.create({
    data: {
      workOrderId: req.params.id,
      url,
      type,
      caption,
    },
  });

  res.status(201).json({ success: true, data: photo });
});

// ─── Add Items (Labor/Parts) ────────────────────────────────────────────────
const addItemsSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      type: z.enum(['LABOR', 'PART']),
      laborRateId: z.string().uuid().optional(),
      partId: z.string().uuid().optional(),
      description: z.string().min(1),
      descriptionAr: z.string().optional(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
      costPrice: z.number().min(0).optional(),
      discountPercent: z.number().min(0).max(100).optional(),
      notes: z.string().optional(),
    })),
  }),
});

router.post('/:id/items', authorize('GARAGE_OWNER', 'BRANCH_MANAGER'), validate(addItemsSchema), async (req: AuthRequest, res: Response) => {
  const items = await workOrderService.addItems(
    req.user!.tenantId,
    req.params.id,
    req.body.items
  );
  res.status(201).json({ success: true, data: items });
});

// ─── Assign Task to Technician ──────────────────────────────────────────────
const assignTaskSchema = z.object({
  body: z.object({
    technicianId: z.string().uuid(),
    specialty: z.enum(['MECHANICAL', 'ELECTRICAL', 'BODYWORK', 'PAINTING', 'AC_SYSTEM', 'TIRES', 'GENERAL']),
    estimatedHours: z.number().positive().optional(),
    notes: z.string().optional(),
  }),
});

router.post('/:id/tasks', authorize('GARAGE_OWNER', 'BRANCH_MANAGER'), validate(assignTaskSchema), async (req: AuthRequest, res: Response) => {
  const assignment = await workOrderService.assignTask(
    req.user!.tenantId,
    req.params.id,
    req.user!.id,
    req.body
  );
  res.status(201).json({ success: true, data: assignment });
});

export default router;
