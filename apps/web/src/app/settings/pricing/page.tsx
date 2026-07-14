'use client'

import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function PricingSettingsPage() {
  return (
    <div className="min-h-screen flex text-[#03045E]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title="التسعير" subtitle="تسعير الخدمات وأجور اليد" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-black text-[#03045E]">💲 إدارة تسعير الخدمات وأجور اليد</h1>
              <p className="text-xs mt-1" style={{ color: '#0077B6' }}>
                تسعير أجور الصيانة الأساسية وأسعار الخدمات الافتراضية المعتمدة
              </p>
            </div>
            
            <div className="glass-card p-12 text-center text-[#0077B6] font-bold">
              <span className="text-4xl block mb-4">💲</span>
              إدارة تسعير الخدمات التلقائي قيد التطوير لتفعيل محرك تسعير ذكي.
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
