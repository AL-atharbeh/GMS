'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import api from '@/lib/api'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

interface WorkOrder {
  id: string
  orderNumber: string
  status: string
  priority: string
  vehicle: { plateNumber: string; make: string; model: string; year?: number; chassisNumber?: string }
  customer: { name: string; phone: string; email?: string } | null
  receivedAt: string
  estimatedReadyAt?: string
  customerComplaintsAr?: string
  internalNotes?: string
  totalAmount: number
  laborCost: number
  partsCost: number
  taxAmount: number
  trackingToken: string
  approvalToken: string
  workOrderItems: Array<{
    id: string
    type: 'LABOR' | 'PART'
    description: string
    descriptionAr?: string
    quantity: number
    unitPrice: number
    costPrice: number
    totalPrice: number
    isApproved: boolean
  }>
  statusHistory: Array<{
    id: string
    fromStatus?: string
    toStatus: string
    notes?: string
    createdAt: string
  }>
  taskAssignments: Array<{
    id: string
    specialty: string
    status: string
    estimatedHours: number
    startedAt?: string
    completedAt?: string
    notes?: string
    technician: {
      user: {
        name: string
      }
    }
  }>
  photos: Array<{
    id: string
    url: string
    type: string
    caption?: string
    capturedAt: string
  }>
  qualityChecks: Array<{
    id: string
    isPassed: boolean | null
    failureReason?: string
    notes?: string
    checkedAt: string
    items: Array<{
      id: string
      isPassed: boolean
      notes?: string
      templateItem: { name: string; nameAr?: string; category?: string; isRequired: boolean }
    }>
  }>
}

