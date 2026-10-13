import { Router, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { isProviderConfigured } from './providers';
import { ToolContext, toolsForRole } from './tools/context';
import {
  confirmPendingAction,
  getOrCreateConversation,
  runAgentTurn,
} from './agent.service';
import { getQuotaStatus, usageByUser, usageTrend } from './usage.service';

const router = Router();
router.use(authenticate);

/**
 * Agent calls cost money per request, so they get a tighter limit than the
 * rest of the API regardless of the global limiter.
 */
const agentLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id ?? req.ip ?? 'anon',
  message: {
    success: false,
    message: 'Too many assistant requests — wait a moment.',
    code: 'AI_RATE_LIMITED',
  },
});

/** Context is built from the session only — never from the request body. */
function toolContext(req: AuthRequest): ToolContext {
  const { id, tenantId, branchId, role } = req.user!;
  const accept = String(req.headers['accept-language'] ?? '');
  return {
    tenantId,
    userId: id,
    branchId: branchId ?? null,
    role,
    language: accept.toLowerCase().startsWith('en') ? 'en' : 'ar',
  };
}

// ─── Status ──────────────────────────────────────────────────────────────────

router.get('/status', async (req: AuthRequest, res: Response) => {
  const { tenantId, role } = req.user!;
  const quota = await getQuotaStatus(tenantId);

  res.json({
    success: true,
    data: {
      enabled: env.AI_ENABLED,
      configured: isProviderConfigured(),
      provider: env.AI_PROVIDER,
      availableTools: toolsForRole(role),
      quota,
    },
  });
});

// ─── Chat ────────────────────────────────────────────────────────────────────

const chatSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(4000),
    conversationId: z.string().uuid().optional(),
  }),
});

router.post(
  '/chat',
  agentLimiter,
  validate(chatSchema),
  async (req: AuthRequest, res: Response) => {
    const ctx = toolContext(req);
    const { message, conversationId } = req.body as {
      message: string;
      conversationId?: string;
    };

    const result = await runAgentTurn({ ctx, userMessage: message, conversationId });
    res.json({ success: true, data: result });
  }
);

// ─── Confirm or reject a staged write ────────────────────────────────────────

const confirmSchema = z.object({
  body: z.object({ approve: z.boolean() }),
  params: z.object({ id: z.string().uuid() }),
});

router.post(
  '/actions/:id/confirm',
  validate(confirmSchema),
  async (req: AuthRequest, res: Response) => {
    const ctx = toolContext(req);
    const outcome = await confirmPendingAction({
      ctx,
      actionId: req.params.id,
      approve: Boolean(req.body.approve),
    });
    res.json({ success: true, data: outcome });
  }
);

// ─── Conversations ───────────────────────────────────────────────────────────

router.get('/conversations', async (req: AuthRequest, res: Response) => {
  const { id: userId, tenantId } = req.user!;

  const conversations = await prisma.aiConversation.findMany({
    where: { tenantId, userId, isArchived: false },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      titleAr: true,
      lastMessageAt: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  });

  res.json({ success: true, data: conversations });
});

router.post('/conversations', async (req: AuthRequest, res: Response) => {
  const ctx = toolContext(req);
  const conversationId = await getOrCreateConversation(ctx);
  res.status(201).json({ success: true, data: { conversationId } });
});

router.get('/conversations/:id', async (req: AuthRequest, res: Response) => {
  const { id: userId, tenantId } = req.user!;

  const conversation = await prisma.aiConversation.findFirst({
    where: { id: req.params.id, tenantId, userId },
    select: { id: true, title: true, createdAt: true, lastMessageAt: true },
  });

  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
      code: 'CONVERSATION_NOT_FOUND',
    });
  }

  const messages = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, createdAt: true },
  });

  const pendingActions = await prisma.aiPendingAction.findMany({
    where: { conversationId: conversation.id, status: 'PENDING' },
    select: {
      id: true,
      toolName: true,
      summary: true,
      summaryAr: true,
      toolInput: true,
      expiresAt: true,
    },
  });

  // Tool turns hold raw database payloads; only the conversational roles are
  // sent to the client.
  res.json({
    success: true,
    data: {
      conversation,
      messages: messages
        .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
        .map((m) => ({
          id: m.id,
          role: m.role,
          text: (m.content as { text?: string | null })?.text ?? '',
          createdAt: m.createdAt,
        })),
      pendingActions,
    },
  });
});

router.delete('/conversations/:id', async (req: AuthRequest, res: Response) => {
  const { id: userId, tenantId } = req.user!;

  const convo = await prisma.aiConversation.findFirst({
    where: { id: req.params.id, tenantId, userId },
    select: { id: true },
  });
  if (!convo) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
      code: 'CONVERSATION_NOT_FOUND',
    });
  }

  // Archived rather than deleted: the usage rows reference it.
  await prisma.aiConversation.update({
    where: { id: convo.id },
    data: { isArchived: true },
  });

  res.json({ success: true, data: { archived: true } });
});

// ─── Usage, scoped to the caller's own garage ────────────────────────────────

router.get('/usage', async (req: AuthRequest, res: Response) => {
  const { tenantId, role } = req.user!;

  if (role !== 'GARAGE_OWNER' && role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Only the garage owner can view usage',
      code: 'FORBIDDEN',
    });
  }

  const periodDays = Math.min(
    Math.max(Number(req.query.periodDays ?? 30) || 30, 1),
    365
  );

  const [quota, byUser, trend] = await Promise.all([
    getQuotaStatus(tenantId),
    usageByUser(tenantId, periodDays),
    usageTrend(tenantId, periodDays),
  ]);

  res.json({ success: true, data: { quota, byUser, trend, periodDays } });
});

export default router;
