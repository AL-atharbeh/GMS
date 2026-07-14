import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();
router.use(authenticate);

// ─── Get Announcements for Tenant ───────────────────────────────────────────
router.get('/announcements', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;

  const sub = await prisma.tenantSubscription.findFirst({
    where: { tenantId },
    include: { plan: true },
  });

  const announcements = await prisma.announcement.findMany({
    where: {
      OR: [
        { targetType: 'ALL' },
        ...(sub?.plan?.name ? [{ targetType: 'PLAN', targetPlan: sub.plan.name }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: announcements });
});

// ─── Get Tenant Support Tickets ──────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  
  const tickets = await prisma.supportTicket.findMany({
    where: { tenantId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: tickets });
});

// ─── Create Support Ticket ───────────────────────────────────────────────────
const createTicketSchema = z.object({
  body: z.object({
    subject: z.string().min(2),
    description: z.string().min(2),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  }),
});

router.post('/', validate(createTicketSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { subject, description, priority } = req.body;

  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId,
      subject,
      description,
      priority,
      status: 'OPEN',
    },
  });

  // Log in platforms audit? Not super necessary, but nice.
  res.status(201).json({ success: true, data: ticket });
});

// ─── Send Message in Ticket ──────────────────────────────────────────────────
const sendMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1),
  }),
});

router.post('/:ticketId/messages', validate(sendMessageSchema), async (req: AuthRequest, res: Response) => {
  const { tenantId, id: userId } = req.user!;
  const { ticketId } = req.params;
  const { message } = req.body;

  // Verify ownership
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, tenantId },
  });
  
  if (!ticket) {
    return res.status(404).json({ success: false, message: 'التذكرة غير موجودة أو لا تملك صلاحية الوصول إليها' });
  }

  const supportMessage = await prisma.supportMessage.create({
    data: {
      ticketId,
      senderType: 'TENANT',
      senderId: userId,
      message,
    },
  });

  // Re-open ticket if it was resolved/closed
  if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'OPEN' },
    });
  }

  res.status(201).json({ success: true, data: supportMessage });
});

export default router;
