import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Subscription Plans ───────────────────────────────────────────────────
  const plans = [
    {
      name: 'BASIC' as const,
      nameAr: 'الأساسية',
      nameEn: 'Basic',
      description: 'Perfect for small garages',
      descriptionAr: 'مثالي للكراجات الصغيرة',
      monthlyPrice: 49,
      annualPrice: 470,
      maxBranches: 1,
      maxTechnicians: 5,
      maxVehiclesPerMonth: 100,
      maxStorageGB: 5,
      hasWhatsApp: false,
      hasAdvancedReports: false,
      hasApiAccess: false,
      hasFleetManagement: false,
      hasPredictiveAnalytics: false,
      trialDays: 14,
      sortOrder: 1,
    },
    {
      name: 'PROFESSIONAL' as const,
      nameAr: 'الاحترافية',
      nameEn: 'Professional',
      description: 'For growing garages with multiple branches',
      descriptionAr: 'للكراجات المتنامية متعددة الفروع',
      monthlyPrice: 149,
      annualPrice: 1430,
      maxBranches: 5,
      maxTechnicians: 25,
      maxVehiclesPerMonth: 500,
      maxStorageGB: 25,
      hasWhatsApp: true,
      hasAdvancedReports: true,
      hasApiAccess: false,
      hasFleetManagement: true,
      hasPredictiveAnalytics: false,
      trialDays: 14,
      sortOrder: 2,
    },
    {
      name: 'ENTERPRISE' as const,
      nameAr: 'المؤسسية',
      nameEn: 'Enterprise',
      description: 'Unlimited power for enterprise garage chains',
      descriptionAr: 'قدرة غير محدودة لسلاسل الكراجات المؤسسية',
      monthlyPrice: 399,
      annualPrice: 3830,
      maxBranches: 999,
      maxTechnicians: 9999,
      maxVehiclesPerMonth: 9999,
      maxStorageGB: 100,
      hasWhatsApp: true,
      hasAdvancedReports: true,
      hasApiAccess: true,
      hasFleetManagement: true,
      hasPredictiveAnalytics: true,
      trialDays: 14,
      sortOrder: 3,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlanConfig.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log('✅ Subscription plans seeded');

  // ─── Super Admin ──────────────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@gms.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@2024!';

  const existingSuperAdmin = await prisma.superAdmin.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    await prisma.superAdmin.create({
      data: {
        email: superAdminEmail,
        passwordHash: await bcrypt.hash(superAdminPassword, 12),
        name: 'Super Admin',
        isActive: true,
      },
    });
    console.log(`✅ Super admin created: ${superAdminEmail}`);
  }

  // ─── Demo Tenant ──────────────────────────────────────────────────────────
  const demoEmail = 'demo@garage.com';
  let demoTenant = await prisma.tenant.findUnique({ where: { email: demoEmail } });

  if (!demoTenant) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const basicPlan = await prisma.subscriptionPlanConfig.findUnique({
      where: { name: 'BASIC' },
    });

    demoTenant = await prisma.tenant.create({
      data: {
        name: 'Demo Garage',
        nameAr: 'كراج تجريبي',
        slug: 'demo-garage',
        email: demoEmail,
        phone: '+96512345678',
        status: 'TRIAL',
        trialEndsAt,
        country: 'KW',
        currency: 'KWD',
        vatRate: 0,
        defaultLanguage: 'AR',
      },
    });

    if (basicPlan) {
      await prisma.tenantSubscription.create({
        data: {
          tenantId: demoTenant.id,
          planId: basicPlan.id,
          billingCycle: 'MONTHLY',
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
        },
      });
    }

    // Main Branch
    const mainBranch = await prisma.branch.create({
      data: {
        tenantId: demoTenant.id,
        name: 'Main Branch',
        nameAr: 'الفرع الرئيسي',
        address: 'Kuwait City, Block 5',
        city: 'Kuwait City',
        phone: '+96512345678',
        dailyCapacity: 15,
        isActive: true,
      },
    });

    // Owner User
    await prisma.user.create({
      data: {
        tenantId: demoTenant.id,
        branchId: mainBranch.id,
        email: demoEmail,
        passwordHash: await bcrypt.hash('Demo@2024!', 12),
        name: 'Ahmad Al-Demo',
        nameAr: 'أحمد الديمو',
        role: 'GARAGE_OWNER',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Branch Manager
    await prisma.user.create({
      data: {
        tenantId: demoTenant.id,
        branchId: mainBranch.id,
        email: 'manager@garage.com',
        passwordHash: await bcrypt.hash('Manager@2024!', 12),
        name: 'Khalid Al-Manager',
        nameAr: 'خالد المدير',
        role: 'BRANCH_MANAGER',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Technician
    const techUser = await prisma.user.create({
      data: {
        tenantId: demoTenant.id,
        branchId: mainBranch.id,
        email: 'tech@garage.com',
        passwordHash: await bcrypt.hash('Tech@2024!', 12),
        name: 'Mohammed Al-Tech',
        nameAr: 'محمد الفني',
        role: 'TECHNICIAN',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.technician.create({
      data: {
        userId: techUser.id,
        tenantId: demoTenant.id,
        branchId: mainBranch.id,
        specialties: ['MECHANICAL', 'ELECTRICAL'],
        skillLevel: 'SENIOR',
        isAvailable: true,
      },
    });

    // Labor Rates
    const laborRates = [
      { category: 'OIL_CHANGE', name: 'Oil & Filter Change', nameAr: 'تغيير زيت وفلتر', basePrice: 15, estimatedMinutes: 30 },
      { category: 'BRAKE_SERVICE', name: 'Brake Pad Replacement', nameAr: 'تغيير فرامل', basePrice: 50, estimatedMinutes: 60 },
      { category: 'TIRE_SERVICE', name: 'Tire Rotation', nameAr: 'تدوير إطارات', basePrice: 20, estimatedMinutes: 45 },
      { category: 'AC_SERVICE', name: 'AC Gas Refill', nameAr: 'شحن فريون', basePrice: 35, estimatedMinutes: 30 },
      { category: 'ELECTRICAL', name: 'Battery Replacement', nameAr: 'تغيير بطارية', basePrice: 25, estimatedMinutes: 20 },
      { category: 'ENGINE', name: 'Engine Diagnostic', nameAr: 'تشخيص المحرك', basePrice: 30, estimatedMinutes: 60 },
      { category: 'TRANSMISSION', name: 'Transmission Service', nameAr: 'صيانة ناقل الحركة', basePrice: 80, estimatedMinutes: 120 },
      { category: 'BODYWORK', name: 'Minor Dent Repair', nameAr: 'إصلاح خدش بسيط', basePrice: 60, estimatedMinutes: 90 },
    ];

    for (const rate of laborRates) {
      await prisma.laborRate.create({
        data: { ...rate, tenantId: demoTenant.id, isActive: true },
      });
    }

    // Quality Check Template
    const qualityTemplate = await prisma.qualityCheckTemplate.create({
      data: {
        tenantId: demoTenant.id,
        name: 'Standard Quality Check',
        nameAr: 'فحص الجودة القياسي',
        isDefault: true,
        isActive: true,
      },
    });

    const qualityItems = [
      { name: 'Engine oil level', nameAr: 'مستوى زيت المحرك', category: 'ENGINE', isRequired: true },
      { name: 'Brake fluid level', nameAr: 'مستوى سائل الفرامل', category: 'BRAKES', isRequired: true },
      { name: 'Tire pressure', nameAr: 'ضغط الإطارات', category: 'TIRES', isRequired: true },
      { name: 'Lights functioning', nameAr: 'الأضواء تعمل', category: 'ELECTRICAL', isRequired: true },
      { name: 'AC working', nameAr: 'التكييف يعمل', category: 'AC', isRequired: false },
      { name: 'No fluid leaks', nameAr: 'لا توجد تسريبات', category: 'ENGINE', isRequired: true },
      { name: 'Interior clean', nameAr: 'الداخلية نظيفة', category: 'GENERAL', isRequired: true },
      { name: 'Exterior clean', nameAr: 'الخارجية نظيفة', category: 'GENERAL', isRequired: true },
    ];

    for (let i = 0; i < qualityItems.length; i++) {
      await prisma.qualityCheckTemplateItem.create({
        data: { ...qualityItems[i], templateId: qualityTemplate.id, sortOrder: i },
      });
    }

    console.log(`✅ Demo tenant created: ${demoEmail} / Demo@2024!`);
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Login credentials:');
  console.log(`   Super Admin: ${process.env.SUPER_ADMIN_EMAIL || 'admin@gms.com'} / ${process.env.SUPER_ADMIN_PASSWORD || 'Admin@2024!'}`);
  console.log('   Demo Garage Owner: demo@garage.com / Demo@2024!');
  console.log('   Demo Manager: manager@garage.com / Manager@2024!');
  console.log('   Demo Technician: tech@garage.com / Tech@2024!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
