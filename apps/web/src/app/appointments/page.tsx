'use client'

import { useEffect, useState, useRef } from 'react'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { useRouter } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────
interface Appointment {
  id: string
  customerName: string
  customerPhone: string
  vehiclePlate: string
  vehicleMake?: string
  vehicleModel?: string
  serviceType: string
  scheduledAt: string
  status: 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
  notes?: string
  customerId?: string
  estimatedDuration?: number
  reminderSent?: boolean
  workOrderId?: string
}

interface Customer {
  id: string
  name: string
  phone: string
  vehicles?: { id: string; make: string; model: string; licensePlate: string }[]
}

interface Technician {
  id: string
  name: string
}

// ─── Status Config ─────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  SCHEDULED:  { label: 'مجدول',        color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: '📅' },
  CONFIRMED:  { label: 'مؤكد الحضور', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
  COMPLETED:  { label: 'دخل الورشة',  color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb', icon: '🛠️' },
  CANCELLED:  { label: 'ملغي',        color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: '❌' },
  NO_SHOW:    { label: 'لم يحضر',     color: '#ea580c', bg: '#fff7ed', border: '#ffedd5', icon: '⚠️' },
}

const SERVICE_TYPES = [
  'صيانة دورية وتغيير زيت',
  'فحص وإصلاح الفرامل',
  'تغيير الإطارات وميزان العجلات',
  'إصلاح التكييف',
  'فحص شامل للسيارة',
  'إصلاح كهربائي',
  'إصلاح المحرك',
  'إصلاح نظام التعليق',
  'خدمة ناقل الحركة',
  'خدمة مخصصة',
]

const DURATION_OPTIONS = [
  { label: '30 دقيقة', value: 30 },
  { label: 'ساعة واحدة', value: 60 },
  { label: 'ساعة ونصف', value: 90 },
  { label: 'ساعتين', value: 120 },
  { label: '3 ساعات', value: 180 },
  { label: 'يوم كامل', value: 480 },
]

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid #e2e8f0',
  fontSize: 13,
  outline: 'none',
  background: '#f8fafc',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#1f2937',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 5,
  display: 'block',
}

// ─── Day helper ─────────────────────────────────────────────────────────────
function getDayRange(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  const start = new Date(d)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { start, end, date: new Date(d) }
}

