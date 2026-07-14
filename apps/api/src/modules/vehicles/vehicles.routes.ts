import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);
router.use(authorize('GARAGE_OWNER', 'BRANCH_MANAGER', 'RECEPTIONIST'));

// ─── Get All Vehicles ───────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId },
    include: {
      customerVehicle: {
        include: {
          customer: true
        }
      },
      workOrders: {
        select: {
          id: true,
          status: true,
          receivedAt: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: vehicles });
});

// ─── Create Vehicle ─────────────────────────────────────────────────────────
const createVehicleSchema = z.object({
  body: z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().optional(),
    plateNumber: z.string().min(2),
    chassisNumber: z.string().optional().or(z.literal('')),
    customerId: z.string().uuid(), // Required customer id to prevent orphan records
    color: z.string().optional().or(z.literal('')),
    fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID']).optional(),
    transmissionType: z.enum(['AUTO', 'MANUAL']).optional(),
    photoData: z.string().optional(), // base64 photo
  }),
});

router.post('/', validate(createVehicleSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const {
    make,
    model,
    year,
    plateNumber,
    chassisNumber,
    customerId,
    color,
    fuelType,
    transmissionType,
    photoData
  } = req.body;

  let photoUrl: string | undefined = undefined;

  // Process base64 photo upload if provided
  if (photoData && photoData.startsWith('data:image/')) {
    const base64Content = photoData.split(';base64,').pop();
    const filename = `${uuidv4()}.jpg`;
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, base64Content, { encoding: 'base64' });
    photoUrl = `http://localhost:3001/uploads/${filename}`;
  }

  const vehicle = await prisma.$transaction(async (tx) => {
    const v = await tx.vehicle.create({
      data: {
        tenantId,
        make,
        model,
        year: year ? parseInt(String(year)) : new Date().getFullYear(),
        plateNumber,
        vin: chassisNumber || null,
        color: color || null,
        fuelType: fuelType || null,
        transmissionType: transmissionType || null,
        photoUrl: photoUrl || null,
      },
    });

    await tx.customerVehicle.create({
      data: {
        customerId,
        vehicleId: v.id,
        isPrimary: true,
      },
    });

    return v;
  });

  res.status(201).json({ success: true, data: vehicle });
});

// ─── Get Vehicle History Report ─────────────────────────────────────────────
router.get('/:vehicleId/history', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { vehicleId } = req.params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    include: {
      customerVehicle: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!vehicle) {
    return res.status(404).json({ success: false, message: 'المركبة غير موجودة' });
  }

  // Get completed and delivered work orders
  const workOrders = await prisma.workOrder.findMany({
    where: {
      vehicleId,
      tenantId,
      status: { in: ['READY_FOR_DELIVERY', 'DELIVERED'] },
      orderNumber: { not: { startsWith: 'WO-DEP-' } }, // exclude deposit cards
    },
    include: {
      workOrderItems: {
        include: {
          part: true,
          laborRate: true,
        },
      },
      taskAssignments: {
        include: {
          technician: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: { receivedAt: 'desc' },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  res.json({
    success: true,
    data: {
      tenant,
      vehicle,
      workOrders,
    },
  });
});

export default router;
