import cron from 'node-cron';
import { prisma } from '../../config/database';
import { logger } from '../../utils/logger';
import { notificationService } from '../notifications/notification.service';

export function initStatementScheduler() {
  logger.info('🚀 Periodic Statement Scheduler Initialized (node-cron)');

  // Run at midnight on the first day of every month: 0 0 1 * *
  cron.schedule('0 0 1 * *', async () => {
    logger.info('📊 Running monthly statement generator for Fleet Contract customers...');
    await generateFleetStatements();
  });
}

export async function generateFleetStatements() {
  try {
    const activeContracts = await prisma.fleetContract.findMany({
      where: { isActive: true },
      include: {
        customer: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (activeContracts.length === 0) {
      logger.info('ℹ️ No active Fleet Contracts found to process.');
      return;
    }

    // Get previous month date bounds
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const monthName = startDate.toLocaleString('ar-KW', { month: 'long' });

    for (const contract of activeContracts) {
      const customer = contract.customer;
      const tenant = customer.tenant;
      if (!customer.phone) continue;

      // Calculate invoice totals
      const invoices = await prisma.invoice.findMany({
        where: {
          customerId: customer.id,
          tenantId: contract.customer.tenantId,
          status: { not: 'CANCELLED' },
        },
        include: {
          payments: {
            where: { status: 'PAID' },
          },
        },
      });

      let invoicedBefore = 0;
      let paidBefore = 0;
      let invoicedDuring = 0;
      let paidDuring = 0;

      for (const inv of invoices) {
        const invDate = new Date(inv.createdAt);
        const invAmount = Number(inv.total);

        if (invDate < startDate) {
          invoicedBefore += invAmount;
        } else if (invDate <= endDate) {
          invoicedDuring += invAmount;
        }

        for (const pay of inv.payments) {
          const payDate = new Date(pay.createdAt);
          const payAmount = Number(pay.amount);

          if (payDate < startDate) {
            paidBefore += payAmount;
          } else if (payDate <= endDate) {
            paidDuring += payAmount;
          }
        }
      }

      const beginningBalance = invoicedBefore - paidBefore;
      const endingBalance = beginningBalance + invoicedDuring - paidDuring;

      const currencyStr = tenant.currency || 'KWD';
      const garageName = tenant.nameAr || tenant.name || 'الورشة';

      // Format statement WhatsApp notice message
      const message = `مرحباً مسؤول أسطول ${customer.name} 👋\n\nتم إصدار كشف حسابكم الدوري التلقائي لشهر (${monthName}) لـ ${garageName} 📊\n\n- الرصيد السابق: ${beginningBalance.toFixed(2)} ${currencyStr}\n- قيمة الفواتير الجديدة (+): ${invoicedDuring.toFixed(2)} ${currencyStr}\n- إجمالي المدفوعات (-): ${paidDuring.toFixed(2)} ${currencyStr}\n\n⚠️ صافي الرصيد المستحق بذمتكم: ${endingBalance.toFixed(2)} ${currencyStr}\n\nيرجى مراجعة الحساب والسداد خلال المدة المحددة (${contract.paymentTermDays} يوم). شكراً لتعاونكم معنا 🙏`;

      // Log action to DB via notification service
      await prisma.notification.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          recipientPhone: customer.phone,
          channel: 'WHATSAPP',
          type: 'FLEET_STATEMENT_PERIODIC',
          message,
          status: 'PENDING',
        },
      });

      logger.info(`✅ Generated monthly statement notice for: ${customer.name} (Balance: ${endingBalance} ${currencyStr})`);
    }
  } catch (error) {
    logger.error('❌ Error during generating monthly statements: %s', error);
  }
}
