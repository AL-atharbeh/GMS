#!/bin/bash
# GMS Project Setup Script
# Run this script to set up the development environment

echo "🚀 GMS — بدء إعداد بيئة التطوير..."

# Check Docker
if ! docker info > /dev/null 2>&1; then
  echo "⚠️  Docker غير شغّال. تشغيل Docker Desktop..."
  open -a Docker
  echo "انتظر 20 ثانية حتى يبدأ Docker..."
  sleep 20
fi

echo "✅ Docker شغّال"

# Start database services
echo "📦 تشغيل PostgreSQL وRedis..."
docker compose up -d postgres redis

echo "⏳ انتظار قاعدة البيانات..."
sleep 8

# Run migrations
echo "🗄️ تطبيق migrations قاعدة البيانات..."
cd apps/api && npx prisma migrate dev --name init --skip-seed 2>&1

# Generate Prisma client
echo "⚙️ توليد Prisma Client..."
npx prisma generate 2>&1

# Run seed
echo "🌱 إضافة البيانات الأساسية..."
npx tsx src/prisma/seed.ts 2>&1

cd ../..

echo ""
echo "🎉 الإعداد اكتمل! جاهز للتشغيل."
echo ""
echo "📋 لتشغيل الـ Backend:"
echo "   cd apps/api && npm run dev"
echo ""
echo "📋 لتشغيل الـ Frontend:"
echo "   cd apps/web && npm run dev"
echo ""
echo "🔐 بيانات الدخول:"
echo "   مالك الكراج: demo@garage.com / Demo@2024!"
echo "   مدير الفرع:  manager@garage.com / Manager@2024!"
echo "   الفني:        tech@garage.com / Tech@2024!"
echo ""
echo "🌐 الروابط:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo "   Health:   http://localhost:3001/health"
