import { PrismaClient } from '@prisma/client';

const databaseUrl = 'postgresql://neondb_owner:npg_0bGxjISKs5eO@ep-fancy-salad-asuku0ux-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function test() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    const admins = await prisma.superAdmin.findMany();
    console.log('Admins count:', admins.length);
    console.log('Admins lists:', admins.map(a => ({ email: a.email, isActive: a.isActive })));
  } catch (err: any) {
    console.error('Error connecting or querying database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
