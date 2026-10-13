/**
 * The agent loop.
 *
 * Read tools execute inline. A write tool call stops the loop: it becomes an
 * AiPendingAction row and the turn returns with that action attached, so the
 * user confirms before anything is written.
 */
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { getProvider, isProviderConfigured } from './providers';
import {
  AgentMessage,
  AgentToolCall,
  AgentToolDef,
  LlmProvider,
} from './providers/types';
import { ToolContext, isWriteTool, toolsForRole } from './tools/context';
import { READ_TOOLS, ToolImpl } from './tools/read-tools';
import {
  WRITE_TOOL_IMPLS,
  describeWriteAction,
  executeWriteTool,
} from './tools/write-tools';
import { buildSystemPrompt, wrapToolResult } from './prompt';
import { getQuotaStatus, recordUsage } from './usage.service';

const ALL_TOOLS: Record<string, ToolImpl> = {
  ...READ_TOOLS,
  ...WRITE_TOOL_IMPLS,
};

/** Guards against a model that keeps calling tools without concluding. */
const MAX_TOOL_ROUNDS = 6;
const PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

export interface AgentTurnResult {
  conversationId: string;
  reply: string;
  pendingAction: {
    id: string;
    toolName: string;
    summary: string;
    summaryAr: string | null;
    input: Record<string, unknown>;
  } | null;
  toolsUsed: string[];
  usage: { totalTokens: number; costUsd: number };
  quota: Awaited<ReturnType<typeof getQuotaStatus>>;
}

function toolDefsFor(role: UserRole): AgentToolDef[] {
  return toolsForRole(role)
    .map((name) => ALL_TOOLS[name]?.def)
    .filter((d): d is AgentToolDef => Boolean(d));
}

/** Rebuilds provider-neutral history from stored rows, oldest first. */
async function loadHistory(conversationId: string): Promise<AgentMessage[]> {
  const rows = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    // Enough context to be useful without unbounded growth; providers that
    // support compaction can raise this.
    take: 40,
  });

  return rows.map((r) => {
    const stored = r.content as {
      text?: string | null;
      toolCalls?: AgentToolCall[];
      providerBlocks?: unknown;
    };
    return {
      role: r.role.toLowerCase() as AgentMessage['role'],
      content: stored.text ?? null,
      toolCalls: stored.toolCalls,
      toolCallId: r.toolCallId ?? undefined,
      providerBlocks: stored.providerBlocks,
    };
  });
}

async function appendMessage(
  conversationId: string,
  message: AgentMessage
): Promise<void> {
  await prisma.aiMessage.create({
    data: {
      conversationId,
      role: message.role.toUpperCase() as never,
      content: {
        text: message.content,
        ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}),
        ...(message.providerBlocks
          ? { providerBlocks: message.providerBlocks }
          : {}),
      } as never,
      toolCallId: message.toolCallId ?? null,
    },
  });
}

export async function getOrCreateConversation(
  ctx: ToolContext,
  conversationId?: string
): Promise<string> {
  if (conversationId) {
    const existing = await prisma.aiConversation.findFirst({
      where: { id: conversationId, tenantId: ctx.tenantId, userId: ctx.userId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }
    return existing.id;
  }

  const created = await prisma.aiConversation.create({
    data: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { id: true },
  });
  return created.id;
}

async function buildProfilePrompt(ctx: ToolContext): Promise<string> {
  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true, nameAr: true, currency: true, timezone: true },
    }),
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, branch: { select: { name: true } } },
    }),
  ]);

  return buildSystemPrompt({
    tenantName: tenant?.name ?? 'the garage',
    tenantNameAr: tenant?.nameAr ?? null,
    currency: tenant?.currency ?? 'KWD',
    timezone: tenant?.timezone ?? 'Asia/Kuwait',
    branchName: user?.branch?.name ?? null,
    userName: user?.name ?? 'the user',
    userRole: ctx.role,
    language: ctx.language,
  });
}

/**
 * Stage 2 of grounded diagnosis: the cheap model reranks trigram candidates by
 * real symptom relevance, which trigram similarity alone does not capture.
 * A failure here is non-fatal — the unranked matches are still useful.
 */
