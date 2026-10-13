/**
 * Usage metering and plan quotas.
 *
 * Token counts are taken from the provider's own usage payload, so the figures
 * in the admin dashboard are what was actually billed, not an estimate.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { ProviderUsage } from './providers/types';

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  percentUsed: number;
  exceeded: boolean;
  nearLimit: boolean;
  periodStart: Date;
  periodEnd: Date;
}

const WARN_THRESHOLD = 0.8;

function quotaForPlan(planName: string | null | undefined): number {
  switch ((planName ?? '').toUpperCase()) {
    case 'ENTERPRISE':
      return Number(env.AI_QUOTA_ENTERPRISE);
    case 'PROFESSIONAL':
      return Number(env.AI_QUOTA_PROFESSIONAL);
    default:
      return Number(env.AI_QUOTA_BASIC);
  }
}

/** Calendar-month window, which is what the quota is expressed against. */
function currentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

export async function getQuotaStatus(tenantId: string): Promise<QuotaStatus> {
  const { start, end } = currentPeriod();

  const [subscription, usage] = await Promise.all([
    prisma.tenantSubscription.findUnique({
      where: { tenantId },
      select: { plan: { select: { name: true } } },
    }),
    prisma.aiUsageLog.aggregate({
      where: { tenantId, createdAt: { gte: start, lt: end } },
      _sum: { totalTokens: true },
    }),
  ]);

  const limit = quotaForPlan(subscription?.plan?.name);
  const used = usage._sum.totalTokens ?? 0;
  const remaining = Math.max(limit - used, 0);
  const percentUsed = limit > 0 ? (used / limit) * 100 : 100;

  return {
    limit,
    used,
    remaining,
    percentUsed: Number(percentUsed.toFixed(2)),
    exceeded: used >= limit,
    nearLimit: percentUsed >= WARN_THRESHOLD * 100,
    periodStart: start,
    periodEnd: end,
  };
}

export async function recordUsage(params: {
  tenantId: string;
  userId: string;
  conversationId?: string | null;
  provider: string;
  model: string;
  purpose: 'AGENT' | 'RERANK' | 'TITLE';
  usage: ProviderUsage;
  costUsd: number;
  latencyMs?: number;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        conversationId: params.conversationId ?? null,
        provider: params.provider,
        model: params.model,
        purpose: params.purpose,
        inputTokens: params.usage.inputTokens,
        outputTokens: params.usage.outputTokens,
        cachedInputTokens: params.usage.cachedInputTokens,
        // Fall back to a sum when the provider omits a total.
        totalTokens:
          params.usage.totalTokens ||
          params.usage.inputTokens + params.usage.outputTokens,
        costUsd: new Prisma.Decimal(params.costUsd.toFixed(6)),
        latencyMs: params.latencyMs ?? null,
      },
    });
  } catch (err) {
    // Losing a usage row must not fail the user's request; it is logged so the
    // gap is visible rather than silent.
    logger.error('Failed to record AI usage', { err, tenantId: params.tenantId });
  }
}

// ─── Admin reporting ─────────────────────────────────────────────────────────

export async function usageByTenant(periodDays = 30) {
  const since = new Date(Date.now() - periodDays * 86_400_000);

  const grouped = await prisma.aiUsageLog.groupBy({
    by: ['tenantId'],
    where: { createdAt: { gte: since } },
    _sum: { totalTokens: true, inputTokens: true, outputTokens: true, costUsd: true },
    _count: true,
    orderBy: { _sum: { totalTokens: 'desc' } },
  });

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: grouped.map((g) => g.tenantId) } },
    select: {
      id: true,
      name: true,
      nameAr: true,
      subscription: { select: { plan: { select: { name: true } } } },
    },
  });
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  return grouped.map((g) => {
    const t = tenantById.get(g.tenantId);
    const planName = t?.subscription?.plan?.name ?? 'BASIC';
    const limit = quotaForPlan(planName);
    const used = g._sum.totalTokens ?? 0;
    return {
      tenantId: g.tenantId,
      tenantName: t?.name ?? 'Unknown',
      tenantNameAr: t?.nameAr ?? null,
      plan: planName,
      quotaLimit: limit,
      requests: g._count,
      inputTokens: g._sum.inputTokens ?? 0,
      outputTokens: g._sum.outputTokens ?? 0,
      totalTokens: used,
      percentOfQuota: limit > 0 ? Number(((used / limit) * 100).toFixed(2)) : null,
      costUsd: g._sum.costUsd ?? new Prisma.Decimal(0),
    };
  });
}

export async function usageByUser(tenantId: string | null, periodDays = 30) {
  const since = new Date(Date.now() - periodDays * 86_400_000);

  const grouped = await prisma.aiUsageLog.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: since },
      ...(tenantId ? { tenantId } : {}),
    },
    _sum: { totalTokens: true, inputTokens: true, outputTokens: true, costUsd: true },
    _count: true,
    orderBy: { _sum: { totalTokens: 'desc' } },
    take: 100,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: {
      id: true,
      name: true,
      nameAr: true,
      email: true,
      role: true,
      tenant: { select: { name: true } },
    },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g) => {
    const u = userById.get(g.userId);
    return {
      userId: g.userId,
      name: u?.name ?? 'Unknown',
      nameAr: u?.nameAr ?? null,
      email: u?.email ?? null,
      role: u?.role ?? null,
      tenantName: u?.tenant?.name ?? null,
      requests: g._count,
      inputTokens: g._sum.inputTokens ?? 0,
      outputTokens: g._sum.outputTokens ?? 0,
      totalTokens: g._sum.totalTokens ?? 0,
      costUsd: g._sum.costUsd ?? new Prisma.Decimal(0),
    };
  });
}

/** Daily totals for the usage trend chart. */
export async function usageTrend(tenantId: string | null, periodDays = 30) {
  const since = new Date(Date.now() - periodDays * 86_400_000);

  const rows = await prisma.$queryRaw<
    { day: Date; total_tokens: bigint; cost_usd: Prisma.Decimal; requests: bigint }[]
  >`
    SELECT
      date_trunc('day', "createdAt")  AS day,
      SUM("totalTokens")              AS total_tokens,
      SUM("costUsd")                  AS cost_usd,
      COUNT(*)                        AS requests
    FROM "ai_usage_logs"
    WHERE "createdAt" >= ${since}
      AND (${tenantId}::text IS NULL OR "tenantId" = ${tenantId})
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((r) => ({
    day: r.day,
    totalTokens: Number(r.total_tokens),
    costUsd: r.cost_usd,
    requests: Number(r.requests),
  }));
}
