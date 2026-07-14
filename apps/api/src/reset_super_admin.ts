import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetSuperAdmin() {
  const email = 'admin@gms.com';
  const password = 'Admin@2024!';
  const hash = await bcrypt.hash(password, 12);

  const existing = await prisma.superAdmin.findUnique({ where: { email } });

  if (existing) {
    await prisma.superAdmin.update({
      where: { email },
      data: { passwordHash: hash, isActive: true },
    });
    console.log(`✅ Super admin password RESET: ${email} / ${password}`);
  } else {
    await prisma.superAdmin.create({
      data: { email, passwordHash: hash, name: 'Super Admin', isActive: true },
    });
    console.log(`✅ Super admin CREATED: ${email} / ${password}`);
  }

  const sa = await prisma.superAdmin.findUnique({ where: { email }, select: { id: true, email: true, name: true, isActive: true, createdAt: true } });
  console.log('Record in DB:', JSON.stringify(sa, null, 2));

  await prisma.$disconnect();
}

resetSuperAdmin().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
