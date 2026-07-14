import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Inspecting DB Work Orders and Items ---');
  try {
    const orders = await prisma.workOrder.findMany({
      include: {
        workOrderItems: true,
        invoice: true,
      }
    });

    for (const o of orders) {
      console.log(`Order: ${o.orderNumber} | Status: ${o.status} | TotalAmount: ${o.totalAmount}`);
      for (const item of o.workOrderItems) {
        console.log(`  Item: ${item.description} | Type: ${item.type} | Qty: ${item.quantity} | UnitPrice: ${item.unitPrice} | TotalPrice: ${item.totalPrice} | CostPrice: ${item.costPrice}`);
      }
      if (o.invoice) {
        console.log(`  Invoice: ${o.invoice.invoiceNumber} | Status: ${o.invoice.status} | Total: ${o.invoice.total} | Paid: ${o.invoice.paidAmount}`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
