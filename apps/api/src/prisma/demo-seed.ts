/**
 * Comprehensive demo data seeder.
 *
 * Populates ONE tenant with realistic data across every major model so the
 * whole system can be explored end to end: multi-branch, every user role,
 * technicians, customers, vehicles, parts + inventory, suppliers, labor rates,
 * work orders in ALL ten statuses, task assignments, quality checks, invoices,
 * payments, appointments, loyalty and reviews.
 *
 * Safe to re-run: it targets a single tenant (by email) and skips if that
 * tenant already has work orders. It never deletes anything.
 *
 *   npm run db:seed:demo --workspace=apps/api
 */
import { PrismaClient, WorkOrderStatus, TaskStatus, PaymentStatus, PaymentMethod, AppointmentStatus, TechnicianSpecialty } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TENANT_EMAIL = 'owner@elite.com';
const PASSWORD = 'Elite@2026';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000);

async function main() {
  console.log('🌱 Seeding comprehensive demo data...\n');

  const tenant = await prisma.tenant.findUnique({ where: { email: TENANT_EMAIL } });
  if (!tenant) {
    throw new Error(`Tenant ${TENANT_EMAIL} not found. Register it first via POST /api/auth/register.`);
  }
  const tenantId = tenant.id;

  const existing = await prisma.workOrder.count({ where: { tenantId } });
  if (existing > 0) {
    console.log(`⏭️  Tenant already has ${existing} work orders — nothing to do.`);
    return;
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      nameAr: 'ورشة النخبة للسيارات',
      phone: '+96599112233',
      vatNumber: 'KW-VAT-8842190',
      vatRate: 5,
      country: 'KW',
      currency: 'KWD',
      timezone: 'Asia/Kuwait',
      settings: { invoiceTemplate: 'MODERN' },
    },
  });

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // ─── Branches ─────────────────────────────────────────────────────────────
  const mainBranch = await prisma.branch.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  if (!mainBranch) throw new Error('Main branch missing');

  await prisma.branch.update({
    where: { id: mainBranch.id },
    data: {
      name: 'Shuwaikh Main Branch',
      nameAr: 'فرع الشويخ الرئيسي',
      address: 'Shuwaikh Industrial Area, Block 2, Street 28',
      addressAr: 'الشويخ الصناعية، قطعة ٢، شارع ٢٨',
      city: 'Kuwait City',
      phone: '+96522334455',
      email: 'shuwaikh@elite.com',
      dailyCapacity: 18,
      workingHours: { sat: { open: '08:00', close: '20:00' }, sun: { open: '08:00', close: '20:00' }, mon: { open: '08:00', close: '20:00' }, tue: { open: '08:00', close: '20:00' }, wed: { open: '08:00', close: '20:00' }, thu: { open: '08:00', close: '18:00' }, fri: { open: '16:00', close: '20:00' } },
      isActive: true,
    },
  });

  const salmiyaBranch = await prisma.branch.create({
    data: {
      tenantId,
      name: 'Salmiya Branch',
      nameAr: 'فرع السالمية',
      address: 'Salmiya, Block 10, Salem Al Mubarak St',
      addressAr: 'السالمية، قطعة ١٠، شارع سالم المبارك',
      city: 'Salmiya',
      phone: '+96522667788',
      email: 'salmiya@elite.com',
      dailyCapacity: 10,
      workingHours: { sat: { open: '09:00', close: '19:00' }, sun: { open: '09:00', close: '19:00' } },
      isActive: true,
    },
  });
  console.log('✅ Branches: 2 (Shuwaikh + Salmiya)');

  // ─── Staff users (every role) ─────────────────────────────────────────────
  const owner = await prisma.user.findFirst({ where: { tenantId, role: 'GARAGE_OWNER' } });
  if (!owner) throw new Error('Owner missing');
  await prisma.user.update({
    where: { id: owner.id },
    data: { nameAr: 'فيصل الرشيد', phone: '+96599112233', branchId: mainBranch.id, avatar: '👨‍💼', emailVerifiedAt: new Date() },
  });

  const staff = await Promise.all([
    prisma.user.create({ data: { tenantId, branchId: mainBranch.id, email: 'manager@elite.com', passwordHash, name: 'Khalid Al-Mutairi', nameAr: 'خالد المطيري', phone: '+96599220011', role: 'BRANCH_MANAGER', avatar: '💼', isActive: true, emailVerifiedAt: new Date(), lastLoginAt: hoursAgo(3) } }),
    prisma.user.create({ data: { tenantId, branchId: salmiyaBranch.id, email: 'manager2@elite.com', passwordHash, name: 'Yousef Al-Enezi', nameAr: 'يوسف العنزي', phone: '+96599220012', role: 'BRANCH_MANAGER', avatar: '💼', isActive: true, emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { tenantId, branchId: mainBranch.id, email: 'accountant@elite.com', passwordHash, name: 'Noura Al-Sabah', nameAr: 'نورة الصباح', phone: '+96599330022', role: 'ACCOUNTANT', avatar: '📊', isActive: true, emailVerifiedAt: new Date(), lastLoginAt: hoursAgo(20) } }),
    prisma.user.create({ data: { tenantId, branchId: mainBranch.id, email: 'reception@elite.com', passwordHash, name: 'Dana Al-Ajmi', nameAr: 'دانة العجمي', phone: '+96599440033', role: 'RECEPTIONIST', avatar: '📋', isActive: true, emailVerifiedAt: new Date() } }),
    prisma.user.create({ data: { tenantId, branchId: salmiyaBranch.id, email: 'inactive@elite.com', passwordHash, name: 'Omar Al-Hajri', nameAr: 'عمر الهاجري', phone: '+96599550044', role: 'ACCOUNTANT', avatar: '👤', isActive: false } }),
  ]);
  const [manager, manager2, accountant, receptionist] = staff;
  console.log('✅ Staff users: 6 (owner, 2 managers, 2 accountants incl. 1 disabled, receptionist)');

  // ─── Technicians ──────────────────────────────────────────────────────────
  const techSpecs: { email: string; name: string; nameAr: string; specialties: TechnicianSpecialty[]; skill: string; rate: number; commission: number; branchId: string; emp: string }[] = [
    { email: 'tech1@elite.com', name: 'Mohammed Al-Tech', nameAr: 'محمد الفني', specialties: ['MECHANICAL', 'GENERAL'], skill: 'SENIOR', rate: 12, commission: 8, branchId: mainBranch.id, emp: 'EMP-1001' },
    { email: 'tech2@elite.com', name: 'Ali Al-Electric', nameAr: 'علي الكهربائي', specialties: ['ELECTRICAL', 'AC_SYSTEM'], skill: 'MID_LEVEL', rate: 9, commission: 6, branchId: mainBranch.id, emp: 'EMP-1002' },
    { email: 'tech3@elite.com', name: 'Salem Al-Body', nameAr: 'سالم الحدادة', specialties: ['BODYWORK', 'PAINTING'], skill: 'MASTER', rate: 15, commission: 10, branchId: mainBranch.id, emp: 'EMP-1003' },
    { email: 'tech4@elite.com', name: 'Bader Al-Tires', nameAr: 'بدر الإطارات', specialties: ['TIRES', 'GENERAL'], skill: 'JUNIOR', rate: 6, commission: 4, branchId: salmiyaBranch.id, emp: 'EMP-1004' },
  ];

  const technicians = [];
  for (const t of techSpecs) {
    const u = await prisma.user.create({
      data: { tenantId, branchId: t.branchId, email: t.email, passwordHash, name: t.name, nameAr: t.nameAr, phone: '+9659900' + t.emp.slice(-4), role: 'TECHNICIAN', avatar: '🔧', isActive: true, emailVerifiedAt: new Date(), lastLoginAt: hoursAgo(2) },
    });
    const tech = await prisma.technician.create({
      data: { userId: u.id, tenantId, branchId: t.branchId, employeeId: t.emp, specialties: t.specialties, hourlyRate: t.rate, commissionPercent: t.commission, skillLevel: t.skill, isAvailable: true, certifications: t.skill === 'MASTER' ? ['ASE Certified', 'Bosch Diagnostics'] : [], workingHours: { sat: '08:00-18:00' } },
    });
    technicians.push(tech);
  }
  console.log('✅ Technicians: 4 (all specialties, JUNIOR→MASTER)');

  // ─── Customers ────────────────────────────────────────────────────────────
  const customerSeed = [
    { name: 'Ahmad Al-Otaibi', nameAr: 'أحمد العتيبي', phone: '50144102', email: 'ahmad@example.com', type: 'INDIVIDUAL', loyalty: 420, spent: 1240.5, visits: 7, pref: 'WHATSAPP' },
    { name: 'Sara Al-Kandari', nameAr: 'سارة الكندري', phone: '55667788', email: 'sara@example.com', type: 'INDIVIDUAL', loyalty: 180, spent: 530.0, visits: 3, pref: 'CALL' },
    { name: 'Kuwait Logistics Co.', nameAr: 'شركة الكويت للخدمات اللوجستية', phone: '22445566', email: 'fleet@kwlogistics.com', type: 'FLEET', loyalty: 1500, spent: 8750.0, visits: 24, pref: 'EMAIL', company: 'Kuwait Logistics Co.', tax: 'KW-TAX-99120' },
    { name: 'Fahad Al-Azmi', nameAr: 'فهد العازمي', phone: '99887766', email: null, type: 'INDIVIDUAL', loyalty: 60, spent: 175.0, visits: 2, pref: 'SMS' },
    { name: 'Maryam Al-Fadhli', nameAr: 'مريم الفضلي', phone: '66554433', email: 'maryam@example.com', type: 'INDIVIDUAL', loyalty: 320, spent: 940.0, visits: 5, pref: 'WHATSAPP' },
    { name: 'Gulf Rent A Car', nameAr: 'الخليج لتأجير السيارات', phone: '24567890', email: 'ops@gulfrent.com', type: 'FLEET', loyalty: 900, spent: 5210.0, visits: 16, pref: 'EMAIL', company: 'Gulf Rent A Car', tax: 'KW-TAX-77431' },
    { name: 'Nasser Al-Dosari', nameAr: 'ناصر الدوسري', phone: '97112233', email: 'nasser@example.com', type: 'INDIVIDUAL', loyalty: 0, spent: 0, visits: 1, pref: 'CALL' },
    { name: 'Talal Al-Shammari', nameAr: 'طلال الشمري', phone: '90011223', email: null, type: 'INDIVIDUAL', loyalty: 0, spent: 320.0, visits: 4, pref: 'SMS', blacklisted: true, blacklistReason: 'تكرار عدم الحضور للمواعيد وعدم سداد فاتورتين' },
  ];

  const customers = [];
  for (const [i, c] of customerSeed.entries()) {
    customers.push(await prisma.customer.create({
      data: {
        tenantId, name: c.name, nameAr: c.nameAr, phone: c.phone, email: c.email ?? undefined,
        type: c.type, companyName: (c as any).company, companyTaxNumber: (c as any).tax,
        address: c.type === 'FLEET' ? 'Shuwaikh Industrial, Kuwait' : 'Kuwait',
        loyaltyPoints: c.loyalty, totalSpent: c.spent, visitCount: c.visits,
        referralCode: `ELITE-${1000 + i}`, preferredContactMethod: c.pref,
        optInMarketing: !(c as any).blacklisted,
        isBlacklisted: !!(c as any).blacklisted, blacklistReason: (c as any).blacklistReason,
        preferredLanguage: i % 3 === 0 ? 'EN' : 'AR',
        notes: c.type === 'FLEET' ? 'عقد أسطول — خصم 10% على أجور اليد' : undefined,
      },
    }));
  }
  console.log('✅ Customers: 8 (individual + fleet, incl. 1 blacklisted)');

  // ─── Vehicles ─────────────────────────────────────────────────────────────
  const vehicleSeed = [
    { plate: '30-757123', make: 'Land Rover', model: 'Range Rover Sport', year: 2014, color: 'White', colorAr: 'أبيض', body: 'SUV', fuel: 'Petrol', trans: 'Auto', engine: '3.0L V6', vin: 'SALWR2WF8EA123456', mileage: 98500, cust: 0 },
    { plate: '45-221900', make: 'Toyota', model: 'Camry', year: 2021, color: 'Silver', colorAr: 'فضي', body: 'Sedan', fuel: 'Petrol', trans: 'Auto', engine: '2.5L', vin: 'JTNB11HK1M3012345', mileage: 42000, cust: 1 },
    { plate: '12-889001', make: 'Isuzu', model: 'D-Max', year: 2019, color: 'White', colorAr: 'أبيض', body: 'Truck', fuel: 'Diesel', trans: 'Manual', engine: '2.5L', vin: 'MPATFS85JJT123456', mileage: 187000, cust: 2 },
    { plate: '12-889002', make: 'Mitsubishi', model: 'Canter', year: 2020, color: 'White', colorAr: 'أبيض', body: 'Truck', fuel: 'Diesel', trans: 'Manual', engine: '3.0L', vin: 'JL6BBG1A0LK123456', mileage: 142000, cust: 2 },
    { plate: '77-334455', make: 'Nissan', model: 'Patrol', year: 2018, color: 'Black', colorAr: 'أسود', body: 'SUV', fuel: 'Petrol', trans: 'Auto', engine: '5.6L V8', vin: 'JN8AY2NY0J9012345', mileage: 121000, cust: 3 },
    { plate: '88-990011', make: 'Lexus', model: 'ES 350', year: 2022, color: 'Pearl White', colorAr: 'أبيض لؤلؤي', body: 'Sedan', fuel: 'Petrol', trans: 'Auto', engine: '3.5L V6', vin: 'JTHBZ1B10N2012345', mileage: 28000, cust: 4 },
    { plate: '55-102030', make: 'Hyundai', model: 'Elantra', year: 2020, color: 'Blue', colorAr: 'أزرق', body: 'Sedan', fuel: 'Petrol', trans: 'Auto', engine: '2.0L', vin: 'KMHLM4AG0LU123456', mileage: 67000, cust: 5 },
    { plate: '55-102031', make: 'Kia', model: 'Sportage', year: 2021, color: 'Gray', colorAr: 'رمادي', body: 'SUV', fuel: 'Petrol', trans: 'Auto', engine: '2.4L', vin: 'KNDPMCAC0M7123456', mileage: 51000, cust: 5 },
    { plate: '10-445566', make: 'Chevrolet', model: 'Tahoe', year: 2017, color: 'Red', colorAr: 'أحمر', body: 'SUV', fuel: 'Petrol', trans: 'Auto', engine: '5.3L V8', vin: '1GNSKBKC0HR123456', mileage: 155000, cust: 6 },
    { plate: '20-778899', make: 'Tesla', model: 'Model 3', year: 2023, color: 'Midnight Blue', colorAr: 'أزرق داكن', body: 'Sedan', fuel: 'Electric', trans: 'Auto', engine: 'Dual Motor', vin: '5YJ3E1EB0PF123456', mileage: 15000, cust: 4 },
  ];

  const vehicles = [];
  for (const v of vehicleSeed) {
    const veh = await prisma.vehicle.create({
      data: {
        tenantId, plateNumber: v.plate, plateState: 'KW', make: v.make, model: v.model, year: v.year,
        color: v.color, colorAr: v.colorAr, bodyType: v.body, fuelType: v.fuel, transmissionType: v.trans,
        engineSize: v.engine, vin: v.vin, mileageAtFirst: v.mileage, receivedById: receptionist.id,
        qrCode: `ELITE-VEH-${v.plate}`,
      },
    });
    await prisma.customerVehicle.create({ data: { customerId: customers[v.cust].id, vehicleId: veh.id, isPrimary: true } });
    vehicles.push(veh);
  }
  console.log('✅ Vehicles: 10 (sedan/SUV/truck, petrol/diesel/electric) linked to owners');

  // ─── Labor rates ──────────────────────────────────────────────────────────
  const laborSeed = [
    { cat: 'OIL_CHANGE', name: 'Engine Oil & Filter Change', nameAr: 'تغيير زيت وفلتر المحرك', price: 18, mins: 45 },
    { cat: 'BRAKE_SERVICE', name: 'Brake Pads Replacement', nameAr: 'تبديل فحمات الفرامل', price: 35, mins: 90 },
    { cat: 'AC_SERVICE', name: 'A/C Diagnosis & Gas Refill', nameAr: 'فحص وتعبئة غاز المكيف', price: 28, mins: 75 },
    { cat: 'ELECTRICAL', name: 'Electrical Fault Diagnosis', nameAr: 'فحص الأعطال الكهربائية', price: 22, mins: 60 },
    { cat: 'TIRES', name: 'Tire Replacement & Balancing', nameAr: 'تبديل وترصيص الإطارات', price: 15, mins: 40 },
    { cat: 'BODYWORK', name: 'Dent Repair & Painting (per panel)', nameAr: 'سمكرة ودهان (لكل قطعة)', price: 65, mins: 240 },
    { cat: 'SUSPENSION', name: 'Suspension Overhaul', nameAr: 'صيانة المساعدين والعفشة', price: 55, mins: 180 },
    { cat: 'INSPECTION', name: 'Comprehensive Inspection', nameAr: 'فحص شامل', price: 12, mins: 30 },
  ];
  const laborRates: Awaited<ReturnType<typeof prisma.laborRate.create>>[] = [];
  for (const [i, l] of laborSeed.entries()) {
    laborRates.push(await prisma.laborRate.create({
      data: { tenantId, category: l.cat, name: l.name, nameAr: l.nameAr, basePrice: l.price, estimatedMinutes: l.mins, sortOrder: i, isActive: true, vehicleTypePricing: { Sedan: l.price, SUV: Math.round(l.price * 1.3), Truck: Math.round(l.price * 1.6) } },
    }));
  }
  console.log('✅ Labor rates: 8');

  // ─── Suppliers ────────────────────────────────────────────────────────────
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { tenantId, name: 'Al-Mulla Auto Parts', nameAr: 'الملا لقطع الغيار', phone: '22551100', whatsapp: '99551100', email: 'sales@almulla-parts.com', contactPerson: 'Waleed Al-Mulla', address: 'Shuwaikh Industrial', paymentTermDays: 30, isActive: true } }),
    prisma.supplier.create({ data: { tenantId, name: 'Gulf Genuine Parts', nameAr: 'الخليج للقطع الأصلية', phone: '22663300', whatsapp: '99663300', email: 'orders@gulfgenuine.com', contactPerson: 'Hassan Kareem', address: 'Ardiya', paymentTermDays: 45, isActive: true } }),
    prisma.supplier.create({ data: { tenantId, name: 'Speed Tyres Kuwait', nameAr: 'سبيد للإطارات', phone: '22778800', email: 'info@speedtyres.com', contactPerson: 'Jassim Ali', address: 'Rai', paymentTermDays: 15, isActive: true } }),
  ]);
  console.log('✅ Suppliers: 3');

  // ─── Parts + inventory (incl. low & out of stock) ─────────────────────────
  const partSeed = [
    { pn: 'OIL-5W30-4L', name: 'Engine Oil 5W-30 (4L)', nameAr: 'زيت محرك 5W-30 (4 لتر)', cat: 'Fluids', brand: 'Mobil 1', buy: 8.5, sell: 13.5, unit: 'PCS', qty: 48, min: 12, warranty: 0, sup: 0 },
    { pn: 'FLT-OIL-TOY', name: 'Oil Filter — Toyota', nameAr: 'فلتر زيت — تويوتا', cat: 'Filters', brand: 'Denso', buy: 1.8, sell: 3.5, unit: 'PCS', qty: 60, min: 15, warranty: 0, sup: 1 },
    { pn: 'FLT-AIR-UNI', name: 'Air Filter — Universal', nameAr: 'فلتر هواء — عام', cat: 'Filters', brand: 'K&N', buy: 4.2, sell: 8.0, unit: 'PCS', qty: 25, min: 10, warranty: 0, sup: 1 },
    { pn: 'BRK-PAD-FRT', name: 'Brake Pads Front Set', nameAr: 'طقم فحمات أمامية', cat: 'Brakes', brand: 'Brembo', buy: 14.0, sell: 26.0, unit: 'SET', qty: 6, min: 8, warranty: 180, sup: 1 },
    { pn: 'BRK-DISC-FRT', name: 'Brake Disc Front', nameAr: 'ديسك فرامل أمامي', cat: 'Brakes', brand: 'ATE', buy: 18.0, sell: 32.0, unit: 'PCS', qty: 0, min: 4, warranty: 365, sup: 1 },
    { pn: 'BAT-70AH', name: 'Battery 70Ah', nameAr: 'بطارية 70 أمبير', cat: 'Electrical', brand: 'AC Delco', buy: 21.0, sell: 34.0, unit: 'PCS', qty: 14, min: 5, warranty: 730, sup: 0 },
    { pn: 'AC-GAS-R134A', name: 'A/C Gas R134a', nameAr: 'غاز مكيف R134a', cat: 'AC', brand: 'Honeywell', buy: 5.0, sell: 9.5, unit: 'PCS', qty: 30, min: 10, warranty: 0, sup: 0 },
    { pn: 'AC-COMP-UNI', name: 'A/C Compressor', nameAr: 'كمبروسر مكيف', cat: 'AC', brand: 'Denso', buy: 78.0, sell: 135.0, unit: 'PCS', qty: 3, min: 2, warranty: 365, sup: 1 },
    { pn: 'TYR-265-65-17', name: 'Tyre 265/65 R17', nameAr: 'إطار 265/65 R17', cat: 'Tires', brand: 'Bridgestone', buy: 32.0, sell: 52.0, unit: 'PCS', qty: 20, min: 8, warranty: 365, sup: 2 },
    { pn: 'TYR-225-45-18', name: 'Tyre 225/45 R18', nameAr: 'إطار 225/45 R18', cat: 'Tires', brand: 'Michelin', buy: 38.0, sell: 61.0, unit: 'PCS', qty: 2, min: 8, warranty: 365, sup: 2 },
    { pn: 'SPK-PLUG-IR', name: 'Spark Plug Iridium', nameAr: 'بوجيه إيريديوم', cat: 'Engine', brand: 'NGK', buy: 3.2, sell: 6.5, unit: 'PCS', qty: 80, min: 20, warranty: 180, sup: 1 },
    { pn: 'SUSP-SHOCK-RR', name: 'Rear Shock Absorber', nameAr: 'مساعد خلفي', cat: 'Suspension', brand: 'KYB', buy: 24.0, sell: 42.0, unit: 'PCS', qty: 9, min: 4, warranty: 365, sup: 0 },
  ];

  const parts: Awaited<ReturnType<typeof prisma.part.create>>[] = [];
  for (const p of partSeed) {
    const part = await prisma.part.create({
      data: {
        tenantId, partNumber: p.pn, name: p.name, nameAr: p.nameAr, category: p.cat, brand: p.brand,
        barcode: '628' + Math.floor(1000000000 + Math.random() * 8999999999),
        unit: p.unit, purchasePrice: p.buy, sellingPrice: p.sell,
        marginPercent: Math.round(((p.sell - p.buy) / p.sell) * 100),
        warrantyDays: p.warranty, isActive: true,
        vehicleCompatibility: ['Toyota Camry 2018-2023', 'Nissan Patrol 2016-2022'],
      },
    });
    const inv = await prisma.inventory.create({
      data: { partId: part.id, branchId: mainBranch.id, quantity: p.qty, availableQty: p.qty, reservedQty: 0, minStockLevel: p.min, maxStockLevel: p.min * 6, reorderPoint: p.min, location: `A-${Math.ceil(Math.random() * 12)}-${Math.ceil(Math.random() * 9)}`, lastRestockedAt: daysAgo(Math.ceil(Math.random() * 40)) },
    });
    await prisma.inventoryTransaction.create({ data: { inventoryId: inv.id, type: 'IN', quantity: p.qty, referenceType: 'MANUAL', notes: 'رصيد افتتاحي', userId: manager.id } });
    // Second branch stock for a subset
    if (parts.length < 6) {
      await prisma.inventory.create({ data: { partId: part.id, branchId: salmiyaBranch.id, quantity: Math.ceil(p.qty / 3), availableQty: Math.ceil(p.qty / 3), minStockLevel: Math.ceil(p.min / 2), maxStockLevel: p.min * 3, reorderPoint: Math.ceil(p.min / 2), location: `S-${Math.ceil(Math.random() * 6)}` } });
    }
    await prisma.partSupplier.create({ data: { partId: part.id, supplierId: suppliers[p.sup].id, supplierPartNumber: p.pn + '-SUP', purchasePrice: p.buy, leadTimeDays: 3, isPreferred: true } });
    parts.push(part);
  }
  console.log('✅ Parts: 12 with inventory (incl. 1 out-of-stock, 2 below reorder point) + supplier links');

  // ─── Quality check template ───────────────────────────────────────────────
  const qcTemplate = await prisma.qualityCheckTemplate.create({
    data: {
      tenantId, name: 'Standard Quality Check', nameAr: 'فحص الجودة القياسي', isDefault: true, isActive: true,
      items: {
        create: [
          { name: 'Engine oil level', nameAr: 'مستوى زيت المحرك', category: 'ENGINE', isRequired: true, sortOrder: 0 },
          { name: 'Brake fluid level', nameAr: 'مستوى سائل الفرامل', category: 'BRAKES', isRequired: true, sortOrder: 1 },
          { name: 'Tire pressure', nameAr: 'ضغط الإطارات', category: 'TIRES', isRequired: true, sortOrder: 2 },
          { name: 'Lights functioning', nameAr: 'الأضواء تعمل', category: 'ELECTRICAL', isRequired: true, sortOrder: 3 },
          { name: 'A/C working', nameAr: 'التكييف يعمل', category: 'AC', isRequired: false, sortOrder: 4 },
          { name: 'No fluid leaks', nameAr: 'لا توجد تسريبات', category: 'ENGINE', isRequired: true, sortOrder: 5 },
          { name: 'Interior clean', nameAr: 'الداخلية نظيفة', category: 'GENERAL', isRequired: true, sortOrder: 6 },
          { name: 'Exterior clean', nameAr: 'الخارجية نظيفة', category: 'GENERAL', isRequired: true, sortOrder: 7 },
        ],
      },
    },
    include: { items: true },
  });
  console.log('✅ Quality check template: 8 items');

  // ─── Work orders — every status ───────────────────────────────────────────
  type WOSpec = {
    n: number; status: WorkOrderStatus; priority: string; veh: number; cust: number; branch: string;
    complaint: string; mileage: number; received: Date; labor: { rate: number; qty?: number }[];
    partItems: { part: number; qty: number }[]; task?: { tech: number; spec: TechnicianSpecialty; status: TaskStatus };
    diagnosis?: string; cancelReason?: string;
  };

  const woSpecs: WOSpec[] = [
    { n: 1, status: 'DELIVERED', priority: 'NORMAL', veh: 1, cust: 1, branch: mainBranch.id, complaint: 'صوت طقطقة عند الفرملة + موعد تغيير الزيت', mileage: 41200, received: daysAgo(21), labor: [{ rate: 0 }, { rate: 1 }], partItems: [{ part: 0, qty: 1 }, { part: 1, qty: 1 }, { part: 3, qty: 1 }], task: { tech: 0, spec: 'MECHANICAL', status: 'COMPLETED' }, diagnosis: 'فحمات أمامية تالفة، تم التبديل مع تغيير الزيت والفلتر.' },
    { n: 2, status: 'DELIVERED', priority: 'HIGH', veh: 4, cust: 3, branch: mainBranch.id, complaint: 'المكيف لا يبرد نهائياً', mileage: 120400, received: daysAgo(14), labor: [{ rate: 2 }], partItems: [{ part: 6, qty: 2 }, { part: 7, qty: 1 }], task: { tech: 1, spec: 'AC_SYSTEM', status: 'COMPLETED' }, diagnosis: 'كمبروسر المكيف تالف — تم تبديله وتعبئة الغاز.' },
    { n: 3, status: 'READY_FOR_DELIVERY', priority: 'NORMAL', veh: 5, cust: 4, branch: mainBranch.id, complaint: 'فحص دوري شامل قبل السفر', mileage: 27800, received: daysAgo(4), labor: [{ rate: 7 }, { rate: 0 }], partItems: [{ part: 0, qty: 1 }, { part: 1, qty: 1 }], task: { tech: 0, spec: 'GENERAL', status: 'COMPLETED' }, diagnosis: 'السيارة بحالة ممتازة، تم تغيير الزيت والفلتر فقط.' },
    { n: 4, status: 'QUALITY_CHECK', priority: 'NORMAL', veh: 6, cust: 5, branch: mainBranch.id, complaint: 'اهتزاز في المقود على السرعات العالية', mileage: 66500, received: daysAgo(3), labor: [{ rate: 4 }], partItems: [{ part: 9, qty: 2 }], task: { tech: 3, spec: 'TIRES', status: 'COMPLETED' }, diagnosis: 'إطارات أمامية غير متزنة — تم التبديل والترصيص.' },
    { n: 5, status: 'IN_PROGRESS', priority: 'HIGH', veh: 8, cust: 6, branch: mainBranch.id, complaint: 'صوت من العفشة الخلفية عند المطبات', mileage: 154200, received: daysAgo(2), labor: [{ rate: 6 }], partItems: [{ part: 11, qty: 2 }], task: { tech: 0, spec: 'MECHANICAL', status: 'IN_PROGRESS' }, diagnosis: 'مساعدات خلفية تالفة — جاري التبديل.' },
    { n: 6, status: 'APPROVED', priority: 'URGENT', veh: 2, cust: 2, branch: mainBranch.id, complaint: 'السيارة لا تشتغل — يشتبه بالبطارية', mileage: 186500, received: daysAgo(1), labor: [{ rate: 3 }], partItems: [{ part: 5, qty: 1 }], task: { tech: 1, spec: 'ELECTRICAL', status: 'PENDING' }, diagnosis: 'بطارية ضعيفة تحتاج تبديل — تمت موافقة العميل.' },
    { n: 7, status: 'AWAITING_APPROVAL', priority: 'NORMAL', veh: 3, cust: 2, branch: mainBranch.id, complaint: 'صيانة دورية 140 ألف كم', mileage: 141800, received: daysAgo(1), labor: [{ rate: 0 }, { rate: 7 }], partItems: [{ part: 0, qty: 1 }, { part: 1, qty: 1 }, { part: 10, qty: 4 }], diagnosis: 'صيانة دورية شاملة — بانتظار موافقة العميل على العرض.' },
    { n: 8, status: 'QUOTED', priority: 'LOW', veh: 7, cust: 5, branch: salmiyaBranch.id, complaint: 'خدش عميق في الباب الأمامي الأيمن', mileage: 50800, received: daysAgo(2), labor: [{ rate: 5 }], partItems: [], diagnosis: 'يحتاج سمكرة ودهان لقطعة واحدة.' },
    { n: 9, status: 'DIAGNOSING', priority: 'NORMAL', veh: 9, cust: 4, branch: mainBranch.id, complaint: 'لمبة تحذير البطارية تضيء أحياناً', mileage: 14800, received: hoursAgo(20), labor: [], partItems: [] },
    { n: 10, status: 'RECEIVED', priority: 'URGENT', veh: 0, cust: 0, branch: mainBranch.id, complaint: 'تسريب زيت أسفل المحرك + صوت غير طبيعي', mileage: 99100, received: hoursAgo(3), labor: [], partItems: [] },
    { n: 11, status: 'CANCELLED', priority: 'LOW', veh: 6, cust: 5, branch: salmiyaBranch.id, complaint: 'تغيير إطارات', mileage: 66000, received: daysAgo(9), labor: [{ rate: 4 }], partItems: [{ part: 9, qty: 4 }], cancelReason: 'العميل رفض العرض — وجد سعر أفضل خارجياً' },
  ];

  const year = new Date().getFullYear();
  const createdWOs: any[] = [];

  for (const s of woSpecs) {
    const laborItems = s.labor.map((l, idx) => {
      const lr = laborRates[l.rate];
      const qty = l.qty ?? 1;
      const price = Number(lr.basePrice);
      return { type: 'LABOR', laborRateId: lr.id, description: lr.name, descriptionAr: lr.nameAr, quantity: qty, unitPrice: price, costPrice: 0, totalPrice: price * qty, isApproved: true, sortOrder: idx, warrantyDays: 30 };
    });
    const partItems = s.partItems.map((pi, idx) => {
      const p = parts[pi.part];
      const price = Number(p.sellingPrice);
      return { type: 'PART', partId: p.id, description: p.name, descriptionAr: p.nameAr, quantity: pi.qty, unitPrice: price, costPrice: Number(p.purchasePrice), totalPrice: price * pi.qty, isApproved: true, sortOrder: laborItems.length + idx, warrantyDays: p.warrantyDays };
    });
    const allItems = [...laborItems, ...partItems];
    const laborCost = laborItems.reduce((a, i) => a + i.totalPrice, 0);
    const partsCost = partItems.reduce((a, i) => a + i.totalPrice, 0);
    const subtotal = laborCost + partsCost;
    const taxAmount = Math.round(subtotal * 0.05 * 1000) / 1000;
    const totalAmount = subtotal + taxAmount;

    const reached = (st: WorkOrderStatus) => {
      const order: WorkOrderStatus[] = ['RECEIVED', 'DIAGNOSING', 'QUOTED', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'DELIVERED'];
      if (s.status === 'CANCELLED') return order.indexOf(st) <= order.indexOf('QUOTED');
      return order.indexOf(st) <= order.indexOf(s.status);
    };
    const rec = s.received;
    const off = (h: number) => new Date(rec.getTime() + h * 3_600_000);

    const wo = await prisma.workOrder.create({
      data: {
        tenantId, branchId: s.branch, orderNumber: `WO-${year}-${String(s.n).padStart(4, '0')}`,
        vehicleId: vehicles[s.veh].id, customerId: customers[s.cust].id, createdById: receptionist.id,
        status: s.status, priority: s.priority, mileageAtReception: s.mileage,
        customerComplaintsAr: s.complaint, customerComplaints: s.complaint,
        diagnosisNotes: s.diagnosis,
        diagnosisDiagram: s.n === 5 ? { points: [{ x: 60, y: 70, label: 'مساعد خلفي أيسر', severity: 'HIGH' }, { x: 78, y: 70, label: 'مساعد خلفي أيمن', severity: 'MEDIUM' }] } : undefined,
        receivedAt: rec,
        diagnosedAt: reached('DIAGNOSING') ? off(2) : undefined,
        quotedAt: reached('QUOTED') ? off(4) : undefined,
        approvedAt: reached('APPROVED') ? off(6) : undefined,
        workStartedAt: reached('IN_PROGRESS') ? off(8) : undefined,
        qualityCheckedAt: reached('QUALITY_CHECK') ? off(26) : undefined,
        readyAt: reached('READY_FOR_DELIVERY') ? off(28) : undefined,
        deliveredAt: reached('DELIVERED') ? off(32) : undefined,
        estimatedReadyAt: daysAhead(2),
        approvalToken: crypto.randomUUID(), trackingToken: crypto.randomUUID(),
        approvalMethod: reached('APPROVED') ? 'LINK' : undefined,
        rejectionReason: s.cancelReason,
        laborCost, partsCost, taxAmount, totalAmount, discountAmount: 0,
        warrantyDays: reached('DELIVERED') ? 30 : 0,
        internalNotes: s.priority === 'URGENT' ? 'عميل مستعجل — أولوية قصوى' : undefined,
        workOrderItems: allItems.length ? { create: allItems } : undefined,
      },
    });
    createdWOs.push({ wo, spec: s, subtotal, taxAmount, totalAmount });

    // Status history trail
    const trail: { from: WorkOrderStatus | null; to: WorkOrderStatus; h: number }[] = [{ from: null, to: 'RECEIVED', h: 0 }];
    const chain: WorkOrderStatus[] = ['DIAGNOSING', 'QUOTED', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'DELIVERED'];
    let prev: WorkOrderStatus = 'RECEIVED';
    for (const [i, st] of chain.entries()) {
      if (!reached(st)) break;
      trail.push({ from: prev, to: st, h: (i + 1) * 3 });
      prev = st;
    }
    if (s.status === 'CANCELLED') trail.push({ from: prev, to: 'CANCELLED', h: 30 });
    for (const t of trail) {
      await prisma.workOrderStatusHistory.create({ data: { workOrderId: wo.id, fromStatus: t.from ?? undefined, toStatus: t.to, changedById: t.to === 'RECEIVED' ? receptionist.id : manager.id, notes: t.to === 'CANCELLED' ? s.cancelReason : undefined, createdAt: off(t.h) } });
    }

    // Task assignment
    if (s.task) {
      await prisma.taskAssignment.create({
        data: {
          workOrderId: wo.id, technicianId: technicians[s.task.tech].id, assignedById: manager.id,
          specialty: s.task.spec, status: s.task.status, estimatedHours: 2,
          actualHours: s.task.status === 'COMPLETED' ? 1.5 : undefined,
          startedAt: s.task.status !== 'PENDING' ? off(8) : undefined,
          completedAt: s.task.status === 'COMPLETED' ? off(24) : undefined,
          notes: 'يرجى التأكد من الفحص النهائي قبل التسليم', reworkStatus: 'NONE',
        },
      });
    }

    // Quality check for QC-and-beyond
    if (['QUALITY_CHECK', 'READY_FOR_DELIVERY', 'DELIVERED'].includes(s.status)) {
      await prisma.qualityCheck.create({
        data: {
          workOrderId: wo.id, checkedById: technicians[s.task?.tech ?? 0] ? (await prisma.technician.findUnique({ where: { id: technicians[s.task!.tech].id } }))!.userId : manager.id,
          isPassed: true, notes: 'تم الفحص بنجاح، السيارة جاهزة.', checkedAt: off(26),
          items: { create: qcTemplate.items.map((it) => ({ templateItemId: it.id, isPassed: true })) },
        },
      });
    }

    // Vehicle history
    await prisma.vehicleHistoryEntry.create({ data: { vehicleId: vehicles[s.veh].id, workOrderId: wo.id, mileage: s.mileage, type: 'WORK_ORDER', description: `${wo.orderNumber} — ${s.complaint}`, createdAt: rec } });
  }
  console.log('✅ Work orders: 11 covering ALL 10 statuses (+ items, history, tasks, QC)');

  // ─── Invoices + payments ──────────────────────────────────────────────────
  const invoiceTargets = createdWOs.filter((x) => ['DELIVERED', 'READY_FOR_DELIVERY'].includes(x.spec.status));
  let invNo = 1;
  for (const { wo, spec, subtotal, taxAmount, totalAmount } of invoiceTargets) {
    let status: PaymentStatus = 'PENDING';
    let paid = 0;
    if (spec.n === 1) { status = 'PAID'; paid = totalAmount; }
    else if (spec.n === 2) { status = 'PARTIAL'; paid = Math.round(totalAmount * 0.4 * 1000) / 1000; }

    const inv = await prisma.invoice.create({
      data: {
        tenantId, workOrderId: wo.id, customerId: wo.customerId,
        invoiceNumber: `INV-${year}-${String(invNo++).padStart(4, '0')}`,
        status, subtotal, discountAmount: 0, taxableAmount: subtotal, taxRate: 5, taxAmount,
        total: totalAmount, paidAmount: paid, remainingAmount: Math.round((totalAmount - paid) * 1000) / 1000,
        currency: 'KWD', issuedAt: wo.deliveredAt ?? wo.readyAt ?? new Date(),
        dueAt: daysAhead(14), paidAt: status === 'PAID' ? wo.deliveredAt : undefined,
        termsAndConditions: 'الضمان 30 يوم على أجور اليد. القطع حسب ضمان المورّد.',
      },
    });

    if (spec.n === 1) {
      await prisma.payment.create({ data: { invoiceId: inv.id, amount: totalAmount, method: 'CARD' as PaymentMethod, status: 'PAID', reference: 'KNET-882194', paidAt: wo.deliveredAt, notes: 'دفع كامل عبر كي نت' } });
    } else if (spec.n === 2) {
      await prisma.payment.create({ data: { invoiceId: inv.id, amount: paid, method: 'CASH' as PaymentMethod, status: 'PAID', reference: 'CASH-0012', paidAt: wo.deliveredAt, notes: 'دفعة مقدمة نقداً' } });
    }
  }
  console.log(`✅ Invoices: ${invoiceTargets.length} (PAID / PARTIAL / PENDING) + payments (KNET, cash)`);

  // ─── Appointments — every status ──────────────────────────────────────────
  const apptSpecs: { st: AppointmentStatus; when: Date; cust: number; veh: number; svc: string; dur: number }[] = [
    { st: 'SCHEDULED', when: daysAhead(1), cust: 0, veh: 0, svc: 'تغيير زيت وفلتر', dur: 45 },
    { st: 'CONFIRMED', when: daysAhead(2), cust: 4, veh: 5, svc: 'فحص شامل قبل السفر', dur: 60 },
    { st: 'IN_PROGRESS', when: hoursAgo(1), cust: 6, veh: 8, svc: 'صيانة العفشة', dur: 180 },
    { st: 'COMPLETED', when: daysAgo(3), cust: 1, veh: 1, svc: 'تبديل فحمات', dur: 90 },
    { st: 'CANCELLED', when: daysAgo(2), cust: 5, veh: 6, svc: 'تبديل إطارات', dur: 40 },
    { st: 'NO_SHOW', when: daysAgo(5), cust: 7, veh: 6, svc: 'فحص مكيف', dur: 75 },
  ];
  for (const a of apptSpecs) {
    const c = customers[a.cust];
    const v = vehicles[a.veh];
    await prisma.appointment.create({
      data: {
        tenantId, branchId: mainBranch.id, customerId: c.id, customerName: c.name, customerPhone: c.phone,
        vehiclePlate: v.plateNumber, vehicleMake: v.make, vehicleModel: v.model,
        serviceType: a.svc, description: a.svc, scheduledAt: a.when, estimatedDuration: a.dur,
        status: a.st, reminderSent: a.when < new Date(), reminderSentAt: a.when < new Date() ? daysAgo(1) : undefined,
        notes: a.st === 'NO_SHOW' ? 'العميل لم يحضر ولم يرد على الاتصال' : undefined,
      },
    });
  }
  console.log('✅ Appointments: 6 covering all statuses');

  // ─── Loyalty + reviews + reminders ────────────────────────────────────────
  await prisma.loyaltyTransaction.createMany({
    data: [
      { customerId: customers[0].id, points: 120, type: 'EARNED', description: 'صيانة دورية', createdAt: daysAgo(20) },
      { customerId: customers[0].id, points: -50, type: 'REDEEMED', description: 'خصم على الفاتورة', createdAt: daysAgo(10) },
      { customerId: customers[0].id, points: 100, type: 'BONUS', description: 'مكافأة إحالة صديق', createdAt: daysAgo(5) },
      { customerId: customers[2].id, points: 400, type: 'EARNED', description: 'عقد أسطول — دفعة ربعية', createdAt: daysAgo(30) },
      { customerId: customers[4].id, points: 80, type: 'EARNED', description: 'فحص شامل', createdAt: daysAgo(7) },
    ],
  });

  await prisma.review.createMany({
    data: [
      { customerId: customers[1].id, tenantId, branchId: mainBranch.id, workOrderId: createdWOs[0].wo.id, rating: 5, comment: 'Excellent and fast service, very professional team.', commentAr: 'خدمة ممتازة وسريعة، فريق محترف جداً.', isPublic: true, isVerified: true, submittedAt: daysAgo(19) },
      { customerId: customers[3].id, tenantId, branchId: mainBranch.id, workOrderId: createdWOs[1].wo.id, rating: 4, comment: 'Good work on the A/C, slightly delayed.', commentAr: 'شغل ممتاز على المكيف، بس تأخروا شوي.', isPublic: true, isVerified: true, submittedAt: daysAgo(12) },
      { customerId: customers[4].id, tenantId, branchId: mainBranch.id, rating: 5, commentAr: 'أفضل ورشة تعاملت معها في الكويت.', isPublic: true, isVerified: true, submittedAt: daysAgo(6) },
    ],
  });

  await prisma.maintenanceReminder.createMany({
    data: [
      { vehicleId: vehicles[1].id, type: 'OIL_CHANGE', dueDate: daysAhead(20), dueMileage: 47000, lastServiceDate: daysAgo(21), lastMileage: 41200, isSent: false },
      { vehicleId: vehicles[4].id, type: 'TIRE_ROTATION', dueDate: daysAhead(45), dueMileage: 126000, lastServiceDate: daysAgo(14), lastMileage: 120400, isSent: false },
      { vehicleId: vehicles[9].id, type: 'INSPECTION', dueDate: daysAgo(2), dueMileage: 16000, lastServiceDate: daysAgo(90), lastMileage: 10000, isSent: true, sentAt: daysAgo(3) },
    ],
  });
  console.log('✅ Loyalty transactions, reviews (3), maintenance reminders (3)');

  // ─── In-app notifications ─────────────────────────────────────────────────
  await prisma.inAppNotification.createMany({
    data: [
      { tenantId, title: 'طلب خدمة جديد', body: 'تم استلام WO-' + year + '-0010 بأولوية عاجلة', type: 'INFO', sourceType: 'WORK_ORDER', isRead: false },
      { tenantId, title: 'مخزون منخفض', body: 'ديسك فرامل أمامي (BRK-DISC-FRT) نفد من المخزون', type: 'WARNING', sourceType: 'INVENTORY', isRead: false },
      { tenantId, title: 'فاتورة مستحقة', body: 'فاتورة INV-' + year + '-0002 مدفوعة جزئياً', type: 'INFO', sourceType: 'INVOICE', isRead: true },
    ],
  });
  console.log('✅ In-app notifications: 3');

  // ─── Summary ──────────────────────────────────────────────────────────────
  const counts = {
    branches: await prisma.branch.count({ where: { tenantId } }),
    users: await prisma.user.count({ where: { tenantId } }),
    technicians: await prisma.technician.count({ where: { tenantId } }),
    customers: await prisma.customer.count({ where: { tenantId } }),
    vehicles: await prisma.vehicle.count({ where: { tenantId } }),
    parts: await prisma.part.count({ where: { tenantId } }),
    suppliers: await prisma.supplier.count({ where: { tenantId } }),
    laborRates: await prisma.laborRate.count({ where: { tenantId } }),
    workOrders: await prisma.workOrder.count({ where: { tenantId } }),
    invoices: await prisma.invoice.count({ where: { tenantId } }),
    appointments: await prisma.appointment.count({ where: { tenantId } }),
  };
  console.log('\n📊 Totals for Elite Auto Workshop:', JSON.stringify(counts, null, 2));
  console.log('\n🔑 Logins (all password: ' + PASSWORD + ')');
  console.log('   Owner       owner@elite.com');
  console.log('   Manager     manager@elite.com');
  console.log('   Accountant  accountant@elite.com');
  console.log('   Reception   reception@elite.com');
  console.log('   Technician  tech1@elite.com');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