async function rerankSimilarFaults(
  provider: LlmProvider,
  ctx: ToolContext,
  conversationId: string,
  symptoms: string,
  payload: unknown
): Promise<unknown> {
  const matches = (payload as { matches?: unknown[] })?.matches;
  if (!Array.isArray(matches) || matches.length < 3) return payload;

  try {
    const result = await provider.chat({
      fast: true,
      maxTokens: 512,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You rank past repair records by how well their symptoms match a new complaint. Reply with ONLY a JSON array of the 0-based indices of the relevant records, most relevant first, e.g. [2,0,5]. Omit records whose symptoms are unrelated. No prose.',
        },
        {
          role: 'user',
          content: `New complaint: ${symptoms}\n\nPast records:\n${matches
            .map((m, i) => {
              const r = m as { complaint?: string; diagnosis?: string };
              return `[${i}] complaint: ${r.complaint ?? '-'} | diagnosis: ${r.diagnosis ?? '-'}`;
            })
            .join('\n')}`,
        },
      ],
    });

    await recordUsage({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      conversationId,
      provider: provider.name,
      model: result.model,
      purpose: 'RERANK',
      usage: result.usage,
      costUsd: provider.costUsd(result.model, result.usage),
      latencyMs: result.latencyMs,
    });

    const json = result.text?.match(/\[[\d,\s]*\]/)?.[0];
    if (!json) return payload;

    const order = JSON.parse(json) as number[];
    const ranked = order
      .filter((i) => Number.isInteger(i) && i >= 0 && i < matches.length)
      .map((i) => matches[i]);

    if (!ranked.length) return payload;

    return {
      matches: ranked,
      note: 'Ranked by symptom relevance against this garage\'s own history.',
    };
  } catch (err) {
    logger.warn('Similar-fault reranking failed; using raw matches', { err });
    return payload;
  }
}

export async function runAgentTurn(params: {
  ctx: ToolContext;
  userMessage: string;
  conversationId?: string;
}): Promise<AgentTurnResult> {
  const { ctx, userMessage } = params;

  if (!env.AI_ENABLED) {
    throw new AppError('AI assistant is disabled', 503, 'AI_DISABLED');
  }

  if (!isProviderConfigured()) {
    throw new AppError(
      `AI provider "${env.AI_PROVIDER}" has no API key configured. Set ${
        env.AI_PROVIDER === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GROQ_API_KEY'
      } in apps/api/.env`,
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  const quotaBefore = await getQuotaStatus(ctx.tenantId);
  if (quotaBefore.exceeded) {
    throw new AppError(
      'Monthly AI allowance for this garage is used up. Upgrade the plan to continue.',
      429,
      'AI_QUOTA_EXCEEDED'
    );
  }

  const provider = getProvider();
  const conversationId = await getOrCreateConversation(ctx, params.conversationId);
  const systemPrompt = await buildProfilePrompt(ctx);
  const tools = toolDefsFor(ctx.role);

  const history = await loadHistory(conversationId);
  await appendMessage(conversationId, { role: 'user', content: userMessage });

  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const toolsUsed: string[] = [];
  let totalTokens = 0;
  let totalCost = 0;
  let reply = '';
  let pendingAction: AgentTurnResult['pendingAction'] = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let result;
    try {
      result = await provider.chat({
        messages,
        tools,
        cacheableSystemPrefix: true,
        maxTokens: 4096,
      });
    } catch (err) {
      // Surface provider failures with a code instead of an opaque 500 —
      // otherwise a bad model id or a rate limit is undebuggable in production.
      const reason = err instanceof Error ? err.message : String(err);
      logger.error('AI provider call failed', {
        provider: provider.name,
        model: provider.agentModel,
        reason,
      });
      throw new AppError(
        `AI provider (${provider.name}) failed: ${reason.slice(0, 300)}`,
        502,
        'AI_PROVIDER_ERROR'
      );
    }

    const cost = provider.costUsd(result.model, result.usage);
    totalTokens += result.usage.totalTokens;
    totalCost += cost;

    await recordUsage({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      conversationId,
      provider: provider.name,
      model: result.model,
      purpose: 'AGENT',
      usage: result.usage,
      costUsd: cost,
      latencyMs: result.latencyMs,
    });

    if (result.finishReason === 'refusal') {
      reply =
        ctx.language === 'ar'
          ? 'لم أستطع معالجة هذا الطلب. صِغه بشكل مختلف أو اسأل عن شيء آخر.'
          : 'I could not process that request. Try rephrasing it.';
      break;
    }

    const assistantMessage: AgentMessage = {
      role: 'assistant',
      content: result.text,
      toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
    };
    messages.push(assistantMessage);
    await appendMessage(conversationId, assistantMessage);

    if (!result.toolCalls.length) {
      reply = result.text ?? '';
      break;
    }

    // A write tool ends the turn: stage it and wait for confirmation.
    const write = result.toolCalls.find((tc) => isWriteTool(tc.name));
    if (write) {
      if (!toolsForRole(ctx.role).includes(write.name)) {
        logger.warn('Model called a tool outside its role', {
          tool: write.name,
          role: ctx.role,
        });
      } else {
        const described = describeWriteAction(write.name, write.input);
        const action = await prisma.aiPendingAction.create({
          data: {
            conversationId,
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            toolName: write.name,
            toolCallId: write.id,
            toolInput: write.input as never,
            summary: described.en,
            summaryAr: described.ar,
            expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS),
          },
          select: { id: true },
        });

        pendingAction = {
          id: action.id,
          toolName: write.name,
          summary: described.en,
          summaryAr: described.ar,
          input: write.input,
        };
        reply = result.text ?? '';
        break;
      }
    }

    // Otherwise run the read tools this round asked for, in parallel.
    const results = await Promise.all(
      result.toolCalls.map(async (tc) => {
        if (!toolsForRole(ctx.role).includes(tc.name)) {
          return {
            tc,
            payload: { error: 'This tool is not available for your role.' },
          };
        }

        const impl = ALL_TOOLS[tc.name];
        if (!impl) {
          return { tc, payload: { error: `Unknown tool: ${tc.name}` } };
        }

        try {
          let payload = await impl.run(tc.input, ctx);
          if (tc.name === 'find_similar_faults') {
            const symptoms = String(tc.input.symptoms ?? '');
            payload = await rerankSimilarFaults(
              provider,
              ctx,
              conversationId,
              symptoms,
              payload
            );
          }
          toolsUsed.push(tc.name);
          return { tc, payload };
        } catch (err) {
          logger.warn('Agent tool failed', { tool: tc.name, err });
          return {
            tc,
            payload: {
              error: err instanceof Error ? err.message : 'Tool execution failed',
            },
          };
        }
      })
    );

    for (const { tc, payload } of results) {
      const toolMessage: AgentMessage = {
        role: 'tool',
        content: wrapToolResult(tc.name, payload),
        toolCallId: tc.id,
      };
      messages.push(toolMessage);
      await appendMessage(conversationId, toolMessage);
    }
  }

  if (!reply && !pendingAction) {
    reply =
      ctx.language === 'ar'
        ? 'لم أصل إلى نتيجة. وضّح لي السؤال أكثر.'
        : 'I could not reach a conclusion. Could you narrow the question down?';
  }

  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  await maybeSetTitle(conversationId, userMessage);

  return {
    conversationId,
    reply,
    pendingAction,
    toolsUsed: [...new Set(toolsUsed)],
    usage: { totalTokens, costUsd: Number(totalCost.toFixed(6)) },
    quota: await getQuotaStatus(ctx.tenantId),
  };
}