export default function AppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [converting, setConverting] = useState<string | null>(null)
  const [convertError, setConvertError] = useState<string | null>(null)

  // Autocomplete
  const [custSearch, setCustSearch] = useState('')
  const [custDropOpen, setCustDropOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<{ id: string; make: string; model: string; licensePlate: string } | null>(null)
  const custRef = useRef<HTMLDivElement>(null)

  // Conflict warning
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    vehiclePlate: '',
    vehicleMake: '',
    vehicleModel: '',
    serviceType: SERVICE_TYPES[0],
    scheduledAt: '',
    notes: '',
    customerId: '',
    vehicleId: '',
    technicianId: '',
    estimatedDuration: 60,
  })

  useEffect(() => {
    fetchAppointments()
    fetchCustomers()
    fetchTechnicians()
  }, [])

  // Close autocomplete on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) {
        setCustDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const res = await api.get('/appointments')
      setAppointments(res.data.data || [])
    } catch (err) {
      console.error('Error fetching appointments', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers?limit=200')
      const list = res.data.data?.customers || res.data.data || []
      // Fetch vehicles for each? We do a quick join — for autocomplete, just names+phones
      setCustomers(list)
    } catch (err) {
      console.error('Error fetching customers', err)
    }
  }

  const fetchTechnicians = async () => {
    try {
      const res = await api.get('/technicians')
      setTechnicians(res.data.data || [])
    } catch (err) {
      console.error('Error fetching technicians', err)
    }
  }

  const fetchCustomerVehicles = async (customerId: string) => {
    try {
      const res = await api.get(`/customers/${customerId}`)
      const cust = res.data.data
      const vehicles = cust?.vehicles?.map((cv: any) => cv.vehicle || cv) || []
      setCustomers(prev =>
        prev.map(c => c.id === customerId ? { ...c, vehicles } : c)
      )
      return vehicles
    } catch {
      return []
    }
  }

  const handleSelectCustomer = async (c: Customer) => {
    setSelectedCustomer(c)
    setCustSearch(c.name)
    setCustDropOpen(false)
    setSelectedVehicle(null)
    setForm(f => ({
      ...f,
      customerName: c.name,
      customerPhone: c.phone,
      customerId: c.id,
      vehiclePlate: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleId: '',
    }))
    // Load vehicles
    const vehicles = await fetchCustomerVehicles(c.id)
    if (vehicles.length === 1) {
      handleSelectVehicle(vehicles[0])
    }
  }

  const handleSelectVehicle = (v: { id: string; make: string; model: string; licensePlate: string }) => {
    setSelectedVehicle(v)
    setForm(f => ({
      ...f,
      vehicleId: v.id,
      vehiclePlate: v.licensePlate,
      vehicleMake: v.make,
      vehicleModel: v.model,
    }))
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setCustSearch('')
    setSelectedVehicle(null)
    setForm(f => ({
      ...f,
      customerName: '',
      customerPhone: '',
      customerId: '',
      vehiclePlate: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleId: '',
    }))
  }

  // Conflict check on time change
  const handleScheduledAtChange = (val: string) => {
    setForm(f => ({ ...f, scheduledAt: val }))
    if (!val) { setConflictWarning(null); return }
    const newDate = new Date(val)
    const ONE_HOUR = 60 * 60 * 1000
    const conflicts = appointments.filter(a => {
      if (a.status === 'CANCELLED' || a.status === 'COMPLETED' || a.status === 'NO_SHOW') return false
      const diff = Math.abs(new Date(a.scheduledAt).getTime() - newDate.getTime())
      return diff < ONE_HOUR
    })
    if (conflicts.length > 0) {
      const names = conflicts.map(c => `${c.customerName} (${new Date(c.scheduledAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })})`).join('، ')
      setConflictWarning(`⚠️ تعارض محتمل مع موعد آخر: ${names}`)
    } else {
      setConflictWarning(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        customerName: selectedCustomer ? selectedCustomer.name : form.customerName,
        customerPhone: selectedCustomer ? selectedCustomer.phone : form.customerPhone,
      }
      await api.post('/appointments', payload)
      setShowAddModal(false)
      resetForm()
      fetchAppointments()
    } catch (err) {
      alert('فشل حجز الموعد')
    }
  }

  const resetForm = () => {
    setForm({
      customerName: '', customerPhone: '', vehiclePlate: '',
      vehicleMake: '', vehicleModel: '', serviceType: SERVICE_TYPES[0],
      scheduledAt: '', notes: '', customerId: '', vehicleId: '',
      technicianId: '', estimatedDuration: 60,
    })
    setSelectedCustomer(null)
    setSelectedVehicle(null)
    setCustSearch('')
    setConflictWarning(null)
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status })
      fetchAppointments()
    } catch {
      alert('فشل تحديث حالة الموعد')
    }
  }

  const handleConvertToWorkOrder = async (appt: Appointment) => {
    setConverting(appt.id)
    setConvertError(null)
    try {
      const res = await api.post(`/appointments/${appt.id}/convert-to-work-order`)
      const { workOrderId, alreadyConverted } = res.data
      if (alreadyConverted) {
        router.push(`/work-orders?highlight=${workOrderId}`)
      } else {
        fetchAppointments()
        router.push(`/work-orders?highlight=${workOrderId}`)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'فشل تحويل الموعد إلى كرت عمل'
      setConvertError(`${appt.id}:${msg}`)
    } finally {
      setConverting(null)
    }
  }

  // ─── Filtered Appointments ────────────────────────────────────────────────
  const filtered = appointments.filter(app => {
    const matchSearch =
      app.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.customerPhone.includes(searchTerm) ||
      app.vehiclePlate.includes(searchTerm)
    const matchStatus = filterStatus === 'ALL' || app.status === filterStatus
    return matchSearch && matchStatus
  })

  // ─── Calendar Week Data ────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const { start, end, date } = getDayRange(i)
    const dayAppts = appointments.filter(a => {
      const d = new Date(a.scheduledAt)
      return d >= start && d <= end
    })
    return { date, appts: dayAppts }
  })

  const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

  // ─── Customer autocomplete list ───────────────────────────────────────────
  const filteredCustomers = custSearch.length >= 1
    ? customers.filter(c =>
        c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
        c.phone.includes(custSearch)
      ).slice(0, 8)
    : []

  const selectedCustomerVehicles = selectedCustomer
    ? customers.find(c => c.id === selectedCustomer.id)?.vehicles || []
    : []

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <TopBar
          title="جدول المواعيد"
          subtitle="تنظيم وإدارة حجوزات صيانة السيارات"
          actions={
            <button
              onClick={() => { setShowAddModal(true); resetForm() }}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
              }}
            >
              ➕ حجز موعد جديد
            </button>
          }
        />

        <main style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ─── Controls ─────────────────────────────────────────────── */}
            <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              {/* Search */}
              <input
                type="text"
                placeholder="ابحث بالاسم، هاتف، أو لوحة السيارة..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ ...inputStyle, maxWidth: 300, flex: 1 }}
              />

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{ ...inputStyle, maxWidth: 160, cursor: 'pointer' }}
              >
                <option value="ALL">كل الحالات</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>

              {/* View Toggle */}
              <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                {(['list', 'calendar'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      padding: '7px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: viewMode === mode ? '#4f46e5' : '#fff',
                      color: viewMode === mode ? '#fff' : '#64748b',
                      transition: 'all 0.15s',
                    }}
                  >
                    {mode === 'list' ? '☰ قائمة' : '📅 تقويم'}
                  </button>
                ))}
              </div>

              {/* Stats */}
              <div style={{ marginRight: 'auto', fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'flex', gap: 12 }}>
                <span>الكل: <b style={{ color: '#4f46e5' }}>{filtered.length}</b></span>
                <span>اليوم: <b style={{ color: '#10b981' }}>{appointments.filter(a => {
                  const d = new Date(a.scheduledAt)
                  const today = new Date()
                  return d.toDateString() === today.toDateString()
                }).length}</b></span>
              </div>
            </div>

            {/* ─── Calendar View ────────────────────────────────────────── */}
            {viewMode === 'calendar' && (
              <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>📅 الأسبوع القادم</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>({new Date().toLocaleDateString('ar-KW')} — {new Date(Date.now() + 6 * 86400000).toLocaleDateString('ar-KW')})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 200 }}>
                  {weekDays.map(({ date, appts }, i) => {
                    const isToday = date.toDateString() === new Date().toDateString()
                    const dayName = AR_DAYS[date.getDay()]
                    return (
                      <div
                        key={i}
                        style={{
                          borderLeft: i > 0 ? '1px solid #f1f5f9' : undefined,
                          padding: 12,
                          background: isToday ? '#faf5ff' : undefined,
                          minHeight: 140,
                        }}
                      >
                        <div style={{ marginBottom: 8, textAlign: 'center' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: isToday ? '#7c3aed' : '#94a3b8' }}>{dayName}</div>
                          <div style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: isToday ? '#7c3aed' : '#1f2937',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: isToday ? '#ede9fe' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '2px auto 0',
                          }}>
                            {date.getDate()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {appts.length === 0 && (
                            <div style={{ fontSize: 10, color: '#cbd5e1', textAlign: 'center', paddingTop: 8 }}>—</div>
                          )}
                          {appts.slice(0, 3).map(a => {
                            const s = STATUS_CONFIG[a.status]
                            return (
                              <div
                                key={a.id}
                                style={{
                                  background: s.bg,
                                  border: `1px solid ${s.border}`,
                                  borderRadius: 6,
                                  padding: '3px 6px',
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: s.color,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`${a.customerName} — ${a.serviceType}`}
                              >
                                {new Date(a.scheduledAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })} {a.customerName}
                              </div>
                            )
                          })}
                          {appts.length > 3 && (
                            <div style={{ fontSize: 9.5, color: '#94a3b8', textAlign: 'center' }}>+{appts.length - 3} أكثر</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── List View ────────────────────────────────────────────── */}
            {viewMode === 'list' && (
              <>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>جاري تحميل المواعيد...</span>
                    </div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 16, padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>لا توجد مواعيد</div>
                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>قم بجدولة أول موعد لترتيب عمل الورشة</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18 }}>
                    {filtered.map(app => {
                      const s = STATUS_CONFIG[app.status] || STATUS_CONFIG.SCHEDULED
                      const isConverting = converting === app.id
                      const errKey = `${app.id}:`
                      const myError = convertError?.startsWith(errKey) ? convertError.replace(errKey, '') : null
                      return (
                        <div
                          key={app.id}
                          style={{
                            background: '#fff',
                            border: '1.5px solid #eeeff4',
                            borderRadius: 18,
                            padding: 20,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          {/* Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, color: s.color,
                              background: s.bg, border: `1px solid ${s.border}`,
                              borderRadius: 6, padding: '3px 8px',
                            }}>
                              {s.icon} {s.label}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', background: '#f5f3ff', border: '1px solid #e0e7ff', padding: '2px 7px', borderRadius: 6 }}>
                                {new Date(app.scheduledAt).toLocaleDateString('ar-KW')}
                              </span>
                              <span style={{ fontSize: 10.5, color: '#7c3aed', fontWeight: 700 }}>
                                🕐 {new Date(app.scheduledAt).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {/* Customer */}
                          <div>
                            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', margin: '0 0 2px' }}>{app.customerName}</h3>
                            <a href={`tel:${app.customerPhone}`} style={{ fontSize: 11.5, color: '#4f46e5', fontWeight: 600, fontFamily: 'monospace', textDecoration: 'none' }}>
                              📞 {app.customerPhone}
                            </a>
                            {app.reminderSent ? (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 5, padding: '1px 6px', marginRight: 6 }}>🔔 تم إشعاره</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, padding: '1px 6px', marginRight: 6 }}>⏰ لم يُشعَر</span>
                            )}
                          </div>

                          {/* Details */}
                          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: '#94a3b8' }}>الخدمة:</span>
                              <span style={{ fontWeight: 700, color: '#334155' }}>{app.serviceType}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: '#94a3b8' }}>المركبة:</span>
                              <span style={{ fontWeight: 700, color: '#334155' }}>
                                {app.vehicleMake} {app.vehicleModel}
                                {app.vehiclePlate && <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, marginRight: 4 }}>{app.vehiclePlate}</span>}
                              </span>
                            </div>
                            {app.estimatedDuration && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: '#94a3b8' }}>المدة المتوقعة:</span>
                                <span style={{ fontWeight: 700, color: '#334155' }}>
                                  {app.estimatedDuration >= 60
                                    ? `${Math.floor(app.estimatedDuration / 60)} ساعة${app.estimatedDuration % 60 > 0 ? ` و${app.estimatedDuration % 60} د` : ''}`
                                    : `${app.estimatedDuration} دقيقة`}
                                </span>
                              </div>
                            )}
                            {app.notes && (
                              <div style={{ background: '#f8fafc', padding: '7px 10px', borderRadius: 8, fontSize: 11, color: '#475569', borderRight: '3px solid #cbd5e1', marginTop: 4 }}>
                                📝 {app.notes}
                              </div>
                            )}
                          </div>

                          {/* Error */}
                          {myError && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                              {myError}
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                            {app.status === 'SCHEDULED' && (
                              <>
                                <button onClick={() => handleUpdateStatus(app.id, 'CONFIRMED')}
                                  style={{ flex: 1, background: '#10b981', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', minWidth: 80 }}>
                                  تأكيد ✅
                                </button>
                                <button onClick={() => handleUpdateStatus(app.id, 'CANCELLED')}
                                  style={{ flex: 1, background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', minWidth: 80 }}>
                                  إلغاء ❌
                                </button>
                                <button onClick={() => handleUpdateStatus(app.id, 'NO_SHOW')}
                                  style={{ flex: 1, background: '#fff7ed', border: '1px solid #ffedd5', color: '#ea580c', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', minWidth: 80 }}>
                                  غائب ⚠️
                                </button>
                              </>
                            )}
                            {app.status === 'CONFIRMED' && (
                              <>
                                <button
                                  onClick={() => handleConvertToWorkOrder(app)}
                                  disabled={isConverting}
                                  style={{ flex: 1, background: isConverting ? '#e0e7ff' : 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: isConverting ? 'not-allowed' : 'pointer' }}>
                                  {isConverting ? '⏳ جاري...' : '🛠️ تحويل لكرت عمل'}
                                </button>
                                <button onClick={() => handleUpdateStatus(app.id, 'NO_SHOW')}
                                  style={{ background: '#fff7ed', border: '1px solid #ffedd5', color: '#ea580c', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                  غائب ⚠️
                                </button>
                              </>
                            )}
                            {(app.status === 'COMPLETED') && app.workOrderId && (
                              <button onClick={() => router.push(`/work-orders?highlight=${app.workOrderId}`)}
                                style={{ width: '100%', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                🔗 فتح كرت العمل
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ─── Add Appointment Modal ─────────────────────────────────────────── */}
      {showAddModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddModal(false); resetForm() } }}
        >
          <div style={{ background: '#fff', border: '1px solid #eeeff4', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', direction: 'rtl', padding: '26px 30px', boxSizing: 'border-box' }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📅</div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>حجز موعد صيانة جديد</h3>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>ابحث عن العميل أو أدخل بيانات جديدة</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetForm() }}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#6b7280', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ── Customer Autocomplete ─────────────────────────── */}
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: 14, border: '1.5px solid #e2e8f0' }}>
                <label style={{ ...labelStyle, color: '#4f46e5', fontSize: 12 }}>👤 العميل</label>
                {selectedCustomer ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, padding: '10px 14px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a' }}>{selectedCustomer.name}</div>
                      <div style={{ fontSize: 11, color: '#3b82f6', fontFamily: 'monospace' }}>{selectedCustomer.phone}</div>
                    </div>
                    <button type="button" onClick={handleClearCustomer}
                      style={{ background: '#dbeafe', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}>
                      تغيير
                    </button>
                  </div>
                ) : (
                  <div ref={custRef} style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو رقم الهاتف..."
                      value={custSearch}
                      onChange={e => { setCustSearch(e.target.value); setCustDropOpen(true); setForm(f => ({ ...f, customerName: e.target.value })) }}
                      onFocus={() => setCustDropOpen(true)}
                      style={{ ...inputStyle }}
                    />
                    {custDropOpen && custSearch.length >= 1 && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 50, marginTop: 4, overflow: 'hidden' }}>
                        {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f5f3ff')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                          >
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>{c.name}</span>
                            <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{c.phone}</span>
                          </div>
                        )) : (
                          <div style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                            لا يوجد عميل مطابق — سيتم الحجز كعميل جديد 🆕
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Phone (only if no customer selected) */}
                {!selectedCustomer && (
                  <div style={{ marginTop: 10 }}>
                    <label style={labelStyle}>رقم الهاتف</label>
                    <input
                      type="text"
                      placeholder="مثال: 50144012"
                      value={form.customerPhone}
                      onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
                      style={inputStyle}
                      required
                    />
                  </div>
                )}
              </div>

              {/* ── Vehicle ──────────────────────────────────────── */}
              <div style={{ background: '#f8fafc', borderRadius: 14, padding: 14, border: '1.5px solid #e2e8f0' }}>
                <label style={{ ...labelStyle, color: '#4f46e5', fontSize: 12 }}>🚗 السيارة</label>

                {selectedCustomer && selectedCustomerVehicles.length > 0 ? (
                  <>
                    <label style={labelStyle}>اختر من سيارات العميل</label>
                    <select
                      value={selectedVehicle?.id || ''}
                      onChange={e => {
                        const v = selectedCustomerVehicles.find((x: any) => x.id === e.target.value)
                        if (v) handleSelectVehicle(v)
                      }}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      required
                    >
                      <option value="">-- اختر سيارة --</option>
                      {selectedCustomerVehicles.map((v: any) => (
                        <option key={v.id} value={v.id}>{v.make} {v.model} — {v.licensePlate}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>نوع / موديل السيارة</label>
                      <input
                        type="text"
                        placeholder="مثال: Land Cruiser"
                        value={form.vehicleMake}
                        onChange={e => setForm(f => ({ ...f, vehicleMake: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>رقم اللوحة</label>
                      <input
                        type="text"
                        placeholder="لوحة..."
                        value={form.vehiclePlate}
                        onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
                        style={inputStyle}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Service Type ─────────────────────────────────── */}
              <div>
                <label style={labelStyle}>نوع الخدمة المطلوبة</label>
                <select
                  value={form.serviceType}
                  onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  required
                >
                  {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* ── Date & Duration ──────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>تاريخ ووقت الموعد</label>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={e => handleScheduledAtChange(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>مدة الخدمة المتوقعة</label>
                  <select
                    value={form.estimatedDuration}
                    onChange={e => setForm(f => ({ ...f, estimatedDuration: Number(e.target.value) }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Conflict Warning */}
              {conflictWarning && (
                <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '9px 12px', fontSize: 11.5, color: '#92400e', fontWeight: 700 }}>
                  {conflictWarning}
                </div>
              )}

              {/* ── Technician (optional) ────────────────────────── */}
              {technicians.length > 0 && (
                <div>
                  <label style={labelStyle}>الفني المفضل (اختياري)</label>
                  <select
                    value={form.technicianId}
                    onChange={e => setForm(f => ({ ...f, technicianId: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— بدون تفضيل —</option>
                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {/* ── Notes ────────────────────────────────────────── */}
              <div>
                <label style={labelStyle}>شكاوى العميل / ملاحظات</label>
                <textarea
                  placeholder="مثال: صوت احتكاك عند الكبح، زيت يتسرب..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ ...inputStyle, height: 64, resize: 'none' }}
                />
              </div>

              {/* ── Submit ───────────────────────────────────────── */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #eeeff4', marginTop: 4 }}>
                <button type="button" onClick={() => { setShowAddModal(false); resetForm() }}
                  style={{ padding: '10px 24px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  إلغاء
                </button>
                <button type="submit"
                  style={{ padding: '10px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.25)' }}>
                  تأكيد الحجز 📅
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