const STATUS_FLOW = [
  'RECEIVED', 'DIAGNOSING', 'QUOTED', 'AWAITING_APPROVAL',
  'APPROVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY_FOR_DELIVERY',
  'DELIVERED', 'CANCELLED',
]

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RECEIVED:           { label: 'تم الاستلام',      color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  DIAGNOSING:         { label: 'قيد التشخيص',      color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  QUOTED:             { label: 'عرض السعر جاهز',   color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe' },
  AWAITING_APPROVAL:  { label: 'بانتظار موافقة العميل', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  APPROVED:           { label: 'موافق عليه للعمل',   color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  IN_PROGRESS:        { label: 'قيد العمل والإصلاح', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  QUALITY_CHECK:      { label: 'فحص الجودة النهائي', color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
  READY_FOR_DELIVERY: { label: 'جاهزة للتسليم للعميل', color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  DELIVERED:          { label: 'تم التسليم والمغادرة', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  CANCELLED:          { label: 'ملغي',              color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

export default function WorkOrderDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { tenant, user } = useAuthStore()
  const id = params.id as string

  const [order, setOrder] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusNotes, setStatusNotes] = useState('')

  // Add Item states
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState({
    type: 'LABOR' as 'LABOR' | 'PART',
    description: '',
    descriptionAr: '',
    quantity: 1,
    unitPrice: 0,
    costPrice: 0,
  })

  // Assign Technician states
  const [showAssignTech, setShowAssignTech] = useState(false)
  const [technicians, setTechnicians] = useState<any[]>([])
  const [taskForm, setTaskForm] = useState({
    technicianId: '',
    specialty: 'MECHANICAL',
    estimatedHours: 1,
    notes: '',
  })

  // Photo upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoForm, setPhotoForm] = useState({
    type: 'RECEPTION',
    caption: '',
  })

  // Invoicing & Payment states
  const [invoice, setInvoice] = useState<any>(null)
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: 'CASH',
    transactionReference: '',
  })
  const [printingQr, setPrintingQr] = useState(false)

  useEffect(() => {
    fetchOrder()
    fetchInvoice()
  }, [id])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/work-orders/${id}`)
      setOrder(res.data.data)
    } catch (err) {
      console.error(err)
      router.push('/work-orders')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoices/work-order/${id}`)
      setInvoice(res.data.data)
      if (res.data.data) {
        setPaymentForm((prev) => ({ ...prev, amount: Number(res.data.data.remainingAmount) }))
      }
    } catch (err) {
      setInvoice(null)
    }
  }

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(`/invoices/work-order/${id}`, {
        discountAmount: Number(discountAmount),
        notes: invoiceNotes,
      })
      setShowCreateInvoice(false)
      fetchInvoice()
      fetchOrder()
    } catch (err) {
      alert('فشل إصدار الفاتورة')
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return
    try {
      await api.post(`/invoices/${invoice.id}/payments`, {
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        transactionReference: paymentForm.transactionReference || undefined,
      })
      setShowPaymentModal(false)
      fetchInvoice()
      fetchOrder()
    } catch (err) {
      alert('فشل تسجيل الدفعة')
    }
  }

  const loadTechnicians = async () => {
    try {
      const res = await api.get('/technicians')
      setTechnicians(res.data.data || [])
      if (res.data.data?.length > 0) {
        setTaskForm((prev) => ({ ...prev, technicianId: res.data.data[0].id }))
      }
    } catch (err) {
      console.error('Error loading technicians', err)
    }
  }

  const handleOpenAssignTech = () => {
    loadTechnicians()
    setShowAssignTech(true)
  }

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskForm.technicianId) {
      alert('الرجاء اختيار فني')
      return
    }
    try {
      await api.post(`/work-orders/${id}/tasks`, {
        ...taskForm,
        estimatedHours: Number(taskForm.estimatedHours),
      })
      setShowAssignTech(false)
      setTaskForm({
        technicianId: '',
        specialty: 'MECHANICAL',
        estimatedHours: 1,
        notes: '',
      })
      fetchOrder()
    } catch (err) {
      alert('فشل إسناد المهمة للفني')
    }
  }

  const handleUpdateStatus = async (nextStatus: string) => {
    try {
      await api.patch(`/work-orders/${id}/status`, {
        status: nextStatus,
        notes: statusNotes,
      })
      setStatusNotes('')
      fetchOrder()
    } catch (err: any) {
      alert(err.response?.data?.message || 'خطأ في الانتقال للحالة المطلوبة')
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post(`/work-orders/${id}/items`, {
        items: [
          {
            ...itemForm,
            description: itemForm.descriptionAr || itemForm.description || 'Item',
            quantity: Number(itemForm.quantity),
            unitPrice: Number(itemForm.unitPrice),
            costPrice: Number(itemForm.costPrice),
          },
        ],
      })
      setShowAddItem(false)
      setItemForm({
        type: 'LABOR',
        description: '',
        descriptionAr: '',
        quantity: 1,
        unitPrice: 0,
        costPrice: 0,
      })
      fetchOrder()
    } catch (err) {
      alert('فشل إضافة البند')
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      try {
        setUploadingPhoto(true)
        await api.post(`/work-orders/${id}/photos`, {
          photoData: reader.result,
          type: photoForm.type,
          caption: photoForm.caption || undefined,
        })
        setPhotoForm({ type: 'RECEPTION', caption: '' })
        fetchOrder()
      } catch (err) {
        alert('فشل رفع الصورة')
      } finally {
        setUploadingPhoto(false)
      }
    }
  }

  const handlePrintQr = async () => {
    try {
      setPrintingQr(true)
      const res = await api.get(`/work-orders/${id}/qrcode`)
      const { orderNumber, vehicle, qrDataUrl } = res.data.data
      const printWindow = window.open('', '_blank', 'width=400,height=500')
      if (!printWindow) return
      printWindow.document.write(`
        <html>
          <head>
            <title>QR - ${orderNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 24px; direction: rtl; }
              .order-number { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
              .vehicle { font-size: 14px; color: #4b5563; margin-bottom: 16px; }
              img { width: 220px; height: 220px; }
            </style>
          </head>
          <body onload="window.print()">
            <div class="order-number">${orderNumber}</div>
            <div class="vehicle">${vehicle.make} ${vehicle.model} — ${vehicle.plateNumber}</div>
            <img src="${qrDataUrl}" alt="QR Code" />
          </body>
        </html>
      `)
      printWindow.document.close()
    } catch (err) {
      alert('فشل توليد QR')
    } finally {
      setPrintingQr(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa' }}>
        <Sidebar />
        <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar title="تفاصيل الطلب" subtitle="جاري التحميل..." />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingBottom: 40 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>جاري تحميل بيانات كرت العمل...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!order) return null

  const trackingLink = `${window.location.origin}/track/${order.trackingToken}`
  
  // WhatsApp Share Link
  const whatsAppText = `مرحباً ${order.customer?.name || 'العميل الكريم'}، يرجى مراجعة كشف تكلفة ومراحل صيانة سيارتك والموافقة لبدء العمل عبر الرابط المباشر التالي: ${trackingLink}`
  const whatsAppLink = `https://api.whatsapp.com/send?phone=${order.customer?.phone}&text=${encodeURIComponent(whatsAppText)}`

  const nextStatuses = STATUS_FLOW.slice(STATUS_FLOW.indexOf(order.status) + 1).slice(0, 2)
  const isManagerOrOwner = user?.role === 'GARAGE_OWNER' || user?.role === 'BRANCH_MANAGER' || user?.role === 'ACCOUNTANT'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f6fa', direction: 'rtl' }}>
      <Sidebar />
      <div className="page-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopBar
          title={`طلب خدمة #${order.orderNumber}`}
          subtitle="تعديل وتحديث تفاصيل وتكلفة تذكرة الصيانة"
          actions={
            <div style={{ display: 'flex', gap: 10 }}>
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#10b981',
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
                  boxShadow: '0 2px 8px rgba(16,185,129,0.2)',
                  textDecoration: 'none',
                }}
              >
                <span>💬</span>
                <span>إرسال موافقة العرض عبر واتساب</span>
              </a>
              <button
                onClick={() => window.print()}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  outline: 'none',
                }}
              >
                <span>🖨️</span>
                <span>طباعة كرت العمل</span>
              </button>
              <button
                onClick={handlePrintQr}
                disabled={printingQr}
                style={{
                  background: '#ffffff',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: printingQr ? 'not-allowed' : 'pointer',
                  opacity: printingQr ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  outline: 'none',
                }}
              >
                <span>🖨️</span>
                <span>{printingQr ? 'جاري التحضير...' : 'طباعة QR'}</span>
              </button>
            </div>
          }
        />

        <div style={{ padding: '24px 28px', flex: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Work Details & Items */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Info Grid */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>السيارة</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 4 }}>
                  {order.vehicle?.make} {order.vehicle?.model}
                </div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#4f46e5', marginTop: 2 }}>
                  {order.vehicle?.plateNumber}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>العميل</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 4 }}>
                  {order.customer?.name || '—'}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {order.customer?.phone}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>تاريخ الاستلام</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginTop: 4 }}>
                  {new Date(order.receivedAt).toLocaleDateString('ar-KW')}
                </div>
              </div>

              <div>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>تاريخ تسليم متوقع</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e53e3e', marginTop: 4 }}>
                  {order.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleDateString('ar-KW') : 'لم يحدد'}
                </div>
              </div>
            </div>

            {/* Complaints */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>📋 شكاوى العميل وأعراض الأعطال</h3>
              <p style={{ fontSize: 13, background: '#f9fafb', padding: '12px 16px', borderRadius: 10, color: '#4b5563', border: '1px solid #f3f4f6', margin: 0, whiteSpace: 'pre-wrap' }}>
                {order.customerComplaintsAr || 'لم يتم تسجيل شكاوى محددة'}
              </p>
            </div>

            {/* Billing / Cost breakdown Items */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>💰 البنود (القطع والأجور)</h3>
                <button
                  onClick={() => setShowAddItem(true)}
                  style={{
                    background: '#f5f3ff',
                    border: '1px solid #e0e7ff',
                    color: '#4f46e5',
                    padding: '4px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ➕ إضافة بند
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                      {['النوع', 'الوصف', 'الكمية', 'سعر البيع', isManagerOrOwner ? 'تكلفة الشراء' : '', 'السعر الكلي', 'موافق عليه'].filter(Boolean).map((h, i) => (
                        <th key={i} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textAlign: 'right' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {order.workOrderItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                          لا توجد بنود مضافة لهذا الطلب.
                        </td>
                      </tr>
                    ) : (
                      order.workOrderItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: idx < order.workOrderItems.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: item.type === 'PART' ? '#eff6ff' : '#faf5ff',
                                color: item.type === 'PART' ? '#2563eb' : '#7c3aed',
                                border: `1px solid ${item.type === 'PART' ? '#bfdbfe' : '#ddd6fe'}`,
                              }}
                            >
                              {item.type === 'PART' ? 'قطعة غيار' : 'أجور يد'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                              {item.descriptionAr || item.description}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#4b5563', fontFamily: 'monospace' }}>
                            {item.quantity}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: '#4b5563', fontFamily: 'monospace' }}>
                            {Number(item.unitPrice).toFixed(3)}
                          </td>
                          {isManagerOrOwner && (
                            <td style={{ padding: '12px 16px', fontSize: 12, color: '#b45309', fontFamily: 'monospace' }}>
                              {Number(item.costPrice || 0).toFixed(3)}
                            </td>
                          )}
                          <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                            {Number(item.totalPrice).toFixed(3)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: item.isApproved ? '#16a34a' : '#ea580c',
                              }}
                            >
                              {item.isApproved ? '✅ معتمد' : '⏳ معلق'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation Display */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  fontSize: 12.5,
                  borderTop: '1px solid #f3f4f6',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>إجمالي القطع</span>
                  <span style={{ fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{Number(order.partsCost).toFixed(3)} د.ك</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>إجمالي أجور اليد</span>
                  <span style={{ fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{Number(order.laborCost).toFixed(3)} د.ك</span>
                </div>
                
                {/* Financial intelligence margin tracking */}
                {isManagerOrOwner && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #f3f4f6', paddingTop: 6, marginTop: 4 }}>
                    <span style={{ color: '#9ca3af' }}>الهامش المالي المتوقع (الربح)</span>
                    <span style={{ fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                      {Number(order.totalAmount - (order.workOrderItems.reduce((acc, curr) => acc + (Number(curr.costPrice) * curr.quantity), 0))).toFixed(3)} د.ك
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: 10, fontSize: 14, fontWeight: 700 }}>
                  <span style={{ color: '#111827' }}>المجموع الكلي المعتمد</span>
                  <span style={{ color: '#4f46e5', fontWeight: 800, fontFamily: 'monospace' }}>{Number(order.totalAmount).toFixed(3)} د.ك</span>
                </div>
              </div>
            </div>

            {/* Photos & Attachments upload card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>📸 الصور المرفقة لطلب الصيانة</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: 10, alignItems: 'center', marginBottom: 16, borderBottom: '1px dashed #f3f4f6', paddingBottom: 16 }}>
                <select
                  value={photoForm.type}
                  onChange={(e) => setPhotoForm({ ...photoForm, type: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 12,
                    outline: 'none',
                  }}
                >
                  <option value="RECEPTION">عند الاستلام (Intake)</option>
                  <option value="DIAGNOSIS">أثناء التشخيص</option>
                  <option value="COMPLETION">بعد انتهاء العمل</option>
                  <option value="DEFECT">عطل/تلف موثق</option>
                </select>

                <input
                  type="text"
                  placeholder="وصف أو تعليق على الصورة..."
                  value={photoForm.caption}
                  onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />

                <label
                  style={{
                    background: '#f3f4f6',
                    color: '#4b5563',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                    opacity: uploadingPhoto ? 0.6 : 1,
                  }}
                >
                  {uploadingPhoto ? 'جاري الرفع...' : '📁 اختر وارفع صورة'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                    disabled={uploadingPhoto}
                  />
                </label>
              </div>

              {order.photos && order.photos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {order.photos.map((photo) => (
                    <div key={photo.id} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f5', background: '#fafafa' }}>
                      <img src={photo.url} alt="Work Order" style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                      <div style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, color: '#4b5563', textAlign: 'center' }}>
                        {photo.type === 'RECEPTION' ? 'عند الاستلام' : 'أثناء الصيانة'} {photo.caption ? `- ${photo.caption}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', paddingTop: 10, paddingBottom: 10, fontSize: 11.5, color: '#9ca3af' }}>لا توجد صور مرفقة حالياً</div>
              )}
            </div>

            {/* Quality Check */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>✅ فحص الجودة</h3>

              {order.qualityChecks && order.qualityChecks.length > 0 ? (
                (() => {
                  const qc = order.qualityChecks[0]
                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: qc.items.length > 0 ? 14 : 0 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '4px 12px',
                            borderRadius: 20,
                            color: qc.isPassed === true ? '#16a34a' : qc.isPassed === false ? '#dc2626' : '#6b7280',
                            background: qc.isPassed === true ? '#f0fdf4' : qc.isPassed === false ? '#fef2f2' : '#f9fafb',
                            border: `1px solid ${qc.isPassed === true ? '#bbf7d0' : qc.isPassed === false ? '#fecaca' : '#e5e7eb'}`,
                          }}
                        >
                          {qc.isPassed === true ? '✅ الجودة مكتملة وناجحة' : qc.isPassed === false ? '❌ الجودة لم تجتز الفحص' : '⏳ بانتظار نتيجة الفحص'}
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {new Date(qc.checkedAt).toLocaleString('ar-KW')}
                        </span>
                      </div>

                      {qc.items.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {qc.items.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: '#fafafa',
                                border: '1px solid #f0f0f5',
                              }}
                            >
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                                  {item.templateItem.nameAr || item.templateItem.name}
                                </span>
                                {item.templateItem.isRequired && (
                                  <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, marginRight: 6 }}>إجباري *</span>
                                )}
                              </div>
                              <span style={{ fontSize: 13 }}>{item.isPassed ? '✅' : '❌'}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {qc.notes && (
                        <p style={{ fontSize: 11.5, color: '#6b7280', marginTop: 12, marginBottom: 0 }}>📝 {qc.notes}</p>
                      )}
                    </>
                  )
                })()
              ) : (
                <div style={{ textAlign: 'center', paddingTop: 10, paddingBottom: 10, fontSize: 11.5, color: '#9ca3af' }}>لم يتم إجراء فحص الجودة بعد</div>
              )}
            </div>

          </div>

          {/* Sidebar Status & Action Timeline */}
          <div className="space-y-6">
            
            {/* Assigned Technicians */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>👨‍🔧 الفنيون المسندون</h3>
                <button
                  onClick={handleOpenAssignTech}
                  style={{
                    background: '#f5f3ff',
                    border: '1px solid #e0e7ff',
                    color: '#4f46e5',
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ➕ إسناد فني
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {order.taskAssignments?.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af', paddingTop: 4, paddingBottom: 4 }}>لا يوجد فنيون مسندون حالياً للعمل</div>
                ) : (
                  order.taskAssignments?.map((assign) => (
                    <div key={assign.id} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #f0f0f5', background: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{assign.technician?.user?.name}</span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: assign.status === 'COMPLETED' ? '#f0fdf4' : assign.status === 'IN_PROGRESS' ? '#f0f9ff' : '#fff7ed',
                            color: assign.status === 'COMPLETED' ? '#16a34a' : assign.status === 'IN_PROGRESS' ? '#0284c7' : '#ea580c',
                            border: `1px solid ${assign.status === 'COMPLETED' ? '#bbf7d0' : assign.status === 'IN_PROGRESS' ? '#bae6fd' : '#fed7aa'}`,
                          }}
                        >
                          {assign.status === 'PENDING' ? 'قيد الانتظار' : assign.status === 'IN_PROGRESS' ? 'قيد التنفيذ' : 'اكتمل'}
                        </span>
                      </div>
                      
                      {/* Work timestamps */}
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div>التخصص: {assign.specialty === 'MECHANICAL' ? 'ميكانيكا' :
                                      assign.specialty === 'ELECTRICAL' ? 'كهرباء' :
                                      assign.specialty === 'AC_SYSTEM' ? 'تكييف' : 'صيانة عامة'}</div>
                        {assign.startedAt && (
                          <div>⏱️ بدأ: {new Date(assign.startedAt).toLocaleTimeString('ar-KW')}</div>
                        )}
                        {assign.completedAt && (
                          <div>🏁 انتهى: {new Date(assign.completedAt).toLocaleTimeString('ar-KW')}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Invoicing Panel */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>🧾 الفاتورة والتحصيل المالي</h3>
              {!invoice ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                    لم يتم إصدار فاتورة نهائية لهذا الطلب بعد. يمكنك إغلاق الحساب وإصدارها الآن.
                  </p>
                  <button
                    onClick={() => setShowCreateInvoice(true)}
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    🧾 إصدار الفاتورة النهائية
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                    <span style={{ color: '#9ca3af' }}>رقم الفاتورة</span>
                    <span style={{ fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{invoice.invoiceNumber}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#9ca3af' }}>إجمالي الفاتورة</span>
                    <span style={{ fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>
                      {Number(invoice.total).toFixed(3)} {tenant?.currency || 'KWD'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: '#9ca3af' }}>المبلغ المدفوع</span>
                    <span style={{ fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                      {Number(invoice.paidAmount).toFixed(3)} {tenant?.currency || 'KWD'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: '1px solid #f3f4f6', paddingTop: 8, fontWeight: 700 }}>
                    <span style={{ color: '#111827' }}>المتبقي المطلوب</span>
                    <span style={{ color: '#ea580c', fontFamily: 'monospace' }}>
                      {Number(invoice.remainingAmount).toFixed(3)} {tenant?.currency || 'KWD'}
                    </span>
                  </div>

                  <div style={{ paddingTop: 8 }}>
                    {invoice.status === 'PAID' ? (
                      <span style={{ display: 'block', textAlign: 'center', paddingTop: 6, paddingBottom: 6, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', fontSize: 11.5, fontWeight: 700 }}>
                        ✅ مدفوعة بالكامل
                      </span>
                    ) : (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        style={{
                          width: '100%',
                          background: '#4f46e5',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        💵 تسجيل دفعة مالية
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Manager */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>⚙️ إدارة مرحلة العمل</h3>
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>الحالة الحالية:</span>
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 11,
                      fontWeight: 700,
                      color: STATUS_LABELS[order.status]?.color,
                      background: STATUS_LABELS[order.status]?.bg,
                      border: `1px solid ${STATUS_LABELS[order.status]?.border}`,
                      borderRadius: 999,
                      padding: '3px 12px',
                    }}
                  >
                    {STATUS_LABELS[order.status]?.label}
                  </span>
                </div>
              </div>

              {/* Next statuses triggers */}
              {nextStatuses.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: '#374151' }}>ملاحظات تغيير الحالة (اختياري)</label>
                  <input
                    type="text"
                    placeholder="سبب أو تفاصيل تغيير الحالة..."
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                    {nextStatuses.map((next) => (
                      <button
                        key={next}
                        onClick={() => handleUpdateStatus(next)}
                        style={{
                          background: '#f0fdf4',
                          border: `1px solid #bbf7d0`,
                          color: '#16a34a',
                          padding: '8px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>تغيير الحالة إلى: {STATUS_LABELS[next]?.label}</span>
                        <span>←</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Timeline log */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #f0f0f5',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>🕒 سجل التحديثات والجدول الزمني</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {order.statusHistory.map((history) => (
                  <div key={history.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f46e5', flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>
                        {STATUS_LABELS[history.toStatus]?.label || history.toStatus}
                      </div>
                      {history.notes && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          {history.notes}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>
                        {new Date(history.createdAt).toLocaleString('ar-KW')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-md" style={{ direction: 'rtl', borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>إضافة بند للطلب</h3>
              <button
                onClick={() => setShowAddItem(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', outline: 'none' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>نوع البند</label>
                <select
                  value={itemForm.type}
                  onChange={(e) => setItemForm({ ...itemForm, type: e.target.value as any })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                >
                  <option value="LABOR">أجور يد صيانة</option>
                  <option value="PART">قطعة غيار</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>اسم البند (بالعربية)</label>
                <input
                  type="text"
                  placeholder="مثال: تبديل فلتر زيت، سفايف أمامية..."
                  value={itemForm.descriptionAr}
                  onChange={(e) => setItemForm({ ...itemForm, descriptionAr: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>الكمية</label>
                  <input
                    type="number"
                    min="1"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>سعر البيع</label>
                  <input
                    type="number"
                    step="0.001"
                    value={itemForm.unitPrice}
                    onChange={(e) => setItemForm({ ...itemForm, unitPrice: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>تكلفة الشراء</label>
                  <input
                    type="number"
                    step="0.001"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 700 }}
                >
                  إضافة البند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Technician Modal */}
      {showAssignTech && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-md" style={{ direction: 'rtl', borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>إسناد مهمة لفني</h3>
              <button
                onClick={() => setShowAssignTech(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', outline: 'none' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>الفني</label>
                <select
                  value={taskForm.technicianId}
                  onChange={(e) => setTaskForm({ ...taskForm, technicianId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  required
                >
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.user.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>التخصص للمهمة</label>
                <select
                  value={taskForm.specialty}
                  onChange={(e) => setTaskForm({ ...taskForm, specialty: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                >
                  <option value="MECHANICAL">ميكانيكا</option>
                  <option value="ELECTRICAL">كهرباء</option>
                  <option value="AC_SYSTEM">تكييف</option>
                  <option value="BODYWORK">حدادة وسمكرة</option>
                  <option value="PAINTING">صبغ ودوكو</option>
                  <option value="TIRES">إطارات وميزان</option>
                  <option value="GENERAL">صيانة عامة</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>الوقت المتوقع (بالساعات)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={taskForm.estimatedHours}
                  onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: parseFloat(e.target.value) || 1 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>ملاحظات العمل</label>
                <textarea
                  placeholder="أدخل أي ملاحظات صيانة محددة للفني..."
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, height: 60, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignTech(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 700 }}
                >
                  إسناد المهمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateInvoice && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-sm" style={{ direction: 'rtl', borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>إصدار الفاتورة النهائية</h3>
              <button
                onClick={() => setShowCreateInvoice(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', outline: 'none' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>الخصم الإضافي (اختياري)</label>
                <input
                  type="number"
                  step="0.001"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>ملاحظات الفاتورة</label>
                <textarea
                  placeholder="شروط الضمان أو ملاحظات إضافية للفاتورة..."
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, height: 60, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateInvoice(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700 }}
                >
                  إصدار الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-content p-6 max-w-sm" style={{ direction: 'rtl', borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-5">
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>تحصيل دفعة مالية</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', outline: 'none' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>المبلغ المدفوع</label>
                <input
                  type="number"
                  step="0.001"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>طريقة الدفع</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                >
                  <option value="CASH">نقدًا (Cash)</option>
                  <option value="KNET">كي نت (Knet)</option>
                  <option value="CARD">بطاقة ائتمانية (Visa/Master)</option>
                  <option value="BANK_TRANSFER">تحويل بنكي</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>رقم مرجع المعاملة (اختياري)</label>
                <input
                  type="text"
                  placeholder="رقم العملية البنكية..."
                  value={paymentForm.transactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600 }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 700 }}
                >
                  تسجيل الدفع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
