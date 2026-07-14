import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { generateOrderNumber } from '../../utils/generators';

export class InvoicingService {
  // ─── Generate Invoice for Work Order ────────────────────────────────────────
  async createInvoiceForWorkOrder(tenantId: string, workOrderId: string, data: { discountAmount?: number; notes?: string }) {
    // 1. Check if invoice already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { workOrderId },
    });
    if (existingInvoice) {
      return existingInvoice;
    }

    // 2. Fetch work order details
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      include: {
        tenant: true,
        workOrderItems: {
          where: { isApproved: true },
        },
      },
    });

    if (!workOrder) {
      throw new AppError('Work order not found', 404);
    }

    // 3. Calculate costs
    const laborCost = workOrder.workOrderItems
      .filter((i) => i.type === 'LABOR')
      .reduce((sum, item) => sum + Number(item.totalPrice), 0);

    const partsCost = workOrder.workOrderItems
      .filter((i) => i.type === 'PART')
      .reduce((sum, item) => sum + Number(item.totalPrice), 0);

    const subtotal = laborCost + partsCost;
    const discountAmount = data.discountAmount || 0;
    const taxableAmount = Math.max(0, subtotal - discountAmount);

    const taxRate = Number(workOrder.tenant?.vatRate || 0);
    const taxAmount = taxableAmount * (taxRate / 100);
    const total = taxableAmount + taxAmount;

    // 4. Generate invoice number
    const invoiceNumber = await generateOrderNumber(tenantId, 'INV');

    // 5. Create invoice record
    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        workOrderId,
        customerId: workOrder.customerId,
        invoiceNumber,
        status: 'PENDING',
        subtotal,
        discountAmount,
        taxableAmount,
        taxRate,
        taxAmount,
        total,
        paidAmount: 0,
        remainingAmount: total,
        currency: workOrder.tenant?.currency || 'KWD',
        notes: data.notes || '',
      },
    });

    return invoice;
  }

  // ─── Get Invoice details ───────────────────────────────────────────────────
  async getInvoiceByWorkOrder(tenantId: string, workOrderId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { workOrderId, tenantId },
      include: {
        tenant: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        workOrder: {
          include: {
            vehicle: true,
            customer: true,
            workOrderItems: true,
          },
        },
      },
    });
    return invoice;
  }

  // ─── Record a Payment ──────────────────────────────────────────────────────
  async recordPayment(tenantId: string, invoiceId: string, data: { amount: number; paymentMethod: string; transactionReference?: string }) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) throw new AppError('Invoice not found', 404);

    const paidAmount = Number(invoice.paidAmount) + data.amount;
    const remainingAmount = Math.max(0, Number(invoice.total) - paidAmount);
    const status = remainingAmount === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING';

    // Map KNET and other UI methods to database Enum values
    let dbMethod: 'CASH' | 'CARD' | 'BANK_TRANSFER' = 'CASH';
    if (data.paymentMethod === 'CARD' || data.paymentMethod === 'KNET' || data.paymentMethod === 'LINK') {
      dbMethod = 'CARD';
    } else if (data.paymentMethod === 'BANK_TRANSFER') {
      dbMethod = 'BANK_TRANSFER';
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: data.amount,
          method: dbMethod,
          reference: data.transactionReference || null,
          status: 'PAID',
        },
      });

      // 2. Update Invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount,
          remainingAmount,
          status,
          paidAt: status === 'PAID' ? new Date() : undefined,
        },
      });

      // 3. Update Work Order status if fully paid
      if (status === 'PAID') {
        const currentWo = await tx.workOrder.findUnique({
          where: { id: invoice.workOrderId },
          select: { status: true },
        });
        await tx.workOrder.update({
          where: { id: invoice.workOrderId },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
        });
        await tx.workOrderStatusHistory.create({
          data: {
            workOrderId: invoice.workOrderId,
            fromStatus: currentWo?.status || null,
            toStatus: 'DELIVERED',
            notes: 'تم تسليم السيارة تلقائياً بعد سداد الفاتورة بالكامل',
          },
        });
      }

      return { payment, invoice: updatedInvoice };
    });

    return result;
  }
}

export const invoicingService = new InvoicingService();
