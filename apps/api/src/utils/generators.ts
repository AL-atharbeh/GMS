import { prisma } from '../config/database';

// Generate sequential order numbers like WO-2024-0001
export async function generateOrderNumber(tenantId: string, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix_with_year = `${prefix}-${year}-`;

  // Get the last order number for this tenant and year
  const lastOrder = await prisma.workOrder.findFirst({
    where: {
      tenantId,
      orderNumber: { startsWith: prefix_with_year },
    },
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });

  let nextNumber = 1;
  if (lastOrder?.orderNumber) {
    const lastNum = parseInt(lastOrder.orderNumber.split('-').pop() || '0');
    nextNumber = lastNum + 1;
  }

  return `${prefix_with_year}${nextNumber.toString().padStart(4, '0')}`;
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      tenantId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNumber: true },
  });

  let nextNumber = 1;
  if (lastInvoice?.invoiceNumber) {
    const lastNum = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
    nextNumber = lastNum + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

export function formatCurrency(amount: number, currency: string = 'KWD'): string {
  return new Intl.NumberFormat('ar-KW', {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
  }).format(amount);
}

export function generateTrackingToken(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
