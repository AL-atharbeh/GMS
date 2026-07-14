'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import KPICard from '@/components/dashboard/KPICard'
import RecentWorkOrders from '@/components/dashboard/RecentWorkOrders'
import StatusBreakdown from '@/components/dashboard/StatusBreakdown'
import WorkshopStatus from '@/components/dashboard/WorkshopStatus'

interface DashboardData {
  kpis: {
    totalWorkOrders: number
    completedOrders: number
    activeVehicles: number
    revenue: number
    costs: number
    profit: number
    profitMargin: number
    completionRate: number
  }
  statusBreakdown: Array<{ status: string; count: number }>
  recentOrders: any[]
}

// Clean SVG icons for KPI cards
const RevenueIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const VehicleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
  </svg>
)
const ProfitIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
)
const CompletionIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

export default function DashboardPage() {
  const { isAuthenticated, isHydrated, user, tenant } = useAuthStore()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    if (!isHydrated) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (user?.role === 'TECHNICIAN') {
      router.push('/technician-dashboard')
      return
    }
    if (user?.role === 'RECEPTIONIST') {
      router.push('/work-orders')
      return
    }
    fetchDashboard()
  }, [isAuthenticated, isHydrated, period, user])

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/reports/dashboard?period=${period}`)
      setData(response.data.data)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#f5f6fa',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: '3px solid #e5e7eb',
              borderTopColor: '#4f46e5',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
            جاري التحميل...
          </p>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-KW', {
      style: 'currency',
      currency: tenant?.currency || 'KWD',
      minimumFractionDigits: 3,
    }).format(amount)
  }

  const kpis = data?.kpis

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar title="لوحة التحكم" subtitle="نظرة عامة على أداء الكراج" />

        <div style={{ padding: '24px 28px', flex: 1 }}>

          {/* ── Welcome Row ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>
                أهلاً، {user?.name} 👋
              </h2>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0', fontWeight: 500 }}>
                {new Date().toLocaleDateString('ar-KW', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {/* Period selector */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
              }}
            >
              {[
                { value: '7',  label: '٧ أيام' },
                { value: '30', label: '٣٠ يوم' },
                { value: '90', label: '٣ أشهر' },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 700,
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: period === p.value ? '#4f46e5' : 'transparent',
                    color: period === p.value ? '#ffffff' : '#6b7280',
                    boxShadow: period === p.value ? '0 2px 8px rgba(79,70,229,0.2)' : 'none',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <KPICard
              title="إجمالي الإيرادات"
              value={loading ? null : formatCurrency(kpis?.revenue || 0)}
              icon={<RevenueIcon />}
              color="blue"
              trend="+12% من الشهر الماضي"
              trendUp={true}
              loading={loading}
            />
            <KPICard
              title="سيارات في الورشة"
              value={loading ? null : String(kpis?.activeVehicles || 0)}
              icon={<VehicleIcon />}
              color="amber"
              subtitle="سيارة نشطة الآن"
              loading={loading}
              isLive={true}
            />
            <KPICard
              title="هامش الربح"
              value={loading ? null : `${kpis?.profitMargin || 0}%`}
              icon={<ProfitIcon />}
              color="green"
              trend={`ربح ${loading ? '...' : formatCurrency(kpis?.profit || 0)}`}
              trendUp={true}
              loading={loading}
            />
            <KPICard
              title="معدل الإنجاز"
              value={loading ? null : `${kpis?.completionRate || 0}%`}
              icon={<CompletionIcon />}
              color="purple"
              subtitle={`${kpis?.completedOrders || 0} من ${kpis?.totalWorkOrders || 0} طلب`}
              loading={loading}
            />
          </div>

          {/* ── Middle Row: WorkshopStatus + StatusBreakdown ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 360px',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <WorkshopStatus />
            <StatusBreakdown data={data?.statusBreakdown || []} loading={loading} />
          </div>

          {/* ── Recent Work Orders ── */}
          <RecentWorkOrders orders={data?.recentOrders || []} loading={loading} />
        </div>
      </div>
    </div>
  )
}
