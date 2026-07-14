'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts'

interface KPI {
  totalWorkOrders: number
  completedOrders: number
  activeVehicles: number
  revenue: number
  costs: number
  profit: number
  profitMargin: number
  completionRate: number
}

interface StatusItem {
  status: string
  count: number
}

interface RecentOrder {
  id: string
  orderNumber: string
  status: string
  createdAt: string
  vehicle: { plateNumber: string; make: string; model: string }
  customer?: { name: string }
  workOrderItems?: Array<{ costPrice: number; totalPrice: number }>
}

interface DailyRevenue {
  date: string
  revenue: number
  orders: number
}

interface Branch {
  id: string
  name: string
  nameAr?: string
}

interface ReportData {
  kpis: KPI
  statusBreakdown: StatusItem[]
  recentOrders: RecentOrder[]
  dailyRevenue: DailyRevenue[]
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  RECEIVED: { label: 'تم الاستلام 📥', color: '#4b5563', bg: '#f3f4f6' },
  DIAGNOSING: { label: 'قيد التشخيص 🔍', color: '#b45309', bg: '#fef3c7' },
  QUOTED: { label: 'تم التسعير 🏷️', color: '#6d28d9', bg: '#f3e8ff' },
  AWAITING_APPROVAL: { label: 'بانتظار الموافقة ⏳', color: '#c2410c', bg: '#ffedd5' },
  APPROVED: { label: 'تمت الموافقة ✓', color: '#0369a1', bg: '#e0f2fe' },
  IN_PROGRESS: { label: 'قيد التنفيذ 🔧', color: '#0284c7', bg: '#e0f2fe' },
  QUALITY_CHECK: { label: 'فحص الجودة 🛡️', color: '#be185d', bg: '#fce7f3' },
  READY_FOR_DELIVERY: { label: 'جاهز للتسليم 🚗', color: '#047857', bg: '#d1fae5' },
  DELIVERED: { label: 'تم تسليم السيارة 🏁', color: '#065f46', bg: '#d1fae5' },
  CANCELLED: { label: 'ملغي ✕', color: '#dc2626', bg: '#fee2e2' },
}

const selectStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1.5px solid #cbd5e1',
  fontSize: 13,
  outline: 'none',
  background: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<string>('30') // 7, 30, 90, 365
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')

  useEffect(() => {
    fetchBranches()
  }, [])

  useEffect(() => {
    fetchReports()
  }, [period, selectedBranch])

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches')
      setBranches(res.data.data || [])
    } catch (err) {
      console.error('Error fetching branches', err)
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      let url = `/reports/dashboard?period=${period}`
      if (selectedBranch) {
        url += `&branchId=${selectedBranch}`
      }
      const res = await api.get(url)
      setData(res.data.data)
    } catch (err) {
      console.error('Error fetching reports data', err)
    } finally {
      setLoading(false)
    }
  }

  // Format date for chart axis
  const formatChartDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return `${d.getDate()}/${d.getMonth() + 1}`
    } catch {
      return dateStr
    }
  }

  // Calculate recent order profit
  const calculateOrderProfit = (ord: RecentOrder) => {
    const totalRevenue = Number(ord.workOrderItems?.reduce((sum, item) => sum + Number(item.totalPrice), 0) || 0)
    const totalCost = Number(ord.workOrderItems?.reduce((sum, item) => sum + Number(item.costPrice || 0), 0) || 0)
    return totalRevenue - totalCost
  }

  // Export report to CSV
  const handleExportCSV = () => {
    if (!data) return
    const headers = ['المؤشر المالي/التشغيلي', 'القيمة المقابلة', 'ملاحظات']
    const rows = [
      ['إجمالي الإيرادات', `${data.kpis.revenue.toFixed(3)} د.ك`, 'مجموع قيم كروت الصيانة المسلمة والمدفوعة'],
      ['تكاليف قطع الغيار والعمالة', `${data.kpis.costs.toFixed(3)} د.ك`, 'سعر التكلفة المسجل'],
      ['صافي الأرباح', `${data.kpis.profit.toFixed(3)} د.ك`, 'هامش الربح الفعلي بعد التكاليف'],
      ['نسبة هامش الربح', `${data.kpis.profitMargin.toFixed(1)}%`, 'ربحية الخدمات'],
      ['معدل إنجاز المهام', `${data.kpis.completionRate.toFixed(1)}%`, 'نسبة الطلبات المنتهية من الإجمالي'],
      ['إجمالي كروت العمل المفتوحة والمنتهية', data.kpis.totalWorkOrders.toString(), 'عدد الحركات المسجلة'],
      ['السيارات قيد الصيانة حالياً', data.kpis.activeVehicles.toString(), 'المركبات النشطة في الورشة'],
    ]

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `financial_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title="التقارير والتحليلات"
          subtitle="مراقبة كفاءة الورشة التشغيلية والربحية والمبيعات"
          actions={
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
              {/* Branch filter */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>الفرع:</span>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">كل الفروع 🏢</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.nameAr || b.name}</option>
                  ))}
                </select>
              </div>

              {/* Period Filter */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#475569' }}>الفترة:</span>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  style={selectStyle}
                >
                  <option value="7">آخر 7 أيام 📅</option>
                  <option value="30">آخر 30 يوم 🗓️</option>
                  <option value="90">آخر 3 أشهر 📊</option>
                  <option value="365">آخر سنة 📈</option>
                </select>
              </div>

              {/* Print Button */}
              <button
                onClick={() => window.print()}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1.5px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                🖨️ طباعة التقرير
              </button>

              {/* Export Button */}
              <button
                onClick={handleExportCSV}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(5,150,105,0.15)',
                }}
              >
                📥 تصدير البيانات (Excel)
              </button>
            </div>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 0', flexDirection: 'column', gap: 14 }}>
                <div style={{ width: 44, height: 44, border: '3.5px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>جاري تحليل البيانات التشغيلية والمالية...</span>
              </div>
            ) : !data ? (
              <div style={{
                background: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: 18,
                padding: '64px 24px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>⚠️</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>فشل تحميل البيانات</div>
                <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>أعد المحاولة لاحقاً أو تحقق من حالة السيرفر</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }} id="report-print-sheet">
                
                {/* ── KPI Grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
                  {[
                    { icon: '💰', label: 'إجمالي الإيرادات', value: `${Number(data.kpis.revenue).toFixed(3)} د.ك`, color: '#1e1b4b', bg: '#ede9fe', note: 'مجموع كروت الصيانة المسلمة' },
                    { icon: '🏷️', label: 'تكاليف قطع الغيار والعمل', value: `${Number(data.kpis.costs).toFixed(3)} د.ك`, color: '#6b7280', bg: '#f3f4f6', note: 'سعر تكلفة المواد الفعلي' },
                    { icon: '📈', label: 'صافي الأرباح', value: `${Number(data.kpis.profit).toFixed(3)} ...`, displayValue: `${Number(data.kpis.profit).toFixed(3)} د.ك`, color: data.kpis.profit >= 0 ? '#059669' : '#dc2626', bg: data.kpis.profit >= 0 ? '#d1fae5' : '#fee2e2', note: 'هامش الربح بعد خصم التكاليف' },
                    { icon: '📊', label: 'نسبة هامش الربح', value: `${data.kpis.profitMargin.toFixed(1)}%`, color: '#0891b2', bg: '#cffafe', note: 'معدل ربحية الخدمات العام' },
                    { icon: '⚙️', label: 'معدل إنجاز المهام', value: `${data.kpis.completionRate.toFixed(1)}%`, color: '#d97706', bg: '#fef3c7', note: 'كرت الصيانة منجز بالكامل' },
                  ].map((kpi, i) => (
                    <div
                      key={i}
                      style={{
                        background: '#fff',
                        border: '1px solid #eeeff4',
                        borderRadius: 16,
                        padding: '16px 18px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 104,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{kpi.label}</span>
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                          {kpi.icon}
                        </span>
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: kpi.color, margin: '6px 0 2px' }}>
                          {kpi.displayValue || kpi.value}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94a3b8' }}>{kpi.note}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Chart & Status Breakdown ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, flexWrap: 'wrap' }} className="chart-and-status-row">
                  
                  {/* Daily Revenue Chart */}
                  <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 18, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }} className="print-width-100">
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#1f2937' }}>📈 حركة الإيرادات اليومية في هذه الفترة</h3>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <AreaChart data={data.dailyRevenue} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tickFormatter={formatChartDate} tickLine={false} axisLine={false} style={{ fontSize: 10.5, fill: '#94a3b8', fontWeight: 600 }} />
                          <YAxis tickLine={false} axisLine={false} style={{ fontSize: 10.5, fill: '#94a3b8', fontWeight: 600 }} />
                          <ChartTooltip
                            labelFormatter={(label) => new Date(label).toLocaleDateString('ar-KW')}
                            formatter={(value: any) => [`${Number(value).toFixed(3)} د.ك`, 'الإيرادات']}
                            contentStyle={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Status Breakdown card */}
                  <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 18, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }} className="print-width-100">
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#1f2937' }}>📋 توزيع حالة كروت العمل</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
                      {data.statusBreakdown.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 12 }}>لا توجد كروت عمل</div>
                      ) : (
                        data.statusBreakdown.map((item, idx) => {
                          const lbl = STATUS_LABELS[item.status] || { label: item.status, color: '#475569', bg: '#f1f5f9' }
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f8fafc', paddingBottom: 8 }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: lbl.color,
                                background: lbl.bg,
                                padding: '3px 8px',
                                borderRadius: 6
                              }}>
                                {lbl.label}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 900, color: '#1e1b4b', fontFamily: 'monospace' }}>
                                {item.count} سيارة
                              </span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Operations Stats & Recent Orders ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, flexWrap: 'wrap' }} className="op-and-recent-row">
                  
                  {/* Operations Card */}
                  <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 18, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }} className="print-width-100">
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#1f2937' }}>📊 مؤشرات الكفاءة التشغيلية</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {[
                        { label: 'إجمالي كروت العمل المفتوحة والمنتهية', value: data.kpis.totalWorkOrders, icon: '🔧', color: '#4f46e5' },
                        { label: 'السيارات قيد الصيانة بالورشة حالياً', value: data.kpis.activeVehicles, icon: '🚗', color: '#d97706' },
                        { label: 'إجمالي الطلبات المنجزة بالكامل', value: data.kpis.completedOrders, icon: '✓', color: '#059669' },
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: idx < 2 ? '1px solid #f1f5f9' : 'none', paddingBottom: 10 }}>
                          <span style={{ fontSize: 22 }}>{item.icon}</span>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{item.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Work Orders */}
                  <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 18, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }} className="print-width-100">
                    <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: '#1f2937' }}>🕒 أحدث عمليات الصيانة والأرباح المحققة</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #eeeff4', background: '#f8fafc' }}>
                            {['رقم الطلب', 'العميل', 'السيارة', 'الحالة', 'صافي ربح العملية', 'تاريخ التسجيل'].map((th, idx) => (
                              <th key={idx} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>{th}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.recentOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af' }}>لا توجد عمليات مؤخراً</td>
                            </tr>
                          ) : (
                            data.recentOrders.map((ord) => {
                              const lbl = STATUS_LABELS[ord.status] || { label: ord.status, color: '#475569', bg: '#f1f5f9' }
                              const profit = calculateOrderProfit(ord)
                              return (
                                <tr key={ord.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  {/* Order Number */}
                                  <td style={{ padding: '10px 12px', fontWeight: 800, color: '#4f46e5', fontFamily: 'monospace' }}>{ord.orderNumber}</td>
                                  
                                  {/* Customer */}
                                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1f2937' }}>{ord.customer?.name || 'عميل عام'}</td>
                                  
                                  {/* Vehicle */}
                                  <td style={{ padding: '10px 12px', color: '#475569' }}>
                                    {ord.vehicle.make} {ord.vehicle.model}
                                    <span style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginTop: 1, fontFamily: 'monospace' }}>{ord.vehicle.plateNumber}</span>
                                  </td>
                                  
                                  {/* Status */}
                                  <td style={{ padding: '10px 12px' }}>
                                    <span style={{
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      color: lbl.color,
                                      background: lbl.bg,
                                      padding: '2px 8px',
                                      borderRadius: 6
                                    }}>
                                      {lbl.label}
                                    </span>
                                  </td>

                                  {/* Process Profit */}
                                  <td style={{ padding: '10px 12px', fontWeight: 800, color: profit >= 0 ? '#059669' : '#dc2626' }}>
                                    {profit >= 0 ? '+' : ''}{profit.toFixed(3)} د.ك
                                  </td>
                                  
                                  {/* Registration Date */}
                                  <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                                    {new Date(ord.createdAt).toLocaleDateString('ar-KW')}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        </main>
      </div>

      {/* Global CSS style block for printing reports */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #report-print-sheet, #report-print-sheet * {
            visibility: visible;
          }
          #report-print-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            padding: 0 !important;
            direction: rtl !important;
          }
          .no-print {
            display: none !important;
          }
          .print-width-100 {
            width: 100% !important;
            max-width: 100% !important;
            flex: none !important;
          }
          .chart-and-status-row, .op-and-recent-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </div>
  )
}
