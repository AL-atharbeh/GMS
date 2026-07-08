import { Router, Response } from 'express';
import { prisma } from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();
router.use(authenticate);

// ─── Get Reports Dashboard Summary ─────────────────────────────────────────
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { branchId, period = '30' } = req.query;
  const days = parseInt(period as string) || 30;
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  const where: any = { tenantId, createdAt: { gte: dateFrom } };
  if (branchId) where.branchId = branchId;

  const [
    totalWorkOrders,
    completedOrders,
    activeVehicles,
    totalRevenue,
    totalCosts,
    statusBreakdown,
    recentOrders,
    topTechnicians,
    dailyRevenue,
  ] = await Promise.all([
    // Total work orders
    prisma.workOrder.count({ where }),
    // Completed orders
    prisma.workOrder.count({ where: { ...where, status: 'DELIVERED' } }),
    // Active vehicles in workshop
    prisma.workOrder.count({
      where: {
        tenantId,
        ...(branchId && { branchId }),
        status: { in: ['RECEIVED', 'DIAGNOSING', 'QUOTED', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_DELIVERY'] },
      },
    }),
    // Total revenue
    prisma.workOrder.aggregate({
      where: { ...where, status: 'DELIVERED' },
      _sum: { totalAmount: true },
    }),
    // Total costs (parts + labor cost)
    prisma.workOrderItem.aggregate({
      where: { workOrder: { ...where, status: 'DELIVERED' } },
      _sum: { costPrice: true },
    }),
    // Status breakdown
    prisma.workOrder.groupBy({
      by: ['status'],
      where: { tenantId, ...(branchId && { branchId }) },
      _count: { id: true },
    }),
    // Recent orders
    prisma.workOrder.findMany({
      where,
      include: {
        vehicle: { select: { plateNumber: true, make: true, model: true } },
        customer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    // Top technicians
    prisma.taskAssignment.groupBy({
      by: ['technicianId'],
      where: {
        workOrder: where,
        status: 'COMPLETED',
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    // Daily revenue for chart
    prisma.$queryRaw`
      SELECT 
        DATE("createdAt") as date,
        SUM("totalAmount") as revenue,
        COUNT(id) as orders
      FROM work_orders
      WHERE "tenantId" = ${tenantId}
        AND status = 'DELIVERED'
        AND "createdAt" >= ${dateFrom}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
  ]);

  const revenue = Number(totalRevenue._sum.totalAmount || 0);
  const costs = Number(totalCosts._sum.costPrice || 0);
  const profit = revenue - costs;
  const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';
  const completionRate = totalWorkOrders > 0
    ? ((completedOrders / totalWorkOrders) * 100).toFixed(1)
    : '0';

  res.json({
    success: true,
    data: {
      kpis: {
        totalWorkOrders,
        completedOrders,
        activeVehicles,
        revenue,
        costs,
        profit,
        profitMargin: parseFloat(profitMargin),
        completionRate: parseFloat(completionRate),
      },
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      recentOrders,
      dailyRevenue: (dailyRevenue as any[]).map((r) => ({
        ...r,
        revenue: Number(r.revenue || 0),
        orders: Number(r.orders || 0),
      })),
    },
  });
});

// ─── Revenue Report ─────────────────────────────────────────────────────────
router.get('/revenue', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { branchId, groupBy = 'day', dateFrom, dateTo } = req.query;

  const startDate = dateFrom ? new Date(dateFrom as string) : new Date(new Date().setDate(1));
  const endDate = dateTo ? new Date(dateTo as string) : new Date();

  const data = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC(${groupBy as string}, wo.created_at) as period,
      COUNT(wo.id) as orders_count,
      SUM(wo.total_amount) as gross_revenue,
      SUM(wo.labor_cost) as labor_revenue,
      SUM(wo.parts_cost) as parts_revenue,
      SUM(wo.tax_amount) as tax_collected
    FROM work_orders wo
    WHERE wo.tenant_id = ${tenantId}
      AND wo.status = 'DELIVERED'
      AND wo.created_at BETWEEN ${startDate} AND ${endDate}
      ${branchId ? `AND wo.branch_id = '${branchId}'` : ''}
    GROUP BY DATE_TRUNC(${groupBy as string}, wo.created_at)
    ORDER BY period ASC
  `;

  res.json({ success: true, data });
});

// ─── Technician Performance ─────────────────────────────────────────────────
router.get('/technicians', async (req: AuthRequest, res: Response) => {
  const { tenantId } = req.user!;
  const { branchId } = req.query;

  const technicians = await prisma.technician.findMany({
    where: {
      tenantId,
      ...(branchId && { branchId: branchId as string }),
    },
    include: {
      user: { select: { name: true, avatar: true } },
      taskAssignments: {
        where: { status: 'COMPLETED' },
        select: { actualHours: true, reworkCount: true, workOrder: { select: { totalAmount: true } } },
      },
    },
  });

  const report = technicians.map((tech) => {
    const tasks = tech.taskAssignments;
    const totalTasks = tasks.length;
    const totalHours = tasks.reduce((s, t) => s + Number(t.actualHours || 0), 0);
    const reworkTotal = tasks.reduce((s, t) => s + t.reworkCount, 0);
    const totalRevenue = tasks.reduce((s, t) => s + Number(t.workOrder?.totalAmount || 0), 0);

    return {
      id: tech.id,
      name: tech.user.name,
      avatar: tech.user.avatar,
      specialties: tech.specialties,
      skillLevel: tech.skillLevel,
      totalTasks,
      totalHours: totalHours.toFixed(1),
      avgTaskHours: totalTasks > 0 ? (totalHours / totalTasks).toFixed(1) : '0',
      reworkRate: totalTasks > 0 ? ((reworkTotal / totalTasks) * 100).toFixed(1) : '0',
      totalRevenue,
    };
  });

  report.sort((a, b) => b.totalTasks - a.totalTasks);

  res.json({ success: true, data: report });
});

export default router;
