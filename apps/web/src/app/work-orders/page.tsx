'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import Link from 'next/link'

interface WorkOrder {
  id: string
  orderNumber: string
  status: string
  priority: string
  vehicle: { plateNumber: string; make: string; model: string }
  customer: { name: string; phone: string } | null
  receivedAt: string
  totalAmount: number
  trackingToken?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RECEIVED:           { label: 'تم الاستلام',      color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  DIAGNOSING:         { label: 'قيد التشخيص',      color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  QUOTED:             { label: 'عرض السعر',         color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  AWAITING_APPROVAL:  { label: 'انتظار الموافقة',   color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  APPROVED:           { label: 'موافق عليه',        color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  IN_PROGRESS:        { label: 'قيد التنفيذ',       color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  QUALITY_CHECK:      { label: 'فحص الجودة',        color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  READY_FOR_DELIVERY: { label: 'جاهز للاستلام',     color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  DELIVERED:          { label: 'تم التسليم',         color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  CANCELLED:          { label: 'ملغي',              color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

const SERVICE_TEMPLATES = [
  { id: 'OIL_CHANGE', label: 'تغيير زيت وفلتر المحرك', price: 10.000, type: 'LABOR' },
  { id: 'BRAKES', label: 'فحص وتبديل الفرامل (السفايف)', price: 25.000, type: 'LABOR' },
  { id: 'AC_RECHARGE', label: 'صيانة التكييف وشحن الغاز', price: 15.000, type: 'LABOR' },
  { id: 'COMPUTER_CHECK', label: 'فحص كمبيوتر وتحديد أعطال', price: 5.000, type: 'LABOR' },
  { id: 'ENGINE_TUNEUP', label: 'تصفية محرك عامة وإصلاح', price: 40.000, type: 'LABOR' },
  { id: 'CUSTOM', label: 'صيانة مخصصة / خدمة أخرى', price: 0, type: 'LABOR' },
]

export default function WorkOrdersPage() {
  const { tenant } = useAuthStore()
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Create form states
  const [customers, setCustomers] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedServices, setSelectedServices] = useState<Array<{ id: string; label: string; price: number }>>([])
  const [customServices, setCustomServices] = useState<Array<{ label: string; price: number }>>([])

  const [form, setForm] = useState({
    customerId: '',
    vehicleId: '',
    branchId: '',
    priority: 'NORMAL',
    mileageAtReception: '',
    customerComplaintsAr: '',
    estimatedReadyAt: '',
    serviceTemplateId: 'OIL_CHANGE',
  })

  // Quick addition states
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' })
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({ make: '', model: '', year: '', plateNumber: '', chassisNumber: '' })

  useEffect(() => {
    fetchWorkOrders()
  }, [statusFilter])

  const fetchWorkOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      if (search) params.append('search', search)
      const res = await api.get(`/work-orders?${params.toString()}`)
      setWorkOrders(res.data.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadModalData = async () => {
    try {
      const [custRes, vehRes, branchRes] = await Promise.all([
        api.get('/customers'),
        api.get('/vehicles'),
        api.get('/branches'),
      ])
      setCustomers(custRes.data.data || [])
      setVehicles(vehRes.data.data || [])
      setBranches(branchRes.data.data || [])
      if (branchRes.data.data?.length > 0) {
        setForm((prev) => ({ ...prev, branchId: branchRes.data.data[0].id }))
      }
    } catch (err) {
      console.error('Error loading modal details', err)
    }
  }

  const handleOpenCreateModal = () => {
    loadModalData()
    setSelectedServices([])
    setCustomServices([])
    setShowCreateModal(true)
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post('/customers', customerForm)
      const newCustomer = res.data.data
      setCustomers([...customers, newCustomer])
      setForm({ ...form, customerId: newCustomer.id })
      setShowAddCustomer(false)
      setCustomerForm({ name: '', phone: '', email: '' })
    } catch (err) {
      alert('خطأ في إضافة العميل')
    }
  }

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await api.post('/vehicles', {
        ...vehicleForm,
        year: vehicleForm.year ? parseInt(vehicleForm.year) : undefined,
        customerId: form.customerId || undefined,
      })
      const newVehicle = res.data.data
      setVehicles([...vehicles, newVehicle])
      setForm({ ...form, vehicleId: newVehicle.id })
      setShowAddVehicle(false)
      setVehicleForm({ make: '', model: '', year: '', plateNumber: '', chassisNumber: '' })
    } catch (err) {
      alert('خطأ في إضافة السيارة')
    }
  }

  const handleSubmitWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vehicleId) {
      alert('الرجاء اختيار سيارة')
      return
    }
    try {
      const isoEstimatedReady = form.estimatedReadyAt ? new Date(form.estimatedReadyAt).toISOString() : undefined;
      const res = await api.post('/work-orders', {
        vehicleId: form.vehicleId,
        branchId: form.branchId,
        customerId: form.customerId || undefined,
        priority: form.priority,
        mileageAtReception: form.mileageAtReception ? parseInt(form.mileageAtReception) : undefined,
        customerComplaintsAr: form.customerComplaintsAr,
        estimatedReadyAt: isoEstimatedReady,
      })

      const createdOrder = res.data.data
      
      // Auto create labor items for all selected and custom services
      const itemsToAdd = [
        ...selectedServices.map(s => ({
          type: 'LABOR' as const,
          description: s.label,
          descriptionAr: s.label,
          quantity: 1,
          unitPrice: s.price,
          costPrice: 0,
        })),
        ...customServices.filter(cs => cs.label.trim() !== '').map(cs => ({
          type: 'LABOR' as const,
          description: cs.label,
          descriptionAr: cs.label,
          quantity: 1,
          unitPrice: cs.price,
          costPrice: 0,
        }))
      ]

      if (itemsToAdd.length > 0) {
        await api.post(`/work-orders/${createdOrder.id}/items`, {
          items: itemsToAdd
        })
      }

      setShowCreateModal(false)
      setForm({
        customerId: '',
        vehicleId: '',
        branchId: '',
        priority: 'NORMAL',
        mileageAtReception: '',
        customerComplaintsAr: '',
        estimatedReadyAt: '',
        serviceTemplateId: 'OIL_CHANGE',
      })
      setSelectedServices([])
      setCustomServices([])
      fetchWorkOrders()
    } catch (err) {
      alert('فشل إنشاء الطلب')
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          title="طلبات الخدمة"
          subtitle="إدارة وتتبع تذاكر الصيانة والاصلاح"
          actions={
            <button
              onClick={handleOpenCreateModal}
              style={{
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(79,70,229,0.2)',
                outline: 'none',
              }}
            >
              <span>➕</span>
              <span>طلب خدمة جديد</span>
            </button>
          }
        />

        <div style={{ padding: '24px 28px', flex: 1 }}>
          {/* Filters Bar */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 24,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', flex: 1, gap: 10 }}>
              <input
                type="text"
                placeholder="البحث برقم الطلب، رقم اللوحة أو العميل..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchWorkOrders()}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  fontSize: 13,
                  outline: 'none',
                  color: '#111827',
                }}
              />
              <button
                onClick={fetchWorkOrders}
                style={{
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '0 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                بحث
              </button>
            </div>

            <div style={{ width: 180 }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
                  outline: 'none',
                }}
              >
                <option value="">كل الحالات</option>
                {Object.entries(STATUS_CONFIG).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Work Orders Table */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f5',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['رقم الطلب', 'السيارة', 'العميل', 'الأولوية', 'الحالة', 'المبلغ الإجمالي', 'التاريخ', 'الإجراءات'].map((h, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '12px 20px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#9ca3af',
                          textAlign: 'right',
                          borderBottom: '1px solid #f3f4f6',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} style={{ padding: '14px 20px' }}>
                            <div
                              style={{
                                height: 14,
                                borderRadius: 6,
                                background: '#f3f4f6',
                                width: j === 0 ? 80 : 100,
                                animation: 'pulse 1.5s ease infinite',
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : workOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '64px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>🔧</div>
                        <div style={{ fontSize: 14, color: '#111827', fontWeight: 700 }}>
                          لا توجد طلبات خدمة مسجلة
                        </div>
                        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                          ابدأ بإضافة أول طلب خدمة لك في النظام
                        </p>
                      </td>
                    </tr>
                  ) : (
                    workOrders.map((order, idx) => {
                      const status = STATUS_CONFIG[order.status] || { label: order.status, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' }
                      return (
                        <tr
                          key={order.id}
                          style={{
                            borderBottom: idx < workOrders.length - 1 ? '1px solid #f9fafb' : 'none',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa'}
                          onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                        >
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>
                              #{order.orderNumber}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                              {order.vehicle?.make} {order.vehicle?.model}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2 }}>
                              {order.vehicle?.plateNumber}
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                              {order.customer?.name || '—'}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginTop: 2 }}>
                              {order.customer?.phone}
                            </div>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background:
                                  order.priority === 'URGENT' || order.priority === 'HIGH'
                                    ? '#fef2f2'
                                    : '#f3f4f6',
                                color:
                                  order.priority === 'URGENT' || order.priority === 'HIGH'
                                    ? '#ef4444'
                                    : '#6b7280',
                                border:
                                  order.priority === 'URGENT' || order.priority === 'HIGH'
                                    ? '1px solid #fecaca'
                                    : '1px solid #e5e7eb',
                              }}
                            >
                              {order.priority === 'URGENT' ? 'عاجل جداً' :
                               order.priority === 'HIGH' ? 'مرتفع' :
                               order.priority === 'NORMAL' ? 'عادي' : 'منخفض'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: 10,
                                fontWeight: 700,
                                color: status.color,
                                background: status.bg,
                                border: `1px solid ${status.border}`,
                                borderRadius: 999,
                                padding: '3px 10px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                              {Number(order.totalAmount || 0).toFixed(3)} {tenant?.currency || 'KWD'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                              {new Date(order.receivedAt).toLocaleDateString('ar-KW')}
                            </span>
                          </td>
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Link
                                href={`/work-orders/${order.id}`}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: '#4f46e5',
                                  textDecoration: 'none',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  background: '#f5f3ff',
                                  border: '1px solid #e0e7ff',
                                }}
                              >
                                إدارة
                              </Link>
                              {order.trackingToken && (
                                <Link
                                  href={`/track/${order.trackingToken}`}
                                  target="_blank"
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#0284c7',
                                    textDecoration: 'none',
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    background: '#f0f9ff',
                                    border: '1px solid #bae6fd',
                                  }}
                                >
                                  تتبع
                                </Link>
                              )}
                            </div>
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

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.3)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="modal-content"
            style={{
              background: '#ffffff',
              border: '1px solid #eeeff4',
              borderRadius: 24,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: 580,
              maxHeight: '90vh',
              overflowY: 'auto',
              direction: 'rtl',
              padding: '24px 30px',
              boxSizing: 'border-box',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#e0e7ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  🛠️
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>
                  إنشاء كرت عمل جديد
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: '#6b7280',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitWorkOrder} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Customer Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>العميل</label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(!showAddCustomer)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#4f46e5',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {showAddCustomer ? 'إلغاء' : '➕ إضافة عميل جديد'}
                  </button>
                </div>

                {showAddCustomer ? (
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: '1px solid #e0e7ff',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="اسم العميل"
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                        required
                      />
                      <input
                        type="text"
                        placeholder="رقم الهاتف"
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                        required
                      />
                    </div>
                    <input
                      type="email"
                      placeholder="البريد الإلكتروني (اختياري)"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        fontSize: 12.5,
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateCustomer}
                      style={{
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      حفظ العميل
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 13,
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">اختر العميل</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Vehicle Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>السيارة</label>
                  <button
                    type="button"
                    onClick={() => setShowAddVehicle(!showAddVehicle)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#4f46e5',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {showAddVehicle ? 'إلغاء' : '➕ إضافة سيارة جديدة'}
                  </button>
                </div>

                {showAddVehicle ? (
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: '1px solid #e0e7ff',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="الشركة المصنعة (تويوتا، فورد...)"
                        value={vehicleForm.make}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                        required
                      />
                      <input
                        type="text"
                        placeholder="الموديل (كامري، موستانج...)"
                        value={vehicleForm.model}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                        required
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 10 }}>
                      <input
                        type="text"
                        placeholder="السنة"
                        value={vehicleForm.year}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="رقم لوحة السيارة"
                        value={vehicleForm.plateNumber}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                        required
                      />
                      <input
                        type="text"
                        placeholder="رقم الشاصي"
                        value={vehicleForm.chassisNumber}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, chassisNumber: e.target.value })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateVehicle}
                      style={{
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 16px',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      حفظ السيارة
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.vehicleId}
                    onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 13,
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  >
                    <option value="">اختر السيارة</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.make} {v.model} ({v.plateNumber})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Services & Templates Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>💼 الخدمات المطلوبة في كرت العمل (تحديد متعدد)</label>
                
                {/* Standard templates list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', padding: '4px 2px' }}>
                  {SERVICE_TEMPLATES.filter(t => t.id !== 'CUSTOM').map((tmpl) => {
                    const isChecked = selectedServices.some(s => s.id === tmpl.id)
                    return (
                      <div
                        key={tmpl.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 12,
                          border: isChecked ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                          background: isChecked ? '#f5f3ff' : '#ffffff',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, userSelect: 'none', margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedServices([...selectedServices, { id: tmpl.id, label: tmpl.label, price: tmpl.price }])
                              } else {
                                setSelectedServices(selectedServices.filter(s => s.id !== tmpl.id))
                              }
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{tmpl.label}</span>
                        </label>

                        {isChecked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#6b7280' }}>السعر:</span>
                            <input
                              type="number"
                              step="0.001"
                              value={selectedServices.find(s => s.id === tmpl.id)?.price ?? tmpl.price}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0
                                setSelectedServices(selectedServices.map(s => s.id === tmpl.id ? { ...s, price: newPrice } : s))
                              }}
                              style={{
                                width: 70,
                                padding: '4px 8px',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                fontSize: 12,
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                textAlign: 'center',
                                outline: 'none',
                              }}
                            />
                            <span style={{ fontSize: 11, color: '#6b7280' }}>د.ك</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Custom services addition */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  {customServices.map((cs, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="اسم الخدمة المخصصة (مثال: فحص تسريب زيت...)"
                        value={cs.label}
                        onChange={(e) => {
                          const updated = [...customServices]
                          updated[idx].label = e.target.value
                          setCustomServices(updated)
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          fontSize: 12.5,
                          outline: 'none',
                        }}
                        required
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="السعر"
                          value={cs.price}
                          onChange={(e) => {
                            const updated = [...customServices]
                            updated[idx].price = parseFloat(e.target.value) || 0
                            setCustomServices(updated)
                          }}
                          style={{
                            width: 80,
                            padding: '8px 8px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            textAlign: 'center',
                            outline: 'none',
                          }}
                          required
                        />
                        <span style={{ fontSize: 11, color: '#6b7280' }}>د.ك</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomServices(customServices.filter((_, i) => i !== idx))}
                        style={{
                          background: '#fef2f2',
                          border: 'none',
                          color: '#ef4444',
                          padding: '8px 10px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setCustomServices([...customServices, { label: '', price: 0 }])}
                    style={{
                      alignSelf: 'flex-start',
                      background: '#f5f3ff',
                      border: '1px dashed #c7d2fe',
                      color: '#4f46e5',
                      padding: '6px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: 4,
                      outline: 'none',
                    }}
                  >
                    ➕ إضافة خدمة مخصصة أخرى
                  </button>
                </div>
              </div>

              {/* Grid: Branch and Expected Delivery */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>الفرع</label>
                  <select
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 13,
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  >
                    <option value="">اختر الفرع</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr || b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>تاريخ تسليم متوقع</label>
                  <input
                    type="datetime-local"
                    value={form.estimatedReadyAt}
                    onChange={(e) => setForm({ ...form, estimatedReadyAt: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 13,
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>
              </div>

              {/* Grid: Priority & Mileage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>الأولوية</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 13,
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="LOW">منخفض</option>
                    <option value="NORMAL">عادي</option>
                    <option value="HIGH">مرتفع</option>
                    <option value="URGENT">عاجل جداً</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>قراءة العداد عند الاستلام</label>
                  <input
                    type="number"
                    value={form.mileageAtReception}
                    onChange={(e) => setForm({ ...form, mileageAtReception: e.target.value })}
                    placeholder="مثال: 50000"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 13,
                      color: '#1e293b',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Complaints */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#4b5563' }}>شكاوى العميل (بالعربية)</label>
                <textarea
                  value={form.customerComplaintsAr}
                  onChange={(e) => setForm({ ...form, customerComplaintsAr: e.target.value })}
                  placeholder="اكتب شكاوى وأعراض المشاكل التي يذكرها العميل..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 13,
                    color: '#1e293b',
                    outline: 'none',
                    height: 70,
                    boxSizing: 'border-box',
                    resize: 'none',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #eeeff4', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: 'none',
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)',
                  }}
                >
                  إنشاء كرت العمل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