/** First user message doubles as the conversation title. */
async function maybeSetTitle(conversationId: string, firstMessage: string) {
  const convo = await prisma.aiConversation.findUnique({
    where: { id: conversationId },
    select: { title: true },
  });
  if (convo?.title) return;

  const title =
    firstMessage.length > 60 ? `${firstMessage.slice(0, 57)}...` : firstMessage;
  await prisma.aiConversation.update({
    where: { id: conversationId },
    data: { title },
  });
}

/** Runs a staged write after the user approves it. */
export async function confirmPendingAction(params: {
  ctx: ToolContext;
  actionId: string;
  approve: boolean;
}): Promise<{ status: string; result?: unknown; error?: string }> {
  const { ctx, actionId, approve } = params;

  const action = await prisma.aiPendingAction.findFirst({
    where: { id: actionId, tenantId: ctx.tenantId, userId: ctx.userId },
  });
  if (!action) {
    throw new AppError('Pending action not found', 404, 'ACTION_NOT_FOUND');
  }
  if (action.status !== 'PENDING') {
    throw new AppError(
      `Action already ${action.status.toLowerCase()}`,
      409,
      'ACTION_NOT_PENDING'
    );
  }
  if (action.expiresAt < new Date()) {
    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: 'EXPIRED' },
    });
    throw new AppError('Action expired — ask again', 410, 'ACTION_EXPIRED');
  }

  if (!approve) {
    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: 'REJECTED' },
    });
    return { status: 'REJECTED' };
  }

  // Re-check the role at execution time, not just when it was staged.
  if (!toolsForRole(ctx.role).includes(action.toolName)) {
    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', errorMessage: 'Role not permitted' },
    });
    throw new AppError('Not permitted for your role', 403, 'FORBIDDEN');
  }

  try {
    const result = await executeWriteTool(
      action.toolName,
      action.toolInput as Record<string, unknown>,
      ctx
    );

    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: {
        status: 'EXECUTED',
        confirmedAt: new Date(),
        executedAt: new Date(),
        resultPayload: result as never,
      },
    });

    // Feed the outcome back so the agent knows the action landed.
    await appendMessage(action.conversationId, {
      role: 'tool',
      content: wrapToolResult(action.toolName, result),
      toolCallId: action.toolCallId,
    });

    return { status: 'EXECUTED', result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Execution failed';
    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', errorMessage: message },
    });
    return { status: 'FAILED', error: message };
  }
}
