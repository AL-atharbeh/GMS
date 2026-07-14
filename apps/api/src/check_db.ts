import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Connection Check ---');
  try {
    const tenants = await prisma.tenant.findMany();
    const users = await prisma.user.findMany();
    const customers = await prisma.customer.findMany();
    const workOrders = await prisma.workOrder.findMany();
    const invoices = await prisma.invoice.findMany();
    const laborRates = await prisma.laborRate.findMany();

    console.log('Tenants:', tenants.length);
    console.log('Users:', users.length);
    console.log('Customers:', customers.length);
    console.log('WorkOrders:', workOrders.length);
    console.log('Invoices:', invoices.length);
    console.log('LaborRates:', laborRates.length);

    console.log('Users details:', users.map(u => ({ email: u.email, name: u.name })));
  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
